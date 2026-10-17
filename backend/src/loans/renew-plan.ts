/** Cash renewal: outstanding goes into the wallet; net cash given is principal − outstanding. */

export function roundMoney(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function remainingCash(remainingAmount: number) {
  return roundMoney(Math.max(0, Number(remainingAmount) || 0));
}

export const PREVIOUS_BALANCE_PURPOSE = 'Previous balance';
export const RENEWAL_BALANCE_PURPOSE = 'Renewal balance';

/**
 * 2000 plan, 700 still due, 1800 cash given on a new cycle:
 * previous 700 into the wallet (closes the old 2000), 1100 paid out.
 */
export function samePlanCashRenewal(input: {
  outstanding: number;
  principal: number;
  payNewCash: boolean;
}) {
  const previousBalance = remainingCash(input.outstanding);
  const principal = roundMoney(Math.max(0, Number(input.principal) || 0));
  const renewalBalance = input.payNewCash
    ? roundMoney(Math.max(0, principal - previousBalance))
    : 0;
  return {
    previousBalance,
    renewalBalance,
    walletIn: previousBalance,
    pettyCashPrevious: previousBalance,
    pettyCashRenewal: renewalBalance,
    walletOut: roundMoney(previousBalance + renewalBalance),
    walletNet: roundMoney(previousBalance - (previousBalance + renewalBalance)),
    oldPlanCloses: previousBalance > 0.001,
  };
}
