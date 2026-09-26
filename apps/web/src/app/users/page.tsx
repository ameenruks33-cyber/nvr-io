'use client';

import { FormEvent, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, getSession } from '@/lib/api';

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
  const [role, setRole] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [clearMsg, setClearMsg] = useState('');
  const [clearErr, setClearErr] = useState('');
  const [clearing, setClearing] = useState(false);
  const [isDesktopWebsite, setIsDesktopWebsite] = useState(false);

  useEffect(() => {
    const session = getSession();
    setRole(session?.user.role || '');
    api<User[]>('/users')
      .then(setRows)
      .catch((e) => setError(e.message));

    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktopWebsite(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  async function clearOldDatabase(e: FormEvent) {
    e.preventDefault();
    if (!isDesktopWebsite || role !== 'SUPER_ADMIN') return;
    setClearing(true);
    setClearErr('');
    setClearMsg('');
    try {
      const result = await api<{
        ok: boolean;
        message: string;
        deleted: Record<string, number>;
      }>('/admin/clear-database', {
        method: 'POST',
        body: JSON.stringify({ confirmation: confirmText.trim() }),
      });
      setClearMsg(result.message);
      setConfirmText('');
    } catch (err) {
      setClearErr(err instanceof Error ? err.message : 'Clear failed');
    } finally {
      setClearing(false);
    }
  }

  return (
    <AppShell>
      <h1 className="mb-2 font-display text-3xl text-white">Users</h1>
      <p className="mb-6 text-sm text-slate-400">
        Website admin panel — staff accounts and database tools.
      </p>

      {error ? <p className="mb-4 text-red-300">{error}</p> : null}

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

      {/* Clear DB: website desktop + SUPER_ADMIN only — never shown as a mobile app control */}
      {role === 'SUPER_ADMIN' && isDesktopWebsite ? (
        <form
          onSubmit={clearOldDatabase}
          className="mt-8 max-w-xl space-y-4 rounded-2xl border border-red-500/30 bg-red-950/20 p-5"
        >
          <h2 className="text-lg font-medium text-red-200">
            Clear old database
          </h2>
          <p className="text-sm text-slate-300">
            Deletes all people, records, receipts, documents, and notes. Staff
            login accounts are kept. This cannot be undone. Not available in the
            mobile app.
          </p>
          <label className="block text-sm">
            <span className="text-slate-300">
              Type <code className="text-red-200">DELETE_OLD_DATA</code> to
              confirm
            </span>
            <input
              className="mt-1 w-full rounded-lg border border-red-500/40 bg-ink-950 px-3 py-3 outline-none ring-red-500 focus:ring-2"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
          {clearErr ? (
            <p className="text-sm text-red-300" role="alert">
              {clearErr}
            </p>
          ) : null}
          {clearMsg ? (
            <p className="text-sm text-teal-200" role="status">
              {clearMsg}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={clearing || confirmText.trim() !== 'DELETE_OLD_DATA'}
            className="w-full rounded-lg bg-red-700 px-4 py-3 font-medium text-white hover:bg-red-600 disabled:opacity-50"
          >
            {clearing ? 'Clearing…' : 'Delete old database'}
          </button>
        </form>
      ) : null}

      {role === 'SUPER_ADMIN' && !isDesktopWebsite ? (
        <p className="mt-6 max-w-xl rounded-2xl border border-white/10 bg-ink-900/70 p-4 text-sm text-slate-400">
          Database clear is only available on the website admin panel (computer
          browser), not in the mobile app.
        </p>
      ) : null}
    </AppShell>
  );
}
