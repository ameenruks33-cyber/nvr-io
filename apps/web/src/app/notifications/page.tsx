'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { api, money } from '@/lib/api';
import { useLiveRefresh } from '@/lib/live-sync';

type Row = {
  id: string;
  type: string;
  message: string;
  status: string;
  createdAt: string;
  customer?: { id: string; name: string; customerCode: string } | null;
  loan?: {
    remainingAmount: string | number;
    totalPayable: string | number;
    principalAmount: string | number;
    status: string;
  } | null;
};

function typeLabel(type: string) {
  switch (type) {
    case 'COLLECTION_REMINDER':
      return 'Pending reminder';
    case 'REPAYMENT_RECEIVED':
      return 'Collection saved';
    case 'LOAN_COMPLETED':
      return 'Account closed';
    default:
      return type.replace(/_/g, ' ');
  }
}

function remainingFromRow(row: Row): number | null {
  if (!row.loan || row.loan.status !== 'ACTIVE') return null;
  const total = Math.max(
    Number(row.loan.totalPayable),
    Number(row.loan.principalAmount),
  );
  const rem = Number(row.loan.remainingAmount);
  return Number.isFinite(rem) ? rem : null;
}

export default function NotificationsPage() {
  const [rows, setRows] = useState<Row[]>([]);

  const load = () => {
    api<Row[]>('/notifications').then(setRows).catch(() => undefined);
  };

  useEffect(load, []);
  useLiveRefresh(load);

  return (
    <AppShell>
      <h1 className="mb-2 font-display text-3xl text-slate-900">Notifications</h1>
      <p className="mb-6 max-w-2xl text-sm text-slate-500">
        Collection confirmations appear when a payment is saved. Pending reminders
        are sent each morning (UAE time) to collectors and admins for accounts
        with no payment logged that day.
      </p>
      <ul className="space-y-3">
        {rows.map((row) => {
          const remaining = remainingFromRow(row);
          return (
            <li
              key={row.id}
              className="rounded-2xl border border-slate-200 bg-white p-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span className="font-medium text-slate-700">
                  {typeLabel(row.type)}
                </span>
                <span>{new Date(row.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-2 text-sm text-slate-900">{row.message}</p>
              {remaining != null && remaining > 0 ? (
                <p className="mt-2 text-sm font-semibold text-amber-800">
                  Remaining to collect: {money(remaining)}
                </p>
              ) : null}
              {row.customer ? (
                <p className="mt-1 text-xs text-slate-500">
                  {row.customer.customerCode} · {row.customer.name}
                  {' · '}
                  <Link
                    href={`/customers/${row.customer.id}`}
                    className="text-teal-700 underline"
                  >
                    Customer
                  </Link>
                  {' · '}
                  <Link href="/collections" className="text-teal-700 underline">
                    Collect
                  </Link>
                </p>
              ) : null}
            </li>
          );
        })}
      </ul>
      {!rows.length ? (
        <p className="text-sm text-slate-500">No notifications yet.</p>
      ) : null}
    </AppShell>
  );
}
