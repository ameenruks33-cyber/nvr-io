'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { ArrearsBadge } from '@/components/ArrearsBadge';
import { PendingTodayBanner } from '@/components/PendingTodayBanner';
import { ClosedBadge } from '@/components/ClosedBadge';
import { api, money } from '@/lib/api';
import { loanDaysInArrears } from '@/lib/arrears';
import { loanTotals } from '@/lib/loan-plans';
import { useLiveRefresh } from '@/lib/live-sync';

type CustomerRow = {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  loan?: {
    amountCollected: string | number;
    principalAmount: string | number;
    totalPayable?: string | number;
    dailyPayment?: string | number;
    remainingAmount?: string | number;
    openedAt?: string;
    status: string;
    daysInArrears?: number;
  };
};

export default function CustomersPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [error, setError] = useState('');
  const appliedSearch = useRef('');

  async function load(search = '') {
    appliedSearch.current = search;
    try {
      const data = await api<CustomerRow[]>(
        `/customers${search ? `?q=${encodeURIComponent(search)}` : ''}`,
      );
      setRows(data);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useLiveRefresh(() => {
    void load(appliedSearch.current);
  });

  function onSearch(e: FormEvent) {
    e.preventDefault();
    load(q);
  }

  return (
    <AppShell>
      <PendingTodayBanner />
      <header className="mb-6">
        <h1 className="font-display text-3xl text-slate-900">People</h1>
        <p className="mt-1 text-sm text-slate-500">
          Search by ID, name, or phone
        </p>
      </header>

      <form onSubmit={onSearch} className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Name / Phone / ID"
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-blue-50"
        >
          Search
        </button>
      </form>

      {error ? <p className="text-red-600">{error}</p> : null}

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white text-slate-500">
            <tr>
              <th className="px-4 py-3 font-medium">ID</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">WhatsApp</th>
              <th className="px-4 py-3 font-medium">Collected</th>
              <th className="px-4 py-3 font-medium"> </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const collected = Number(row.loan?.amountCollected || 0);
              const { total } = loanTotals(row.loan);
              const closed = Boolean(row.loan) && row.loan?.status !== 'ACTIVE';
              return (
                <tr
                  key={row.id}
                  className="border-t border-slate-100 hover:bg-white/[0.03]"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${row.id}`}
                      className="text-teal-700 hover:underline"
                    >
                      {row.customerCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{row.name}</td>
                  <td className="px-4 py-3">{row.phone}</td>
                  <td className="px-4 py-3">
                    {closed ? (
                      <ClosedBadge label="Closed" />
                    ) : (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {money(collected)} / {money(total)}
                        <ArrearsBadge days={loanDaysInArrears(row.loan)} />
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/customers/${row.id}#restore-account`}
                      className="rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50"
                    >
                      Restore
                    </Link>
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
