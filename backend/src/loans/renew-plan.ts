/** Same-account renewal: outstanding is paid from the wallet, not collected again. */

export function roundMoney(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function remainingCash(remainingAmount: number) {
  return roundMoney(Math.max(0, Number(remainingAmount) || 0));
}

export const RENEW_OUTSTANDING_PURPOSE =
  'Plan renewal — outstanding paid from wallet';
export const RENEW_CASH_PURPOSE = 'Plan renewal — cash paid to customer';

export function samePlanRenewalPayout(input: {
  outstanding: number;
  newPrincipal: number;
  payNewCash: boolean;
}) {
  const outstanding = remainingCash(input.outstanding);
  const cashGiven = input.payNewCash
    ? roundMoney(Math.max(0, Number(input.newPrincipal) || 0))
    : 0;
  return {
    outstanding,
    pettyCashOutstanding: outstanding,
    pettyCashNewCash: cashGiven,
    walletOut: roundMoney(outstanding + cashGiven),
  };
}
