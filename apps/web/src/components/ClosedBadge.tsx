export function ClosedBadge({ label = 'Account closed' }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-3 py-1 font-sans text-xs font-semibold text-emerald-800">
      <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
      {label}
    </span>
  );
}
