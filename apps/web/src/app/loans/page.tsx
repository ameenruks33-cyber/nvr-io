'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { ClosedBadge } from '@/components/ClosedBadge';
import { api, money } from '@/lib/api';
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

  const load = () => {
    api<LoanRow[]>('/loans').then(setRows).catch(() => undefined);
  };

  useEffect(load, []);
  useLiveRefresh(load);

  return (
    <AppShell>
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
                  {money(
                    Math.max(
                      Number(row.totalPayable || 2000),
                      Number(row.principalAmount),
                    ),
                  )}
                </td>
                <td className="px-4 py-3">
                  {row.status === 'ACTIVE' ? (
                    money(Number(row.remainingAmount))
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
