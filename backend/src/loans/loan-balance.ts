/** Source of truth: sum of this cycle’s collections vs plan total. */
export function loanBalanceFromCollected(
  totalPayable: number,
  principal: number,
  collected: number,
) {
  const total = Math.max(Number(totalPayable) || 0, Number(principal) || 0);
  const paid = Math.max(Number(collected) || 0, 0);
  const remaining = Math.max(total - paid, 0);
  const completed = remaining <= 0.001 && paid + 0.001 >= total;
  return {
    collected: paid,
    remaining: completed ? 0 : remaining,
    status: completed ? ('COMPLETED' as const) : ('ACTIVE' as const),
  };
}

export function loanCycle(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
}

/** Recalculate every account from the current cycle’s collection rows (skips manually CLOSED). */
export const RECONCILE_LOAN_BALANCES_SQL = `
UPDATE "loans" AS l
SET
  "amount_collected" = p.paid,
  "remaining_amount" = CASE
    WHEN p.paid >= GREATEST(l."total_payable", l."principal_amount") - 0.001 THEN 0
    ELSE GREATEST(GREATEST(l."total_payable", l."principal_amount") - p.paid, 0)
  END,
  "status" = CASE
    WHEN l."status" = 'CLOSED' THEN l."status"
    WHEN p.paid >= GREATEST(l."total_payable", l."principal_amount") - 0.001 THEN 'COMPLETED'::"LoanStatus"
    ELSE 'ACTIVE'::"LoanStatus"
  END,
  "completed_at" = CASE
    WHEN l."status" = 'CLOSED' THEN l."completed_at"
    WHEN p.paid >= GREATEST(l."total_payable", l."principal_amount") - 0.001 THEN COALESCE(l."completed_at", NOW())
    ELSE NULL
  END,
  "closed_at" = CASE
    WHEN l."status" = 'CLOSED' THEN l."closed_at"
    WHEN p.paid >= GREATEST(l."total_payable", l."principal_amount") - 0.001 THEN COALESCE(l."closed_at", NOW())
    ELSE NULL
  END
FROM (
  SELECT l2."id" AS id, COALESCE(SUM(r."amount"), 0) AS paid
  FROM "loans" l2
  LEFT JOIN "repayments" r
    ON r."loan_id" = l2."id"
   AND COALESCE(r."cycle", 1) = COALESCE(l2."cycle", 1)
  GROUP BY l2."id"
) AS p
WHERE l."id" = p.id;
`;
