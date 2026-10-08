import { DAILY_COLLECTION_AED, dueTodayAed } from './daily-collection';

describe('daily collection rule', () => {
  it('expects 100 AED per day', () => {
    expect(DAILY_COLLECTION_AED).toBe(100);
  });

  it('caps due today when balance is below 100', () => {
    expect(dueTodayAed(40)).toBe(40);
    expect(dueTodayAed(200)).toBe(100);
  });
});
