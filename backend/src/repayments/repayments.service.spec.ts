import { RepaymentsService } from './repayments.service';

describe('RepaymentsService.computeBalance', () => {
  it('tracks partial collections', () => {
    const result = RepaymentsService.computeBalance(1800, 700, 100);
    expect(result).toEqual({
      collected: 800,
      remaining: 1000,
      status: 'ACTIVE',
    });
  });

  it('marks loan completed at principal', () => {
    const result = RepaymentsService.computeBalance(1800, 1700, 100);
    expect(result).toEqual({
      collected: 1800,
      remaining: 0,
      status: 'COMPLETED',
    });
  });

  it('rejects overpayment', () => {
    expect(() => RepaymentsService.computeBalance(1800, 1750, 100)).toThrow(
      'Payment exceeds outstanding amount',
    );
  });

  it('rejects non-positive payment', () => {
    expect(() => RepaymentsService.computeBalance(1800, 0, 0)).toThrow(
      'Amount must be positive',
    );
  });
});
