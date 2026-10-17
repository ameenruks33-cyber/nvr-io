import { remainingCash, samePlanRenewalPayout } from './renew-plan';

describe('samePlanRenewalPayout', () => {
  it('deducts outstanding from the wallet as petty cash', () => {
    expect(
      samePlanRenewalPayout({
        outstanding: 700,
        newPrincipal: 1800,
        payNewCash: false,
      }),
    ).toEqual({
      outstanding: 700,
      pettyCashOutstanding: 700,
      pettyCashNewCash: 0,
      walletOut: 700,
    });
  });

  it('can also pay new plan cash in the same renewal', () => {
    expect(
      samePlanRenewalPayout({
        outstanding: 700,
        newPrincipal: 1800,
        payNewCash: true,
      }).walletOut,
    ).toBe(2500);
  });

  it('treats a fully paid plan as nothing outstanding', () => {
    expect(remainingCash(0)).toBe(0);
    expect(
      samePlanRenewalPayout({
        outstanding: 0,
        newPrincipal: 1800,
        payNewCash: true,
      }),
    ).toMatchObject({ pettyCashOutstanding: 0, pettyCashNewCash: 1800 });
  });
});
