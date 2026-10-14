import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { dueTodayAed } from '../collections/daily-collection';
import { startOfUaeDayUtc, uaeCalendarDay } from '../collections/uae-day';

const UAE = 'Asia/Dubai';

export type MonthlyAuditPayload = {
  summary: {
    totalCustomers: number;
    activeLoansEnd: number;
    completedLoansInMonth: number;
    collectionsInMonth: number;
    collectionReceiptsInMonth: number;
    expensesInMonth: number;
    netCashflowInMonth: number;
    totalOutstandingEnd: number;
    totalCollectedAllTime: number;
    totalDisbursedAllTime: number;
    pendingDailyAccountsEnd: number;
  };
  ledger: Array<{
    date: string;
    collected: number;
    spent: number;
    net: number;
  }>;
  expenses: Array<{
    id: string;
    spentOn: string;
    amount: number;
    purpose: string;
    paidToName: string | null;
    recordedBy: string;
  }>;
  collectionsByDay: Array<{
    date: string;
    total: number;
    count: number;
  }>;
  openAccounts: Array<{
    customerCode: string;
    customerName: string;
    remainingBalance: number;
    collectedInMonth: number;
  }>;
  pendingDailyAtMonthEnd: Array<{
    customerCode: string;
    customerName: string;
    pendingAed: number;
    remainingBalance: number;
  }>;
};

function shiftUaeMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(`${y}-${String(m).padStart(2, '0')}-01T12:00:00+04:00`);
  d.setMonth(d.getMonth() + delta);
  return new Intl.DateTimeFormat('en-CA', { timeZone: UAE }).format(d).slice(0, 7);
}

function monthBounds(periodMonth: string) {
  const periodStart = `${periodMonth}-01`;
  const periodEnd = `${shiftUaeMonth(periodMonth, 1)}-01`;
  const title = new Date(`${periodMonth}-01T12:00:00+04:00`).toLocaleDateString(
    'en-GB',
    { timeZone: UAE, month: 'long', year: 'numeric' },
  );
  return { periodMonth, periodStart, periodEnd, title };
}

function previousUaeMonth(ref = new Date()): string {
  const current = uaeCalendarDay(ref).slice(0, 7);
  return shiftUaeMonth(current, -1);
}

@Injectable()
export class MonthlyAuditService {
  constructor(private readonly prisma: PrismaService) {}

  list(limit = 24) {
    return this.prisma.monthlyAuditReport.findMany({
      take: limit,
      orderBy: { periodMonth: 'desc' },
      select: {
        id: true,
        periodMonth: true,
        periodStart: true,
        periodEnd: true,
        title: true,
        generatedAt: true,
        report: true,
      },
    });
  }

  getById(validatedId: string) {
    return this.prisma.monthlyAuditReport.findFirst({
      where: { id: { equals: validatedId } },
    });
  }

