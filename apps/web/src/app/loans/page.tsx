'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { PendingTodayBanner } from '@/components/PendingTodayBanner';
import { ClosedBadge } from '@/components/ClosedBadge';
import { api, money } from '@/lib/api';
import { loanTotals } from '@/lib/loan-plans';
import { useLiveRefresh } from '@/lib/live-sync';

type LoanRow = {
  id: string;
  status: string;
  principalAmount: string | number;
  totalPayable?: string | number;
  amountCollected: string | number;
  remainingAmount: string | number;
  customer: {
    id: string;
    customerCode: string;
    name: string;
    phone: string;
  };
};

export default function LoansPage() {
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [pendingLoanIds, setPendingLoanIds] = useState<Set<string>>(new Set());

  const load = () => {
    api<LoanRow[]>('/loans').then(setRows).catch(() => undefined);
    api<{ items: { loanId: string }[] }>('/collections/pending-today')
      .then((data) =>
        setPendingLoanIds(new Set(data.items.map((i) => i.loanId))),
      )
      .catch(() => setPendingLoanIds(new Set()));
  };

  useEffect(load, []);
  useLiveRefresh(load);

  return (
    <AppShell>
      <PendingTodayBanner />
      <header className="mb-6">
        <h1 className="font-display text-3xl text-slate-900">Records</h1>
        <p className="mt-1 text-sm text-slate-500">Payment tracking</p>
      </header>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white text-slate-500">
            <tr>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Collected</th>
              <th className="px-4 py-3">Balance</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-4 py-3">
                  <Link
                    href={`/customers/${row.customer.id}`}
                    className="text-teal-700 hover:underline"
                  >
                    {row.customer.customerCode} · {row.customer.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {money(Number(row.amountCollected))} /{' '}
                  {money(loanTotals(row).total)}
                </td>
                <td className="px-4 py-3">
                  {row.status === 'ACTIVE' ? (
                    <span className="inline-flex flex-wrap items-center gap-2">
                      {money(Number(row.remainingAmount))}
                      {pendingLoanIds.has(row.id) ? (
                        <span className="rounded-md bg-amber-50 px-2 py-0.5 text-xs text-amber-800">
                          Pending
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <ClosedBadge label="Closed" />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
