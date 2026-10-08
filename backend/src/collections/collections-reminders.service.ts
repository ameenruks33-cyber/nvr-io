import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { uaeDayBounds } from './uae-day';
import { PendingCollectionsService } from './pending-collections.service';

@Injectable()
export class CollectionsRemindersService {
  private readonly logger = new Logger(CollectionsRemindersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
    private readonly pending: PendingCollectionsService,
  ) {}

  /** Daily job: remind collectors and admins about today's pending AED 100. */
  async runDailyPendingReminders() {
    const { date, items } = await this.pending.listPendingToday();
    const { start, end } = uaeDayBounds(date);

    let reminded = 0;
    let skippedAlreadySent = 0;

    for (const row of items) {
      const already = await this.prisma.notification.count({
        where: {
          loanId: row.loanId,
          type: 'COLLECTION_REMINDER',
          createdAt: { gte: start, lt: end },
        },
      });
      if (already > 0) {
        skippedAlreadySent++;
        continue;
      }

      await this.notifications.createPendingCollectionReminders({
        customerId: row.customerId,
        loanId: row.loanId,
        customerName: row.customerName,
        customerCode: row.customerCode,
        remaining: row.remainingBalance,
        total: row.totalPayable,
        dueTodayAed: row.dueTodayAed,
        collectedTodayAed: row.collectedTodayAed,
      });
      reminded++;
    }

    const summary = {
      date,
      pendingCount: items.length,
      remindersSent: reminded,
      skippedAlreadySent,
    };
    this.logger.log(JSON.stringify(summary));
    return summary;
  }
}
