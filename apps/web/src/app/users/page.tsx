'use client';

import { useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

type User = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

export default function UsersPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [error, setError] = useState('');

  useEffect(() => {
    api<User[]>('/users')
      .then(setRows)
      .catch((e) => setError(e.message));
  }, []);

  return (
    <AppShell>
      <h1 className="mb-6 font-display text-3xl text-white">Users</h1>
      {error ? <p className="text-red-300">{error}</p> : null}
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-ink-900 text-slate-400">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-t border-white/5">
                <td className="px-4 py-3">{row.name}</td>
                <td className="px-4 py-3">{row.email}</td>
                <td className="px-4 py-3">{row.role}</td>
                <td className="px-4 py-3">
                  {row.isActive ? 'Active' : 'Disabled'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
