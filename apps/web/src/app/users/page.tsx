'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { SuperAdminOnly } from '@/components/SuperAdminOnly';
import { api, getSession } from '@/lib/api';

type User = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: string;
  isActive: boolean;
  createdAt?: string;
};

const ROLE_OPTIONS_ADMIN = [
  { value: 'COLLECTOR', label: 'Collector (staff)' },
  { value: 'ADMIN', label: 'Admin' },
];

const ROLE_OPTIONS_SUPER = [
  ...ROLE_OPTIONS_ADMIN,
  { value: 'SUPER_ADMIN', label: 'Super admin' },
];

export default function UsersPage() {
  const [rows, setRows] = useState<User[]>([]);
  const [error, setError] = useState('');
  const [msg, setMsg] = useState('');
  const [role, setRole] = useState('');
  const [myId, setMyId] = useState('');
  const [busyId, setBusyId] = useState('');
  const [creating, setCreating] = useState(false);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [newRole, setNewRole] = useState('COLLECTOR');

  const [confirmText, setConfirmText] = useState('');
  const [clearMsg, setClearMsg] = useState('');
  const [clearErr, setClearErr] = useState('');
  const [clearing, setClearing] = useState(false);
  const [isDesktopWebsite, setIsDesktopWebsite] = useState(false);

  const isSuperAdmin = role === 'SUPER_ADMIN';
  const roleOptions = ROLE_OPTIONS_SUPER;

  const load = useCallback(async () => {
    try {
      const list = await api<User[]>('/users');
      setRows(list);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load users');
    }
  }, []);

  useEffect(() => {
    const session = getSession();
    setRole(session?.user.role || '');
    setMyId(session?.user.id || '');
    void load();

    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktopWebsite(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [load]);

  async function createUser(e: FormEvent) {
    e.preventDefault();
    if (!isSuperAdmin) return;
    setCreating(true);
    setError('');
    setMsg('');
    try {
      await api<User>('/users', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim() || undefined,
          password,
          role: newRole,
        }),
      });
      setName('');
      setEmail('');
      setPhone('');
      setPassword('');
      setNewRole('COLLECTOR');
      setMsg('User created. They can sign in with that email and password.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Create failed');
    } finally {
      setCreating(false);
    }
  }

  async function setRestricted(user: User, restrict: boolean) {
    if (!isSuperAdmin || user.id === myId) return;
    setBusyId(user.id);
    setError('');
    setMsg('');
    try {
      await api(`/users/${user.id}/${restrict ? 'disable' : 'enable'}`, {
        method: 'PATCH',
      });
      setMsg(
        restrict
          ? `${user.name} is restricted — they cannot sign in.`
          : `${user.name} is active again.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setBusyId('');
    }
  }

  async function changeRole(user: User, nextRole: string) {
    if (!isSuperAdmin || user.id === myId) return;
    setBusyId(user.id);
    setError('');
    setMsg('');
    try {
      await api(`/users/${user.id}/role`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      setMsg(`${user.name} role set to ${nextRole}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Role change failed');
    } finally {
      setBusyId('');
    }
  }

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

  function canManage(user: User) {
    if (!isSuperAdmin) return false;
    if (user.id === myId) return false;
    return true;
  }

  return (
    <AppShell>
      <SuperAdminOnly>
      <h1 className="mb-2 font-display text-3xl text-slate-900">Users</h1>
      <p className="mb-6 text-sm text-slate-500">
        Create staff accounts and restrict access. Restricted users cannot sign
        in.
      </p>

      {error ? (
        <p className="mb-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {msg ? (
        <p className="mb-4 text-sm text-teal-700" role="status">
          {msg}
        </p>
      ) : null}

      <form
        onSubmit={createUser}
        className="mb-8 space-y-4 rounded-2xl border border-blue-500/20 bg-white p-5"
      >
        <h2 className="text-lg font-medium text-slate-900">Create new user</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm sm:col-span-2">
            <span className="text-slate-600">Full Name</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              autoComplete="name"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Email / username</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Phone (optional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoComplete="tel"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Password</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={10}
              autoComplete="new-password"
              placeholder="At least 10 characters"
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Role</span>
            <select
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
              value={newRole}
              onChange={(e) => setNewRole(e.target.value)}
            >
              {roleOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60 sm:w-auto"
        >
          {creating ? 'Creating…' : 'Create user'}
        </button>
      </form>

      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Access</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const manage = canManage(row);
              return (
                <tr key={row.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-3 text-slate-900">{row.name}</td>
                  <td className="px-4 py-3 text-slate-600">{row.email}</td>
                  <td className="px-4 py-3">
                    {manage ? (
                      <select
                        className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700"
                        value={row.role}
                        disabled={busyId === row.id}
                        onChange={(e) => void changeRole(row, e.target.value)}
                      >
                        {roleOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                        {row.role === 'SUPER_ADMIN' &&
                        role === 'SUPER_ADMIN' ? (
                          <option value="SUPER_ADMIN">Super admin</option>
                        ) : null}
                      </select>
                    ) : (
                      <span className="text-slate-600">{row.role}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        row.isActive ? 'text-teal-700' : 'text-amber-700'
                      }
                    >
                      {row.isActive ? 'Active' : 'Restricted'}
                    </span>
                    {row.id === myId ? (
                      <span className="ml-2 text-xs text-slate-500">(you)</span>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {manage ? (
                      <button
                        type="button"
                        disabled={busyId === row.id}
                        onClick={() =>
                          void setRestricted(row, row.isActive)
                        }
                        className={`rounded-lg px-3 py-1.5 text-xs font-medium disabled:opacity-60 ${
                          row.isActive
                            ? 'bg-amber-700/80 text-white hover:bg-amber-600'
                            : 'bg-teal-700/80 text-white hover:bg-teal-600'
                        }`}
                      >
                        {busyId === row.id
                          ? '…'
                          : row.isActive
                            ? 'Restrict'
                            : 'Allow access'}
                      </button>
                    ) : (
                      <span className="text-xs text-slate-500">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!rows.length ? (
        <p className="mt-6 text-center text-sm text-slate-500">
          No users yet. Create the first account above.
        </p>
      ) : null}

      {role === 'SUPER_ADMIN' && isDesktopWebsite ? (
        <form
          onSubmit={clearOldDatabase}
          className="mt-8 max-w-xl space-y-4 rounded-2xl border border-red-500/30 bg-red-50 p-5"
        >
          <h2 className="text-lg font-medium text-red-600">
            Clear old database
          </h2>
          <p className="text-sm text-slate-600">
            Deletes all people, records, receipts, documents, and notes. Staff
            login accounts are kept. This cannot be undone. Not available in the
            mobile app.
          </p>
          <label className="block text-sm">
            <span className="text-slate-600">
              Type <code className="text-red-600">DELETE_OLD_DATA</code> to
              confirm
            </span>
            <input
              className="mt-1 w-full rounded-lg border border-red-500/40 bg-slate-50 px-3 py-3 outline-none ring-red-500 focus:ring-2"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              autoComplete="off"
              required
            />
          </label>
          {clearErr ? (
            <p className="text-sm text-red-600" role="alert">
              {clearErr}
            </p>
          ) : null}
          {clearMsg ? (
            <p className="text-sm text-teal-700" role="status">
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
        <p className="mt-6 max-w-xl rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
          Database clear is only available on the website admin panel (computer
          browser), not in the mobile app.
        </p>
      ) : null}
      </SuperAdminOnly>
    </AppShell>
  );
}
