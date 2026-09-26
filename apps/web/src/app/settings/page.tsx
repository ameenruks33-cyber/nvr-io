'use client';

import { AppShell } from '@/components/AppShell';

export default function SettingsPage() {
  return (
    <AppShell>
      <h1 className="font-display text-3xl text-white">Settings</h1>
      <div className="mt-6 max-w-xl space-y-4 rounded-2xl border border-white/10 bg-ink-900/70 p-6 text-sm text-slate-300">
        <p>
          <strong className="text-white">NVR.io</strong> is set up for{' '}
          <strong className="text-white">personal use</strong> — private
          records and payment tracking, not a public finance product.
        </p>
        <p>
          Default target: AED 1,800 · default entry: AED 100. Adjust in your
          environment config if needed.
        </p>
        <p>
          Install from /app with your permission. Data is stored on the NVR.io
          server / website.
        </p>
      </div>
    </AppShell>
  );
}
