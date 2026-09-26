'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { AppUpdateInfo } from '@/components/UpdateNotifier';

const STORAGE_KEY = 'nvr_app_version';

export default function UpdatesPage() {
  const [info, setInfo] = useState<AppUpdateInfo | null>(null);
  const [current, setCurrent] = useState('…');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setCurrent(localStorage.getItem(STORAGE_KEY) || 'not installed yet');
    fetch(`/app-update.json?t=${Date.now()}`, { cache: 'no-store' })
      .then((r) => r.json())
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  async function applyUpdate() {
    if (!info) return;
    setBusy(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        reg?.active?.postMessage({ type: 'ACK_UPDATE', version: info.version });
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      localStorage.setItem(STORAGE_KEY, info.version);
      window.location.assign('/dashboard');
      setTimeout(() => window.location.reload(), 80);
    } finally {
      setBusy(false);
    }
  }

  async function enableNotifications() {
    if (!('Notification' in window)) return;
    await Notification.requestPermission();
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-lg flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-white/10 bg-ink-900/95 p-6 shadow-2xl">
        <p className="font-display text-3xl text-white">App updates</p>
        <p className="mt-2 text-sm text-slate-400">
          Installed devices get update alerts automatically. Allow notifications
          once, then new versions are pushed to this phone when you ship.
        </p>

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
            className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {busy ? 'Updating…' : 'Update now'}
          </button>
          <button
            type="button"
            onClick={() => void enableNotifications()}
            className="w-full rounded-lg border border-white/15 px-4 py-3 text-sm text-slate-200 hover:bg-white/5"
          >
            Allow update notifications
          </button>
          <Link
            href="/dashboard"
            className="block text-center text-sm text-teal-300 hover:underline"
          >
            Back to app
          </Link>
        </div>

        <p className="mt-6 text-xs text-slate-500">
          Update file: <code className="text-slate-400">/app-update.json</code>
        </p>
      </div>
    </div>
  );
}
