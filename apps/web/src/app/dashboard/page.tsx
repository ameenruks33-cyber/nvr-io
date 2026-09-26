'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { api, money } from '@/lib/api';

type Stats = {
  totalCustomers: number;
  activeLoans: number;
  completedLoans: number;
  totalDisbursed: number;
  totalCollected: number;
  totalOutstanding: number;
  todaysCollections: number;
};

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api<Stats>('/dashboard')
      .then(setStats)
      .catch((e) => setError(e.message));
  }, []);

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
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-white">Home</h1>
          <p className="mt-1 text-sm text-slate-400">
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

      {error ? <p className="text-red-300">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-white/10 bg-ink-900/70 p-5"
          >
            <p className="text-xs uppercase tracking-wide text-slate-400">
              {card.label}
            </p>
            <p className="mt-2 font-display text-2xl text-white">{card.value}</p>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
