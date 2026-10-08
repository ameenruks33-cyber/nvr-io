import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { dueTodayAed } from './daily-collection';
import { uaeDayBounds } from './uae-day';

export type PendingTodayItem = {
  customerId: string;
  customerName: string;
  customerCode: string;
  loanId: string;
  dueTodayAed: number;
  collectedTodayAed: number;
  pendingTodayAed: number;
  remainingBalance: number;
  totalPayable: number;
};

@Injectable()
export class PendingCollectionsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Open accounts where today's AED 100 (or remainder) is not fully collected yet. */
  async listPendingToday(): Promise<{
    date: string;
    items: PendingTodayItem[];
  }> {
    const { day, start, end } = uaeDayBounds();
    const activeLoans = await this.prisma.loan.findMany({
      where: { status: 'ACTIVE', remainingAmount: { gt: 0 } },
      include: {
        customer: {
          select: { id: true, name: true, customerCode: true },
        },
      },
      orderBy: { customer: { name: 'asc' } },
    });

    const items: PendingTodayItem[] = [];

    for (const loan of activeLoans) {
      const remainingBalance = Number(loan.remainingAmount);
      const dueToday = dueTodayAed(remainingBalance);
      const paidTodayAgg = await this.prisma.repayment.aggregate({
        where: {
          loanId: loan.id,
          collectedAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
      });
      const collectedTodayAed = Number(paidTodayAgg._sum.amount || 0);
      const pendingTodayAed = Math.max(dueToday - collectedTodayAed, 0);
      if (pendingTodayAed <= 0.001) continue;

      items.push({
        customerId: loan.customerId,
        customerName: loan.customer.name,
        customerCode: loan.customer.customerCode,
        loanId: loan.id,
        dueTodayAed: dueToday,
        collectedTodayAed,
        pendingTodayAed,
        remainingBalance,
        totalPayable: Math.max(
          Number(loan.totalPayable),
          Number(loan.principalAmount),
        ),
      });
    }

    return { date: day, items };
  }
}
