const UAE = 'Asia/Dubai';

function uaeDay(d: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: UAE }).format(d);
}

function daysInclusive(from: Date, to: Date): number {
  const start = new Date(`${uaeDay(from)}T00:00:00+04:00`).getTime();
  const end = new Date(`${uaeDay(to)}T00:00:00+04:00`).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
  return Math.floor((end - start) / 86_400_000) + 1;
}

export type ArrearsLoan = {
  openedAt?: string | Date | null;
  createdAt?: string | Date | null;
  amountCollected?: string | number;
  remainingAmount?: string | number;
  dailyPayment?: string | number;
  totalPayable?: string | number;
  principalAmount?: string | number;
  status?: string;
  daysInArrears?: number;
};

/** Prefer the server total; fall back to the same missed-days math in the browser. */
export function loanDaysInArrears(loan?: ArrearsLoan | null): number {
  if (!loan) return 0;
  const fromApi = Number(loan.daysInArrears);
  if (Number.isFinite(fromApi) && fromApi > 0) return Math.round(fromApi);
  if (loan.status && loan.status !== 'ACTIVE') return 0;

  const remaining = Number(loan.remainingAmount || 0);
  if (!(remaining > 0.001)) return 0;
  const daily = Number(loan.dailyPayment || 100) || 100;
  const collected = Math.max(Number(loan.amountCollected || 0), 0);
  const total = Math.max(
    Number(loan.totalPayable || 0),
    Number(loan.principalAmount || 0),
    collected + remaining,
  );
  const opened = new Date(loan.openedAt || loan.createdAt || Date.now());
  if (Number.isNaN(opened.getTime())) return 1;

  const elapsed = daysInclusive(opened, new Date());
  const planDays = Math.max(1, Math.ceil(total / daily - 1e-9));
  const expected = Math.min(elapsed, planDays) * daily;
  const shortfall = Math.max(0, Math.min(expected, total) - collected);
  if (shortfall <= 0.001) return 0;
  return Math.min(
    Math.ceil(shortfall / daily - 1e-9),
    Math.ceil(remaining / daily - 1e-9),
  );
}

export function newIdempotencyKey(): string {
  try {
    return crypto.randomUUID();
  } catch {
    return `k-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
}
