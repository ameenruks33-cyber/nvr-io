'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, money } from '@/lib/api';

type Row = {
  id: string;
  amount: string | number;
  receiptNumber: string;
  collectedAt: string;
  notes?: string | null;
  collectedBy: { name: string };
  loan: {
    customer: { name: string; customerCode: string };
  };
};

export default function RepaymentsPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api<Row[]>('/repayments?limit=50').then(setRows);
  }, []);

  return (
    <AppShell>
      <h1 className="mb-6 font-display text-3xl text-slate-900">Receipts</h1>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white text-slate-500">
            <tr>
              <th className="px-4 py-3">Receipt</th>
              <th className="px-4 py-3">Customer</th>
              <th className="px-4 py-3">Amount</th>
              <th className="px-4 py-3">Note</th>
              <th className="px-4 py-3">Collector</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const a = Number(row.amount);
              const ok = a >= 100 && a <= 1800;
              return (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-mono text-xs">
                    {row.receiptNumber}
                  </td>
                  <td className="px-4 py-3">
                    {row.loan.customer.customerCode} · {row.loan.customer.name}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex items-center gap-1.5 ${
                        ok ? 'text-teal-700' : 'text-red-600'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          ok ? 'bg-teal-400' : 'bg-red-400'
                        }`}
                      />
                      {money(a)}
                    </span>
                  </td>
                  <td className="max-w-[200px] truncate px-4 py-3 text-slate-500">
                    {row.notes?.trim() || '—'}
                  </td>
                  <td className="px-4 py-3">{row.collectedBy.name}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(row.collectedAt).toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