  /** Idempotent monthly run — defaults to previous UAE calendar month. */
  async generate(periodMonth?: string) {
    const month = periodMonth?.trim() || previousUaeMonth();
    const existing = await this.prisma.monthlyAuditReport.findUnique({
      where: { periodMonth: month },
    });
    if (existing) return existing;

    const { periodStart, periodEnd, title } = monthBounds(month);
    const startUtc = startOfUaeDayUtc(periodStart);
    const endUtc = startOfUaeDayUtc(periodEnd);
    const lastDayOfMonth = (() => {
      const next = shiftUaeMonth(month, 1);
      const d = new Date(`${next}-01T12:00:00+04:00`);
      d.setDate(d.getDate() - 1);
      return uaeCalendarDay(d);
    })();

    const [
      totalCustomers,
      activeLoansEnd,
      completedInMonth,
      loanAgg,
      monthCollectionsAgg,
      monthReceiptCount,
      monthExpensesAgg,
      expenses,
      collectedByDay,
      activeLoans,
      monthRepaymentsByLoan,
    ] = await Promise.all([
      this.prisma.customer.count(),
      this.prisma.loan.count({ where: { status: 'ACTIVE' } }),
      this.prisma.loan.count({
        where: {
          status: 'COMPLETED',
          completedAt: { gte: startUtc, lt: endUtc },
        },
      }),
      this.prisma.loan.aggregate({
        _sum: {
          totalPayable: true,
          amountCollected: true,
          remainingAmount: true,
        },
      }),
      this.prisma.repayment.aggregate({
        where: { collectedAt: { gte: startUtc, lt: endUtc } },
        _sum: { amount: true },
      }),
      this.prisma.repayment.count({
        where: { collectedAt: { gte: startUtc, lt: endUtc } },
      }),
      this.prisma.pettyCashExpense.aggregate({
        where: {
          spentOn: { gte: periodStart, lt: periodEnd },
        },
        _sum: { amount: true },
      }),
      this.prisma.pettyCashExpense.findMany({
        where: { spentOn: { gte: periodStart, lt: periodEnd } },
        orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }],
        include: { recordedBy: { select: { name: true } } },
      }),
      this.prisma.$queryRaw<Array<{ day: string; total: Prisma.Decimal; cnt: bigint }>>`
        SELECT t.day, SUM(t.amount) AS total, COUNT(*)::bigint AS cnt
        FROM (
          SELECT to_char(("collected_at" AT TIME ZONE 'UTC') AT TIME ZONE ${UAE}, 'YYYY-MM-DD') AS day,
                 "amount" AS amount
          FROM "repayments"
        ) t
        WHERE t.day >= ${periodStart} AND t.day < ${periodEnd}
        GROUP BY t.day
        ORDER BY t.day ASC
      `,
      this.prisma.loan.findMany({
        where: { status: 'ACTIVE', remainingAmount: { gt: 0 } },
        include: {
          customer: { select: { name: true, customerCode: true } },
        },
        orderBy: { customer: { name: 'asc' } },
      }),
      this.prisma.repayment.groupBy({
        by: ['loanId'],
        where: { collectedAt: { gte: startUtc, lt: endUtc } },
        _sum: { amount: true },
      }),
    ]);

    const num = (v: Prisma.Decimal | null | undefined) => (v ? Number(v) : 0);
    const collectionsInMonth = num(monthCollectionsAgg._sum.amount);
    const expensesInMonth = num(monthExpensesAgg._sum.amount);

    const expenseByDay = new Map<string, number>();
    for (const e of expenses) {
      expenseByDay.set(
        e.spentOn,
        (expenseByDay.get(e.spentOn) || 0) + Number(e.amount),
      );
    }

    const collectionsByDay = collectedByDay.map((row) => ({
      date: row.day,
      total: Number(row.total),
      count: Number(row.cnt),
    }));

    const ledgerDays = new Set<string>();
    for (const row of collectionsByDay) ledgerDays.add(row.date);
    for (const d of expenseByDay.keys()) ledgerDays.add(d);
    const ledger = [...ledgerDays]
      .sort()
      .map((date) => {
        const collected =
          collectionsByDay.find((c) => c.date === date)?.total || 0;
        const spent = expenseByDay.get(date) || 0;
        return { date, collected, spent, net: collected - spent };
      });

    const collectedInMonthByLoan = new Map(
      monthRepaymentsByLoan.map((r) => [r.loanId, num(r._sum.amount)]),
    );

    const openAccounts = activeLoans.map((loan) => ({
      customerCode: loan.customer.customerCode,
      customerName: loan.customer.name,
      remainingBalance: num(loan.remainingAmount),
      collectedInMonth: collectedInMonthByLoan.get(loan.id) || 0,
    }));

    const { start: lastStart, end: lastEnd } = (() => {
      const day = lastDayOfMonth;
      const start = startOfUaeDayUtc(day);
      const next = uaeCalendarDay(
        new Date(new Date(`${day}T12:00:00+04:00`).getTime() + 86_400_000),
      );
      const end = startOfUaeDayUtc(next);
      return { start, end };
    })();

    const pendingDailyAtMonthEnd: MonthlyAuditPayload['pendingDailyAtMonthEnd'] =
      [];
    for (const loan of activeLoans) {
      const remainingBalance = num(loan.remainingAmount);
      const dueToday = dueTodayAed(remainingBalance);
      const paidLastDay = await this.prisma.repayment.aggregate({
        where: {
          loanId: loan.id,
          collectedAt: { gte: lastStart, lt: lastEnd },
        },
        _sum: { amount: true },
      });
      const collected = num(paidLastDay._sum.amount);
      const pendingAed = Math.max(dueToday - collected, 0);
      if (pendingAed <= 0.001) continue;
      pendingDailyAtMonthEnd.push({
        customerCode: loan.customer.customerCode,
        customerName: loan.customer.name,
        pendingAed,
        remainingBalance,
      });
    }

    const report: MonthlyAuditPayload = {
      summary: {
        totalCustomers,
        activeLoansEnd,
        completedLoansInMonth: completedInMonth,
        collectionsInMonth,
        collectionReceiptsInMonth: monthReceiptCount,
        expensesInMonth,
        netCashflowInMonth: collectionsInMonth - expensesInMonth,
        totalOutstandingEnd: num(loanAgg._sum.remainingAmount),
        totalCollectedAllTime: num(loanAgg._sum.amountCollected),
        totalDisbursedAllTime: num(loanAgg._sum.totalPayable),
        pendingDailyAccountsEnd: pendingDailyAtMonthEnd.length,
      },
      ledger,
      expenses: expenses.map((e) => ({
        id: e.id,
        spentOn: e.spentOn,
        amount: Number(e.amount),
        purpose: e.purpose,
        paidToName: e.paidToName?.trim() || null,
        recordedBy: e.recordedBy.name,
      })),
      collectionsByDay,
      openAccounts,
      pendingDailyAtMonthEnd,
    };

    const row = await this.prisma.monthlyAuditReport.create({
      data: {
        periodMonth: month,
        periodStart,
        periodEnd,
        title,
        report: report as unknown as Prisma.InputJsonValue,
      },
    });

    await this.prisma.notification.create({
      data: {
        type: 'SYSTEM',
        audience: 'ADMIN',
        message: `Monthly audit ready: ${title}. Collections AED ${collectionsInMonth.toFixed(2)}, expenses AED ${expensesInMonth.toFixed(2)}, net AED ${(collectionsInMonth - expensesInMonth).toFixed(2)}. Open Admin → Monthly audit to view.`,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return row;
  }
}
