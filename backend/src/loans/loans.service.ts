import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { attachArrears } from '../collections/daily-collection';
import { uaeCalendarDay } from '../collections/uae-day';
import { retryPrisma } from '../common/prisma-retry';
import { resolveLoanAmounts } from './loan-plans';
import { loanCycle } from './loan-balance';
import { UpdateLoanPlanDto } from './dto/update-loan-plan.dto';
import { RenewPlanDto } from './dto/renew-plan.dto';
import {
  RENEW_CASH_PURPOSE,
  RENEW_OUTSTANDING_PURPOSE,
  remainingCash,
  samePlanRenewalPayout,
} from './renew-plan';
import { closeoutWallet } from './closeout-wallet';

@Injectable()
export class LoansService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async findAll(status?: string) {
    await this.purgeEmptyDuplicateActives();
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

  /** Keep one open plan per person; drop unused extra 0-collection copies. */
  private async purgeEmptyDuplicateActives() {
    const actives = await this.prisma.loan.findMany({
      where: { status: 'ACTIVE' },
      orderBy: { openedAt: 'desc' },
      select: {
        id: true,
        customerId: true,
        amountCollected: true,
        _count: { select: { repayments: true } },
      },
    });
    const seen = new Set<string>();
    const extraIds: string[] = [];
    for (const row of actives) {
      if (!seen.has(row.customerId)) {
        seen.add(row.customerId);
        continue;
      }
      if (Number(row.amountCollected) <= 0.001 && row._count.repayments === 0) {
        extraIds.push(row.id);
      }
    }
    if (!extraIds.length) return;
    await this.prisma.notification.deleteMany({
      where: { loanId: { in: extraIds } },
    });
    await this.prisma.loan.deleteMany({ where: { id: { in: extraIds } } });
  }

  async remove(id: string, userId: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, customerCode: true } },
        _count: { select: { repayments: true } },
      },
    });
    if (!loan) throw new NotFoundException('Record not found');

    await this.prisma.$transaction(async (tx) => {
      await tx.repayment.deleteMany({ where: { loanId: loan.id } });
      await tx.notification.deleteMany({ where: { loanId: loan.id } });
      await tx.loan.delete({ where: { id: loan.id } });
    });

    await this.audit.log({
      userId,
      action: 'LOAN_DELETE',
      recordType: 'loan',
      recordId: loan.id,
      metadata: {
        customerId: loan.customerId,
        customerCode: loan.customer.customerCode,
        name: loan.customer.name,
        status: loan.status,
        collected: Number(loan.amountCollected),
        remaining: Number(loan.remainingAmount),
        repaymentCount: loan._count.repayments,
      },
    });

    return { ok: true, id: loan.id };
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
   * Continue the same person on the existing loan row.
   * Outstanding is deducted from the wallet and stored as petty-cash paid out.
   */
  async renew(customerId: string, dto: RenewPlanDto, userId: string) {
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
          const extras = active.slice(1).filter(
            (l) => Number(l.amountCollected) <= 0.001,
          );
          if (extras.length) {
            const extraIds = extras.map((l) => l.id);
            await tx.notification.deleteMany({
              where: { loanId: { in: extraIds } },
            });
            await tx.loan.deleteMany({ where: { id: { in: extraIds } } });
          }
          const current =
            active.find((l) => !extras.some((x) => x.id === l.id)) ??
            loans[0] ??
            null;

          const outstanding = remainingCash(
            Number(current?.remainingAmount || 0),
          );
          const payout = samePlanRenewalPayout({
            outstanding,
            newPrincipal: principal,
            payNewCash: recordCashGiven,
          });
          const paidTo = `${customer.customerCode} · ${customer.name}`;
          const spentOn = uaeCalendarDay();

          if (payout.pettyCashOutstanding > 0) {
            await tx.pettyCashExpense.create({
              data: {
                amount: new Prisma.Decimal(payout.pettyCashOutstanding),
                spentOn,
                purpose: dto.notes?.trim()
                  ? `${RENEW_OUTSTANDING_PURPOSE} · ${dto.notes.trim()}`
                  : RENEW_OUTSTANDING_PURPOSE,
                paidToName: paidTo,
                customerId: customer.id,
                recordedById: userId,
              },
            });
          }

          const nextCycle = current ? loanCycle(current.cycle) + 1 : 1;
          const loan = current
            ? await tx.loan.update({
                where: { id: current.id },
                data: {
                  principalAmount: new Prisma.Decimal(principal),
                  dailyPayment: new Prisma.Decimal(daily),
                  totalPayable: new Prisma.Decimal(totalPayable),
                  remainingAmount: new Prisma.Decimal(totalPayable),
                  amountCollected: new Prisma.Decimal(0),
                  cycle: nextCycle,
                  status: 'ACTIVE',
                  openedAt: new Date(),
                  completedAt: null,
                  closedAt: null,
                },
              })
            : await tx.loan.create({
                data: {
                  customerId,
                  principalAmount: new Prisma.Decimal(principal),
                  dailyPayment: new Prisma.Decimal(daily),
                  totalPayable: new Prisma.Decimal(totalPayable),
                  remainingAmount: new Prisma.Decimal(totalPayable),
                  amountCollected: new Prisma.Decimal(0),
                  cycle: 1,
                  status: 'ACTIVE',
                },
              });

          if (payout.pettyCashNewCash > 0) {
            await tx.pettyCashExpense.create({
              data: {
                amount: new Prisma.Decimal(payout.pettyCashNewCash),
                spentOn,
                purpose: RENEW_CASH_PURPOSE,
                paidToName: paidTo,
                customerId: customer.id,
                recordedById: userId,
              },
            });
          }

          const paidAgg = await tx.repayment.aggregate({
            where: { loanId: loan.id, cycle: loan.cycle },
            _sum: { amount: true },
          });
          const collected = Number(paidAgg._sum.amount || 0);
          if (collected > 0.001) {
            throw new BadRequestException(
              'New cycle still has collections — account was not reset',
            );
          }

          return {
            customer,
            loan,
            outstandingSettled: payout.pettyCashOutstanding,
            cashGiven: payout.pettyCashNewCash,
            cycle: loan.cycle,
            wallet: closeoutWallet({
              collectedNow: 0,
              payoutPrincipal: payout.walletOut,
            }),
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
        planId: dto.planId,
        outstandingSettled: result.outstandingSettled,
        cashGiven: result.cashGiven,
        cycle: result.cycle,
        walletOut: result.wallet.walletOut,
      },
    });

    return {
      ok: true,
      customerId,
      loanId: result.loan.id,
      newLoanId: result.loan.id,
      planId: dto.planId,
      outstandingSettled: result.outstandingSettled,
      collectedToClose: 0,
      remainingClosed: 0,
      cashGiven: result.cashGiven,
      cycle: result.cycle,
      wallet: result.wallet,
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
