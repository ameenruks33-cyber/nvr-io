import { RepaymentsService } from './repayments.service';

describe('RepaymentsService.computeBalance', () => {
  it('counts the balance down from the 2000 total', () => {
    const result = RepaymentsService.computeBalance(2000, 700, 300);
    expect(result).toEqual({
      collected: 1000,
      remaining: 1000,
      status: 'ACTIVE',
    });
  });

  it('keeps the account open with 200 left at 1800 collected', () => {
    const result = RepaymentsService.computeBalance(2000, 1700, 100);
    expect(result).toEqual({
      collected: 1800,
      remaining: 200,
      status: 'ACTIVE',
    });
  });

  it('closes the account when the full 2000 is collected', () => {
    const result = RepaymentsService.computeBalance(2000, 1800, 200);
    expect(result).toEqual({
      collected: 2000,
      remaining: 0,
      status: 'COMPLETED',
    });
  });

  it('rejects payments beyond the total', () => {
    expect(() => RepaymentsService.computeBalance(2000, 1900, 200)).toThrow(
      'Payment exceeds outstanding amount',
    );
  });

  it('rejects non-positive payment', () => {
    expect(() => RepaymentsService.computeBalance(2000, 0, 0)).toThrow(
      'Amount must be positive',
    );
  });
});
