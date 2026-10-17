import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  daysInArrears,
  dueTodayAed,
  nextDueAtFromRepayments,
  overdueAed,
  prepaidIsDue,
} from './daily-collection';
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
  dailyPayment: number;
  remainingBalance: number;
  totalPayable: number;
  nextDueAt: string | null;
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
          repayments: {
            select: { amount: true, collectedAt: true, cycle: true },
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
      const daily = Number(loan.dailyPayment) || 100;
      const dueToday = dueTodayAed(remainingBalance, daily);
      const collectedTodayAed = collectedByLoan.get(loan.id) || 0;
      const pendingTodayAed = Math.max(dueToday - collectedTodayAed, 0);
      const missedDays = daysInArrears(loan);
      const nextDue = nextDueAtFromRepayments(loan, loan.repayments);
      let overdue = Math.min(
        remainingBalance,
        Math.max(overdueAed(loan), pendingTodayAed),
      );
      if (overdue <= 0.001 && prepaidIsDue(nextDue)) {
        overdue = dueToday;
      }
      if (overdue <= 0.001) continue;

      items.push({
        customerId: loan.customerId,
        customerName: loan.customer.name,
        customerCode: loan.customer.customerCode,
        loanId: loan.id,
        dueTodayAed: dueToday,
        collectedTodayAed,
        pendingTodayAed,
        daysInArrears: Math.max(
          missedDays,
          Math.ceil(overdue / daily - 1e-9),
        ),
        overdueAed: overdue,
        dailyPayment: daily,
        remainingBalance,
        totalPayable: Math.max(
          Number(loan.totalPayable),
          Number(loan.principalAmount),
        ),
        nextDueAt: nextDue ? nextDue.toISOString() : null,
      });
    }

    items.sort((a, b) => b.daysInArrears - a.daysInArrears || a.customerName.localeCompare(b.customerName));
    return { date: day, items };
  }
}
