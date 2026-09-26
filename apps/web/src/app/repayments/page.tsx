'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, money } from '@/lib/api';

type Row = {
  id: string;
  amount: string | number;
  receiptNumber: string;
  collectedAt: string;
  collectedBy: { name: string };
  loan: {
    customer: { name: string; customerCode: string };
  };
};

export default function RepaymentsPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api<Row[]>('/repayments').then(setRows);
  }, []);

  return (
    <AppShell>
      <h1 className="mb-6 font-display text-3xl text-white">Receipts</h1>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ink-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Collector</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/5">
                <td className="px-4 py-3 font-mono text-xs">
                  {row.receiptNumber}
                </td>
                <td className="px-4 py-3">
                  {row.loan.customer.customerCode} · {row.loan.customer.name}
                </td>
                <td className="px-4 py-3">{money(Number(row.amount))}</td>
                <td className="px-4 py-3">{row.collectedBy.name}</td>
                <td className="px-4 py-3 text-slate-400">
                  {new Date(row.collectedAt).toLocaleString()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
