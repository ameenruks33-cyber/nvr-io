import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateExpenseDto } from './dto/create-expense.dto';

const TIME_ZONE = 'Asia/Dubai';
const HISTORY_DAYS = 90;

function uaeDate(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(d);
}

@Injectable()
export class PettyCashService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async summary() {
    const today = uaeDate(new Date());
    const since = uaeDate(new Date(Date.now() - HISTORY_DAYS * 86_400_000));

    const [collectedAgg, spentAgg, collectedByDay, expenses] = await Promise.all([
      this.prisma.repayment.aggregate({ _sum: { amount: true } }),
      this.prisma.pettyCashExpense.aggregate({ _sum: { amount: true } }),
      // collected_at is stored in UTC; group by the UAE calendar day.
      this.prisma.$queryRaw<Array<{ day: string; total: Prisma.Decimal }>>`
        SELECT t.day, SUM(t.amount) AS total
        FROM (
          SELECT to_char(("collected_at" AT TIME ZONE 'UTC') AT TIME ZONE ${TIME_ZONE}, 'YYYY-MM-DD') AS day,
                 "amount" AS amount
          FROM "repayments"
        ) t
        WHERE t.day >= ${since}
        GROUP BY t.day
      `,
      this.prisma.pettyCashExpense.findMany({
        where: { spentOn: { gte: since } },
        orderBy: [{ spentOn: 'desc' }, { createdAt: 'desc' }],
        include: { recordedBy: { select: { id: true, name: true } } },
      }),
    ]);

    const days = new Map<
      string,
      {
        date: string;
        collected: number;
        spent: number;
        expenses: Array<{
          id: string;
          amount: number;
          purpose: string;
          recordedBy: { id: string; name: string };
          createdAt: Date;
        }>;
      }
    >();
    const dayOf = (date: string) => {
      let d = days.get(date);
      if (!d) {
        d = { date, collected: 0, spent: 0, expenses: [] };
        days.set(date, d);
      }
      return d;
    };

    for (const row of collectedByDay) {
      dayOf(row.day).collected = Number(row.total);
    }
    for (const e of expenses) {
      const d = dayOf(e.spentOn);
      const amount = Number(e.amount);
      d.spent += amount;
      d.expenses.push({
        id: e.id,
        amount,
        purpose: e.purpose,
        recordedBy: e.recordedBy,
        createdAt: e.createdAt,
      });
    }

    const totalCollected = Number(collectedAgg._sum.amount ?? 0);
    const totalSpent = Number(spentAgg._sum.amount ?? 0);
    const todayRow = days.get(today);

    return {
      today,
      totalCollected,
      totalSpent,
      balance: totalCollected - totalSpent,
      todayCollected: todayRow?.collected ?? 0,
      todaySpent: todayRow?.spent ?? 0,
      days: [...days.values()].sort((a, b) => b.date.localeCompare(a.date)),
    };
  }

  async create(dto: CreateExpenseDto, userId: string) {
    const spentOn = dto.spentOn;
    const parsed = new Date(`${spentOn}T00:00:00Z`);
    if (Number.isNaN(parsed.getTime()) || uaeDate(parsed) !== spentOn) {
      throw new BadRequestException('Invalid date');
    }
    if (spentOn > uaeDate(new Date())) {
      throw new BadRequestException('Date cannot be in the future');
    }

    const expense = await this.prisma.pettyCashExpense.create({
      data: {
        amount: new Prisma.Decimal(dto.amount),
        spentOn,
        purpose: dto.purpose.trim(),
        recordedById: String(userId),
      },
    });

    await this.audit.log({
      userId,
      action: 'PETTY_CASH_EXPENSE',
      recordType: 'petty_cash',
      recordId: expense.id,
      metadata: { amount: dto.amount, spentOn },
    });

    return { id: expense.id };
  }

  async remove(id: string, userId: string) {
    const expense = await this.prisma.pettyCashExpense.findUnique({
      where: { id: String(id) },
    });
    if (!expense) throw new NotFoundException('Expense not found');

    await this.prisma.pettyCashExpense.delete({ where: { id: expense.id } });
    await this.audit.log({
      userId,
      action: 'PETTY_CASH_EXPENSE_DELETE',
      recordType: 'petty_cash',
      recordId: expense.id,
      metadata: {
        amount: Number(expense.amount),
        spentOn: expense.spentOn,
        purpose: expense.purpose,
      },
    });
    return { ok: true };
  }
}
