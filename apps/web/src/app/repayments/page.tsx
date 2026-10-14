'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { DeleteCollectionButton } from '@/components/DeleteCollectionButton';
import { api, getSession, money } from '@/lib/api';
import { isSuperAdminRole } from '@/lib/roles';
import { useLiveRefresh } from '@/lib/live-sync';
import { formatUaeDateTime } from '@/lib/uae-datetime';
import { loanTotals } from '@/lib/loan-plans';

type Row = {
  id: string;
  amount: string | number;
  receiptNumber: string;
  collectedAt: string;
  notes?: string | null;
  collectedBy: { name: string };
  loan: {
    totalPayable?: string | number;
    principalAmount?: string | number;
    customer: { name: string; customerCode: string };
  };
};

export default function RepaymentsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const load = () => {
    api<Row[]>('/repayments?limit=50').then(setRows).catch(() => undefined);
  };

  useEffect(load, []);
  useEffect(() => {
    setIsSuperAdmin(isSuperAdminRole(getSession()?.user.role));
  }, []);
  useLiveRefresh(load);

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
              {isSuperAdmin ? <th className="px-4 py-3"> </th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const a = Number(row.amount);
              const ok = a >= 100 && a <= loanTotals(row.loan).total;
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
                    {formatUaeDateTime(row.collectedAt)}
                  </td>
                  {isSuperAdmin ? (
                    <td className="px-4 py-3">
                      <DeleteCollectionButton
                        repaymentId={row.id}
                        receiptNumber={row.receiptNumber}
                        compact
                        onDeleted={load}
                      />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
