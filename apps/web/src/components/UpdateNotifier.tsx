'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

export type AppUpdateInfo = {
  app: string;
  version: string;
  build: string;
  releasedAt: string;
  title: string;
  message: string;
  notes?: string[];
  force?: boolean;
  updateUrl?: string;
};

const STORAGE_KEY = 'nvr_app_version';
const CHECK_MS = 60_000;

function cmpVersion(a: string, b: string) {
  const pa = a.split('.').map((n) => parseInt(n, 10) || 0);
  const pb = b.split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

async function fetchUpdateFile(): Promise<AppUpdateInfo | null> {
  const res = await fetch(`/app-update.json?t=${Date.now()}`, {
    cache: 'no-store',
  });
  if (!res.ok) return null;
  return res.json();
}

/** Only allow same-origin relative paths (blocks javascript:/https:// open redirects). */
function safeUpdatePath(url?: string) {
  if (!url || typeof url !== 'string') return '/updates';
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('\\')) {
    return '/updates';
  }
  return url;
}

export function UpdateNotifier() {
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);

  const applyUpdate = useCallback(async (info: AppUpdateInfo) => {
    setBusy(true);
    try {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        reg?.waiting?.postMessage({ type: 'SKIP_WAITING' });
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
      localStorage.setItem(STORAGE_KEY, info.version);
      window.location.assign(safeUpdatePath(info.updateUrl));
      // Hard reload after navigation target loads
      setTimeout(() => window.location.reload(), 50);
    } finally {
      setBusy(false);
    }
  }, []);

  const maybeNotify = useCallback(async (info: AppUpdateInfo) => {
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      // Don't force; install page can request permission
      return;
    }
    if (Notification.permission !== 'granted') return;
    if (!('serviceWorker' in navigator)) {
      new Notification(info.title, {
        body: info.message,
        icon: '/icon-192.png',
        tag: `nvr-update-${info.version}`,
      });
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(info.title, {
      body: info.message,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      tag: `nvr-update-${info.version}`,
      data: { url: safeUpdatePath(info.updateUrl) },
      requireInteraction: Boolean(info.force),
    });
  }, []);

  const check = useCallback(async () => {
    try {
      const info = await fetchUpdateFile();
      if (!info?.version) return;
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        // First run on this device — record current version, no nag
        localStorage.setItem(STORAGE_KEY, info.version);
        setUpdate(null);
        return;
      }
      if (cmpVersion(info.version, stored) > 0) {
        setUpdate(info);
        void maybeNotify(info);
      } else {
        setUpdate(null);
      }
    } catch {
      /* offline / ignore */
    }
  }, [maybeNotify]);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then((reg) => {
          reg.update().catch(() => undefined);
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                void check();
              }
            });
          });
        })
        .catch(() => undefined);
    }

    void check();
    const timer = window.setInterval(() => void check(), CHECK_MS);
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void check();
    });

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
    };
  }, [check]);

  if (!update) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] border-b border-blue-400/40 bg-blue-950/95 px-3 py-3 shadow-lg backdrop-blur"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-white">{update.title}</p>
          <p className="text-xs text-blue-100/90">
            v{update.version} · {update.message}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href={safeUpdatePath(update.updateUrl)}
            className="rounded-lg border border-white/20 px-3 py-2 text-xs text-blue-100 hover:bg-white/5"
          >
            Details
          </Link>
          <button
            type="button"
            disabled={busy}
            onClick={() => void applyUpdate(update)}
            className="rounded-lg bg-blue-500 px-4 py-2 text-xs font-medium text-white hover:bg-blue-400 disabled:opacity-60"
          >
            {busy ? 'Updating…' : 'Update now'}
          </button>
        </div>
      </div>
    </div>
  );
}
