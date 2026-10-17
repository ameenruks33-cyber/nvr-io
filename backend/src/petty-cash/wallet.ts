/** Cash on hand = all collections minus all petty-cash outflows. */
export function roundMoney(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function walletBalance(totalCollected: number, totalSpent: number) {
  return roundMoney(roundMoney(totalCollected) - roundMoney(totalSpent));
}
