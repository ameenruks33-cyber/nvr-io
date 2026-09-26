'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function NewCustomerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
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
            'Camera is not available. Open NVR.io in Chrome or Safari.',
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

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  async function capturePersonPhoto() {
    const video = videoRef.current;
    if (!video || !cameraOn) {
      setError('Open the camera first.');
      return;
    }
    setError('');
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

      const file = new File([blob], `person-${Date.now()}.jpg`, {
        type: 'image/jpeg',
      });
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(URL.createObjectURL(blob));
      setPhoto(file);
      stopCamera();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not capture photo');
    }
  }

  function clearPhoto() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setPhoto(null);
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
      <h1 className="font-display text-3xl text-white">Add person</h1>
      <p className="mt-1 text-sm text-slate-400">
        Identity fields are encrypted on the server. Location is saved only
        after you allow it.
      </p>

      <form
        onSubmit={onSubmit}
        className="mt-8 max-w-xl space-y-4 rounded-2xl border border-white/10 bg-ink-900/70 p-6"
      >
        {(
          [
            ['name', 'Full name', 'text'],
            ['phone', 'Phone number', 'tel'],
            ['address', 'Address', 'text'],
            ['passportNumber', 'Passport number', 'text'],
            ['aadhaarNumber', 'Aadhaar number', 'text'],
          ] as const
        ).map(([name, label, type]) => (
          <label key={name} className="block text-sm">
            <span className="text-slate-300">{label}</span>
            <input
              name={name}
              type={type}
              required
              autoComplete="off"
              className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2"
            />
          </label>
        ))}

        <div className="flex gap-2 text-sm">
          <a
            id="call-link"
            className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              const phone = (
                document.querySelector(
                  'input[name="phone"]',
                ) as HTMLInputElement
              )?.value;
              if (phone) window.location.href = `tel:${phone}`;
            }}
          >
            Call
          </a>
          <a
            className="rounded-lg border border-white/10 px-3 py-2 hover:bg-white/5"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              const phone = (
                document.querySelector(
                  'input[name="phone"]',
                ) as HTMLInputElement
              )?.value;
              if (phone)
                window.open(
                  `https://wa.me/${phone.replace(/[^\d]/g, '')}`,
                  '_blank',
                );
            }}
          >
            WhatsApp
          </a>
        </div>

        <div className="space-y-3 text-sm">
          <span className="text-slate-300">Customer photo</span>
          <p className="text-xs text-slate-500">
            Use the in-app camera. Saved to private server storage — not the
            device gallery, and not the cloud gallery.
          </p>

          <div
            className={
              cameraOn
                ? 'overflow-hidden rounded-xl border border-white/10 bg-black'
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

          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              disabled={cameraBusy || loading}
              onClick={() => void startCamera()}
              className="rounded-xl bg-blue-600 px-4 py-3.5 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
            >
              {cameraBusy
                ? 'Opening camera…'
                : cameraOn
                  ? 'Restart camera'
                  : 'Open camera'}
            </button>
            <button
              type="button"
              disabled={loading || cameraBusy}
              onClick={() => {
                const next = facing === 'environment' ? 'user' : 'environment';
                setFacing(next);
                if (cameraOn) void startCamera(next);
              }}
              className="rounded-xl border border-white/15 px-4 py-3.5 text-slate-200 hover:bg-white/5 disabled:opacity-60"
            >
              Flip camera
            </button>
          </div>

          {cameraOn ? (
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => void capturePersonPhoto()}
                className="rounded-xl bg-teal-700/90 px-4 py-3 font-medium text-white hover:bg-teal-600"
              >
                Take photo
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="text-xs text-slate-500 underline hover:text-slate-300"
              >
                Close camera
              </button>
            </div>
          ) : null}

          {photo ? (
            <button
              type="button"
              onClick={clearPhoto}
              className="text-xs text-slate-500 underline hover:text-slate-300"
            >
              Remove photo
            </button>
          ) : null}
        </div>

        <div className="rounded-lg border border-white/10 bg-ink-950 p-3 text-sm">
          <p className="text-slate-300">{locationStatus}</p>
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
            className="mt-2 rounded-lg bg-white/10 px-3 py-1.5 text-xs hover:bg-white/15"
          >
            Request location permission
          </button>
        </div>

        {error ? <p className="text-sm text-red-300">{error}</p> : null}

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
