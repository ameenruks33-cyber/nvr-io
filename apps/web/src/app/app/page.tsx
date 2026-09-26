'use client';

import { useEffect, useRef, useState } from 'react';
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

  useEffect(() => {
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
        'Use your browser menu: Add to Home Screen / Install app. Installation always needs your confirmation.',
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
      <div className="w-full max-w-lg rounded-2xl border border-white/10 bg-ink-900/95 p-8 shadow-2xl">
        <p className="font-display text-4xl text-white">NVR.io</p>
        <p className="mt-2 text-sm text-slate-400">
          Download and install with your permission. Opens as a normal app
          icon.
        </p>

        <div className="mt-8 space-y-3">
          <button
            type="button"
            onClick={installPwa}
            className="w-full rounded-lg bg-accent px-4 py-3 font-medium text-white hover:bg-teal-700"
          >
            {canInstall ? 'Install NVR.io (ask permission)' : 'Install NVR.io'}
          </button>

          <a
            href="https://play.google.com/store"
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-lg border border-white/15 px-4 py-3 text-center text-sm text-slate-200 hover:bg-white/5"
          >
            Get Android app (Play Store — when published)
          </a>

          <a
            href="https://apps.apple.com/"
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-lg border border-white/15 px-4 py-3 text-center text-sm text-slate-200 hover:bg-white/5"
          >
            Get iOS app (App Store — when published)
          </a>
        </div>

        {status ? (
          <p className="mt-4 text-sm text-teal-200" role="status">
            {status}
          </p>
        ) : null}

        <ul className="mt-8 space-y-2 text-sm text-slate-400">
          <li>Install only after you approve the system prompt</li>
          <li>Normal visible app name: NVR.io</li>
          <li>Sign in with your staff account after install</li>
          <li>
            Records are saved on the NVR.io server / website — not kept as a
            local phone database
          </li>
        </ul>

        <Link
          href="/login"
          className="mt-6 inline-block text-sm text-teal-300 hover:underline"
        >
          Already installed? Sign in
        </Link>
      </div>
    </div>
  );
}
