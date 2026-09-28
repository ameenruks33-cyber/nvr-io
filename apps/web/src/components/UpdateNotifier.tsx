'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { applyAppUpdate } from '@/lib/apply-app-update';
import {
  clearUpdateNotifications,
  isMobileAppSurface,
} from '@/lib/mobile-app';

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
  iconsUpdated?: boolean;
  icons?: {
    favicon?: string;
    icon192?: string;
    icon512?: string;
    apple?: string;
    logo?: string;
  };
};

const STORAGE_KEY = 'nvr_app_version';
const CHECK_MS = 20_000;
const NOTIFY_ASKED_KEY = 'nvr_notify_asked';

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

function safeUpdatePath(url?: string) {
  if (!url || typeof url !== 'string') return '/updates';
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('\\')) {
    return '/updates';
  }
  return url;
}

function isInstalledPwa() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

/** Update banners + push alerts — mobile app only, never desktop website. */
export function UpdateNotifier() {
  const [enabled, setEnabled] = useState(false);
  const [update, setUpdate] = useState<AppUpdateInfo | null>(null);
  const [busy, setBusy] = useState(false);
  const [askNotify, setAskNotify] = useState(false);

  const applyUpdate = useCallback(async (info: AppUpdateInfo) => {
    setBusy(true);
    try {
      await clearUpdateNotifications(info.version);
      await applyAppUpdate(info, '/dashboard?updated=1');
    } finally {
      setBusy(false);
    }
  }, []);

  const maybeNotify = useCallback(async (info: AppUpdateInfo) => {
    if (!isMobileAppSurface()) return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const icon = info.icons?.icon192 || '/icon-192.png';
    if (!('serviceWorker' in navigator)) {
      new Notification(info.title, {
        body: info.message,
        icon,
        tag: `nvr-update-${info.version}`,
      });
      return;
    }
    const reg = await navigator.serviceWorker.ready;
    await reg.showNotification(info.title, {
      body: info.message,
      icon,
      badge: icon,
      tag: `nvr-update-${info.version}`,
      data: { url: safeUpdatePath(info.updateUrl), version: info.version },
      requireInteraction: true,
      ...({
        renotify: true,
        actions: [
          { action: 'update', title: 'Update now' },
          { action: 'later', title: 'Later' },
        ],
      } as NotificationOptions),
    });
  }, []);

  const check = useCallback(async () => {
    if (!isMobileAppSurface()) {
      setUpdate(null);
      return;
    }
    try {
      const info = await fetchUpdateFile();
      if (!info?.version) return;
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        localStorage.setItem(STORAGE_KEY, info.version);
        if ('serviceWorker' in navigator) {
          const reg = await navigator.serviceWorker.getRegistration();
          reg?.active?.postMessage({
            type: 'ACK_UPDATE',
            version: info.version,
          });
        }
        setUpdate(null);
        return;
      }
      if (cmpVersion(info.version, stored) > 0) {
        setUpdate(info);
        void maybeNotify(info);
      } else {
        setUpdate(null);
        await clearUpdateNotifications(info.version);
      }
    } catch {
      /* offline */
    }
  }, [maybeNotify]);

  useEffect(() => {
    const mobile = isMobileAppSurface();
    setEnabled(mobile);
    if (!mobile) {
      setUpdate(null);
      setAskNotify(false);
      return;
    }

    async function setup() {
      if (!('serviceWorker' in navigator)) {
        void check();
        return;
      }

      try {
        const reg = await navigator.serviceWorker.register('/sw.js', {
          updateViaCache: 'none',
        });
        await reg.update();

        const anyReg = reg as ServiceWorkerRegistration & {
          periodicSync?: {
            register: (
              tag: string,
              opts: { minInterval: number },
            ) => Promise<void>;
          };
        };
        if (anyReg.periodicSync) {
          try {
            await anyReg.periodicSync.register('nvr-update-check', {
              minInterval: 15 * 60 * 1000,
            });
          } catch {
            /* ignore */
          }
        }

        reg.active?.postMessage({ type: 'CHECK_UPDATE' });

        reg.addEventListener('updatefound', () => {
          const worker = reg.installing;
          worker?.addEventListener('statechange', () => {
            if (
              worker.state === 'installed' &&
              navigator.serviceWorker.controller
            ) {
              void check();
            }
          });
        });
      } catch {
        /* ignore */
      }

      void check();
    }

    void setup();

    const onMessage = (event: MessageEvent) => {
      if (!isMobileAppSurface()) return;
      if (event.data?.type === 'NVR_UPDATE_AVAILABLE' && event.data.update) {
        const info = event.data.update as AppUpdateInfo;
        setUpdate(info);
        void maybeNotify(info);
      }
    };
    navigator.serviceWorker?.addEventListener('message', onMessage);

    const timer = window.setInterval(() => void check(), CHECK_MS);
    const onFocus = () => void check();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void check();
    });

    if (
      isInstalledPwa() &&
      'Notification' in window &&
      Notification.permission === 'default' &&
      !localStorage.getItem(NOTIFY_ASKED_KEY)
    ) {
      setAskNotify(true);
    }

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', onFocus);
      navigator.serviceWorker?.removeEventListener('message', onMessage);
    };
  }, [check, maybeNotify]);

  async function enableAutoUpdates() {
    localStorage.setItem(NOTIFY_ASKED_KEY, '1');
    setAskNotify(false);
    if (!('Notification' in window)) return;
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      void check();
    }
  }

  if (!enabled) return null;

  return (
    <>
      {askNotify ? (
        <div className="fixed inset-x-0 bottom-0 z-[110] border-t border-blue-400/30 bg-slate-50 px-3 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-xs text-slate-700">
              Allow notifications so new CrickHerose updates are sent to this mobile
              app.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem(NOTIFY_ASKED_KEY, '1');
                  setAskNotify(false);
                }}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-600"
              >
                Not now
              </button>
              <button
                type="button"
                onClick={() => void enableAutoUpdates()}
                className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white"
              >
                Enable auto updates
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {update ? (
        <div
          role="status"
          className="fixed inset-x-0 top-0 z-[100] border-b border-blue-400/40 bg-blue-50 px-3 py-3 shadow-lg backdrop-blur"
        >
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-medium text-slate-900">{update.title}</p>
              <p className="text-xs text-blue-700">
                v{update.version} · {update.message}
              </p>
            </div>
            <div className="flex gap-2">
              <Link
                href={safeUpdatePath(update.updateUrl)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-xs text-blue-700 hover:bg-blue-50"
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
      ) : null}
    </>
  );
}
