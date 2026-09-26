'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { api, money } from '@/lib/api';

type LoanRow = {
  id: string;
  status: string;
  principalAmount: string | number;
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

  useEffect(() => {
    api<LoanRow[]>('/loans').then(setRows);
  }, []);

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-white">Records</h1>
        <p className="mt-1 text-sm text-slate-400">Payment tracking</p>
      </header>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ink-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Collected</th>
              <th className="px-4 py-3">Remaining</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/5">
                <td className="px-4 py-3">
                  <Link
                    href={`/customers/${row.customer.id}`}
                    className="text-teal-300 hover:underline"
                  >
                    {row.customer.customerCode} · {row.customer.name}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {money(Number(row.amountCollected))} /{' '}
                  {money(Number(row.principalAmount))}
                </td>
                <td className="px-4 py-3">
                  {money(Number(row.remainingAmount))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
