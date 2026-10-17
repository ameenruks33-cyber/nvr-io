import { closeoutWallet } from './closeout-wallet';

describe('closeoutWallet', () => {
  it('puts the remaining collection into the wallet and closes with no payout', () => {
    expect(closeoutWallet({ collectedNow: 700 })).toEqual({
      walletIn: 700,
      walletOut: 0,
      walletNet: 700,
    });
  });

  it('pays out only principal, not the plan total', () => {
    expect(
      closeoutWallet({ collectedNow: 2000, payoutPrincipal: 1800 }),
    ).toEqual({
      walletIn: 2000,
      walletOut: 1800,
      walletNet: 200,
    });
  });

  it('never treats a missing payout as the 2000 total', () => {
    expect(closeoutWallet({ collectedNow: 300 }).walletOut).toBe(0);
  });
});
