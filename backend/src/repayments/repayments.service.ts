import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { NotificationsService } from '../notifications/notifications.service';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly notifications: NotificationsService,
    private readonly config: ConfigService,
  ) {}

  async recordRepayment(input: RecordRepaymentInput) {
    if (input.amount <= 0) {
      throw new BadRequestException('Amount must be positive');
    }

    if (input.idempotencyKey) {
      const existing = await this.prisma.repayment.findUnique({
        where: { idempotencyKey: input.idempotencyKey },
        include: { loan: true },
      });
      if (existing) {
        return this.toResult(existing.loan, existing);
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const loan = await tx.loan.findUnique({ where: { id: input.loanId } });
      if (!loan) throw new NotFoundException('Loan not found');
      if (loan.status === 'COMPLETED' || loan.status === 'CLOSED') {
        throw new ConflictException('Loan already completed');
      }

      const collected = Number(loan.amountCollected);
      const principal = Number(loan.principalAmount);
      const newTotal = collected + input.amount;

      if (newTotal > principal + 0.001) {
        throw new BadRequestException('Payment exceeds outstanding amount');
      }

      const remaining = Math.max(principal - newTotal, 0);
      const completed = newTotal >= principal;
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
      });

      return { loan: updatedLoan, repayment, completed };
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

    if (result.completed) {
      await this.notifications.createLoanCompleted(
        result.loan.customerId,
        result.loan.id,
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
        input.amount,
      );
    }

    return this.toResult(result.loan, result.repayment);
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

  /** Pure helper used by unit tests */
  static computeBalance(principal: number, collected: number, payment: number) {
    const newTotal = collected + payment;
    if (payment <= 0) throw new Error('Amount must be positive');
    if (newTotal > principal) throw new Error('Payment exceeds outstanding amount');
    const remaining = principal - newTotal;
    return {
      collected: newTotal,
      remaining,
      status: newTotal >= principal ? 'COMPLETED' : 'ACTIVE',
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
      status: loan.status,
      completedAt: loan.completedAt,
    };
  }
}
