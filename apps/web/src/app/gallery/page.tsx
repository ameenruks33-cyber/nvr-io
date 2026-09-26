'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
        // Memory-only preview — never written to device storage
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
 * NVR.io cloud gallery — camera → server only.
 * No device Photos picker, no local save, no Downloads.
 */
export default function GalleryPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [items, setItems] = useState<GalleryItem[]>([]);
  const [caption, setCaption] = useState('');
  const [filter, setFilter] = useState<'ALL' | 'PENDING' | 'VERIFIED' | 'REJECTED'>(
    'ALL',
  );
  const [role, setRole] = useState('');
  const [error, setError] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const isAdmin = role === 'SUPER_ADMIN' || role === 'ADMIN';

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setCameraOn(false);
  }, []);

  const startCamera = useCallback(
    async (mode?: 'environment' | 'user') => {
      const useFacing = mode || facing;
      setError('');
      setCameraBusy(true);
      try {
        stopCamera();
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error(
            'Camera is not available in this browser. Open NVR.io in Chrome or Safari.',
          );
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: useFacing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraOn(true);
        setStatusMsg(
          'Live camera ready — photos go only to NVR.io cloud, never to phone Photos.',
        );
      } catch (e) {
        setCameraOn(false);
        setError(
          e instanceof Error
            ? e.message
            : 'Could not open camera. Allow camera permission for NVR.io only.',
        );
      } finally {
        setCameraBusy(false);
      }
    },
    [facing, stopCamera],
  );

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

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
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  async function captureAndUpload() {
    const video = videoRef.current;
    if (!video || !cameraOn) {
      setError('Open the in-app camera first.');
      return;
    }
    setUploading(true);
    setError('');
    setStatusMsg('');
    try {
      const w = video.videoWidth || 1280;
      const h = video.videoHeight || 720;
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not capture frame');
      ctx.drawImage(video, 0, 0, w, h);

      const blob = await new Promise<Blob>((resolve, reject) => {
        canvas.toBlob(
          (b) => (b ? resolve(b) : reject(new Error('Capture failed'))),
          'image/jpeg',
          0.88,
        );
      });

      // Upload straight to cloud — never write blob to device storage / Photos
      const fd = new FormData();
      fd.append('file', blob, `nvr-cloud-${Date.now()}.jpg`);
      if (caption.trim()) fd.append('caption', caption.trim());

      await api<GalleryItem>('/gallery/upload', {
        method: 'POST',
        body: fd,
      });

      setCaption('');
      setStatusMsg('Saved to NVR.io cloud gallery only. Not on this device.');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cloud upload failed');
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
          <h1 className="font-display text-3xl text-white">Cloud gallery</h1>
          <p className="mt-1 max-w-xl text-sm text-slate-400">
            Private NVR.io storage only. This gallery does{' '}
            <strong className="text-slate-200">not</strong> open your phone
            Photos, does not save to device storage, and does not sync with the
            device gallery — camera capture uploads straight to the cloud.
          </p>
        </div>
      </div>

      <div className="mt-6 space-y-4 rounded-2xl border border-blue-500/20 bg-ink-900/80 p-4">
        <div className="rounded-lg border border-teal-500/20 bg-teal-950/30 px-3 py-2 text-xs text-teal-100/90">
          Cloud-only · No device Photos · No Downloads · No local gallery link
        </div>

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

        <div className="overflow-hidden rounded-xl border border-white/10 bg-black">
          <video
            ref={videoRef}
            playsInline
            muted
            autoPlay
            className={
              cameraOn
                ? 'aspect-[4/3] w-full object-cover'
                : 'hidden'
            }
          />
          {!cameraOn ? (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 px-4 text-center text-sm text-slate-500">
              <p>In-app camera is off</p>
              <p className="text-xs text-slate-600">
                We never open your phone gallery or file storage.
              </p>
            </div>
          ) : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            disabled={cameraBusy || uploading}
            onClick={() => void startCamera()}
            className="rounded-xl bg-blue-600 px-4 py-3.5 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
          >
            {cameraBusy
              ? 'Opening camera…'
              : cameraOn
                ? 'Restart camera'
                : 'Open in-app camera'}
          </button>
          <button
            type="button"
            disabled={!cameraOn || uploading}
            onClick={() => void captureAndUpload()}
            className="rounded-xl bg-teal-600 px-4 py-3.5 font-medium text-white hover:bg-teal-500 disabled:opacity-60"
          >
            {uploading ? 'Uploading to cloud…' : 'Capture → cloud'}
          </button>
          <button
            type="button"
            disabled={uploading || cameraBusy}
            onClick={() => {
              const next = facing === 'environment' ? 'user' : 'environment';
              setFacing(next);
              if (cameraOn) void startCamera(next);
            }}
            className="rounded-xl border border-white/15 px-4 py-3.5 text-slate-200 hover:bg-white/5 disabled:opacity-60"
          >
            Flip camera ({facing === 'environment' ? 'rear' : 'front'})
          </button>
        </div>

        {cameraOn ? (
          <button
            type="button"
            onClick={stopCamera}
            className="text-xs text-slate-500 underline hover:text-slate-300"
          >
            Close camera
          </button>
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

      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
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
        <p className="text-xs text-slate-500">Stored in NVR.io cloud</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {items.map((item) => (
          <article
            key={item.id}
            className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900/70"
          >
            <GalleryThumb id={item.id} alt={item.caption || 'Cloud gallery item'} />
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
          Cloud gallery is empty. Open the in-app camera and capture — nothing
          is stored on this phone.
        </p>
      ) : null}
    </AppShell>
  );
}
