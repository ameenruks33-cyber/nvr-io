'use client';

import { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
};

/**
 * Install NVR.io with explicit user permission.
 * No silent install. No hidden app / dial-pad activation.
 */
export default function InstallAppPage() {
  const deferred = useRef<BeforeInstallPromptEvent | null>(null);
  const [canInstall, setCanInstall] = useState(false);
  const [status, setStatus] = useState('');
  const [isIos, setIsIos] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIos(/iPad|iPhone|iPod/.test(ua));

    function onBeforeInstall(e: Event) {
      e.preventDefault();
      deferred.current = e as BeforeInstallPromptEvent;
      setCanInstall(true);
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall);
    return () =>
      window.removeEventListener('beforeinstallprompt', onBeforeInstall);
  }, []);

  async function installPwa() {
    if (!deferred.current) {
      setStatus(
        isIos
          ? 'On iPhone/iPad: tap Share → Add to Home Screen, then confirm.'
          : 'Use your browser menu: Install app / Add to Home Screen. Installation always needs your confirmation.',
      );
      return;
    }
    await deferred.current.prompt();
    const choice = await deferred.current.userChoice;
    setStatus(
      choice.outcome === 'accepted'
        ? 'NVR.io was installed with your permission.'
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
          <p className="mt-4 font-display text-4xl text-white">NVR.io</p>
          <p className="mt-2 text-sm text-slate-400">
            Install with your permission. Opens as a normal app icon on your
            phone.
          </p>
        </div>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={installPwa}
            className="w-full rounded-lg bg-blue-600 px-4 py-3.5 font-medium text-white hover:bg-blue-500"
          >
            {canInstall ? 'Install NVR.io (ask permission)' : 'Install NVR.io'}
          </button>

          <Link
            href="/login"
            className="block w-full rounded-lg border border-white/15 px-4 py-3 text-center text-sm text-slate-200 hover:bg-white/5"
          >
            Open in browser / sign in
          </Link>
        </div>

        {status ? (
          <p className="mt-4 text-sm text-teal-200" role="status">
            {status}
          </p>
        ) : null}

        <ul className="mt-8 space-y-2 text-sm text-slate-400">
          <li>Android Chrome: tap Install when prompted</li>
          <li>iPhone Safari: Share → Add to Home Screen</li>
          <li>Same login on web and installed app</li>
          <li>Change name/password anytime in Settings</li>
          <li>Records stay on the NVR.io server</li>
        </ul>
      </div>
    </div>
  );
}
