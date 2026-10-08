/** Expected collection from each open customer every UAE calendar day. */
export const DAILY_COLLECTION_AED = 100;

export function dueTodayAed(remainingBalance: number): number {
  return Math.min(DAILY_COLLECTION_AED, Math.max(remainingBalance, 0));
}
