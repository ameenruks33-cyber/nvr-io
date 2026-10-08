import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { uaeCalendarDay } from './uae-day';

@Injectable()
export class CollectionsRemindersService {
  private readonly logger = new Logger(CollectionsRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  /**
   * Daily job: remind collectors and admins about open accounts with no payment
   * recorded today (UAE calendar day).
   */
  async runDailyPendingReminders() {
    const today = uaeCalendarDay();
    const activeLoans = await this.prisma.loan.findMany({
      where: { status: 'ACTIVE', remainingAmount: { gt: 0 } },
      include: {
        customer: {
          select: { id: true, name: true, customerCode: true, phone: true },
        },
      },
    });

    let reminded = 0;
    let skippedPaidToday = 0;
    let skippedAlreadySent = 0;

    for (const loan of activeLoans) {
      const remaining = Number(loan.remainingAmount);
      const total = Math.max(
        Number(loan.totalPayable),
        Number(loan.principalAmount),
      );
      const daily = Number(loan.dailyPayment || 100);

      const paidToday = await this.prisma.repayment.count({
        where: {
          loanId: loan.id,
          collectedAt: {
            gte: this.startOfUaeDayUtc(today),
            lt: this.startOfUaeDayUtc(this.nextUaeDay(today)),
          },
        },
      });
      if (paidToday > 0) {
        skippedPaidToday++;
        continue;
      }

      const already = await this.prisma.notification.count({
        where: {
          loanId: loan.id,
          type: 'COLLECTION_REMINDER',
          createdAt: {
            gte: this.startOfUaeDayUtc(today),
            lt: this.startOfUaeDayUtc(this.nextUaeDay(today)),
          },
        },
      });
      if (already > 0) {
        skippedAlreadySent++;
        continue;
      }

      await this.notifications.createPendingCollectionReminders({
        customerId: loan.customerId,
        loanId: loan.id,
        customerName: loan.customer.name,
        customerCode: loan.customer.customerCode,
        remaining,
        total,
        dailyTarget: daily,
      });
      reminded++;
    }

    const summary = {
      date: today,
      activeWithBalance: activeLoans.length,
      remindersSent: reminded,
      skippedPaidToday,
      skippedAlreadySent,
    };
    this.logger.log(JSON.stringify(summary));
    return summary;
  }

  /** UTC instant for 00:00 on a UAE YYYY-MM-DD calendar day. */
  private startOfUaeDayUtc(day: string): Date {
    return new Date(`${day}T00:00:00+04:00`);
  }

  private nextUaeDay(day: string): string {
    const d = new Date(`${day}T12:00:00+04:00`);
    d.setDate(d.getDate() + 1);
    return uaeCalendarDay(d);
  }
}
