'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

type Row = {
  id: string;
  type: string;
  message: string;
  status: string;
  createdAt: string;
  customer?: { name: string; customerCode: string } | null;
};

export default function NotificationsPage() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    api<Row[]>('/notifications').then(setRows);
  }, []);

  return (
    <AppShell>
      <h1 className="mb-6 font-display text-3xl text-white">Notifications</h1>
      <ul className="space-y-3">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-2xl border border-white/10 bg-ink-900/70 p-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
              <span>{row.type}</span>
              <span>{new Date(row.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-2 text-sm text-slate-100">{row.message}</p>
            {row.customer ? (
              <p className="mt-1 text-xs text-slate-500">
                {row.customer.customerCode} · {row.customer.name}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
    </AppShell>
  );
}
