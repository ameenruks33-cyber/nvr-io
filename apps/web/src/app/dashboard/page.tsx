'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import {
  TodayPendingNotice,
  type PendingTodayItem,
} from '@/components/TodayPendingNotice';
import { api, money } from '@/lib/api';
import { useLiveRefresh } from '@/lib/live-sync';

type Stats = {
  totalCustomers: number;
  activeLoans: number;
  completedLoans: number;
  totalDisbursed: number;
  totalCollected: number;
  totalOutstanding: number;
  todaysCollections: number;
};

type PendingToday = {
  date: string;
  items: PendingTodayItem[];
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [pending, setPending] = useState<PendingToday | null>(null);
  const [error, setError] = useState('');

  const load = () => {
    api<Stats>('/dashboard')
      .then(setStats)
      .catch((e) => setError(e.message));
    api<PendingToday>('/collections/pending-today')
      .then(setPending)
      .catch(() => setPending(null));
  };

  useEffect(load, []);
  useLiveRefresh(load);

  const cards = stats
    ? [
        { label: 'People', value: String(stats.totalCustomers) },
        { label: 'Open records', value: String(stats.activeLoans) },
        { label: 'Finished records', value: String(stats.completedLoans) },
        { label: "Today's receipts", value: money(stats.todaysCollections) },
        { label: 'Remaining', value: money(stats.totalOutstanding) },
        { label: 'Collected', value: money(stats.totalCollected) },
      ]
    : [];

  return (
    <AppShell>
      {pending?.items.length ? (
        <TodayPendingNotice date={pending.date} items={pending.items} />
      ) : null}

      <header className="mb-8 flex flex-wrap items-end justify-between gap-4 pr-0 sm:pr-[min(22rem,40vw)]">
        <div>
          <h1 className="font-display text-3xl text-slate-900">Home</h1>
          <p className="mt-1 text-sm text-slate-500">
            Personal records overview
          </p>
        </div>
        <Link
          href="/customers/new"
          className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          Add person
        </Link>
      </header>

      {error ? <p className="text-red-600">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-slate-200 bg-white p-5"
          >
            <p className="text-xs uppercase tracking-wide text-slate-500">
              {card.label}
            </p>
            <p className="mt-2 font-display text-2xl text-slate-900">
              {card.value}
            </p>
          </div>
        ))}
      </div>
    </AppShell>
  );
};
