import { roundMoney } from './renew-plan';

/**
 * Closing a plan: leftover collections go into the wallet.
 * Cash paid to the customer is only the principal they actually receive,
 * never the 2,000 / 1,000 plan total.
 */
export function closeoutWallet(input: {
  collectedNow: number;
  payoutPrincipal?: number;
}) {
  const walletIn = roundMoney(Math.max(0, Number(input.collectedNow) || 0));
  const walletOut = roundMoney(
    Math.max(0, Number(input.payoutPrincipal) || 0),
  );
  return {
    walletIn,
    walletOut,
    walletNet: roundMoney(walletIn - walletOut),
  };
}
