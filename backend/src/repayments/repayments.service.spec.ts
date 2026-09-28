import { RepaymentsService } from './repayments.service';

describe('RepaymentsService.computeBalance', () => {
  it('counts the balance down from the 2000 total', () => {
    const result = RepaymentsService.computeBalance(1800, 2000, 700, 300);
    expect(result).toEqual({
      collected: 1000,
      remaining: 1000,
      status: 'ACTIVE',
    });
  });

  it('closes the account at 1800 collected and waives the rest', () => {
    const result = RepaymentsService.computeBalance(1800, 2000, 1700, 100);
    expect(result).toEqual({
      collected: 1800,
      remaining: 0,
      status: 'COMPLETED',
    });
  });

  it('rejects payments beyond the closing amount', () => {
    expect(() =>
      RepaymentsService.computeBalance(1800, 2000, 1750, 100),
    ).toThrow('Payment exceeds outstanding amount');
  });

  it('rejects non-positive payment', () => {
    expect(() => RepaymentsService.computeBalance(1800, 2000, 0, 0)).toThrow(
      'Amount must be positive',
    );
  });
});
