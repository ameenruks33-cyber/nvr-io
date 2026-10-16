export function arrearsText(days?: number | null): string {
  const n = Math.round(Number(days || 0));
  if (!Number.isFinite(n) || n <= 0) return '';
  return n === 1 ? '1 day overdue' : `${n} days overdue`;
}

export function ArrearsBadge({ days }: { days?: number | null }) {
  const label = arrearsText(days);
  if (!label) return null;
  return (
    <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
      {label}
    </span>
  );
}
