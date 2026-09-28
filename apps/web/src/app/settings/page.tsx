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

  type GalleryAdminRow = {
    id: string;
    caption?: string | null;
    status: string;
    createdAt: string;
    uploadedBy?: { name: string } | null;
  };
  const [galleryPhotos, setGalleryPhotos] = useState<GalleryAdminRow[]>([]);
  const [galleryPhotosErr, setGalleryPhotosErr] = useState('');
  const [galleryPhotosMsg, setGalleryPhotosMsg] = useState('');
  const [deletingPhotoId, setDeletingPhotoId] = useState('');

  const [waEnabled, setWaEnabled] = useState(false);
  const [waAutoSend, setWaAutoSend] = useState(false);
  const [waProvider, setWaProvider] = useState<'green-api' | 'meta'>(
    'green-api',
  );
  const [waInstanceId, setWaInstanceId] = useState('');
  const [waToken, setWaToken] = useState('');
  const [waTokenSet, setWaTokenSet] = useState(false);
  const [waApiUrl, setWaApiUrl] = useState('');
  const [waTemplate, setWaTemplate] = useState('');
  const [waTestPhone, setWaTestPhone] = useState('');
  const [waMsg, setWaMsg] = useState('');
  const [waErr, setWaErr] = useState('');
  const [waSaving, setWaSaving] = useState(false);
  const [waTesting, setWaTesting] = useState(false);

  const isSuperAdmin = profile?.role === 'SUPER_ADMIN';

  const loadWhatsapp = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const s = await api<{
        autoSend: boolean;
        provider: string | null;
        settings: {
          enabled: boolean;
          provider: string;
          instanceId: string;
          tokenSet: boolean;
          apiUrl: string;
          templateName: string;
        };
      }>('/whatsapp/settings');
      setWaAutoSend(Boolean(s.autoSend));
      setWaEnabled(Boolean(s.settings?.enabled));
      setWaProvider(
        s.settings?.provider === 'meta' ? 'meta' : 'green-api',
      );
      setWaInstanceId(s.settings?.instanceId || '');
      setWaTokenSet(Boolean(s.settings?.tokenSet));
      setWaApiUrl(s.settings?.apiUrl || '');
      setWaTemplate(s.settings?.templateName || '');
    } catch {
      setWaAutoSend(false);
    }
  }, [isSuperAdmin]);

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

  const loadGalleryPhotos = useCallback(async () => {
    if (!isSuperAdmin) return;
    try {
      const rows = await api<GalleryAdminRow[]>('/gallery');
      setGalleryPhotos(rows);
      setGalleryPhotosErr('');
    } catch (e) {
      setGalleryPhotosErr(
        e instanceof Error ? e.message : 'Could not load cloud photos',
      );
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
    if (isSuperAdmin) {
      void loadStaff();
      void loadGalleryPhotos();
      void loadWhatsapp();
    }
  }, [isSuperAdmin, loadStaff, loadGalleryPhotos, loadWhatsapp]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    api<{ pinSet: boolean }>('/gallery/pin-status')
      .then((s) => setGalleryPinSet(s.pinSet))
      .catch(() => setGalleryPinSet(false));
  }, [isSuperAdmin]);

  async function deleteGalleryPhoto(photo: GalleryAdminRow) {
    const label = photo.caption?.trim() || 'this photo';
    if (
      !window.confirm(
        `Delete ${label} from the cloud gallery? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingPhotoId(photo.id);
    setGalleryPhotosErr('');
    setGalleryPhotosMsg('');
    try {
      await api(`/gallery/${photo.id}`, { method: 'DELETE' });
      setGalleryPhotos((prev) => prev.filter((p) => p.id !== photo.id));
      setGalleryPhotosMsg('Photo removed from cloud gallery.');
    } catch (e) {
      setGalleryPhotosErr(
        e instanceof Error ? e.message : 'Could not delete photo',
      );
    } finally {
      setDeletingPhotoId('');
    }
  }

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

  async function saveWhatsapp(e: FormEvent) {
    e.preventDefault();
    setWaErr('');
    setWaMsg('');
    setWaSaving(true);
    try {
      const s = await api<{
        autoSend: boolean;
        settings: { tokenSet: boolean };
      }>('/whatsapp/settings', {
        method: 'PUT',
        body: JSON.stringify({
          enabled: waEnabled,
          provider: waProvider,
          instanceId: waInstanceId,
          token: waToken.trim() || undefined,
          apiUrl: waApiUrl.trim() || undefined,
          templateName: waTemplate.trim() || undefined,
          templateLang: 'en',
        }),
      });
      setWaAutoSend(Boolean(s.autoSend));
      setWaTokenSet(Boolean(s.settings?.tokenSet));
      setWaToken('');
      setWaMsg(
        s.autoSend
          ? 'WhatsApp auto-send is ON. New collections will message customers automatically.'
          : 'WhatsApp settings saved. Auto-send is still off.',
      );
    } catch (err) {
      setWaErr(err instanceof Error ? err.message : 'Could not save WhatsApp');
    } finally {
      setWaSaving(false);
    }
  }

  async function testWhatsapp() {
    setWaErr('');
    setWaMsg('');
    if (!waTestPhone.trim()) {
      setWaErr('Enter a test phone number first');
      return;
    }
    setWaTesting(true);
    try {
      const r = await api<{ sent: boolean; error?: string }>('/whatsapp/test', {
        method: 'POST',
        body: JSON.stringify({ phone: waTestPhone.trim() }),
      });
      if (r.sent) {
        setWaMsg('Test receipt sent. Check WhatsApp on that phone.');
      } else {
        setWaErr(r.error || 'Test send failed');
      }
    } catch (err) {
      setWaErr(err instanceof Error ? err.message : 'Test send failed');
    } finally {
      setWaTesting(false);
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
            <span className="text-slate-300">Display Name</span>
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

      {/* Super Admin: WhatsApp auto receipts */}
      {isSuperAdmin ? (
        <section className="mt-8 max-w-xl space-y-4 rounded-2xl border border-teal-500/25 bg-ink-900/80 p-5">
          <div>
            <h2 className="text-lg font-medium text-white">
              WhatsApp receipts
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              After each saved collection, WhatsApp opens with the receipt
              (name, date &amp; time, amount, total, remaining balance) ready
              for the customer — the collector taps Send. This is free and needs
              no setup. Optional: add a paid WhatsApp API below to send receipts
              without the tap.
            </p>
            {waAutoSend ? (
              <p className="mt-2 text-sm text-teal-200">
                Auto-send is ON ({waProvider}).
              </p>
            ) : (
              <p className="mt-2 text-sm text-slate-300">
                Using the free one-tap WhatsApp button.
              </p>
            )}
          </div>
          <form onSubmit={saveWhatsapp} className="space-y-3">
            <label className="flex items-center gap-2 text-sm text-slate-200">
              <input
                type="checkbox"
                checked={waEnabled}
                onChange={(e) => setWaEnabled(e.target.checked)}
              />
              Enable automatic WhatsApp receipts
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">Provider</span>
              <select
                className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3"
                value={waProvider}
                onChange={(e) =>
                  setWaProvider(e.target.value as 'green-api' | 'meta')
                }
              >
                <option value="green-api">Green API</option>
                <option value="meta">Meta WhatsApp Cloud API</option>
              </select>
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">
                {waProvider === 'meta' ? 'Phone Number ID' : 'Instance ID'}
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3"
                value={waInstanceId}
                onChange={(e) => setWaInstanceId(e.target.value)}
                placeholder={
                  waProvider === 'meta' ? 'Phone Number ID' : 'idInstance'
                }
                autoComplete="off"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-300">
                API token{waTokenSet ? ' (leave blank to keep current)' : ''}
              </span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3"
                type="password"
                value={waToken}
                onChange={(e) => setWaToken(e.target.value)}
                placeholder={waTokenSet ? '••••••••' : 'apiTokenInstance'}
                autoComplete="new-password"
              />
            </label>
            {waProvider === 'green-api' ? (
              <label className="block text-sm">
                <span className="text-slate-300">API URL (optional)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3"
                  value={waApiUrl}
                  onChange={(e) => setWaApiUrl(e.target.value)}
                  placeholder="https://api.green-api.com"
                />
              </label>
            ) : (
              <label className="block text-sm">
                <span className="text-slate-300">
                  Template name (optional, for Meta)
                </span>
                <input
                  className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3"
                  value={waTemplate}
                  onChange={(e) => setWaTemplate(e.target.value)}
                  placeholder="collection_receipt"
                />
              </label>
            )}
            <label className="block text-sm">
              <span className="text-slate-300">Test phone (optional)</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3"
                value={waTestPhone}
                onChange={(e) => setWaTestPhone(e.target.value)}
                placeholder="05xxxxxxxx or 9715xxxxxxxx"
              />
            </label>
            {waErr ? (
              <p className="text-sm text-red-300" role="alert">
                {waErr}
              </p>
            ) : null}
            {waMsg ? (
              <p className="text-sm text-teal-200" role="status">
                {waMsg}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={waSaving}
                className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-500 disabled:opacity-60"
              >
                {waSaving ? 'Saving…' : 'Save WhatsApp settings'}
              </button>
              <button
                type="button"
                disabled={waTesting}
                onClick={() => void testWhatsapp()}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-slate-200 hover:bg-white/5 disabled:opacity-60"
              >
                {waTesting ? 'Sending…' : 'Send test receipt'}
              </button>
            </div>
          </form>
        </section>
      ) : null}

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

      {/* Super Admin: remove old cloud gallery photos */}
      {isSuperAdmin ? (
        <section className="mt-8 max-w-2xl space-y-4 rounded-2xl border border-red-500/25 bg-ink-900/80 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-medium text-white">
                Cloud photos
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Remove old cloud gallery photos from the admin panel. You can
                also delete them in{' '}
                <Link href="/gallery" className="text-teal-300 underline">
                  Gallery
                </Link>
                .
              </p>
            </div>
            <button
              type="button"
              onClick={() => void loadGalleryPhotos()}
              className="rounded-lg border border-white/15 px-3 py-1.5 text-xs text-slate-300 hover:bg-white/5"
            >
              Refresh
            </button>
          </div>

          {galleryPhotosErr ? (
            <p className="text-sm text-red-300" role="alert">
              {galleryPhotosErr}
            </p>
          ) : null}
          {galleryPhotosMsg ? (
            <p className="text-sm text-teal-200" role="status">
              {galleryPhotosMsg}
            </p>
          ) : null}

          <ul className="divide-y divide-white/5 rounded-xl border border-white/10">
            {galleryPhotos.map((photo) => (
              <li
                key={photo.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-white">
                    {photo.caption?.trim() || 'Untitled photo'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {photo.status}
                    {photo.uploadedBy ? ` · ${photo.uploadedBy.name}` : ''}
                    {' · '}
                    {new Date(photo.createdAt).toLocaleString()}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={deletingPhotoId === photo.id}
                  onClick={() => void deleteGalleryPhoto(photo)}
                  className="rounded-lg bg-red-800/90 px-3 py-2 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deletingPhotoId === photo.id ? 'Deleting…' : 'Delete'}
                </button>
              </li>
            ))}
          </ul>

          {!galleryPhotos.length ? (
            <p className="text-sm text-slate-500">No cloud photos to remove.</p>
          ) : null}
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
