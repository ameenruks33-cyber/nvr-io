import { samePlanCashRenewal } from './renew-plan';

describe('samePlanCashRenewal', () => {
  it('puts 700 previous balance into the wallet and pays out 1100', () => {
    expect(
      samePlanCashRenewal({
        outstanding: 700,
        principal: 1800,
        payNewCash: true,
      }),
    ).toEqual({
      previousBalance: 700,
      renewalBalance: 1100,
      walletIn: 700,
      pettyCashPrevious: 700,
      pettyCashRenewal: 1100,
      walletOut: 1800,
      walletNet: -1100,
      oldPlanCloses: true,
    });
  });

  it('pays full principal when nothing is outstanding', () => {
    expect(
      samePlanCashRenewal({
        outstanding: 0,
        principal: 1800,
        payNewCash: true,
      }).renewalBalance,
    ).toBe(1800);
  });
});
