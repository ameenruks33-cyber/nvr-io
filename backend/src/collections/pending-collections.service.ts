import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { daysInArrears, dueTodayAed, overdueAed } from './daily-collection';
import { uaeDayBounds } from './uae-day';

export type PendingTodayItem = {
  customerId: string;
  customerName: string;
  customerCode: string;
  loanId: string;
  dueTodayAed: number;
  collectedTodayAed: number;
  pendingTodayAed: number;
  daysInArrears: number;
  overdueAed: number;
  remainingBalance: number;
  totalPayable: number;
};

@Injectable()
export class PendingCollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Open accounts with unpaid days (total arrears, not only today). */
  async listPendingToday(): Promise<{
    date: string;
    items: PendingTodayItem[];
  }> {
    const { day, start, end } = uaeDayBounds();
    const [activeLoans, paidToday] = await Promise.all([
      this.prisma.loan.findMany({
        where: { status: 'ACTIVE', remainingAmount: { gt: 0 } },
        include: {
          customer: {
            select: { id: true, name: true, customerCode: true },
          },
        },
        orderBy: { customer: { name: 'asc' } },
      }),
      this.prisma.repayment.groupBy({
        by: ['loanId'],
        where: { collectedAt: { gte: start, lt: end } },
        _sum: { amount: true },
      }),
    ]);

    const collectedByLoan = new Map(
      paidToday.map((r) => [r.loanId, Number(r._sum.amount || 0)]),
    );

    const items: PendingTodayItem[] = [];

    for (const loan of activeLoans) {
      const remainingBalance = Number(loan.remainingAmount);
      const dueToday = dueTodayAed(
        remainingBalance,
        Number(loan.dailyPayment) || 100,
      );
      const collectedTodayAed = collectedByLoan.get(loan.id) || 0;
      const pendingTodayAed = Math.max(dueToday - collectedTodayAed, 0);
      const missedDays = daysInArrears(loan);
      const overdue = overdueAed(loan);
      if (missedDays <= 0 && pendingTodayAed <= 0.001) continue;

      items.push({
        customerId: loan.customerId,
        customerName: loan.customer.name,
        customerCode: loan.customer.customerCode,
        loanId: loan.id,
        dueTodayAed: dueToday,
        collectedTodayAed,
        pendingTodayAed,
        daysInArrears: Math.max(missedDays, pendingTodayAed > 0.001 ? 1 : 0),
        overdueAed: overdue,
        remainingBalance,
        totalPayable: Math.max(
          Number(loan.totalPayable),
          Number(loan.principalAmount),
        ),
      });
    }

    items.sort((a, b) => b.daysInArrears - a.daysInArrears || a.customerName.localeCompare(b.customerName));
    return { date: day, items };
  }
}
