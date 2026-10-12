'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
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

const dismissKey = (date: string) => `nvr_pending_reminder_${date}`;

export function TodayPendingNotice({
  date,
  items,
}: {
  date: string;
  items: PendingTodayItem[];
}) {
  const [closed, setClosed] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setClosed(sessionStorage.getItem(dismissKey(date)) === '1');
  }, [date]);

  if (!items.length || closed) return null;

  const totalPending = items.reduce((sum, row) => sum + row.pendingTodayAed, 0);
  const count = items.length;
  const label =
    count === 1
      ? `${items[0].customerName} — collection pending today`
      : `${count} collections pending today`;

  function dismiss() {
    sessionStorage.setItem(dismissKey(date), '1');
    setClosed(true);
  }

  return (
    <div
      className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200/80 bg-amber-50/95 px-3 py-2.5 text-sm text-amber-950 shadow-sm"
      role="status"
      aria-live="polite"
    >
      <p className="min-w-0 flex-1 leading-snug">
        <span className="font-medium">{label}</span>
        <span className="text-amber-900"> ({money(totalPending)})</span>
        .{' '}
        <Link
          href="/collections"
          className="font-medium text-teal-800 underline decoration-teal-800/40 underline-offset-2 hover:text-teal-900"
        >
          Open Collection
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-lg leading-none text-amber-900/70 hover:bg-amber-100 hover:text-amber-950"
        aria-label="Close reminder"
      >
        ×
      </button>
    </div>
  );
}
