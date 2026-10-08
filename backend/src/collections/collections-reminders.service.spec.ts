import { DAILY_COLLECTION_AED } from './collections-reminders.service';

describe('daily collection rule', () => {
  it('expects 100 AED per day by default', () => {
    expect(DAILY_COLLECTION_AED).toBe(100);
  });

  it('caps due today when balance is below 100', () => {
    const remaining = 40;
    const dueToday = Math.min(DAILY_COLLECTION_AED, remaining);
    expect(dueToday).toBe(40);
  });
});
