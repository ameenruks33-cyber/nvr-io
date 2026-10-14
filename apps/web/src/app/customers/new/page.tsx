'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { api, GALLERY_UNLOCK_KEY, money } from '@/lib/api';
import { LOAN_PLAN_IDS, LOAN_PLANS, type LoanPlanId } from '@/lib/loan-plans';
import { shrinkImage } from '@/lib/image';

type PendingPhoto = { file: File; url: string };

export default function NewCustomerPage() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<PendingPhoto[]>([]);
  const pendingRef = useRef<PendingPhoto[]>([]);
  pendingRef.current = pending;
  const streamRef = useRef<MediaStream | null>(null);
  const coordsRef = useRef<typeof coords>(null);
  const locatingRef = useRef(false);
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
  const [tab, setTab] = useState<'details' | 'cash'>('details');
  const [savedCustomer, setSavedCustomer] = useState<{
    id: string;
    name: string;
    loanId?: string;
  } | null>(null);
  const [cashAmount, setCashAmount] = useState('');
  const [cashSpentOn, setCashSpentOn] = useState('');
  const [cashNote, setCashNote] = useState('');
  const [cashSaving, setCashSaving] = useState(false);
  const [cashMessage, setCashMessage] = useState('');
  const [galleryPinSet, setGalleryPinSet] = useState(false);
  const [galleryUnlocked, setGalleryUnlocked] = useState(false);
  const [galleryPin, setGalleryPin] = useState('');
  const [galleryUnlockMsg, setGalleryUnlockMsg] = useState('');
  const [galleryUnlocking, setGalleryUnlocking] = useState(false);
  const [planId, setPlanId] = useState<LoanPlanId>('AED_2000');
  const [dailyPayment, setDailyPayment] = useState('100');

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

  useEffect(() => {
    api<{ today: string }>('/petty-cash')
      .then((s) => setCashSpentOn((prev) => prev || s.today))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    api<{ pinSet: boolean }>('/gallery/pin-status')
      .then(({ pinSet }) => {
        setGalleryPinSet(pinSet);
        const ok =
          !pinSet || Boolean(sessionStorage.getItem(GALLERY_UNLOCK_KEY));
        setGalleryUnlocked(ok);
      })
      .catch(() => setGalleryUnlocked(true));
  }, []);

  useEffect(() => {
    void requestLocation();
    const retry = setInterval(() => {
      if (!coordsRef.current) void requestLocation({ quiet: true });
    }, 25_000);
    return () => clearInterval(retry);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount + background retry
  }, []);

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
    if (galleryPinSet && !sessionStorage.getItem(GALLERY_UNLOCK_KEY)) {
      setError('Cloud gallery is locked — enter the gallery PIN below, then tap Save Cloud.');
      return;
    }
    setUploading(true);
    setError('');
    setPhotoStatus('');
    try {
      if (pending.length) {
        const failed: PendingPhoto[] = [];
        let saved = 0;
        let lastUploadError = '';
        for (const p of pending) {
          try {
            await uploadToGallery(p.file);
            saved += 1;
          } catch (e) {
            failed.push(p);
            lastUploadError =
              e instanceof Error ? e.message : 'Upload failed';
          }
        }
        const firstOk = pending.find((p) => !failed.includes(p));
        if (saved && firstOk) setPersonPhoto(firstOk.file);
        pending.filter((p) => !failed.includes(p)).forEach((p) => URL.revokeObjectURL(p.url));
        setPending(failed);
        if (failed.length) {
          setError(
            `${failed.length} photo(s) failed to upload${lastUploadError ? `: ${lastUploadError}` : ''}. Tap Save Cloud to retry.`,
          );
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

  function locationHint(code: number) {
    if (code === 1) {
      return 'Location permission denied. On your phone: Settings → Apps → your browser or CrickHerose → Permissions → Location → Allow, then tap Try location again.';
    }
    if (code === 2) {
      return 'Location unavailable — turn on Location and mobile data, then tap Try location again.';
    }
    if (code === 3) {
      return 'GPS is slow indoors — we keep trying in the background. Tap Try location again or wait a moment near a window.';
    }
    return 'Could not get location — tap Try location again.';
  }

  function applyLocation(pos: GeolocationPosition) {
    const next = {
      latitude: pos.coords.latitude,
      longitude: pos.coords.longitude,
      accuracy: pos.coords.accuracy,
    };
    coordsRef.current = next;
    setCoords(next);
    const acc = pos.coords.accuracy;
    setLocationStatus(
      Number.isFinite(acc) && acc > 400
        ? `Location ready (approximate ±${Math.round(acc)} m)`
        : 'Location ready',
    );
  }

  function getPosition(options: PositionOptions) {
    return new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, options);
    });
  }

  function watchOnce(options: PositionOptions, maxMs: number) {
    return new Promise<GeolocationPosition | null>((resolve) => {
      let settled = false;
      let watchId: number | undefined;
      const finish = (pos: GeolocationPosition | null) => {
        if (settled) return;
        settled = true;
        if (watchId !== undefined) navigator.geolocation.clearWatch(watchId);
        clearTimeout(timer);
        resolve(pos);
      };
      watchId = navigator.geolocation.watchPosition(
        (pos) => finish(pos),
        () => finish(null),
        options,
      );
      const timer = setTimeout(() => finish(null), maxMs);
    });
  }

  async function requestLocation(opts?: { quiet?: boolean }) {
    if (!navigator.geolocation) {
      setLocationStatus('Geolocation not supported on this device');
      return;
    }
    if (locatingRef.current) return;
    locatingRef.current = true;
    if (!opts?.quiet) {
      setLocationStatus('Getting location…');
    }

    const attempts: PositionOptions[] = [
      { enableHighAccuracy: false, timeout: 12_000, maximumAge: 86_400_000 },
      { enableHighAccuracy: false, timeout: 30_000, maximumAge: 3_600_000 },
      { enableHighAccuracy: true, timeout: 45_000, maximumAge: 300_000 },
    ];

    try {
      for (const options of attempts) {
        try {
          applyLocation(await getPosition(options));
          return;
        } catch {
          // try next strategy
        }
      }

      const watched = await watchOnce(
        { enableHighAccuracy: false, maximumAge: 86_400_000 },
        22_000,
      );
      if (watched) {
        applyLocation(watched);
        return;
      }

      if (!coordsRef.current && !opts?.quiet) {
        setLocationStatus(locationHint(3));
      }
    } finally {
      locatingRef.current = false;
    }
  }

  async function unlockCloudGallery() {
    setGalleryUnlockMsg('');
    setGalleryUnlocking(true);
    try {
      const res = await api<{ unlockToken: string }>('/gallery/unlock', {
        method: 'POST',
        body: JSON.stringify({ pin: galleryPin }),
      });
      sessionStorage.setItem(GALLERY_UNLOCK_KEY, res.unlockToken);
      setGalleryUnlocked(true);
      setGalleryPin('');
      setGalleryUnlockMsg('Cloud gallery unlocked — tap Save Cloud again.');
      setError('');
    } catch (e) {
      setGalleryUnlockMsg(
        e instanceof Error ? e.message : 'Could not unlock gallery',
      );
    } finally {
      setGalleryUnlocking(false);
    }
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (savedCustomer) {
      router.push(`/customers/${savedCustomer.id}`);
      return;
    }
    if (!coords) {
      setError('Location permission is required before saving.');
      return;
    }
    setLoading(true);
    setError('');
    const form = new FormData(e.currentTarget);
    try {
      const created = await api<{
        id: string;
        loan?: { id: string };
      }>('/customers', {
        method: 'POST',
        body: JSON.stringify({
          name: form.get('name'),
          phone: form.get('phone'),
          botimNumber: String(form.get('botimNumber') || '').trim() || undefined,
          mobileNumber: String(form.get('mobileNumber') || '').trim() || undefined,
          address: form.get('address'),
          careOfName: String(form.get('careOfName') || '').trim() || undefined,
          careOfPhone: String(form.get('careOfPhone') || '').trim() || undefined,
          passportNumber: form.get('passportNumber'),
          aadhaarNumber: form.get('aadhaarNumber'),
          latitude: coords.latitude,
          longitude: coords.longitude,
          locationAccuracy: coords.accuracy,
          consentVersion: 'v1',
          planId,
          principalAmount: LOAN_PLANS[planId].principal,
          totalPayable: LOAN_PLANS[planId].totalPayable,
          dailyPayment:
            Number(dailyPayment) || LOAN_PLANS[planId].defaultDaily,
        }),
      });

      const personName = String(form.get('name') || '').trim();
      setSavedCustomer({
        id: created.id,
        name: personName,
        loanId: created.loan?.id,
      });
      setCashAmount(String(LOAN_PLANS[planId].principal));
      setTab('cash');
      setCashMessage('');
      setError('');

      if (photo) {
        try {
          const fd = new FormData();
          fd.append('photo', photo);
          await api(`/customers/${created.id}/photo`, {
            method: 'POST',
            body: fd,
          });
          setPhotoStatus('Photo saved.');
        } catch (photoErr) {
          setPhotoStatus(
            photoErr instanceof Error
              ? `Person saved. Photo failed: ${photoErr.message}`
              : 'Person saved. Photo failed — retry from their profile.',
          );
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setLoading(false);
    }
  }

  async function selectPlan(id: LoanPlanId) {
    setPlanId(id);
    setDailyPayment(String(LOAN_PLANS[id].defaultDaily));
    setCashAmount(String(LOAN_PLANS[id].principal));
    if (!savedCustomer?.loanId) return;
    try {
      await api(`/loans/${savedCustomer.loanId}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({
          planId: id,
          dailyPayment: LOAN_PLANS[id].defaultDaily,
        }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update plan');
    }
  }

  async function syncDailyPayment(value: string) {
    setDailyPayment(value);
    if (!savedCustomer?.loanId) return;
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    try {
      await api(`/loans/${savedCustomer.loanId}/plan`, {
        method: 'PATCH',
        body: JSON.stringify({ planId, dailyPayment: n }),
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Could not update daily amount',
      );
    }
  }

  async function recordCustomerCash() {
    if (!savedCustomer) {
      setError('Save the person on the Details tab first.');
      setTab('details');
      return;
    }
    const value = Number(cashAmount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter a valid cash amount');
      return;
    }
    if (!cashSpentOn) {
      setError('Choose the date cash was given');
      return;
    }
    setCashSaving(true);
    setError('');
    setCashMessage('');
    try {
      await api('/petty-cash', {
        method: 'POST',
        body: JSON.stringify({
          amount: Math.round(value * 100) / 100,
          spentOn: cashSpentOn,
          customerId: savedCustomer.id,
          ...(cashNote.trim() ? { purpose: cashNote.trim() } : {}),
        }),
      });
      setCashMessage(
        `Recorded ${money(value)} cash to ${savedCustomer.name}. It appears under Pay customer (cash) on Petty Cash.`,
      );
      setCashAmount('');
      setCashNote('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not record cash');
    } finally {
      setCashSaving(false);
    }
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl text-slate-900">Add person</h1>
      <p className="mt-1 text-sm text-slate-500">
        Identity fields are encrypted on the server. Location is saved only
        after you allow it.
      </p>

      <div className="mt-8 max-w-xl rounded-2xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex gap-2 border-b border-slate-100 pb-3">
          <button
            type="button"
            onClick={() => setTab('details')}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === 'details'
                ? 'bg-blue-50 text-blue-900 ring-1 ring-blue-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Details
          </button>
          <button
            type="button"
            onClick={() => setTab('cash')}
            className={`rounded-lg px-3 py-2 text-sm font-medium ${
              tab === 'cash'
                ? 'bg-violet-50 text-violet-900 ring-1 ring-violet-200'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            Cash
          </button>
        </div>

        {tab === 'cash' ? (
          <div className="space-y-4">
            <fieldset className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <legend className="px-1 text-sm font-medium text-slate-900">
                Plan
              </legend>
              <div className="flex flex-wrap gap-2">
                {LOAN_PLAN_IDS.map((id) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => void selectPlan(id)}
                    className={`rounded-lg border px-3 py-2 text-sm ${
                      planId === id
                        ? 'border-blue-600 bg-blue-50 font-medium text-blue-900'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    {LOAN_PLANS[id].label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-slate-600">
                Customer receives {money(LOAN_PLANS[planId].principal)}. Account
                closes when collections reach{' '}
                {money(LOAN_PLANS[planId].totalPayable)}.
              </p>
              <label className="block text-sm">
                <span className="text-slate-600">Daily collection amount (AED)</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={dailyPayment}
                  onChange={(e) => void syncDailyPayment(e.target.value)}
                  className="mt-1 w-full max-w-xs rounded-lg border border-slate-200 bg-white px-3 py-2"
                />
              </label>
            </fieldset>
            {savedCustomer ? (
              <p className="text-sm font-medium text-slate-900">
                {savedCustomer.name}
              </p>
            ) : null}
            <label className="block text-sm">
              <span className="text-slate-600">Cash amount (AED)</span>
              <input
                type="number"
                inputMode="decimal"
                min={1}
                step="0.01"
                value={cashAmount}
                onChange={(e) => setCashAmount(e.target.value)}
                disabled={!savedCustomer || cashSaving}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
                placeholder="e.g. 500"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Date given</span>
              <input
                type="date"
                value={cashSpentOn}
                onChange={(e) => setCashSpentOn(e.target.value)}
                disabled={!savedCustomer || cashSaving}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
              />
            </label>
            <label className="block text-sm">
              <span className="text-slate-600">Note (optional)</span>
              <input
                value={cashNote}
                onChange={(e) => setCashNote(e.target.value)}
                maxLength={200}
                disabled={!savedCustomer || cashSaving}
                placeholder="e.g. Advance, refund"
                className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3"
              />
            </label>
            {cashMessage ? (
              <p className="text-sm text-teal-700" role="status">
                {cashMessage}
              </p>
            ) : null}
            <button
              type="button"
              disabled={!savedCustomer || cashSaving}
              onClick={() => void recordCustomerCash()}
              className="w-full rounded-lg bg-violet-600 px-4 py-3 font-medium text-white hover:bg-violet-500 disabled:opacity-60"
            >
              {cashSaving ? 'Saving…' : 'Record cash to customer'}
            </button>
            {savedCustomer ? (
              <div className="flex flex-wrap gap-3 text-sm">
                <Link
                  href="/petty-cash"
                  className="text-violet-700 underline hover:text-violet-900"
                >
                  Open Petty Cash
                </Link>
                <button
                  type="button"
                  onClick={() => router.push(`/customers/${savedCustomer.id}`)}
                  className="text-teal-700 underline hover:text-teal-900"
                >
                  Open customer profile
                </button>
              </div>
            ) : null}
          </div>
        ) : null}

        {tab === 'details' ? (
      <form onSubmit={onSubmit} className="space-y-4">
        {savedCustomer ? (
          <p className="rounded-lg bg-teal-50 px-3 py-2 text-sm text-teal-800">
            Person saved. Use the <strong>Cash</strong> tab for plan and wallet
            payout, or update details below.
          </p>
        ) : null}
        {(
          [
            ['name', 'Full Name', 'text'],
            ['address', 'Address', 'text'],
            ['passportNumber', 'Passport Number', 'text'],
            ['aadhaarNumber', 'Aadhaar Number', 'text'],
            'contact',
            'careOf',
          ] as const
        ).map((field) =>
          field === 'contact' ? (
            <div key="contact" className="block text-sm">
              <span className="text-slate-600">WhatsApp / Botim / Phone</span>
              <div className="mt-1 grid grid-cols-3 gap-2">
                <input
                  name="phone"
                  type="tel"
                  placeholder="WhatsApp"
                  aria-label="WhatsApp Number"
                  required
                  maxLength={20}
                  autoComplete="off"
                  className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                />
                <input
                  name="botimNumber"
                  type="tel"
                  placeholder="Botim"
                  aria-label="Botim Number"
                  maxLength={20}
                  autoComplete="off"
                  className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                />
                <input
                  name="mobileNumber"
                  type="tel"
                  placeholder="Phone"
                  aria-label="Phone Number"
                  maxLength={20}
                  autoComplete="off"
                  className="w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
                />
              </div>
            </div>
          ) : field === 'careOf' ? (
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

          {galleryPinSet && !galleryUnlocked ? (
            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 text-sm">
              <p className="font-medium text-indigo-950">Cloud gallery PIN</p>
              <p className="mt-1 text-xs text-indigo-900/80">
                Save Cloud needs the same PIN as the File gallery on this device.
              </p>
              <div className="mt-2 flex gap-2">
                <input
                  type="password"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={galleryPin}
                  onChange={(e) => setGalleryPin(e.target.value.replace(/\D/g, ''))}
                  maxLength={8}
                  placeholder="Gallery PIN"
                  className="min-w-0 flex-1 rounded-lg border border-indigo-200 bg-white px-3 py-2"
                />
                <button
                  type="button"
                  disabled={galleryUnlocking || galleryPin.length < 4}
                  onClick={() => void unlockCloudGallery()}
                  className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-white hover:bg-indigo-500 disabled:opacity-60"
                >
                  {galleryUnlocking ? '…' : 'Unlock'}
                </button>
              </div>
              {galleryUnlockMsg ? (
                <p className="mt-2 text-xs text-indigo-900">{galleryUnlockMsg}</p>
              ) : null}
            </div>
          ) : null}

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
              disabled={
                (!cameraOn && !pending.length) ||
                uploading ||
                loading ||
                (galleryPinSet && !galleryUnlocked)
              }
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

        <div
          className={`rounded-lg border p-3 text-sm ${
            coords
              ? 'border-teal-200 bg-teal-50'
              : locationStatus.toLowerCase().includes('denied') ||
                  locationStatus.toLowerCase().includes('unavailable')
                ? 'border-amber-300 bg-amber-50'
                : locationStatus.toLowerCase().includes('slow') ||
                    locationStatus.toLowerCase().includes('getting')
                  ? 'border-slate-200 bg-slate-50'
                  : 'border-amber-300 bg-amber-50'
          }`}
        >
          <p
            className={
              coords
                ? 'text-teal-800'
                : locationStatus.toLowerCase().includes('denied')
                  ? 'text-amber-900'
                  : 'text-slate-600'
            }
          >
            {locationStatus}
          </p>
          {coords ? (
            <p className="mt-1 text-xs text-teal-700/80">
              {coords.latitude.toFixed(5)}, {coords.longitude.toFixed(5)}
              {coords.accuracy
                ? ` · ±${coords.accuracy.toFixed(1)}m`
                : ''}
            </p>
          ) : null}
          <button
            type="button"
            onClick={() => void requestLocation()}
            className="mt-2 rounded-lg bg-white px-3 py-2 text-xs font-medium text-slate-800 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Try location again
          </button>
        </div>

        <button
          type="submit"
          disabled={loading || !coords}
          className="w-full rounded-lg bg-accent px-4 py-2.5 font-medium text-white disabled:opacity-60"
        >
          {loading
            ? 'Saving…'
            : savedCustomer
              ? 'Open customer profile'
              : 'Save'}
        </button>
      </form>
        ) : null}

        {error ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </AppShell>
  );
}
