/** Fallback daily collection when a loan has no dailyPayment set. */
export const DAILY_COLLECTION_AED = 100;

/** Today's expected collection for one account (plan daily amount, or remaining). */
export function dueTodayAed(
  remainingBalance: number,
  dailyAmount: number = DAILY_COLLECTION_AED,
): number {
  const daily = Number.isFinite(dailyAmount) && dailyAmount > 0
    ? dailyAmount
    : DAILY_COLLECTION_AED;
  return Math.min(daily, Math.max(remainingBalance, 0));
}
