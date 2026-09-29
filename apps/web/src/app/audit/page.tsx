'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { SuperAdminOnly } from '@/components/SuperAdminOnly';
import { api } from '@/lib/api';
import { useLiveRefresh } from '@/lib/live-sync';

type Row = {
  id: string;
  action: string;
  recordType: string;
  recordId?: string | null;
  createdAt: string;
  ipAddress?: string | null;
  user?: { name: string; email: string } | null;
};

export default function AuditPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');

  const load = () => {
    api<Row[]>('/audit')
      .then(setRows)
      .catch((e) => setError(e.message));
  };

  useEffect(load, []);
  useLiveRefresh(load);

  return (
    <AppShell>
      <SuperAdminOnly>
      <h1 className="mb-6 font-display text-3xl text-slate-900">Audit log</h1>
      {error ? <p className="text-red-600">{error}</p> : null}
      <ul className="space-y-2 text-sm">
        {rows.map((row) => (
          <li
            key={row.id}
            className="rounded-xl border border-slate-200 bg-white px-4 py-3"
          >
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium text-teal-700">{row.action}</span>
              <span className="text-slate-500">
                {new Date(row.createdAt).toLocaleString()}
              </span>
            </div>
            <p className="mt-1 text-slate-600">
              {row.recordType}
              {row.recordId ? ` · ${row.recordId}` : ''}
            </p>
            <p className="text-xs text-slate-500">
              {row.user?.name || 'system'}
              {row.ipAddress ? ` · ${row.ipAddress}` : ''}
            </p>
          </li>
        ))}
      </ul>
      </SuperAdminOnly>
    </AppShell>
  );
}
