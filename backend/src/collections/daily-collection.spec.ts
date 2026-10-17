import {
  daysInArrears,
  dueTodayAed,
  nextDueAtFromRepayments,
  overdueAed,
} from './daily-collection';

function loan(partial: {
  openedAt: string;
  amountCollected: number;
  remainingAmount: number;
  dailyPayment?: number;
  totalPayable?: number;
}) {
  return {
    status: 'ACTIVE' as const,
    dailyPayment: partial.dailyPayment ?? 100,
    totalPayable: partial.totalPayable ?? 1000,
    principalAmount: 800,
    ...partial,
  };
}

describe('days in arrears', () => {
  const now = new Date('2026-10-16T12:00:00+04:00');

  it('counts today as one day when nothing is collected', () => {
    expect(
      daysInArrears(
        loan({
          openedAt: '2026-10-16T08:00:00+04:00',
          amountCollected: 0,
          remainingAmount: 1000,
        }),
        now,
      ),
    ).toBe(1);
  });

  it('adds every missed day, not only today', () => {
    expect(
      daysInArrears(
        loan({
          openedAt: '2026-10-14T09:00:00+04:00',
          amountCollected: 0,
          remainingAmount: 1000,
        }),
        now,
      ),
    ).toBe(3);
  });

  it('deducts a payment from overdue money', () => {
    const before = overdueAed(
      loan({
        openedAt: '2026-10-14T09:00:00+04:00',
        amountCollected: 0,
        remainingAmount: 1000,
      }),
      now,
    );
    const after = overdueAed(
      loan({
        openedAt: '2026-10-14T09:00:00+04:00',
        amountCollected: 200,
        remainingAmount: 800,
      }),
      now,
    );
    expect(before).toBe(300);
    expect(after).toBe(100);
  });

  it('reduces arrears by paid daily amounts', () => {
    expect(
      daysInArrears(
        loan({
          openedAt: '2026-10-14T09:00:00+04:00',
          amountCollected: 200,
          remainingAmount: 800,
        }),
        now,
      ),
    ).toBe(1);
  });

  it('is zero when collections match elapsed days', () => {
    expect(
      daysInArrears(
        loan({
          openedAt: '2026-10-14T09:00:00+04:00',
          amountCollected: 300,
          remainingAmount: 700,
        }),
        now,
      ),
    ).toBe(0);
  });

  it('does not exceed remaining daily slots after the plan length', () => {
    expect(
      daysInArrears(
        loan({
          openedAt: '2026-09-01T09:00:00+04:00',
          amountCollected: 0,
          remainingAmount: 1000,
          totalPayable: 1000,
        }),
        now,
      ),
    ).toBe(10);
  });

  it('caps overdue money at the remaining balance', () => {
    expect(
      overdueAed(
        loan({
          openedAt: '2026-10-14T09:00:00+04:00',
          amountCollected: 0,
          remainingAmount: 250,
          dailyPayment: 100,
          totalPayable: 1000,
        }),
        now,
      ),
    ).toBe(250);
  });

  it('is zero on a closed account', () => {
    expect(
      daysInArrears({
        ...loan({
          openedAt: '2026-10-01T09:00:00+04:00',
          amountCollected: 1000,
          remainingAmount: 0,
        }),
        status: 'COMPLETED',
      }),
    ).toBe(0);
  });
});

describe('due today', () => {
  it('uses the account daily amount', () => {
    expect(dueTodayAed(800, 50)).toBe(50);
  });
});

describe('prepaid next due', () => {
  it('starts a 10-day clock from a lump at 8:41 AM and extends with the next lump', () => {
    const due = nextDueAtFromRepayments(
      {
        status: 'ACTIVE',
        remainingAmount: 700,
        dailyPayment: 100,
        cycle: 1,
      },
      [
        { amount: 100, collectedAt: '2026-10-10T11:02:47.112Z', cycle: 1 },
        { amount: 100, collectedAt: '2026-10-11T16:51:30.453Z', cycle: 1 },
        { amount: 100, collectedAt: '2026-10-13T13:42:28.203Z', cycle: 1 },
        { amount: 500, collectedAt: '2026-10-14T04:41:04.467Z', cycle: 1 },
        { amount: 500, collectedAt: '2026-10-17T11:03:38.637Z', cycle: 1 },
      ],
    );
    expect(due?.toISOString()).toBe('2026-10-24T04:41:04.467Z');
  });
});
