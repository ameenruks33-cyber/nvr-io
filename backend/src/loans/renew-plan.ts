/** One account at a time: remaining cash must be collected before a new plan opens. */

export function roundMoney(n: number) {
  return Math.round((Number(n) || 0) * 100) / 100;
}

export function remainingCash(remainingAmount: number) {
  return roundMoney(Math.max(0, Number(remainingAmount) || 0));
}

export function renewalSettlement(remainingAmount: number, settleRemaining: boolean) {
  const due = remainingCash(remainingAmount);
  if (due > 0.001 && !settleRemaining) {
    return {
      ok: false as const,
      due,
      collect: 0,
      error: 'Collect the remaining cash to close this plan, then renew.',
    };
  }
  return {
    ok: true as const,
    due,
    collect: due > 0.001 ? due : 0,
    error: null as string | null,
  };
}
