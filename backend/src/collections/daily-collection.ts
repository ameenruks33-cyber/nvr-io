import { uaeCalendarDaysInclusive } from './uae-day';

/** Fallback daily collection when a loan has no dailyPayment set. */
export const DAILY_COLLECTION_AED = 100;

function asAmount(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function dailyAmountOf(value: unknown): number {
  const n = asAmount(value, DAILY_COLLECTION_AED);
  return n > 0 ? n : DAILY_COLLECTION_AED;
}

/** Today's expected collection for one account (plan daily amount, or remaining). */
export function dueTodayAed(
  remainingBalance: number,
  dailyAmount: number = DAILY_COLLECTION_AED,
): number {
  const daily = dailyAmountOf(dailyAmount);
  return Math.min(daily, Math.max(remainingBalance, 0));
}

export type LoanArrearsInput = {
  openedAt?: Date | string | null;
  createdAt?: Date | string | null;
  amountCollected?: unknown;
  remainingAmount?: unknown;
  dailyPayment?: unknown;
  totalPayable?: unknown;
  principalAmount?: unknown;
  status?: string | null;
};

/**
 * Missed collection days since the account opened (UAE calendar),
 * not only whether today is unpaid.
 */
export function daysInArrears(
  loan: LoanArrearsInput,
  now: Date = new Date(),
): number {
  if (loan.status && loan.status !== 'ACTIVE') return 0;
  const remaining = asAmount(loan.remainingAmount);
  if (remaining <= 0.001) return 0;

  const daily = dailyAmountOf(loan.dailyPayment);
  const collected = Math.max(asAmount(loan.amountCollected), 0);
  const total = Math.max(
    asAmount(loan.totalPayable),
    asAmount(loan.principalAmount),
    collected + remaining,
  );
  const opened = new Date(loan.openedAt || loan.createdAt || now);
  if (Number.isNaN(opened.getTime())) return remaining > 0.001 ? 1 : 0;

  const elapsedDays = uaeCalendarDaysInclusive(opened, now);
  const planDays = Math.max(1, Math.ceil(total / daily - 1e-9));
  const expectedDays = Math.min(elapsedDays, planDays);
  const expectedCollected = Math.min(expectedDays * daily, total);
  const shortfall = Math.max(0, expectedCollected - collected);
  if (shortfall <= 0.001) return 0;
  return Math.min(
    Math.ceil(shortfall / daily - 1e-9),
    Math.ceil(remaining / daily - 1e-9),
  );
}

export function overdueAed(loan: LoanArrearsInput, now: Date = new Date()): number {
  const days = daysInArrears(loan, now);
  if (days <= 0) return 0;
  const daily = dailyAmountOf(loan.dailyPayment);
  return Math.min(days * daily, Math.max(asAmount(loan.remainingAmount), 0));
}

export function attachArrears<T extends LoanArrearsInput>(
  loan: T,
  now: Date = new Date(),
): T & { daysInArrears: number; overdueAed: number } {
  const days = daysInArrears(loan, now);
  return {
    ...loan,
    daysInArrears: days,
    overdueAed: overdueAed(loan, now),
  };
}
