'use client';

import Link from 'next/link';
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
};

export function TodayPendingNotice({
  date,
  items,
}: {
  date: string;
  items: PendingTodayItem[];
}) {
  if (!items.length) return null;

  return (
    <div
      className="fixed right-3 top-[3.75rem] z-40 w-[min(100vw-1.5rem,22rem)] rounded-xl border border-amber-300 bg-amber-50 shadow-lg ring-1 ring-amber-200/80 sm:right-5"
      role="status"
      aria-live="polite"
    >
      <div className="border-b border-amber-200/80 px-4 py-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-900">
          Today · {date}
        </p>
        <p className="mt-0.5 text-sm font-semibold text-amber-950">
          Collection pending ({items.length})
        </p>
      </div>
      <ul className="max-h-64 overflow-y-auto px-2 py-2">
        {items.map((row) => (
          <li
            key={row.loanId}
            className="rounded-lg px-2 py-2 text-sm hover:bg-amber-100/80"
          >
            <p className="font-medium text-slate-900">{row.customerName}</p>
            <p className="text-xs text-amber-900">
              Pending today:{' '}
              <span className="font-semibold">{money(row.pendingTodayAed)}</span>
              {row.collectedTodayAed > 0 ? (
                <span className="text-amber-800">
                  {' '}
                  ({money(row.collectedTodayAed)} received)
                </span>
              ) : null}
            </p>
            <Link
              href={`/collections?customer=${encodeURIComponent(row.customerId)}`}
              className="mt-1 inline-block text-xs font-medium text-teal-800 underline"
            >
              Collect now
            </Link>
          </li>
        ))}
      </ul>
      <div className="border-t border-amber-200/80 px-4 py-2">
        <Link
          href="/collections"
          className="text-xs font-medium text-teal-800 underline"
        >
          Open collection page
        </Link>
      </div>
    </div>
  );
}
