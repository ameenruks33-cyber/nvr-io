import { remainingCash, renewalSettlement } from './renew-plan';

describe('renewalSettlement', () => {
  it('lets a fully paid plan renew with nothing to collect', () => {
    expect(renewalSettlement(0, true)).toEqual({
      ok: true,
      due: 0,
      collect: 0,
      error: null,
    });
  });

  it('collects the leftover cash on an open plan', () => {
    expect(renewalSettlement(300, true)).toEqual({
      ok: true,
      due: 300,
      collect: 300,
      error: null,
    });
  });

  it('blocks renewal while leftover cash is unpaid', () => {
    const result = renewalSettlement(150, false);
    expect(result.ok).toBe(false);
    expect(result.collect).toBe(0);
    expect(result.due).toBe(150);
  });

  it('treats tiny leftovers as settled', () => {
    expect(remainingCash(0.0004)).toBe(0);
    expect(renewalSettlement(0.0004, false).ok).toBe(true);
  });
});
