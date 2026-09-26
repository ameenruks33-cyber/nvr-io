import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats() {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [
      totalCustomers,
      activeLoans,
      completedLoans,
      loanAgg,
      todaysAgg,
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.loan.count({ where: { status: 'ACTIVE' } }),
      this.prisma.loan.count({ where: { status: 'COMPLETED' } }),
      this.prisma.loan.aggregate({
        _sum: {
          principalAmount: true,
          amountCollected: true,
          remainingAmount: true,
        },
      }),
      this.prisma.repayment.aggregate({
        where: { collectedAt: { gte: startOfDay } },
        _sum: { amount: true },
      }),
    ]);

    const sum = (v: Prisma.Decimal | null | undefined) =>
      v ? Number(v) : 0;

    return {
      totalCustomers,
      activeLoans,
      completedLoans,
      totalDisbursed: sum(loanAgg._sum.principalAmount),
      totalCollected: sum(loanAgg._sum.amountCollected),
      totalOutstanding: sum(loanAgg._sum.remainingAmount),
      todaysCollections: sum(todaysAgg._sum.amount),
    };
  }
}
