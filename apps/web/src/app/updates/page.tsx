'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import type { AppUpdateInfo } from '@/components/UpdateNotifier';
import { applyAppUpdate } from '@/lib/apply-app-update';
import { APP_ICONS } from '@/lib/app-branding';

const STORAGE_KEY = 'nvr_app_version';

export default function UpdatesPage() {
  const [info, setInfo] = useState<AppUpdateInfo | null>(null);
  const [current, setCurrent] = useState('…');
  const [busy, setBusy] = useState(false);
  const [iconRefreshed, setIconRefreshed] = useState(false);

  useEffect(() => {
    setCurrent(localStorage.getItem(STORAGE_KEY) || 'not installed yet');
    if (sessionStorage.getItem('nvr_icon_updated')) {
      setIconRefreshed(true);
      sessionStorage.removeItem('nvr_icon_updated');
    }
    fetch(`/app-update.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  async function applyUpdate() {
    if (!info) return;
    setBusy(true);
    try {
      await applyAppUpdate(info, '/updates?updated=1');
    } finally {
      setBusy(false);
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return;
    await Notification.requestPermission();
  }

  const newIcon = info?.icons?.icon512 || APP_ICONS.icon512;

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-white/10 bg-ink-900/95 p-6 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          <Image
            src={newIcon}
            alt="NVR.io app icon"
            width={96}
            height={96}
            className="rounded-3xl shadow-lg shadow-red-500/30"
            unoptimized
            priority
          />
          <p className="mt-4 font-display text-3xl text-white">App updates</p>
          <p className="mt-2 text-sm text-slate-400">
            Updates refresh the app and the icon. Tap Update now to replace the
            old icon with the new one.
          </p>
        </div>

        {iconRefreshed ? (
          <p className="mt-4 rounded-lg border border-teal-500/30 bg-teal-950/40 px-3 py-3 text-sm text-teal-100">
            Update applied — new icon loaded. If your home screen still shows the
            old icon, remove NVR.io and install again from{' '}
            <Link href="/app" className="underline">
              /app
            </Link>{' '}
            (required on some iPhones).
          </p>
        ) : null}

        <dl className="mt-6 space-y-2 text-sm">
          <div className="flex justify-between gap-4 border-b border-white/5 py-2">
            <dt className="text-slate-400">Installed version</dt>
            <dd className="text-white">{current}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-white/5 py-2">
            <dt className="text-slate-400">Latest version</dt>
            <dd className="text-white">{info?.version || '…'}</dd>
          </div>
          <div className="flex justify-between gap-4 border-b border-white/5 py-2">
            <dt className="text-slate-400">Build</dt>
            <dd className="text-white">{info?.build || '…'}</dd>
          </div>
        </dl>

        {info?.notes?.length ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-slate-300">
            {info.notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-6 space-y-3">
          <button
            type="button"
            disabled={busy || !info}
            onClick={() => void applyUpdate()}
            className="w-full rounded-lg bg-red-600 px-4 py-3 font-medium text-white hover:bg-red-500 disabled:opacity-60"
          >
            {busy ? 'Updating icon & app…' : 'Update now (new icon)'}
          </button>
          <button
            type="button"
            onClick={() => void enableNotifications()}
            className="w-full rounded-lg border border-white/15 px-4 py-3 text-sm text-slate-200 hover:bg-white/5"
          >
            Allow update notifications
          </button>
          <Link
            href="/app"
            className="block w-full rounded-lg border border-white/15 px-4 py-3 text-center text-sm text-slate-200 hover:bg-white/5"
          >
            Reinstall home-screen icon
          </Link>
          <Link
            href="/dashboard"
            className="block text-center text-sm text-teal-300 hover:underline"
          >
            Back to app
          </Link>
        </div>
      </div>
    </div>
  );
}
