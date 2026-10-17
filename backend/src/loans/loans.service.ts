import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { attachArrears } from '../collections/daily-collection';
import { uaeCalendarDay } from '../collections/uae-day';
import { nextReceiptFromLatest, retryPrisma } from '../common/prisma-retry';
import { resolveLoanAmounts } from './loan-plans';
import { UpdateLoanPlanDto } from './dto/update-loan-plan.dto';
import { RenewPlanDto } from './dto/renew-plan.dto';
import { renewalSettlement } from './renew-plan';

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly crypto: FieldEncryptionService,
  ) {}

  async findAll(status?: string) {
    const rows = await this.prisma.loan.findMany({
      where: status ? { status: status as 'ACTIVE' | 'COMPLETED' | 'CLOSED' } : undefined,
      orderBy: { openedAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            name: true,
            phone: true,
          },
        },
      },
    });
    return rows.map((row) => attachArrears(row));
  }

  async findOne(id: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            name: true,
            phone: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
        repayments: {
          orderBy: { collectedAt: 'asc' },
          include: {
            collectedBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    return attachArrears(loan);
  }

  async updatePlan(loanId: string, dto: UpdateLoanPlanDto) {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot change plan on a closed record');
    }
    if (Number(loan.amountCollected) > 0) {
      throw new BadRequestException(
        'Cannot change plan after collections have started',
      );
    }

    const { principal, totalPayable, daily } = resolveLoanAmounts({
      planId: dto.planId,
      dailyPayment: dto.dailyPayment,
    });

    return this.prisma.loan.update({
      where: { id: loanId },
      data: {
        principalAmount: new Prisma.Decimal(principal),
        totalPayable: new Prisma.Decimal(totalPayable),
        remainingAmount: new Prisma.Decimal(totalPayable),
        dailyPayment: new Prisma.Decimal(daily),
      },
    });
  }

  /**
   * Close the current plan (collect leftover cash if any), then open a new plan
   * for the same person. Wallet: settlement is a collection; cash given is spend.
   */
  async renew(customerId: string, dto: RenewPlanDto, userId: string) {
    const settleRemaining = dto.settleRemaining !== false;
    const recordCashGiven = dto.recordCashGiven !== false;
    const { principal, totalPayable, daily } = resolveLoanAmounts({
      planId: dto.planId,
      dailyPayment: dto.dailyPayment,
    });

    const result = await retryPrisma(() =>
      this.prisma.$transaction(
        async (tx) => {
          const customer = await tx.customer.findUnique({
            where: { id: customerId },
            select: { id: true, name: true, customerCode: true },
          });
          if (!customer) throw new NotFoundException('Customer not found');

          const loans = await tx.loan.findMany({
            where: { customerId },
            orderBy: { openedAt: 'desc' },
          });
          const active = loans.filter((l) => l.status === 'ACTIVE');
          if (active.length > 1) {
            throw new BadRequestException(
              'This person already has more than one open plan',
            );
          }
          const current = active[0] ?? loans[0] ?? null;

          let collectedToClose = 0;
          let closedLoanId: string | null = null;
          let settlementReceipt: string | null = null;

          if (current?.status === 'ACTIVE') {
            const remaining = Number(current.remainingAmount);
            const step = renewalSettlement(remaining, settleRemaining);
            if (!step.ok) {
              throw new BadRequestException(step.error);
            }

            if (step.collect > 0) {
              const latest = await tx.repayment.findFirst({
                where: { receiptNumber: { startsWith: 'JB-RCP-' } },
                orderBy: { receiptNumber: 'desc' },
                select: { receiptNumber: true },
              });
              const receiptNumber = nextReceiptFromLatest(latest?.receiptNumber);
              const note = dto.notes?.trim()
                ? `Plan renewal · ${dto.notes.trim()}`
                : 'Collected remaining cash to close plan for renewal';
              await tx.repayment.create({
                data: {
                  loanId: current.id,
                  amount: new Prisma.Decimal(step.collect),
                  collectedById: userId,
                  notes: this.crypto.encryptOptional(note),
                  receiptNumber,
                },
              });
              collectedToClose = step.collect;
              settlementReceipt = receiptNumber;
            }

            const paidAgg = await tx.repayment.aggregate({
              where: { loanId: current.id },
              _sum: { amount: true },
            });
            const paid = Number(paidAgg._sum.amount || 0);
            const total = Math.max(
              Number(current.totalPayable),
              Number(current.principalAmount),
            );
            if (step.collect > 0 && paid + 0.001 < total) {
              throw new BadRequestException(
                `Still AED ${(total - paid).toFixed(2)} remaining. Collect it to renew.`,
              );
            }

            await tx.loan.update({
              where: { id: current.id },
              data: {
                amountCollected: new Prisma.Decimal(Math.max(paid, 0)),
                remainingAmount: new Prisma.Decimal(0),
                status: 'COMPLETED',
                completedAt: new Date(),
                closedAt: new Date(),
              },
            });
            closedLoanId = current.id;
          }

          const stillActive = await tx.loan.count({
            where: { customerId, status: 'ACTIVE' },
          });
          if (stillActive > 0) {
            throw new BadRequestException(
              'Close the current plan before opening a new one',
            );
          }

          const loan = await tx.loan.create({
            data: {
              customerId,
              principalAmount: new Prisma.Decimal(principal),
              dailyPayment: new Prisma.Decimal(daily),
              totalPayable: new Prisma.Decimal(totalPayable),
              remainingAmount: new Prisma.Decimal(totalPayable),
              amountCollected: new Prisma.Decimal(0),
              status: 'ACTIVE',
            },
          });

          if (recordCashGiven && principal > 0) {
            await tx.pettyCashExpense.create({
              data: {
                amount: new Prisma.Decimal(principal),
                spentOn: uaeCalendarDay(),
                purpose: 'Plan renewal — cash paid to customer',
                paidToName: `${customer.customerCode} · ${customer.name}`,
                customerId: customer.id,
                recordedById: userId,
              },
            });
          }

          return {
            customer,
            loan,
            closedLoanId,
            collectedToClose,
            settlementReceipt,
            cashGiven: recordCashGiven ? principal : 0,
          };
        },
        { maxWait: 10_000, timeout: 25_000 },
      ),
    );

    await this.audit.log({
      userId,
      action: 'PLAN_RENEWED',
      recordType: 'loan',
      recordId: result.loan.id,
      metadata: {
        customerId,
        closedLoanId: result.closedLoanId,
        planId: dto.planId,
        collectedToClose: result.collectedToClose,
        cashGiven: result.cashGiven,
        settlementReceipt: result.settlementReceipt,
      },
    });

    return {
      ok: true,
      customerId,
      closedLoanId: result.closedLoanId,
      newLoanId: result.loan.id,
      planId: dto.planId,
      collectedToClose: result.collectedToClose,
      remainingClosed: 0,
      cashGiven: result.cashGiven,
      settlementReceipt: result.settlementReceipt,
      newPlan: {
        principal,
        totalPayable,
        dailyPayment: daily,
        remaining: totalPayable,
        status: 'ACTIVE' as const,
      },
    };
  }
}
