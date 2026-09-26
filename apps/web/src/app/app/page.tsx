'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

function isStandalone() {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari
    ('standalone' in navigator &&
      Boolean((navigator as Navigator & { standalone?: boolean }).standalone))
  );
}

/**
 * Install NVR.io — Android Chrome can show a native prompt;
 * iPhone always needs Share → Add to Home Screen (no automatic popup).
 */
export default function InstallAppPage() {
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [status, setStatus] = useState('');
  const [isIos, setIsIos] = useState(false);
  const [isAndroid, setIsAndroid] = useState(false);
  const [installed, setInstalled] = useState(false);
  const [swReady, setSwReady] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1));
    setIsAndroid(/Android/i.test(ua));
    setInstalled(isStandalone());

    // Register SW first — required before Chrome fires beforeinstallprompt
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => navigator.serviceWorker.ready)
        .then(() => setSwReady(true))
        .catch(() => setSwReady(false));
    } else {
      setSwReady(false);
    }

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
      setStatus('Ready — tap Install below to add NVR.io to your home screen.');
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);

    window.addEventListener('appinstalled', () => {
      setInstalled(true);
      setCanInstall(false);
      deferred.current = null;
      setStatus('NVR.io is installed. Open it from your home screen.');
    });

    return () =>
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  async function installPwa() {
    if (installed) {
      setStatus('Already installed — open NVR.io from your home screen icon.');
      return;
    }
    if (!deferred.current) {
      setStatus(
        isIos
          ? 'On iPhone: tap the Share button (□↑) at the bottom, then “Add to Home Screen”, then Add.'
          : isAndroid
            ? 'On Android Chrome: tap the ⋮ menu (top right) → Install app / Add to Home screen.'
            : 'Use your browser menu: Install app / Add to Home Screen.',
      );
      return;
    }
    await deferred.current.prompt();
    const choice = await deferred.current.userChoice;
    setStatus(
      choice.outcome === 'accepted'
        ? 'NVR.io was installed. Check your home screen.'
        : 'Install cancelled. You can try again anytime.',
    );
    deferred.current = null;
    setCanInstall(false);
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink-900/95 p-6 shadow-2xl sm:p-8">
        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo.jpg"
            alt="NVR.io"
            width={128}
            height={128}
            className="rounded-3xl shadow-lg shadow-blue-500/25"
            priority
          />
          <p className="mt-4 font-display text-4xl text-white">Install NVR.io</p>
          <p className="mt-2 text-sm text-slate-400">
            Phones never auto-install. Use the button below (or the steps for
            your phone).
          </p>
        </div>

        {installed ? (
          <p className="mt-6 rounded-lg border border-teal-500/30 bg-teal-950/40 px-3 py-3 text-center text-sm text-teal-100">
            This device already has NVR.io installed. Open it from the home
            screen icon.
          </p>
        ) : null}

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={() => void installPwa()}
            className="w-full rounded-lg bg-blue-600 px-4 py-3.5 font-medium text-white hover:bg-blue-500"
          >
            {canInstall
              ? 'Install NVR.io now'
              : installed
                ? 'Already installed'
                : 'Install NVR.io'}
          </button>

          <button
            type="button"
            onClick={() => {
              if (!('Notification' in window)) {
                setStatus('This browser does not support notifications.');
                return;
              }
              void Notification.requestPermission().then((p) =>
                setStatus(
                  p === 'granted'
                    ? 'Update notifications enabled for this device.'
                    : 'Notifications were not enabled.',
                ),
              );
            }}
            className="w-full rounded-lg border border-white/15 px-4 py-3 text-sm text-slate-200 hover:bg-white/5"
          >
            Allow update notifications
          </button>

          <Link
            href="/login"
            className="block w-full rounded-lg border border-white/15 px-4 py-3 text-center text-sm text-slate-200 hover:bg-white/5"
          >
            Continue to sign in
          </Link>
        </div>

        {status ? (
          <p className="mt-4 text-sm text-teal-200" role="status">
            {status}
          </p>
        ) : null}

        <div className="mt-8 space-y-4 text-left text-sm text-slate-300">
          {isIos ? (
            <div className="rounded-xl border border-white/10 bg-ink-950/80 p-4">
              <p className="font-medium text-white">iPhone / iPad (Safari)</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-400">
                <li>Open this page in Safari (not Chrome / Instagram)</li>
                <li>Tap Share (□↑) at the bottom</li>
                <li>Scroll and tap Add to Home Screen</li>
                <li>Tap Add</li>
              </ol>
            </div>
          ) : null}

          {isAndroid || (!isIos && !installed) ? (
            <div className="rounded-xl border border-white/10 bg-ink-950/80 p-4">
              <p className="font-medium text-white">Android (Chrome)</p>
              <ol className="mt-2 list-decimal space-y-1 pl-5 text-slate-400">
                <li>Open https://nvr-io-web.vercel.app/app in Chrome</li>
                <li>Tap Install NVR.io above (or ⋮ → Install app)</li>
                <li>Confirm Install when Chrome asks</li>
              </ol>
              {!canInstall && swReady ? (
                <p className="mt-2 text-xs text-amber-200/90">
                  If no Install popup appears, use Chrome menu → Install app.
                  In-app browsers (WhatsApp, Instagram) cannot install PWAs —
                  open the link in Chrome.
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="mt-6 text-center text-xs text-slate-500">
          Direct install link:{' '}
          <span className="text-slate-400">nvr-io-web.vercel.app/app</span>
        </p>
      </div>
    </div>
  );
}
