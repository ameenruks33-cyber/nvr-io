import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { loanBalanceFromCollected, loanCycle } from '../loans/loan-balance';
import { uaeDateTimeToInstant } from './uae-instant';

@Injectable()
export class RestoreService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  parseAt(date: string, time: string) {
    try {
      const at = uaeDateTimeToInstant(date, time);
      if (at.getTime() > Date.now() + 60_000) {
        throw new BadRequestException('Choose a time that has already passed');
      }
      return at;
    } catch (err) {
      throw new BadRequestException(
        err instanceof Error ? err.message : 'Invalid date or time',
      );
    }
  }

  async preview(date: string, time: string) {
    const at = this.parseAt(date, time);
    const [repayments, expenses, renewals] = await Promise.all([
      this.prisma.repayment.findMany({
        where: { collectedAt: { gt: at } },
        orderBy: { collectedAt: 'desc' },
        include: {
          loan: {
            include: {
              customer: { select: { name: true, customerCode: true } },
            },
          },
        },
        take: 200,
      }),
      this.prisma.pettyCashExpense.findMany({
        where: { createdAt: { gt: at } },
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { name: true, customerCode: true } },
        },
        take: 200,
      }),
      this.prisma.loan.findMany({
        where: { openedAt: { gt: at }, cycle: { gt: 1 } },
        include: {
          customer: { select: { name: true, customerCode: true } },
        },
        take: 100,
      }),
    ]);

    return {
      at: at.toISOString(),
      date,
      time,
      repayments: repayments.map((r) => ({
        id: r.id,
        at: r.collectedAt,
        amount: Number(r.amount),
        receiptNumber: r.receiptNumber,
        person: `${r.loan.customer.customerCode} · ${r.loan.customer.name}`,
      })),
      expenses: expenses.map((e) => ({
        id: e.id,
        at: e.createdAt,
        amount: Number(e.amount),
        purpose: e.purpose,
        person: e.customer
          ? `${e.customer.customerCode} · ${e.customer.name}`
          : e.paidToName || 'General',
      })),
      renewals: renewals.map((l) => ({
        id: l.id,
        at: l.openedAt,
        cycle: l.cycle,
        person: `${l.customer.customerCode} · ${l.customer.name}`,
      })),
      totals: {
        repayments: repayments.length,
        expenses: expenses.length,
        renewals: renewals.length,
      },
    };
  }

  async restoreTo(date: string, time: string, userId: string) {
    const at = this.parseAt(date, time);
    const preview = await this.preview(date, time);
    if (
      !preview.totals.repayments &&
      !preview.totals.expenses &&
      !preview.totals.renewals
    ) {
      throw new BadRequestException(
        'Nothing to undo after that date and time',
      );
    }

    const result = await this.prisma.$transaction(
      async (tx) => {
        const laterRepayments = await tx.repayment.findMany({
          where: { collectedAt: { gt: at } },
          select: { id: true, loanId: true },
        });
        const loanIds = new Set(laterRepayments.map((r) => r.loanId));

        await tx.repayment.deleteMany({
          where: { collectedAt: { gt: at } },
        });
        const expenses = await tx.pettyCashExpense.deleteMany({
          where: { createdAt: { gt: at } },
        });

        const renewed = await tx.loan.findMany({
          where: { openedAt: { gt: at }, cycle: { gt: 1 } },
          select: { id: true, cycle: true, openedAt: true },
        });
        for (const loan of renewed) loanIds.add(loan.id);

        for (const loanId of loanIds) {
          await this.recalcLoan(tx, loanId, at);
        }

        return {
          repaymentsRemoved: laterRepayments.length,
          expensesRemoved: expenses.count,
          accountsReconciled: loanIds.size,
        };
      },
      { maxWait: 15_000, timeout: 40_000 },
    );

    await this.audit.log({
      userId,
      action: 'RESTORE_TO',
      recordType: 'restore',
      recordId: `${date}T${time}`,
      metadata: {
        date,
        time,
        at: at.toISOString(),
        ...result,
      },
    });

    return {
      ok: true,
      date,
      time,
      at: at.toISOString(),
      ...result,
    };
  }

  private async recalcLoan(
    tx: Prisma.TransactionClient,
    loanId: string,
    at: Date,
  ) {
    const loan = await tx.loan.findUnique({ where: { id: loanId } });
    if (!loan) return;

    const remainingRows = await tx.repayment.findMany({
      where: { loanId },
      select: { cycle: true, collectedAt: true },
      orderBy: { collectedAt: 'asc' },
    });
    const maxPaidCycle = remainingRows.reduce(
      (m, r) => Math.max(m, loanCycle(r.cycle)),
      0,
    );
    let cycle = loanCycle(loan.cycle);
    if (loan.openedAt > at && cycle > 1) {
      cycle = Math.max(1, maxPaidCycle || cycle - 1);
    }

    const paidAgg = await tx.repayment.aggregate({
      where: { loanId, cycle },
      _sum: { amount: true },
    });
    const balance = loanBalanceFromCollected(
      Number(loan.totalPayable),
      Number(loan.principalAmount),
      Number(paidAgg._sum.amount || 0),
    );
    const firstOfCycle = remainingRows.find((r) => loanCycle(r.cycle) === cycle);
    const openedAt =
      loan.openedAt > at
        ? firstOfCycle?.collectedAt || loan.createdAt
        : loan.openedAt;

    await tx.loan.update({
      where: { id: loanId },
      data: {
        cycle,
        amountCollected: new Prisma.Decimal(balance.collected),
        remainingAmount: new Prisma.Decimal(balance.remaining),
        status: balance.status,
        openedAt,
        completedAt:
          balance.status === 'COMPLETED' ? loan.completedAt ?? new Date() : null,
        closedAt:
          balance.status === 'COMPLETED' ? loan.closedAt ?? new Date() : null,
      },
    });
  }
}
