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
      className="mb-4 w-full rounded-xl border border-amber-300 bg-amber-50 shadow-md ring-1 ring-amber-200/80 md:fixed md:right-5 md:top-[3.75rem] md:z-40 md:mb-0 md:w-[min(22rem,calc(100vw-2.5rem))] md:shadow-lg"
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
      <ul className="divide-y divide-amber-200/80 md:max-h-64 md:overflow-y-auto">
        {items.map((row) => (
          <li
            key={row.loanId}
            className="flex flex-col gap-2 px-3 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium text-slate-900">{row.customerName}</p>
              <p className="text-xs text-amber-900">
                Pending today:{' '}
                <span className="font-semibold">
                  {money(row.pendingTodayAed)}
                </span>
                {row.collectedTodayAed > 0 ? (
                  <span className="text-amber-800">
                    {' '}
                    ({money(row.collectedTodayAed)} received)
                  </span>
                ) : null}
              </p>
            </div>
            <Link
              href={`/collections?customer=${encodeURIComponent(row.customerId)}`}
              className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-lg bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-600 active:bg-teal-800"
            >
              Collect now
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
