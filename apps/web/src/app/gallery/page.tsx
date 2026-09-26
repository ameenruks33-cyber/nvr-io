'use client';

import { useEffect, useRef, useState } from 'react';
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
  return <img src={src} alt={alt} className="aspect-square w-full object-cover" />;
}

export default function GalleryPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [caption, setCaption] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>(
    'ALL',
  );
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

  async function load() {
    try {
      const q = filter === 'ALL' ? '' : `?status=${filter}`;
      const rows = await api<GalleryItem[]>(`/gallery${q}`);
      setItems(rows);
      setError('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load gallery');
    }
  }

  useEffect(() => {
    const session = getSession();
    setRole(session?.user.role || '');
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function onPick(file: File | null) {
    if (!file) return;
    setUploading(true);
    setError('');
    setStatusMsg('');
    try {
      // In-memory only — never write to device Photos / Downloads
      const localPreview = URL.createObjectURL(file);
      setPreview(localPreview);

      const fd = new FormData();
      fd.append('file', file, file.name || 'capture.jpg');
      if (caption.trim()) fd.append('caption', caption.trim());

      await api<GalleryItem>('/gallery/upload', {
        method: 'POST',
        body: fd,
      });

      setCaption('');
      setStatusMsg('Saved to secret gallery on the server. Visible on the website.');
      if (fileRef.current) fileRef.current.value = '';
      URL.revokeObjectURL(localPreview);
      setPreview(null);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function setItemStatus(id: string, status: 'VERIFIED' | 'REJECTED') {
    try {
      await api(`/gallery/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Update failed');
    }
  }

  return (
    <AppShell>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl text-white">Secret gallery</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Photos stay inside NVR.io on the server — they are{' '}
            <strong className="text-slate-200">not</strong> saved to your phone
            Photos app. Everything uploaded here appears on the website for
            admin verification.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-blue-500/20 bg-ink-900/80 p-4">
        <label className="block text-sm">
          <span className="text-slate-300">Caption (optional)</span>
          <input
            className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-3 outline-none ring-blue-500 focus:ring-2"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={120}
            placeholder="e.g. Passport scan — Ahmed"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            disabled={uploading}
            onClick={() => {
              const input = fileRef.current;
              if (!input) return;
              input.setAttribute('capture', 'environment');
              input.click();
            }}
            className="rounded-xl bg-blue-600 px-4 py-3.5 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {uploading ? 'Uploading…' : 'Take photo (camera)'}
          </button>
          <button
            type="button"
            disabled={uploading}
            onClick={() => {
              const input = fileRef.current;
              if (!input) return;
              input.removeAttribute('capture');
              input.click();
            }}
            className="rounded-xl border border-white/15 px-4 py-3.5 text-slate-200 hover:bg-white/5 disabled:opacity-60"
          >
            Choose image file
          </button>
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => onPick(e.target.files?.[0] || null)}
        />

        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Upload preview"
            className="max-h-48 rounded-xl border border-white/10 object-contain"
          />
        ) : null}

        {statusMsg ? (
          <p className="text-sm text-teal-200" role="status">
            {statusMsg}
          </p>
        ) : null}
        {error ? (
          <p className="text-sm text-red-300" role="alert">
            {error}
          </p>
        ) : null}
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {(['ALL', 'PENDING', 'VERIFIED', 'REJECTED'] as const).map((f) => (
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
            {f}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900/70"
          >
            <GalleryThumb id={item.id} alt={item.caption || 'Gallery item'} />
            <div className="space-y-1 p-3 text-xs">
              <p className="truncate text-sm text-white">
                {item.caption || 'Untitled'}
              </p>
              <p className="text-slate-400">
                {item.status}
                {item.uploadedBy ? ` · ${item.uploadedBy.name}` : ''}
              </p>
              {isAdmin && item.status === 'PENDING' ? (
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setItemStatus(item.id, 'VERIFIED')}
                    className="flex-1 rounded-lg bg-teal-700/80 px-2 py-1.5 text-white"
                  >
                    Verify
                  </button>
                  <button
                    type="button"
                    onClick={() => setItemStatus(item.id, 'REJECTED')}
                    className="flex-1 rounded-lg bg-red-800/80 px-2 py-1.5 text-white"
                  >
                    Reject
                  </button>
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>

      {!items.length ? (
        <p className="mt-8 text-center text-sm text-slate-500">
          No items yet. Capture a photo above — it syncs to the website
          instantly.
        </p>
      ) : null}
    </AppShell>
  );
}
