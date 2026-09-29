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

export interface RecordRepaymentInput {
  loanId: string;
  amount: number;
  collectorId: string;
  latitude?: number;
  longitude?: number;
  notes?: string;
  idempotencyKey?: string;
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
  ) {}

  async recordRepayment(input: RecordRepaymentInput) {
    if (input.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

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

    const result = await this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({
        where: { id: input.loanId },
        include: { customer: true },
      });
      if (!loan) throw new NotFoundException('Loan not found');
      if (loan.status === 'COMPLETED' || loan.status === 'CLOSED') {
        throw new ConflictException('Loan already completed');
      }

      const collected = Number(loan.amountCollected);
      const total = Math.max(
        Number(loan.totalPayable),
        Number(loan.principalAmount),
      );
      const newTotal = collected + input.amount;

      if (newTotal > total + 0.001) {
        throw new BadRequestException(
          `Only AED ${(total - collected).toFixed(2)} is needed to close this account`,
        );
      }

      const completed = newTotal >= total - 0.001;
      const remaining = completed ? 0 : Math.max(total - newTotal, 0);
      const receiptNumber = await this.nextReceiptNumber(tx);

      const repayment = await tx.repayment.create({
        data: {
          loanId: input.loanId,
          amount: new Prisma.Decimal(input.amount),
          collectedById: input.collectorId,
          latitude: input.latitude,
          longitude: input.longitude,
          notes: input.notes,
          receiptNumber,
          idempotencyKey: input.idempotencyKey,
        },
      });

      const updatedLoan = await tx.loan.update({
        where: { id: input.loanId },
        data: {
          amountCollected: new Prisma.Decimal(newTotal),
          remainingAmount: new Prisma.Decimal(remaining),
          status: completed ? 'COMPLETED' : 'ACTIVE',
          completedAt: completed ? new Date() : null,
          closedAt: completed ? new Date() : null,
        },
        include: { customer: true },
      });

      return { loan: updatedLoan, repayment, completed, customer: loan.customer };
    });

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

    const amountPaid = Number(result.repayment.amount);
    const remaining = Number(result.loan.remainingAmount);
    const principal = Math.max(
      Number(result.loan.totalPayable),
      Number(result.loan.principalAmount),
    );

    if (result.completed) {
      await this.notifications.createLoanCompleted(
        result.loan.customerId,
        result.loan.id,
        amountPaid,
        remaining,
        principal,
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
        principal,
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
        principal,
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
            message: `WhatsApp receipt auto-sent: paid AED ${amountPaid.toFixed(2)}, remaining AED ${remaining.toFixed(2)} of AED ${principal.toFixed(2)}.`,
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
    return this.prisma.repayment.findMany({
      where: { loanId },
      orderBy: { collectedAt: 'asc' },
      include: {
        collectedBy: { select: { id: true, name: true } },
      },
    });
  }

  async listRecent(limit = 20) {
    return this.prisma.repayment.findMany({
      take: limit,
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

  private async nextReceiptNumber(tx: Prisma.TransactionClient) {
    const count = await tx.repayment.count();
    return `JB-RCP-${String(count + 1).padStart(8, '0')}`;
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
    return {
      repaymentId: repayment.id,
      receiptNumber: repayment.receiptNumber,
      amount: Number(repayment.amount),
      collected: Number(loan.amountCollected),
      remaining: Number(loan.remainingAmount),
      principal: Number(loan.principalAmount),
      total: Math.max(Number(loan.totalPayable), Number(loan.principalAmount)),
      status: loan.status,
      completedAt: loan.completedAt,
    };
  }
}
