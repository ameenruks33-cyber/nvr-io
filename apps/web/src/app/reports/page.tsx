'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, money } from '@/lib/api';

type Stats = {
  totalDisbursed: number;
  totalCollected: number;
  totalOutstanding: number;
  todaysCollections: number;
  activeLoans: number;
  completedLoans: number;
};

export default function ReportsPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    api<Stats>('/dashboard').then(setStats);
  }, []);

  return (
    <AppShell>
      <h1 className="mb-6 font-display text-3xl text-white">Summary</h1>
      {stats ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {[
            ['Total target', money(stats.totalDisbursed)],
            ['Collected', money(stats.totalCollected)],
            ['Remaining', money(stats.totalOutstanding)],
            ["Today's receipts", money(stats.todaysCollections)],
            ['Open records', String(stats.activeLoans)],
            ['Finished records', String(stats.completedLoans)],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-white/10 bg-ink-900/70 p-5"
            >
              <p className="text-xs uppercase text-slate-400">{label}</p>
              <p className="mt-2 font-display text-2xl">{value}</p>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-slate-400">Loading…</p>
      )}
    </AppShell>
  );
}
