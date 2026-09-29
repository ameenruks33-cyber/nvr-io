'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { api, getSession } from '@/lib/api';
import { useLiveRefresh } from '@/lib/live-sync';

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
  const [failed, setFailed] = useState(false);
  const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

  useEffect(() => {
    const session = getSession();
    if (!session) {
      setFailed(true);
      return;
    }
    let objectUrl: string | null = null;
    let cancelled = false;
    setFailed(false);
    setSrc(null);

    fetch(`${apiBase}/gallery/${id}/file`, {
      headers: { Authorization: `Bearer ${session.accessToken}` },
      mode: 'cors',
      credentials: 'omit',
    })
      .then((r) => {
        if (!r.ok) throw new Error(`load failed (${r.status})`);
        return r.blob();
      })
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setSrc(null);
          setFailed(true);
        }
      });

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [apiBase, id]);

  if (failed) {
    return (
      <div className="flex aspect-square items-center justify-center bg-slate-50 px-2 text-center text-xs text-red-600">
        Could not load photo
      </div>
    );
  }

  if (!src) {
    return (
      <div className="flex aspect-square items-center justify-center bg-slate-50 text-xs text-slate-500">
        Loading…
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
 * Shared cloud gallery — PIN unlock when set; watch photos from Add person.
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
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [savingPin, setSavingPin] = useState(false);
  const [deletingId, setDeletingId] = useState('');

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
      .then((s) => {
        setPinSet(s.pinSet);
        // If no PIN configured yet, open gallery for signed-in staff
        if (!s.pinSet) {
          sessionStorage.setItem(UNLOCK_KEY, '1');
          setUnlocked(true);
        }
      })
      .catch(() => {
        setPinSet(false);
        sessionStorage.setItem(UNLOCK_KEY, '1');
        setUnlocked(true);
      });
  }, []);

  useEffect(() => {
    if (unlocked) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter, unlocked]);

  useLiveRefresh(() => {
    if (unlocked) void load();
  });

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

  async function onSetPin(e: FormEvent) {
    e.preventDefault();
    setError('');
    if (!/^\d{4,8}$/.test(newPin)) {
      setError('PIN must be 4–8 digits');
      return;
    }
    if (newPin !== newPinConfirm) {
      setError('PIN confirmation does not match');
      return;
    }
    setSavingPin(true);
    try {
      await api('/gallery/pin', {
        method: 'POST',
        body: JSON.stringify({ pin: newPin }),
      });
      setPinSet(true);
      setNewPin('');
      setNewPinConfirm('');
      setStatusMsg('Gallery number password saved. Staff will unlock with this PIN next time.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save PIN');
    } finally {
      setSavingPin(false);
    }
  }

  function lockGallery() {
    if (!pinSet) {
      setStatusMsg('Set a gallery PIN in Settings (or below) before locking.');
      return;
    }
    sessionStorage.removeItem(UNLOCK_KEY);
    setUnlocked(false);
  }

  async function deletePhoto(id: string, caption?: string | null) {
    const label = caption?.trim() || 'this photo';
    if (
      !window.confirm(
        `Delete ${label} from the cloud gallery? This cannot be undone.`,
      )
    ) {
      return;
    }
    setDeletingId(id);
    setError('');
    try {
      await api(`/gallery/${id}`, { method: 'DELETE' });
      setItems((prev) => prev.filter((p) => p.id !== id));
      setStatusMsg('Photo deleted from cloud gallery.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not delete photo');
    } finally {
      setDeletingId('');
    }
  }

  if (!unlocked && pinSet) {
    return (
      <AppShell>
        <h1 className="font-display text-3xl text-slate-900">Cloud gallery</h1>
        <p className="mt-2 max-w-lg text-sm text-slate-500">
          Watch cloud photos captured from Add person. Enter the number
          password to open.
        </p>

        <form
          onSubmit={onUnlock}
          className="mt-6 max-w-sm space-y-4 rounded-2xl border border-slate-200 bg-white p-5"
        >
          <label className="block text-sm">
            <span className="text-slate-600">Number password (PIN)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 tracking-[0.4em] outline-none ring-blue-500 focus:ring-2"
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
            <p className="text-sm text-red-600" role="alert">
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
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-slate-900">Cloud gallery</h1>
        </div>
        {pinSet ? (
          <button
            type="button"
            onClick={lockGallery}
            className="text-xs text-slate-500 underline hover:text-slate-800"
          >
            Lock gallery
          </button>
        ) : null}
      </div>

      {!pinSet && isSuperAdmin ? (
        <form
          onSubmit={onSetPin}
          className="mt-4 max-w-md space-y-3 rounded-2xl border border-amber-500/30 bg-amber-50 p-4"
        >
          <p className="text-sm text-amber-700">
            No gallery PIN yet. Set a 4–8 digit number password so the gallery
            can be locked later.
          </p>
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 tracking-[0.3em]"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={newPin}
            onChange={(e) =>
              setNewPin(e.target.value.replace(/\D/g, '').slice(0, 8))
            }
            placeholder="New PIN"
            required
          />
          <input
            className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 tracking-[0.3em]"
            type="password"
            inputMode="numeric"
            maxLength={8}
            value={newPinConfirm}
            onChange={(e) =>
              setNewPinConfirm(e.target.value.replace(/\D/g, '').slice(0, 8))
            }
            placeholder="Confirm PIN"
            required
          />
          <button
            type="submit"
            disabled={savingPin || newPin.length < 4}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm text-white disabled:opacity-60"
          >
            {savingPin ? 'Saving…' : 'Set gallery PIN'}
          </button>
        </form>
      ) : null}

      {!pinSet && !isSuperAdmin ? (
        <p className="mt-4 text-sm text-amber-700">
          Gallery is open (no PIN set yet). Ask the super admin to set a number
          password in Settings.
        </p>
      ) : null}

      {statusMsg ? (
        <p className="mt-4 text-sm text-teal-700" role="status">
          {statusMsg}
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 text-sm text-red-600" role="alert">
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
                  ? 'bg-blue-100 text-blue-700'
                  : 'border border-slate-200 text-slate-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-xs text-slate-500">
          From Add person{isSuperAdmin ? ' · can delete' : ''}
        </p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white"
          >
            <GalleryThumb
              id={item.id}
              alt={item.caption || 'Cloud gallery item'}
            />
            <div className="space-y-2 p-3 text-xs">
              <p className="truncate text-sm text-slate-900">
                {item.caption || 'Untitled'}
              </p>
              <p className="text-slate-500">
                {item.status}
                {item.uploadedBy ? ` · ${item.uploadedBy.name}` : ''}
              </p>
              {isSuperAdmin ? (
                <button
                  type="button"
                  disabled={deletingId === item.id}
                  onClick={() => void deletePhoto(item.id, item.caption)}
                  className="w-full rounded-lg bg-red-800/80 px-2 py-1.5 text-white hover:bg-red-700 disabled:opacity-60"
                >
                  {deletingId === item.id ? 'Deleting…' : 'Delete'}
                </button>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {!items.length ? (
        <p className="mt-8 text-center text-sm text-slate-500">
          No cloud photos yet. Use Data Capture or Upload from device, then
          Save Cloud on{' '}
          <Link href="/customers/new" className="text-teal-700 underline">
            Add person
          </Link>
          . Older photos taken before this fix may need a new capture.
        </p>
      ) : null}
    </AppShell>
  );
}
