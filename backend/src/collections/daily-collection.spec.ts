import { daysInArrears, dueTodayAed, overdueAed } from './daily-collection';

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
