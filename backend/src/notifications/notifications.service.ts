import { Injectable } from '@nestjs/common';
import { NotificationType, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';

type Audience = 'ALL' | 'ADMIN';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  private async create(
    data: {
      customerId: string;
      loanId: string;
      type: NotificationType;
      message: string;
      audience?: Audience;
    },
  ) {
    return this.prisma.notification.create({
      data: {
        customerId: data.customerId,
        loanId: data.loanId,
        type: data.type,
        message: data.message,
        audience: data.audience ?? 'ALL',
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async createLoanCompleted(
    customerId: string,
    loanId: string,
    amountPaid: number,
    remaining: number,
    total: number,
    customerName: string,
    collectorName: string,
  ) {
    await this.create({
      customerId,
      loanId,
      type: 'LOAN_COMPLETED',
      audience: 'ALL',
      message: `Account closed for ${customerName}. Last payment AED ${amountPaid.toFixed(2)}. Full AED ${total.toFixed(2)} collected.`,
    });
    await this.create({
      customerId,
      loanId,
      type: 'LOAN_COMPLETED',
      audience: 'ADMIN',
      message: `Admin: ${collectorName} closed ${customerName}'s account with AED ${amountPaid.toFixed(2)} (remaining AED ${remaining.toFixed(2)}).`,
    });
  }

  /** Fires only when a collection is saved — staff + admin copies with remaining balance. */
  async createRepaymentReceived(
    customerId: string,
    loanId: string,
    amount: number,
    remaining: number,
    total: number,
    customerName: string,
    collectorName: string,
  ) {
    await this.create({
      customerId,
      loanId,
      type: 'REPAYMENT_RECEIVED',
      audience: 'ALL',
      message: `Collection saved: AED ${amount.toFixed(2)} from ${customerName}. Remaining balance AED ${remaining.toFixed(2)} of AED ${total.toFixed(2)}.`,
    });
    await this.create({
      customerId,
      loanId,
      type: 'REPAYMENT_RECEIVED',
      audience: 'ADMIN',
      message: `Admin: ${collectorName} collected AED ${amount.toFixed(2)} from ${customerName}. Remaining AED ${remaining.toFixed(2)} of AED ${total.toFixed(2)}.`,
    });
  }

  async createPendingCollectionReminders(input: {
    customerId: string;
    loanId: string;
    customerName: string;
    customerCode: string;
    remaining: number;
    total: number;
    dueTodayAed: number;
    collectedTodayAed: number;
  }) {
    const {
      customerId,
      loanId,
      customerName,
      customerCode,
      remaining,
      total,
      dueTodayAed,
      collectedTodayAed,
    } = input;
    const stillDueToday = Math.max(dueTodayAed - collectedTodayAed, 0);
    const partial =
      collectedTodayAed > 0
        ? ` (AED ${collectedTodayAed.toFixed(0)} received today — AED ${stillDueToday.toFixed(0)} still due today)`
        : '';

    await this.create({
      customerId,
      loanId,
      type: 'COLLECTION_REMINDER',
      audience: 'ALL',
      message: `Today's collection is pending for ${customerName}: collect AED ${dueTodayAed.toFixed(0)} today${partial}. Remaining balance AED ${remaining.toFixed(2)} of AED ${total.toFixed(2)} (${customerCode}).`,
    });
    await this.create({
      customerId,
      loanId,
      type: 'COLLECTION_REMINDER',
      audience: 'ADMIN',
      message: `Admin: Today's collection is pending for ${customerName}. AED ${stillDueToday.toFixed(0)} of today's AED ${dueTodayAed.toFixed(0)} is still due${partial}. Remaining AED ${remaining.toFixed(2)} (${customerCode}).`,
    });
  }

  findAllForUser(user: AuthUser, limit = 50) {
    const isAdmin =
      user.role === UserRole.SUPER_ADMIN || user.role === UserRole.ADMIN;
    return this.prisma.notification.findMany({
      where: isAdmin ? undefined : { audience: 'ALL' },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { id: true, name: true, customerCode: true },
        },
        loan: {
          select: {
            id: true,
            remainingAmount: true,
            totalPayable: true,
            principalAmount: true,
            status: true,
          },
        },
      },
    });
  }
}
