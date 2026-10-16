'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { arrearsText } from '@/components/ArrearsBadge';
import { money } from '@/lib/api';

export type PendingTodayItem = {
  customerId: string;
  customerName: string;
  customerCode: string;
  loanId: string;
  pendingTodayAed: number;
  collectedTodayAed: number;
  dueTodayAed: number;
  remainingBalance: number;
  daysInArrears?: number;
  overdueAed?: number;
  dailyPayment?: number;
};

const dismissKey = (date: string) => `nvr_pending_reminder_${date}`;

export function TodayPendingNotice({
  date,
  items,
}: {
  date: string;
  items: PendingTodayItem[];
}) {
  const [closed, setClosed] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setClosed(sessionStorage.getItem(dismissKey(date)) === '1');
  }, [date]);

  const visible = items.filter(
    (row) => (row.overdueAed ?? row.pendingTodayAed) > 0.001,
  );
  const totalOverdue = visible.reduce(
    (sum, row) => sum + (row.overdueAed ?? row.pendingTodayAed),
    0,
  );
  const totalDays = visible.reduce((sum, row) => sum + (row.daysInArrears || 0), 0);

  if (!visible.length || closed) return null;
  const count = visible.length;
  const label =
    count === 1
      ? `${visible[0].customerName} — ${arrearsText(visible[0].daysInArrears || 1)}`
      : `${count} accounts overdue (${totalDays} ${totalDays === 1 ? 'day' : 'days'} in arrears)`;

  function dismiss() {
    sessionStorage.setItem(dismissKey(date), '1');
    setClosed(true);
    setExpanded(false);
  }

  return (
    <div
      className="mb-4 overflow-hidden rounded-lg border border-amber-200/80 bg-amber-50/95 text-sm text-amber-950 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="min-h-11 min-w-0 flex-1 px-3 py-2.5 text-left leading-snug active:bg-amber-100/80"
          aria-expanded={expanded}
          aria-controls="pending-customers-list"
        >
          <span className="font-medium">{label}</span>
          <span className="text-amber-900"> ({money(totalOverdue)})</span>.
          <span className="mt-0.5 block text-xs font-normal text-amber-800/90">
            {expanded ? 'Tap to hide names' : 'Tap to see names'}
          </span>
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            dismiss();
          }}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-lg leading-none text-amber-900/70 hover:bg-amber-100 hover:text-amber-950"
          aria-label="Close reminder"
        >
          ×
        </button>
      </div>
      {expanded ? (
        <ul
          id="pending-customers-list"
          className="max-h-48 overflow-y-auto border-t border-amber-200/80 bg-white/60 px-3 py-2"
        >
          {visible.map((row) => (
            <li
              key={row.loanId}
              className="flex items-center justify-between gap-2 border-b border-amber-100/80 py-2 last:border-0"
            >
              <span className="min-w-0 truncate font-medium text-slate-900">
                {row.customerName}
                <span className="mt-0.5 block text-xs font-normal text-amber-800/90">
                  {arrearsText(row.daysInArrears || 1)}
                </span>
              </span>
              <Link
                href={`/collections?customer=${encodeURIComponent(row.customerId)}`}
                className="shrink-0 text-xs font-medium text-teal-800 underline underline-offset-2"
                onClick={(e) => e.stopPropagation()}
              >
                {money(row.overdueAed ?? row.pendingTodayAed)}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
