'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api, clearSession, getSession, setSession } from '@/lib/api';

type Profile = {
  id: string;
  name: string;
  email: string;
  role: string;
};

type StaffUser = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
};

function useWebsiteDesktopUi() {
  const [isDesktopWebsite, setIsDesktopWebsite] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)');
    const update = () => setIsDesktopWebsite(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  return isDesktopWebsite;
}

export default function SettingsPage() {
  const router = useRouter();
  const isDesktopWebsite = useWebsiteDesktopUi();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [staffErr, setStaffErr] = useState('');
  const [staffMsg, setStaffMsg] = useState('');
  const [busyId, setBusyId] = useState('');

  const isAdmin =
    profile?.role === 'SUPER_ADMIN' || profile?.role === 'ADMIN';

  const loadStaff = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const rows = await api<StaffUser[]>('/users');
      setStaff(rows);
      setStaffErr('');
    } catch (e) {
      setStaffErr(e instanceof Error ? e.message : 'Could not load users');
    }
  }, [isAdmin]);

  useEffect(() => {
    api<Profile>('/auth/me')
      .then((user) => {
        setProfile(user);
        setName(user.name);
        setEmail(user.email);
      })
      .catch(() => {
        clearSession();
        router.replace('/login');
      });
  }, [router]);

  useEffect(() => {
    if (isAdmin) void loadStaff();
  }, [isAdmin, loadStaff]);

  async function toggleAppAccess(user: StaffUser) {
    if (!isAdmin || user.id === profile?.id) return;
    if (profile?.role === 'ADMIN' && user.role === 'SUPER_ADMIN') return;

    setBusyId(user.id);
    setStaffErr('');
    setStaffMsg('');
    try {
      const disable = user.isActive;
      await api(`/users/${user.id}/${disable ? 'disable' : 'enable'}`, {
        method: 'PATCH',
      });
      setStaffMsg(
        disable
          ? `${user.name} is disabled — they cannot use the app.`
          : `${user.name} can use the app again.`,
      );
      await loadStaff();
    } catch (e) {
      setStaffErr(e instanceof Error ? e.message : 'Update failed');
    } finally {
      setBusyId('');
    }
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isDesktopWebsite) return;
    setSaving(true);
    setError('');
    setMessage('');

    if (newPassword && newPassword !== confirmPassword) {
      setError('New passwords do not match');
      setSaving(false);
      return;
    }

    try {
      const body: Record<string, string> = {};
      if (name.trim() && name.trim() !== profile?.name) body.name = name.trim();
      if (email.trim() && email.trim().toLowerCase() !== profile?.email) {
        body.email = email.trim();
      }
      if (newPassword) {
        body.newPassword = newPassword;
        body.currentPassword = currentPassword;
      } else if (body.email) {
        body.currentPassword = currentPassword;
      }

      if (!Object.keys(body).length) {
        setError('Change your name, email, or password first');
        setSaving(false);
        return;
      }

      const updated = await api<Profile>('/auth/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });

      const session = getSession();
      if (session) {
        setSession({
          ...session,
          user: {
            ...session.user,
            name: updated.name,
            email: updated.email,
            role: updated.role,
          },
        });
      }

      setProfile(updated);
      setName(updated.name);
      setEmail(updated.email);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      if (body.newPassword) {
        setMessage('Password updated. Please sign in again.');
        clearSession();
        setTimeout(() => router.replace('/login'), 900);
      } else {
        setMessage('Profile saved.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl text-white">Settings</h1>

      {/* Mobile app: no username/password change */}
      <div className="mt-6 max-w-xl space-y-3 rounded-2xl border border-white/10 bg-ink-900/70 p-5 text-sm text-slate-300 md:hidden">
        <p className="font-medium text-white">
          {profile?.name || 'Signed in'}
        </p>
        <p className="text-slate-400">{profile?.email}</p>
        <p>
          Username and password can only be changed from the{' '}
          <strong className="text-white">website</strong> (computer browser),
          not in the mobile app.
        </p>
        <button
          type="button"
          onClick={() => {
            clearSession();
            router.replace('/login');
          }}
          className="w-full rounded-lg border border-white/15 px-4 py-3 text-slate-200 hover:bg-white/5"
        >
          Sign out
        </button>
      </div>

      {/* Website desktop: account management */}
      <div className="mt-6 hidden md:block">
        <p className="text-sm text-slate-400">
          Change your display name, login email, and password on the website.
        </p>

        <form
          onSubmit={onSubmit}
          className="mt-4 max-w-xl space-y-4 rounded-2xl border border-white/10 bg-ink-900/70 p-5 sm:p-6"
        >
          <label className="block text-sm">
            <span className="text-slate-300">Display name</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              minLength={2}
              autoComplete="name"
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-300">Login email / username</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>

          <div className="border-t border-white/10 pt-4">
            <p className="text-sm font-medium text-white">Change password</p>
            <p className="mt-1 text-xs text-slate-400">
              Leave blank to keep your current password. Current password is
              required when changing email or password.
            </p>
          </div>

          <label className="block text-sm">
            <span className="text-slate-300">Current password</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-300">New password</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={10}
              autoComplete="new-password"
            />
          </label>

          <label className="block text-sm">
            <span className="text-slate-300">Confirm new password</span>
            <input
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={10}
              autoComplete="new-password"
            />
          </label>

          {error ? (
            <p className="text-sm text-red-300" role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className="text-sm text-teal-200" role="status">
              {message}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </form>
      </div>

      {/* Admin: disable / enable users for the app */}
      {isAdmin ? (
        <section className="mt-8 max-w-2xl space-y-4 rounded-2xl border border-amber-500/25 bg-ink-900/80 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-white">
                User app access
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Disable a user to block them from the app immediately. Enable
                again anytime. Create new accounts under{' '}
                <Link href="/users" className="text-teal-300 underline">
                  Users
                </Link>
                .
              </p>
            </div>
          </div>

          {staffErr ? (
            <p className="text-sm text-red-300" role="alert">
              {staffErr}
            </p>
          ) : null}
          {staffMsg ? (
            <p className="text-sm text-teal-200" role="status">
              {staffMsg}
            </p>
          ) : null}

          <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
            {staff.map((user) => {
              const isMe = user.id === profile?.id;
              const blockedAdmin =
                profile?.role === 'ADMIN' && user.role === 'SUPER_ADMIN';
              const canToggle = !isMe && !blockedAdmin;

              return (
                <li
                  key={user.id}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium text-white">
                      {user.name}
                      {isMe ? (
                        <span className="ml-2 text-xs text-slate-500">(you)</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-400">
                      {user.email} · {user.role}
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        user.isActive ? 'text-teal-300' : 'text-amber-300'
                      }`}
                    >
                      {user.isActive ? 'App enabled' : 'App disabled'}
                    </p>
                  </div>

                  {canToggle ? (
                    <button
                      type="button"
                      disabled={busyId === user.id}
                      onClick={() => void toggleAppAccess(user)}
                      className={`rounded-lg px-3 py-2 text-xs font-medium disabled:opacity-60 ${
                        user.isActive
                          ? 'bg-amber-700/90 text-white hover:bg-amber-600'
                          : 'bg-teal-700/90 text-white hover:bg-teal-600'
                      }`}
                    >
                      {busyId === user.id
                        ? '…'
                        : user.isActive
                          ? 'Disable from app'
                          : 'Enable for app'}
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500">—</span>
                  )}
                </li>
              );
            })}
          </ul>

          {!staff.length ? (
            <p className="text-sm text-slate-500">No staff users found.</p>
          ) : null}
        </section>
      ) : null}

      <div className="mt-6 max-w-xl space-y-3 rounded-2xl border border-white/10 bg-ink-900/70 p-5 text-sm text-slate-300">
        <p>
          Install NVR.io from <strong className="text-white">/app</strong> for a
          home-screen icon on your phone.
        </p>
        <p className="hidden md:block">
          To clear old customer data, open{' '}
          <strong className="text-white">Users</strong> on this website — that
          option is not available in the mobile app.
        </p>
      </div>
    </AppShell>
  );
}
