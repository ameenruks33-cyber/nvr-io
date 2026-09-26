'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { SuperAdminOnly } from '@/components/SuperAdminOnly';
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

  const [galleryPinSet, setGalleryPinSet] = useState(false);
  const [galleryPin, setGalleryPin] = useState('');
  const [galleryPinConfirm, setGalleryPinConfirm] = useState('');
  const [pinMsg, setPinMsg] = useState('');
  const [pinErr, setPinErr] = useState('');
  const [pinSaving, setPinSaving] = useState(false);

  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';

  const loadStaff = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const rows = await api<StaffUser[]>('/users');
      setStaff(rows);
      setStaffErr('');
    } catch (e) {
      setStaffErr(e instanceof Error ? e.message : 'Could not load users');
    }
  }, [isSuperAdmin]);

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
    if (isSuperAdmin) void loadStaff();
  }, [isSuperAdmin, loadStaff]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api<{ pinSet: boolean }>('/gallery/pin-status')
      .then((s) => setGalleryPinSet(s.pinSet))
      .catch(() => setGalleryPinSet(false));
  }, [isSuperAdmin]);

  async function saveGalleryPin(e: FormEvent) {
    e.preventDefault();
    setPinErr('');
    setPinMsg('');
    if (!/^\d{4,8}$/.test(galleryPin)) {
      setPinErr('PIN must be 4–8 digits');
      return;
    }
    if (galleryPin !== galleryPinConfirm) {
      setPinErr('PIN confirmation does not match');
      return;
    }
    setPinSaving(true);
    try {
      await api('/gallery/pin', {
        method: 'POST',
        body: JSON.stringify({ pin: galleryPin }),
      });
      setGalleryPinSet(true);
      setGalleryPin('');
      setGalleryPinConfirm('');
      setPinMsg(
        'Cloud gallery number password saved. Admins and users unlock Gallery with this PIN.',
      );
    } catch (err) {
      setPinErr(err instanceof Error ? err.message : 'Could not save PIN');
    } finally {
      setPinSaving(false);
    }
  }

  async function toggleAppAccess(user: StaffUser) {
    if (!isSuperAdmin || user.id === profile?.id) return;

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
      <SuperAdminOnly>
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

      {/* Super Admin: shared cloud gallery number password */}
      {isSuperAdmin ? (
        <section className="mt-8 max-w-xl space-y-4 rounded-2xl border border-blue-500/25 bg-ink-900/80 p-5">
          <div>
            <h2 className="text-lg font-medium text-white">
              Cloud gallery number password
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              Set a 4–8 digit PIN. Admins and users enter it to open the shared
              cloud photo gallery (read, write, and previous-photo verification).
              {galleryPinSet
                ? ' A PIN is already set — saving a new one replaces it.'
                : ' No PIN yet — gallery stays locked until you set one.'}
            </p>
          </div>
          <form onSubmit={saveGalleryPin} className="space-y-3">
            <label className="block text-sm">
              <span className="text-slate-300">New number password</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3 tracking-[0.35em] outline-none ring-blue-500 focus:ring-2"
                type="password"
                inputMode="numeric"
                pattern="\d{4,8}"
                maxLength={8}
                value={galleryPin}
                onChange={(e) =>
                  setGalleryPin(e.target.value.replace(/\D/g, '').slice(0, 8))
                }
                required
                autoComplete="new-password"
                placeholder="••••"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Confirm number password</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3 tracking-[0.35em] outline-none ring-blue-500 focus:ring-2"
                type="password"
                inputMode="numeric"
                pattern="\d{4,8}"
                maxLength={8}
                value={galleryPinConfirm}
                onChange={(e) =>
                  setGalleryPinConfirm(
                    e.target.value.replace(/\D/g, '').slice(0, 8),
                  )
                }
                required
                autoComplete="new-password"
                placeholder="••••"
              />
            </label>
            {pinErr ? (
              <p className="text-sm text-red-300" role="alert">
                {pinErr}
              </p>
            ) : null}
            {pinMsg ? (
              <p className="text-sm text-teal-200" role="status">
                {pinMsg}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pinSaving || galleryPin.length < 4}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {pinSaving
                ? 'Saving…'
                : galleryPinSet
                  ? 'Update gallery PIN'
                  : 'Set gallery PIN'}
            </button>
          </form>
        </section>
      ) : null}

      {/* Admin: disable / enable users for the app */}
      {isSuperAdmin ? (
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
              const blockedAdmin = false;
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
          Install CrickHerose from <strong className="text-white">/app</strong> for a
          home-screen icon on your phone.
        </p>
        <p className="hidden md:block">
          To clear old customer data, open{' '}
          <strong className="text-white">Users</strong> on this website — that
          option is not available in the mobile app.
        </p>
      </div>
      </SuperAdminOnly>
    </AppShell>
  );
}
