import { uaeDateTimeToInstant } from './uae-instant';

describe('uaeDateTimeToInstant', () => {
  it('keeps the exact UAE clock time', () => {
    const at = uaeDateTimeToInstant('2026-10-17', '14:30');
    expect(at.toISOString()).toBe('2026-10-17T10:30:00.000Z');
  });
});
