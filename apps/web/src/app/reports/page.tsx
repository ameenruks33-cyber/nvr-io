'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { api, money } from '@/lib/api';
import { useLiveRefresh } from '@/lib/live-sync';
import { formatUaeDateTime } from '@/lib/uae-datetime';
import { loanTotals } from '@/lib/loan-plans';

type Stats = {
  totalDisbursed: number;
  totalCollected: number;
  totalOutstanding: number;
  todaysCollections: number;
  activeLoans: number;
  completedLoans: number;
};

type Person = {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  loan?: {
    amountCollected: string | number;
    remainingAmount?: string | number;
    principalAmount: string | number;
    totalPayable?: string | number;
    status: string;
  };
};

type Receipt = {
  id: string;
  amount: string | number;
  receiptNumber: string;
  collectedAt: string;
  collectedBy: { name: string };
  loan: {
    customer: { id?: string; name: string; customerCode: string };
  };
};

export default function ReportsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [q, setQ] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [pickedId, setPickedId] = useState('');
  const [searched, setSearched] = useState(false);

  const load = () => {
    api<Stats>('/dashboard').then(setStats).catch(() => undefined);
  };

  useEffect(load, []);
  useLiveRefresh(load);

  async function onSearch(e: FormEvent) {
    e.preventDefault();
    const term = q.trim();
    setSearched(true);
    if (!term) {
      setPeople([]);
      setReceipts([]);
      setPickedId('');
      return;
    }
    try {
      const [cust, rec] = await Promise.all([
        api<Person[]>(`/customers?q=${encodeURIComponent(term)}`),
        api<Receipt[]>(
          `/repayments?q=${encodeURIComponent(term)}&limit=200`,
        ),
      ]);
      setPeople(cust);
      setReceipts(rec);
      setPickedId(cust.length === 1 ? cust[0].id : '');
    } catch {
      setPeople([]);
      setReceipts([]);
    }
  }

  const person = people.find((p) => p.id === pickedId) || people[0] || null;
  const personReceipts = person
    ? receipts.filter(
        (r) =>
          r.loan.customer.customerCode === person.customerCode ||
          r.loan.customer.name === person.name,
      )
    : receipts;
  const receiptTotal = personReceipts.reduce(
    (sum, r) => sum + Number(r.amount || 0),
    0,
  );

  return (
    <AppShell>
      <h1 className="mb-6 font-display text-3xl text-slate-900">Summary</h1>
      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['Total', money(stats.totalDisbursed)],
            ['Collected', money(stats.totalCollected)],
            ['Balance', money(stats.totalOutstanding)],
            ["Today's receipts", money(stats.todaysCollections)],
            ['Open records', String(stats.activeLoans)],
            ['Finished records', String(stats.completedLoans)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-slate-200 bg-white p-5"
            >
              <p className="text-xs uppercase text-slate-500">{label}</p>
              <p className="mt-2 font-display text-2xl">{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-500">Loading…</p>
      )}

      <section className="mt-10">
        <h2 className="font-display text-2xl text-slate-900">
          Collection report
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Search one person to see their collected total and receipts
        </p>
        <form onSubmit={onSearch} className="mt-4 flex gap-2">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Name / ID / Phone"
            className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2"
          />
          <button
            type="submit"
            className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-blue-50"
          >
            Search
          </button>
        </form>

        {people.length > 1 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {people.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setPickedId(p.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm ${
                  (pickedId || people[0]?.id) === p.id
                    ? 'border-teal-600 bg-teal-50 text-teal-900'
                    : 'border-slate-200 hover:bg-slate-50'
                }`}
              >
                {p.customerCode} · {p.name}
              </button>
            ))}
          </div>
        ) : null}

        {person ? (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="font-display text-xl text-slate-900">
                  {person.name}
                </p>
                <p className="text-sm text-slate-500">
                  {person.customerCode} · {person.phone}
                </p>
              </div>
              <Link
                href={`/customers/${person.id}`}
                className="text-sm text-teal-700 underline"
              >
                Open person
              </Link>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <div>
                <p className="text-xs uppercase text-slate-500">Collected</p>
                <p className="text-lg">
                  {money(Number(person.loan?.amountCollected || 0))} /{' '}
                  {money(loanTotals(person.loan).total)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">Balance</p>
                <p className="text-lg">
                  {money(Number(person.loan?.remainingAmount || 0))}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-slate-500">
                  Receipts in search
                </p>
                <p className="text-lg">
                  {personReceipts.length} · {money(receiptTotal)}
                </p>
              </div>
            </div>
          </div>
        ) : searched && q.trim() ? (
          <p className="mt-4 text-sm text-slate-500">
            No person matches that search.
          </p>
        ) : null}

        {personReceipts.length ? (
          <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-white text-slate-500">
                <tr>
                  <th className="px-4 py-3">Receipt</th>
                  <th className="px-4 py-3">Person</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Collector</th>
                  <th className="px-4 py-3">When</th>
                </tr>
              </thead>
              <tbody>
                {personReceipts.map((row) => (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">
                      {row.receiptNumber}
                    </td>
                    <td className="px-4 py-3">
                      {row.loan.customer.customerCode} ·{' '}
                      {row.loan.customer.name}
                    </td>
                    <td className="px-4 py-3">{money(Number(row.amount))}</td>
                    <td className="px-4 py-3">{row.collectedBy.name}</td>
                    <td className="px-4 py-3 text-slate-500">
                      {formatUaeDateTime(row.collectedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}
