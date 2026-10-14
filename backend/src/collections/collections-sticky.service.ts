import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PettyCashService } from '../petty-cash/petty-cash.service';
import { parseStickyWalletLines } from './sticky-wallet-lines';

const SETTINGS_ID = 'default';
const MAX_LEN = 1000;
/** Matches petty-cash “pay customer” entries created from the collections sticky note. */
export const STICKY_WALLET_PURPOSE = 'Sticky note · customer payout';
const MIN_WALLET_AMOUNT = 100;

const TIME_ZONE = 'Asia/Dubai';

function uaeDate(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE }).format(d);
}

@Injectable()
export class CollectionsStickyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pettyCash: PettyCashService,
  ) {}

  async get() {
    const row = await this.prisma.appSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: { collectionsStickyNote: true, updatedAt: true },
    });
    return {
      text: row?.collectionsStickyNote?.trim() || '',
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  }

  private async matchCustomer(label: string) {
    const q = label.trim();
    if (!q) return null;

    if (/^JB-CUS-/i.test(q)) {
      return this.prisma.customer.findFirst({
        where: { customerCode: { equals: q, mode: 'insensitive' } },
        select: { id: true, name: true, customerCode: true },
      });
    }

    const exact = await this.prisma.customer.findMany({
      where: { name: { equals: q, mode: 'insensitive' } },
      select: { id: true, name: true, customerCode: true },
      take: 2,
    });
    if (exact.length === 1) return exact[0];

    const partial = await this.prisma.customer.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, customerCode: true },
      take: 2,
    });
    if (partial.length === 1) return partial[0];

    return null;
  }

  private async applyWalletLines(text: string, userId: string) {
    const spentOn = uaeDate(new Date());
    const parsed = parseStickyWalletLines(text);

    const applied: Array<{
      name: string;
      amount: number;
      customerCode: string;
      customerName: string;
    }> = [];
    const updated: typeof applied = [];
    const unmatched: Array<{ name: string; amount: number }> = [];
    const skippedLowAmount: Array<{ name: string; amount: number }> = [];
    const byCustomer = new Map<
      string,
      { name: string; amount: number; customer: { id: string; name: string; customerCode: string } }
    >();

    for (const line of parsed) {
      if (line.amount < MIN_WALLET_AMOUNT) {
        skippedLowAmount.push(line);
        continue;
      }
      const customer = await this.matchCustomer(line.name);
      if (!customer) {
        unmatched.push(line);
        continue;
      }
      byCustomer.set(customer.id, { ...line, customer });
    }

    for (const { name, amount, customer } of byCustomer.values()) {

      const existing = await this.prisma.pettyCashExpense.findFirst({
        where: {
          customerId: customer.id,
          spentOn,
          purpose: STICKY_WALLET_PURPOSE,
        },
      });

      if (existing) {
        const prev = Number(existing.amount);
        if (prev !== amount) {
          await this.prisma.pettyCashExpense.update({
            where: { id: existing.id },
            data: { amount: new Prisma.Decimal(amount) },
          });
          updated.push({
            name,
            amount,
            customerCode: customer.customerCode,
            customerName: customer.name,
          });
        }
        continue;
      }

      await this.pettyCash.create(
        {
          amount,
          spentOn,
          customerId: customer.id,
          purpose: STICKY_WALLET_PURPOSE,
        },
        userId,
      );
      applied.push({
        name,
        amount,
        customerCode: customer.customerCode,
        customerName: customer.name,
      });
    }

    return { applied, updated, unmatched, skippedLowAmount };
  }

  async save(text: string, userId: string) {
    const trimmed = text.trim();
    if (trimmed.length > MAX_LEN) {
      throw new BadRequestException(`Sticky note must be at most ${MAX_LEN} characters`);
    }
    const row = await this.prisma.appSetting.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        collectionsStickyNote: trimmed || null,
      },
      update: {
        collectionsStickyNote: trimmed || null,
      },
      select: { collectionsStickyNote: true, updatedAt: true },
    });

    const wallet = await this.applyWalletLines(trimmed, userId);

    return {
      text: row.collectionsStickyNote?.trim() || '',
      updatedAt: row.updatedAt.toISOString(),
      wallet,
    };
  }
}
