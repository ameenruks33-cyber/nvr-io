'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { api, getSession } from '@/lib/api';

type GalleryItem = {
  id: string;
  storageKey: string;
  mimeType?: string | null;
  caption?: string | null;
  note?: string | null;
  status: 'PENDING' | 'VERIFIED' | 'REJECTED';
  createdAt: string;
  uploadedBy?: { id: string; name: string; email: string };
  verifiedBy?: { id: string; name: string; email: string } | null;
};

const UNLOCK_KEY = 'nvr_gallery_unlocked';

function GalleryThumb({ id, alt }: { id: string; alt: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  useEffect(() => {
    const session = getSession();
    if (!session) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    fetch(`${apiBase}/gallery/${id}/file`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error('load failed');
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) setSrc(null);
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiBase, id]);

  if (!src) {
    return (
      <div className="flex aspect-square items-center justify-center bg-ink-950 text-xs text-slate-500">
        …
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return (
    <img
      src={src}
      alt={alt}
      draggable={false}
      onContextMenu={(e) => e.preventDefault()}
      className="aspect-square w-full object-cover select-none"
    />
  );
}

/**
 * Shared cloud gallery — PIN unlock, watch-only.
 * Photos are captured from Add person (Capture → cloud).
 */
export default function GalleryPage() {
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>(
    'ALL',
  );
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');

  const [pinSet, setPinSet] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [pin, setPin] = useState('');
  const [unlocking, setUnlocking] = useState(false);

  const isSuperAdmin = role === 'SUPER_ADMIN';

  async function load() {
    try {
      const q = filter === 'ALL' ? '' : `?status=${filter}`;
      const rows = await api<GalleryItem[]>(`/gallery${q}`);
      setItems(rows);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cloud gallery');
    }
  }

  useEffect(() => {
    const session = getSession();
    setRole(session?.user.role || '');
    if (sessionStorage.getItem(UNLOCK_KEY) === '1') {
      setUnlocked(true);
    }
    api<{ pinSet: boolean }>('/gallery/pin-status')
      .then((s) => setPinSet(s.pinSet))
      .catch(() => setPinSet(false));
  }, []);

  useEffect(() => {
    if (unlocked) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, unlocked]);

  async function onUnlock(e: FormEvent) {
    e.preventDefault();
    setUnlocking(true);
    setError('');
    try {
      await api('/gallery/unlock', {
        method: 'POST',
        body: JSON.stringify({ pin: pin.trim() }),
      });
      sessionStorage.setItem(UNLOCK_KEY, '1');
      setUnlocked(true);
      setPin('');
      setStatusMsg('Gallery unlocked — watching cloud photos from Add person.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Wrong PIN');
    } finally {
      setUnlocking(false);
    }
  }

  function lockGallery() {
    sessionStorage.removeItem(UNLOCK_KEY);
    setUnlocked(false);
  }

  if (!unlocked) {
    return (
      <AppShell>
        <h1 className="font-display text-3xl text-white">Cloud gallery</h1>
        <p className="mt-2 max-w-lg text-sm text-slate-400">
          Watch cloud photos captured from Add person. Enter the number
          password to open.
        </p>

        {!pinSet ? (
          <p className="mt-6 max-w-md rounded-2xl border border-amber-500/30 bg-amber-950/30 p-4 text-sm text-amber-100">
            Gallery PIN is not set yet.
            {isSuperAdmin
              ? ' Open Settings and set a 4–8 digit number password.'
              : ' Ask the super admin to set the gallery number password in Settings.'}
          </p>
        ) : (
          <form
            onSubmit={onUnlock}
            className="mt-6 max-w-sm space-y-4 rounded-2xl border border-white/10 bg-ink-900/90 p-5"
          >
            <label className="block text-sm">
              <span className="text-slate-300">Number password (PIN)</span>
              <input
                className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3 tracking-[0.4em] outline-none ring-blue-500 focus:ring-2"
                type="password"
                inputMode="numeric"
                pattern="\d{4,8}"
                maxLength={8}
                value={pin}
                onChange={(e) =>
                  setPin(e.target.value.replace(/\D/g, '').slice(0, 8))
                }
                required
                autoComplete="one-time-code"
                placeholder="••••"
              />
            </label>
            {error ? (
              <p className="text-sm text-red-300" role="alert">
                {error}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={unlocking || pin.length < 4}
              className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {unlocking ? 'Unlocking…' : 'Unlock gallery'}
            </button>
          </form>
        )}
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-white">Cloud gallery</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Watch-only. Photos are captured with Capture → cloud on{' '}
            <Link href="/customers/new" className="text-teal-300 underline">
              Add person
            </Link>
            .
          </p>
        </div>
        <button
          type="button"
          onClick={lockGallery}
          className="text-xs text-slate-500 underline hover:text-slate-300"
        >
          Lock gallery
        </button>
      </div>

      {statusMsg ? (
        <p className="mt-4 text-sm text-teal-200" role="status">
          {statusMsg}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-300" role="alert">
          {error}
        </p>
      ) : null}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          {(
            [
              ['ALL', 'All photos'],
              ['PENDING', 'New'],
              ['VERIFIED', 'Verified'],
              ['REJECTED', 'Rejected'],
            ] as const
          ).map(([f, label]) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`rounded-lg px-3 py-1.5 text-xs ${
                filter === f
                  ? 'bg-blue-600/30 text-blue-100'
                  : 'border border-white/10 text-slate-400'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">Watch only · from Add person</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900/70"
          >
            <GalleryThumb
              id={item.id}
              alt={item.caption || 'Cloud gallery item'}
            />
            <div className="space-y-1 p-3 text-xs">
              <p className="truncate text-sm text-white">
                {item.caption || 'Untitled'}
              </p>
              <p className="text-slate-400">
                {item.status}
                {item.uploadedBy ? ` · ${item.uploadedBy.name}` : ''}
              </p>
            </div>
          </article>
        ))}
      </div>

      {!items.length ? (
        <p className="mt-8 text-center text-sm text-slate-500">
          No cloud photos yet. Capture with Open camera → Capture → cloud on{' '}
          <Link href="/customers/new" className="text-teal-300 underline">
            Add person
          </Link>
          .
        </p>
      ) : null}
    </AppShell>
  );
}
