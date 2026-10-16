import { loanBalanceFromCollected } from './loan-balance';

describe('loanBalanceFromCollected', () => {
  it('deducts a payment from remaining', () => {
    expect(loanBalanceFromCollected(2000, 1800, 1600)).toEqual({
      collected: 1600,
      remaining: 400,
      status: 'ACTIVE',
    });
  });

  it('closes when collected matches the full total', () => {
    expect(loanBalanceFromCollected(2000, 1800, 2000)).toEqual({
      collected: 2000,
      remaining: 0,
      status: 'COMPLETED',
    });
  });

  it('keeps remaining in sync when nothing is collected', () => {
    expect(loanBalanceFromCollected(1000, 800, 0)).toEqual({
      collected: 0,
      remaining: 1000,
      status: 'ACTIVE',
    });
  });
});
