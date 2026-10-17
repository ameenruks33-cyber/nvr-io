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

/** Unpaid collection money vs what should have been collected by today. */
export function arrearsShortfallAed(
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
  if (Number.isNaN(opened.getTime())) return Math.min(daily, remaining);

  const elapsedDays = uaeCalendarDaysInclusive(opened, now);
  const planDays = Math.max(1, Math.ceil(total / daily - 1e-9));
  const expectedDays = Math.min(elapsedDays, planDays);
  const expectedCollected = Math.min(expectedDays * daily, total);
  const shortfall = Math.max(0, expectedCollected - collected);
  return Math.min(shortfall, remaining);
}

/**
 * Missed collection days since the account opened (UAE calendar),
 * not only whether today is unpaid.
 */
export function daysInArrears(
  loan: LoanArrearsInput,
  now: Date = new Date(),
): number {
  const shortfall = arrearsShortfallAed(loan, now);
  if (shortfall <= 0.001) return 0;
  const daily = dailyAmountOf(loan.dailyPayment);
  return Math.ceil(shortfall / daily - 1e-9);
}

export function overdueAed(loan: LoanArrearsInput, now: Date = new Date()): number {
  return arrearsShortfallAed(loan, now);
}

export type PrepaidRepayment = {
  collectedAt: Date | string;
  amount: unknown;
  cycle?: unknown;
};

function cycleOf(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/**
 * Next collection due instant from prepaid cover.
 * A lump (more than one daily amount) starts a new clock at that payment’s
 * time; later receipts while still covered extend that clock.
 */
export function nextDueAtFromRepayments(
  loan: LoanArrearsInput & { cycle?: unknown },
  repayments: PrepaidRepayment[],
): Date | null {
  if (loan.status && loan.status !== 'ACTIVE') return null;
  if (asAmount(loan.remainingAmount) <= 0.001) return null;
  const daily = dailyAmountOf(loan.dailyPayment);
  const cycle = cycleOf(loan.cycle);
  const rows = [...repayments]
    .filter((r) => cycleOf(r.cycle) === cycle)
    .sort(
      (a, b) =>
        new Date(a.collectedAt).getTime() - new Date(b.collectedAt).getTime(),
    );
  let coverEnd: Date | null = null;
  let inPrepaid = false;
  for (const row of rows) {
    const amount = asAmount(row.amount);
    if (amount <= 0) continue;
    const days = amount / daily;
    const at = new Date(row.collectedAt);
    if (Number.isNaN(at.getTime())) continue;
    const lump = amount > daily + 0.001;
    let base: Date;
    if (!coverEnd || at.getTime() > coverEnd.getTime()) {
      base = at;
      inPrepaid = lump;
    } else if (lump) {
      base = inPrepaid ? coverEnd : at;
      inPrepaid = true;
    } else {
      base = coverEnd;
      inPrepaid = false;
    }
    coverEnd = new Date(base.getTime() + days * 86_400_000);
  }
  return coverEnd;
}

export function prepaidIsDue(nextDueAt: Date | null, now: Date = new Date()) {
  return Boolean(nextDueAt && now.getTime() >= nextDueAt.getTime());
}

export function attachArrears<T extends LoanArrearsInput & { cycle?: unknown; repayments?: PrepaidRepayment[] }>(
  loan: T,
  now: Date = new Date(),
): T & {
  amountCollected: number;
  remainingAmount: number;
  daysInArrears: number;
  overdueAed: number;
  nextDueAt: string | null;
} {
  const collected = asAmount(loan.amountCollected);
  const remaining = asAmount(loan.remainingAmount);
  const numbered = {
    ...loan,
    amountCollected: collected,
    remainingAmount: remaining,
    principalAmount: asAmount(loan.principalAmount),
    totalPayable: asAmount(loan.totalPayable),
    dailyPayment: dailyAmountOf(loan.dailyPayment),
  };
  const days = daysInArrears(numbered, now);
  const nextDue = Array.isArray(loan.repayments)
    ? nextDueAtFromRepayments(numbered, loan.repayments)
    : null;
  return {
    ...numbered,
    daysInArrears: days,
    overdueAed: overdueAed(numbered, now),
    nextDueAt: nextDue ? nextDue.toISOString() : null,
  };
}
