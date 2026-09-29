'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, money } from '@/lib/api';
import { useLiveRefresh } from '@/lib/live-sync';

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

  const load = () => {
    api<Stats>('/dashboard').then(setStats).catch(() => undefined);
  };

  useEffect(load, []);
  useLiveRefresh(load);

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
    </AppShell>
  );
}
