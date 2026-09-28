'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

// Vercel rejects request bodies over ~4.5 MB, so device photos are downscaled first.
const MAX_UPLOAD_EDGE = 1600;

async function shrinkImage(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file).catch(() => null);
  if (!bitmap) return file;
  const scale = Math.min(1, MAX_UPLOAD_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', 0.85),
  );
  if (!blob) return file;
  const base = file.name.replace(/\.[^.]+$/, '') || 'photo';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg' });
}

type PendingPhoto = { file: File; url: string };

export default function NewCustomerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const pendingRef = useRef<PendingPhoto[]>([]);
  pendingRef.current = pending;
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Location not requested');
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraBusy, setCameraBusy] = useState(false);
  const [facing, setFacing] = useState<'environment' | 'user'>('environment');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [photoStatus, setPhotoStatus] = useState('');

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
            'Camera is not available. Open CrickHerose in Chrome or Safari.',
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
      } catch (e) {
        setCameraOn(false);
        setError(
          e instanceof Error ? e.message : 'Could not open camera.',
        );
      } finally {
        setCameraBusy(false);
      }
    },
    [facing, stopCamera],
  );

  useEffect(() => () => stopCamera(), [stopCamera]);

  useEffect(
    () => () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.url)),
    [],
  );

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function captureFrameBlob() {
    const video = videoRef.current;
    if (!video || !cameraOn) {
      throw new Error('Open the in-app camera first.');
    }
    const w = video.videoWidth || 1280;
    const h = video.videoHeight || 720;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not capture frame');
    ctx.drawImage(video, 0, 0, w, h);

    return new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('Capture failed'))),
        'image/jpeg',
        0.88,
      );
    });
  }

  async function uploadToGallery(file: File) {
    const fd = new FormData();
    fd.append('file', file);
    if (caption.trim()) fd.append('caption', caption.trim());
    await api('/gallery/upload', { method: 'POST', body: fd });
  }

  function setPersonPhoto(file: File) {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
    setPhoto(file);
  }

  async function onPickFiles(list: FileList | null) {
    const files = Array.from(list || []).filter((f) => f.type.startsWith('image/'));
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (!files.length) return;
    setError('');
    setPhotoStatus('');
    const shrunk = await Promise.all(files.map(shrinkImage));
    setPending((prev) => [
      ...prev,
      ...shrunk.map((file) => ({ file, url: URL.createObjectURL(file) })),
    ]);
  }

  function removePending(url: string) {
    URL.revokeObjectURL(url);
    setPending((prev) => prev.filter((p) => p.url !== url));
  }

  async function saveToCloud() {
    setUploading(true);
    setError('');
    setPhotoStatus('');
    try {
      if (pending.length) {
        const failed: PendingPhoto[] = [];
        let saved = 0;
        for (const p of pending) {
          try {
            await uploadToGallery(p.file);
            saved += 1;
          } catch {
            failed.push(p);
          }
        }
        if (saved) setPersonPhoto(pending.find((p) => !failed.includes(p))!.file);
        pending.filter((p) => !failed.includes(p)).forEach((p) => URL.revokeObjectURL(p.url));
        setPending(failed);
        if (failed.length) {
          setError(`${failed.length} photo(s) failed to upload. Tap Save Cloud to retry.`);
        }
        if (saved) {
          setPhotoStatus(
            `${saved} photo${saved > 1 ? 's' : ''} saved to cloud gallery. First one set for this person.`,
          );
          setCaption('');
        }
        return;
      }

      const blob = await captureFrameBlob();
      const file = new File([blob], `nvr-cloud-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      setPersonPhoto(file);
      await uploadToGallery(file);
      setPhotoStatus('Photo set for this person and saved to cloud gallery.');
      setCaption('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cloud save failed');
    } finally {
      setUploading(false);
    }
  }

  function clearPhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPhoto(null);
    setPhotoStatus('');
  }

  function requestLocation() {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported');
      return;
    }
    setLocationStatus('Requesting permission…');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        });
        setLocationStatus('Location permission granted');
      },
      () => setLocationStatus('Location permission denied'),
      { enableHighAccuracy: true, timeout: 15000 },
    );
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!coords) {
      setError('Location permission is required before saving.');
      return;
    }
    setLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const created = await api<{ id: string }>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          phone: form.get('phone'),
          address: form.get('address'),
          careOfName: String(form.get('careOfName') || '').trim() || undefined,
          careOfPhone: String(form.get('careOfPhone') || '').trim() || undefined,
          passportNumber: form.get('passportNumber'),
          aadhaarNumber: form.get('aadhaarNumber'),
          latitude: coords.latitude,
          longitude: coords.longitude,
          locationAccuracy: coords.accuracy,
          consentVersion: 'v1',
        }),
      });

      if (photo) {
        const fd = new FormData();
        fd.append('photo', photo);
        await api(`/customers/${created.id}/photo`, {
          method: 'POST',
          body: fd,
        });
      }

      router.push(`/customers/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl text-slate-900">Add person</h1>
      <p className="mt-1 text-sm text-slate-500">
        Identity fields are encrypted on the server. Location is saved only
        after you allow it.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-8 max-w-xl space-y-4 rounded-2xl border border-slate-200 bg-white p-6"
      >
        {(
          [
            ['name', 'Full Name', 'text'],
            ['phone', 'WhatsApp Number', 'tel'],
            'careOf',
            ['address', 'Address', 'text'],
            ['passportNumber', 'Passport Number', 'text'],
            ['aadhaarNumber', 'Aadhaar Number', 'text'],
          ] as const
        ).map((field) =>
          field === 'careOf' ? (
            <div key="careOf" className="block text-sm">
              <span className="text-slate-600">C/O Name &amp; Phone</span>
              <div className="mt-1 grid grid-cols-2 gap-2">
                <input
                  name="careOfName"
                  type="text"
                  placeholder="Name"
                  aria-label="C/O Name"
                  maxLength={120}
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                />
                <input
                  name="careOfPhone"
                  type="tel"
                  placeholder="Phone"
                  aria-label="C/O Phone"
                  maxLength={20}
                  autoComplete="off"
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                />
              </div>
            </div>
          ) : (
            <label key={field[0]} className="block text-sm">
              <span className="text-slate-600">{field[1]}</span>
              <input
                name={field[0]}
                type={field[2]}
                required
                autoComplete="off"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              />
            </label>
          ),
        )}

        <div className="space-y-3 text-sm">
          <label className="block text-sm">
            <span className="text-slate-500">Caption (optional)</span>
            <input
              className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none ring-blue-500 focus:ring-2"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={120}
              placeholder="e.g. Passport scan — Ahmed"
            />
          </label>

          <div
            className={
              cameraOn
                ? 'overflow-hidden rounded-xl border border-slate-200 bg-black'
                : 'contents'
            }
          >
            <video
              ref={videoRef}
              playsInline
              muted
              autoPlay
              className={
                cameraOn ? 'aspect-[4/3] w-full object-cover' : 'hidden'
              }
            />
          </div>

          {previewUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={previewUrl}
              alt="Customer photo preview"
              className="aspect-square max-h-56 w-full rounded-xl object-cover"
            />
          ) : null}

          {pending.length ? (
            <div>
              <p className="text-xs text-slate-500">
                {pending.length} photo{pending.length > 1 ? 's' : ''} ready —
                tap Save Cloud to upload.
              </p>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                {pending.map((p) => (
                  <div key={p.url} className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.url}
                      alt="Selected photo"
                      className="aspect-square w-full rounded-lg object-cover"
                    />
                    <button
                      type="button"
                      disabled={uploading}
                      onClick={() => removePending(p.url)}
                      aria-label="Remove selected photo"
                      className="absolute right-1 top-1 rounded-full bg-black/70 px-2 text-xs text-white hover:bg-black"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void onPickFiles(e.target.files)}
          />

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={cameraBusy || uploading || loading}
              onClick={() => void startCamera()}
              className="rounded-xl bg-blue-600 px-4 py-3.5 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {cameraBusy
                ? 'Opening…'
                : cameraOn
                  ? 'Restart Data Capture'
                  : 'Data Capture'}
            </button>
            <button
              type="button"
              disabled={uploading || loading}
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl bg-indigo-600 px-4 py-3.5 font-medium text-white hover:bg-indigo-500 disabled:opacity-60"
            >
              Upload from device
            </button>
            <button
              type="button"
              disabled={(!cameraOn && !pending.length) || uploading || loading}
              onClick={() => void saveToCloud()}
              className="rounded-xl bg-teal-600 px-4 py-3.5 font-medium text-white hover:bg-teal-500 disabled:opacity-60"
            >
              {uploading ? 'Saving…' : 'Save Cloud'}
            </button>
            <button
              type="button"
              disabled={uploading || cameraBusy || loading}
              onClick={() => {
                const next = facing === 'environment' ? 'user' : 'environment';
                setFacing(next);
                if (cameraOn) void startCamera(next);
              }}
              className="rounded-xl border border-slate-300 px-4 py-3.5 text-slate-700 hover:bg-blue-50 disabled:opacity-60"
            >
              Flip camera
            </button>
          </div>

          {cameraOn ? (
            <button
              type="button"
              onClick={stopCamera}
              className="text-xs text-slate-500 underline hover:text-slate-800"
            >
              Close camera
            </button>
          ) : null}

          {photoStatus ? (
            <p className="text-sm text-teal-700" role="status">
              {photoStatus}
            </p>
          ) : null}

          {photo ? (
            <button
              type="button"
              onClick={clearPhoto}
              className="text-xs text-slate-500 underline hover:text-slate-800"
            >
              Remove photo
            </button>
          ) : null}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm">
          <p className="text-slate-600">{locationStatus}</p>
          {coords ? (
            <p className="mt-1 text-xs text-slate-500">
              {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              {coords.accuracy
                ? ` · ±${coords.accuracy.toFixed(1)}m`
                : ''}
            </p>
          ) : null}
          <button
            type="button"
            onClick={requestLocation}
            className="mt-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs hover:bg-slate-200"
          >
            Request location permission
          </button>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {loading ? 'Saving…' : 'Save'}
        </button>
      </form>
    </AppShell>
  );
}
