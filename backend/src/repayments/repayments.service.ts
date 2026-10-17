import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import {
  nextReceiptFromLatest,
  prismaErrorCode,
  retryPrisma,
} from '../common/prisma-retry';
import { loanBalanceFromCollected, loanCycle } from '../loans/loan-balance';
import { uaeDateTimeToInstant } from '../restore/uae-instant';

export interface RecordRepaymentInput {
  loanId: string;
  amount: number;
  collectorId: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  idempotencyKey?: string;
  collectedDate?: string;
  collectedTime?: string;
}

/**
 * Server-side repayment engine.
 * All balance math happens here inside a DB transaction.
 */
@Injectable()
export class RepaymentsService {
  private readonly logger = new Logger(RepaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly whatsapp: WhatsappService,
    private readonly crypto: FieldEncryptionService,
  ) {}

  private collectedAtFromInput(input: RecordRepaymentInput) {
    const date = String(input.collectedDate || '').trim();
    const time = String(input.collectedTime || '').trim().slice(0, 5);
    if (!date && !time) return new Date();
    if (!date || !time) {
      throw new BadRequestException('Set both the collection date and time');
    }
    try {
      const at = uaeDateTimeToInstant(date, time);
      if (at.getTime() > Date.now() + 5 * 60_000) {
        throw new BadRequestException('Collection time cannot be in the future');
      }
      return at;
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid collection date or time',
      );
    }
  }

  async recordRepayment(input: RecordRepaymentInput) {
    if (input.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }
    const collectedAt = this.collectedAtFromInput(input);

    if (input.idempotencyKey) {
      const existing = await this.prisma.repayment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: {
          loan: { include: { customer: true } },
        },
      });
      if (existing) {
        return this.toResult(existing.loan, existing);
      }
    }

    let result;
    try {
    result = await retryPrisma(() =>
      this.prisma.$transaction(
        async (tx) => {
          const loan = await tx.loan.findUnique({
            where: { id: input.loanId },
            include: { customer: true },
          });
          if (!loan) throw new NotFoundException('Loan not found');
          if (loan.status === 'COMPLETED' || loan.status === 'CLOSED') {
            throw new ConflictException('Loan already completed');
          }

          const alreadyCollected = Number(loan.amountCollected);
          const total = Math.max(
            Number(loan.totalPayable),
            Number(loan.principalAmount),
          );
          if (alreadyCollected + input.amount > total + 0.001) {
            throw new BadRequestException(
              `Only AED ${(total - alreadyCollected).toFixed(2)} is needed to close this account`,
            );
          }

          const receiptNumber = await this.nextReceiptNumber(tx);
          const cycle = loanCycle(loan.cycle);

          const repayment = await tx.repayment.create({
            data: {
              loanId: input.loanId,
              cycle,
              amount: new Prisma.Decimal(input.amount),
              collectedById: input.collectorId,
              collectedAt,
              createdAt: collectedAt,
              latitude: input.latitude ?? null,
              longitude: input.longitude ?? null,
              notes: this.crypto.encryptOptional(input.notes),
              receiptNumber,
              idempotencyKey: input.idempotencyKey || null,
            },
          });

          const paidAgg = await tx.repayment.aggregate({
            where: { loanId: input.loanId, cycle },
            _sum: { amount: true },
          });
          const balance = loanBalanceFromCollected(
            Number(loan.totalPayable),
            Number(loan.principalAmount),
            Number(paidAgg._sum.amount || 0),
          );
          const completed = balance.status === 'COMPLETED';

          const updatedLoan = await tx.loan.update({
            where: { id: input.loanId },
            data: {
              amountCollected: new Prisma.Decimal(balance.collected),
              remainingAmount: new Prisma.Decimal(balance.remaining),
              status: completed ? 'COMPLETED' : 'ACTIVE',
              completedAt: completed ? new Date() : null,
              closedAt: completed ? new Date() : null,
            },
            include: { customer: true },
          });

          return {
            loan: updatedLoan,
            repayment,
            completed,
            customer: loan.customer,
          };
        },
        { maxWait: 10_000, timeout: 20_000 },
      ),
    );
    } catch (err) {
      if (input.idempotencyKey && prismaErrorCode(err) === 'P2002') {
        const existing = await this.prisma.repayment.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          include: { loan: { include: { customer: true } } },
        });
        if (existing) {
          return this.toResult(existing.loan, existing);
        }
      }
      throw err;
    }

    try {
      await this.audit.log({
        userId: input.collectorId,
        action: 'REPAYMENT_CREATE',
        recordType: 'repayment',
        recordId: result.repayment.id,
        metadata: {
          loanId: input.loanId,
          amount: input.amount,
          receiptNumber: result.repayment.receiptNumber,
        },
      });
    } catch (e) {
      this.logger.warn(
        `Audit log skipped after collection: ${e instanceof Error ? e.message : e}`,
      );
    }

    const amountPaid = Number(result.repayment.amount);
    const remaining = Number(result.loan.remainingAmount);
    const total = Math.max(
      Number(result.loan.totalPayable),
      Number(result.loan.principalAmount),
    );
    const customerName = result.customer.name;
    const collector = await this.prisma.user.findUnique({
      where: { id: input.collectorId },
      select: { name: true },
    });
    const collectorName = collector?.name || 'Staff';

    try {
      if (result.completed) {
        await this.notifications.createLoanCompleted(
          result.loan.customerId,
          result.loan.id,
          amountPaid,
          remaining,
          total,
          customerName,
          collectorName,
        );
        await this.audit.log({
          userId: input.collectorId,
          action: 'LOAN_COMPLETED',
          recordType: 'loan',
          recordId: result.loan.id,
        });
      } else {
        await this.notifications.createRepaymentReceived(
          result.loan.customerId,
          result.loan.id,
          amountPaid,
          remaining,
          total,
          customerName,
          collectorName,
        );
      }
    } catch (e) {
      this.logger.warn(
        `Collection notice skipped: ${e instanceof Error ? e.message : e}`,
      );
    }

    let whatsapp: {
      sent: boolean;
      deepLink: string | null;
      message?: string;
      configured?: boolean;
      provider?: string;
      error?: string;
    } = { sent: false, deepLink: null };

    try {
      const wa = await this.whatsapp.sendCollectionReceipt({
        customerName: result.customer.name,
        phone: result.customer.phone,
        amountPaid,
        remaining,
        principal: total,
        totalCollected: Number(result.loan.amountCollected),
        receiptNumber: result.repayment.receiptNumber,
        collectedAt: result.repayment.collectedAt,
        completed: result.completed,
      });
      whatsapp = {
        sent: wa.sent,
        deepLink: wa.deepLink,
        message: wa.message,
        configured: wa.configured,
        provider: wa.provider,
        error: wa.error,
      };
      if (wa.sent) {
        await this.audit.log({
          userId: input.collectorId,
          action: 'WHATSAPP_RECEIPT_SENT',
          recordType: 'repayment',
          recordId: result.repayment.id,
          metadata: { phoneDigits: wa.digits, provider: wa.provider },
        });
        await this.prisma.notification.create({
          data: {
            customerId: result.loan.customerId,
            loanId: result.loan.id,
            type: 'SYSTEM',
            message: `WhatsApp receipt auto-sent: paid AED ${amountPaid.toFixed(2)}, remaining AED ${remaining.toFixed(2)} of AED ${total.toFixed(2)}.`,
            status: 'SENT',
            sentAt: new Date(),
          },
        });
      } else if (wa.error) {
        await this.prisma.notification.create({
          data: {
            customerId: result.loan.customerId,
            loanId: result.loan.id,
            type: 'SYSTEM',
            message: `WhatsApp auto-send failed: ${wa.error}`,
            status: 'FAILED',
            sentAt: null,
          },
        });
      }
    } catch (e) {
      this.logger.warn(
        `WhatsApp receipt skipped: ${e instanceof Error ? e.message : e}`,
      );
    }

    return {
      ...this.toResult(result.loan, result.repayment),
      whatsapp,
    };
  }

  async listForLoan(loanId: string) {
    const rows = await this.prisma.repayment.findMany({
      where: { loanId },
      orderBy: { collectedAt: 'asc' },
      include: {
        collectedBy: { select: { id: true, name: true } },
      },
    });
    return rows.map((r) => ({
      ...r,
      notes: this.crypto.decryptLoose(r.notes),
    }));
  }

  async deleteRepayment(repaymentId: string, actorId: string) {
    const result = await this.prisma.$transaction(async (tx) => {
      const repayment = await tx.repayment.findUnique({
        where: { id: repaymentId },
        include: { loan: true },
      });
      if (!repayment) throw new NotFoundException('Collection not found');

      const loan = repayment.loan;

      await tx.repayment.delete({ where: { id: repaymentId } });

      const paidAgg = await tx.repayment.aggregate({
        where: { loanId: loan.id, cycle: loanCycle(loan.cycle) },
        _sum: { amount: true },
      });
      const balance = loanBalanceFromCollected(
        Number(loan.totalPayable),
        Number(loan.principalAmount),
        Number(paidAgg._sum.amount || 0),
      );

      const updatedLoan = await tx.loan.update({
        where: { id: loan.id },
        data: {
          amountCollected: new Prisma.Decimal(balance.collected),
          remainingAmount: new Prisma.Decimal(balance.remaining),
          status: balance.status,
          completedAt:
            balance.status === 'COMPLETED' ? loan.completedAt ?? new Date() : null,
          closedAt:
            balance.status === 'COMPLETED' ? loan.closedAt ?? new Date() : null,
        },
      });

      return { repayment, loan: updatedLoan };
    });

    await this.audit.log({
      userId: actorId,
      action: 'REPAYMENT_DELETE',
      recordType: 'repayment',
      recordId: result.repayment.id,
      metadata: {
        loanId: result.repayment.loanId,
        amount: Number(result.repayment.amount),
        receiptNumber: result.repayment.receiptNumber,
      },
    });

    return {
      ok: true,
      repaymentId: result.repayment.id,
      receiptNumber: result.repayment.receiptNumber,
      loanId: result.loan.id,
      collected: Number(result.loan.amountCollected),
      remaining: Number(result.loan.remainingAmount),
      status: result.loan.status,
    };
  }

  async listRecent(limit = 20, query?: string) {
    const q = String(query || '').trim().slice(0, 80);
    const take = q ? Math.min(Math.max(limit, 200), 400) : limit;
    const where = q
      ? {
          OR: [
            { receiptNumber: { contains: q, mode: 'insensitive' as const } },
            {
              loan: {
                customer: { name: { contains: q, mode: 'insensitive' as const } },
              },
            },
            {
              loan: {
                customer: {
                  customerCode: { contains: q, mode: 'insensitive' as const },
                },
              },
            },
            {
              loan: {
                customer: { phone: { contains: q } },
              },
            },
          ],
        }
      : undefined;

    const rows = await this.prisma.repayment.findMany({
      where,
      take,
      orderBy: { collectedAt: 'desc' },
      include: {
        collectedBy: { select: { id: true, name: true } },
        loan: {
          include: {
            customer: {
              select: { id: true, name: true, customerCode: true, phone: true },
            },
          },
        },
      },
    });
    return rows.map((r) => ({
      ...r,
      notes: this.crypto.decryptLoose(r.notes),
    }));
  }

  /** Pure helper used by unit tests: account closes once `total` is collected. */
  static computeBalance(total: number, collected: number, payment: number) {
    const newTotal = collected + payment;
    if (payment <= 0) throw new Error('Amount must be positive');
    if (newTotal > total) throw new Error('Payment exceeds outstanding amount');
    const completed = newTotal >= total;
    return {
      collected: newTotal,
      remaining: completed ? 0 : total - newTotal,
      status: completed ? 'COMPLETED' : 'ACTIVE',
    };
  }

  /** Reverse one collection and restore loan balances. */
  static computeBalanceAfterDelete(
    total: number,
    collected: number,
    removePayment: number,
  ) {
    if (removePayment <= 0) throw new Error('Amount must be positive');
    const newCollected = collected - removePayment;
    if (newCollected < -0.001) {
      throw new Error('Delete would make collected amount negative');
    }
    const safeCollected = Math.max(newCollected, 0);
    const completed = safeCollected >= total - 0.001;
    return {
      collected: safeCollected,
      remaining: completed ? 0 : Math.max(total - safeCollected, 0),
      status: completed ? 'COMPLETED' : 'ACTIVE',
    };
  }

  private async nextReceiptNumber(tx: Prisma.TransactionClient) {
    const latest = await tx.repayment.findFirst({
      where: { receiptNumber: { startsWith: 'JB-RCP-' } },
      orderBy: { receiptNumber: 'desc' },
      select: { receiptNumber: true },
    });
    return nextReceiptFromLatest(latest?.receiptNumber);
  }

  private toResult(
    loan: {
      id: string;
      amountCollected: Prisma.Decimal;
      remainingAmount: Prisma.Decimal;
      principalAmount: Prisma.Decimal;
      totalPayable: Prisma.Decimal;
      status: string;
      completedAt: Date | null;
    },
    repayment: { id: string; receiptNumber: string; amount: Prisma.Decimal },
  ) {
    const amount = Number(repayment.amount);
    const remaining = Number(loan.remainingAmount);
    const closed =
      loan.status === 'COMPLETED' || loan.status === 'CLOSED';
    return {
      repaymentId: repayment.id,
      receiptNumber: repayment.receiptNumber,
      amount,
      collected: Number(loan.amountCollected),
      remaining,
      principal: Number(loan.principalAmount),
      total: Math.max(Number(loan.totalPayable), Number(loan.principalAmount)),
      status: loan.status,
      completedAt: loan.completedAt,
      closed,
      walletAdded: amount,
      walletPaidOut: 0,
    };
  }
}
