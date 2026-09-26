'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api } from '@/lib/api';

export default function NewCustomerPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [locationStatus, setLocationStatus] = useState('Location not requested');
  const [coords, setCoords] = useState<{
    latitude: number;
    longitude: number;
    accuracy?: number;
  } | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);

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

        <label className="block text-sm">
          <span className="text-slate-300">Customer photo</span>
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="mt-1 block w-full text-slate-300"
            onChange={(e) => setPhoto(e.target.files?.[0] || null)}
          />
          <span className="mt-1 block text-xs text-slate-500">
            Uploaded to private server storage — not the device gallery.
          </span>
        </label>

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
