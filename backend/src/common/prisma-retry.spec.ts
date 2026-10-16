import { isRetryablePrismaError, nextReceiptFromLatest } from './prisma-retry';

describe('receipt numbers', () => {
  it('starts at 1 when none exist', () => {
    expect(nextReceiptFromLatest(null)).toBe('JB-RCP-00000001');
  });

  it('increments the highest existing receipt, including after deletes', () => {
    expect(nextReceiptFromLatest('JB-RCP-00000014')).toBe('JB-RCP-00000015');
  });
});

describe('retryable prisma errors', () => {
  it('retries write conflicts and unique collisions', () => {
    expect(isRetryablePrismaError({ code: 'P2034' })).toBe(true);
    expect(isRetryablePrismaError({ code: 'P2002' })).toBe(true);
    expect(isRetryablePrismaError({ code: 'P2003' })).toBe(false);
  });
});
