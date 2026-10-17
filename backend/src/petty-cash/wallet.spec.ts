import { roundMoney, walletBalance } from './wallet';

describe('walletBalance', () => {
  it('adds collections and subtracts petty-cash spend', () => {
    expect(walletBalance(3800, 2278)).toBe(1522);
  });

  it('drops as soon as an expense is recorded', () => {
    const before = walletBalance(3800, 2200);
    expect(before).toBe(1600);
    expect(walletBalance(3800, 2200 + 78)).toBe(1522);
  });

  it('rises as soon as a collection is recorded', () => {
    expect(walletBalance(3800 + 100, 2200)).toBe(1700);
  });

  it('rounds to fils', () => {
    expect(roundMoney(10.1)).toBe(10.1);
    expect(walletBalance(100.1, 0.2)).toBe(99.9);
  });
});
