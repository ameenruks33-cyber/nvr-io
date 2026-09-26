'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { AuthenticatedImage } from '@/components/AuthenticatedImage';
import { api, money } from '@/lib/api';

type CustomerDetail = {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  address: string;
  passportMasked: string;
  aadhaarMasked: string;
  passportNumber?: string;
  aadhaarNumber?: string;
  photoStorageId?: string | null;
  latitude: number;
  longitude: number;
  locationAccuracy?: number | null;
  createdAt: string;
  loans: Array<{
    id: string;
    principalAmount: string | number;
    amountCollected: string | number;
    remainingAmount: string | number;
    dailyPayment: string | number;
    status: string;
    repayments: Array<{
      id: string;
      amount: string | number;
      collectedAt: string;
      receiptNumber: string;
      notes?: string | null;
    }>;
  }>;
};

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>();
  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [amount, setAmount] = useState('100');
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [waLink, setWaLink] = useState<string | null>(null);

  async function load() {
    const data = await api<CustomerDetail>(`/customers/${params.id}`);
    setCustomer(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [params.id]);

  const amountNum = Number(amount);
  const amountOk =
    Number.isFinite(amountNum) && amountNum >= 100 && amountNum <= 1800;

  async function collect(e: FormEvent) {
    e.preventDefault();
    if (!customer?.loans?.[0]) return;
    setMessage('');
    setError('');
    setWaLink(null);
    try {
      const result = await api<{
        collected: number;
        remaining: number;
        principal: number;
        receiptNumber: string;
        amount: number;
        whatsapp?: {
          sent: boolean;
          deepLink: string | null;
          configured?: boolean;
          error?: string;
        };
      }>(`/loans/${customer.loans[0].id}/repayments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          notes: notes.trim() || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const target = Number(result.principal) || 1800;
      const wa = result.whatsapp;
      let waNote = '';
      if (wa?.sent) {
        waNote = ' WhatsApp receipt sent automatically.';
      } else if (wa?.error) {
        waNote = ` ${wa.error}`;
        if (wa.deepLink) setWaLink(wa.deepLink);
      } else if (wa?.deepLink) {
        waNote = ' WhatsApp auto-send is off — enable it in Settings.';
        setWaLink(wa.deepLink);
      }
      setMessage(
        `Saved ${result.receiptNumber}: paid ${money(result.amount ?? amount)}. Remaining ${money(result.remaining)} of ${money(target)}.${waNote}`,
      );
      setNotes('');
      setAmount('100');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save payment');
    }
  }

  if (!customer) {
    return (
      <AppShell>
        <p className="text-slate-400">{error || 'Loading…'}</p>
      </AppShell>
    );
  }

  const loan = customer.loans?.[0];
  const collected = Number(loan?.amountCollected || 0);
  const principal = Number(loan?.principalAmount || 1800);
  const remaining = Number(loan?.remainingAmount || 0);
  const open = loan?.status === 'ACTIVE';

  return (
    <AppShell>
      <div className="mb-6">
        <p className="text-sm text-slate-400">{customer.customerCode}</p>
        <h1 className="font-display text-3xl text-white">{customer.name}</h1>
        <p className="mt-1 text-slate-300">{customer.phone}</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className="space-y-4">
          <div className="overflow-hidden rounded-2xl border border-white/10 bg-ink-900/70">
            {customer.photoStorageId ? (
              <AuthenticatedImage
                storageKey={customer.photoStorageId}
                alt={`${customer.name} photo`}
                className="aspect-square w-full object-cover"
              />
            ) : (
              <div className="flex aspect-square items-center justify-center text-slate-500">
                No photo
              </div>
            )}
          </div>
          <div className="rounded-2xl border border-white/10 bg-ink-900/70 p-4 text-sm">
            <p className="text-slate-400">Address</p>
            <p className="mt-1">{customer.address}</p>
            <p className="mt-3 text-slate-400">Passport</p>
            <p className="mt-1 font-mono">
              {customer.passportNumber || customer.passportMasked}
            </p>
            <p className="mt-3 text-slate-400">Aadhaar</p>
            <p className="mt-1 font-mono">
              {customer.aadhaarNumber || customer.aadhaarMasked}
            </p>
            <p className="mt-3 text-slate-400">Saved location</p>
            <p className="mt-1">
              {customer.latitude.toFixed(5)}, {customer.longitude.toFixed(5)}
            </p>
            <a
              className="mt-2 inline-block text-teal-300 hover:underline"
              href={`https://maps.google.com/?q=${customer.latitude},${customer.longitude}`}
              target="_blank"
              rel="noreferrer"
            >
              Open map
            </a>
          </div>
        </div>

        <div className="space-y-6">
          {loan ? (
            <div className="rounded-2xl border border-white/10 bg-ink-900/70 p-5">
              <h2 className="font-display text-xl text-white">Payments</h2>
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <div>
                  <p className="text-xs text-slate-400">Target</p>
                  <p className="text-lg">{money(principal)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Collected</p>
                  <p className="text-lg">{money(collected)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400">Remaining</p>
                  <p className="text-lg">{money(remaining)}</p>
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-400">
                Entries:{' '}
                {Math.round(collected / Number(loan.dailyPayment || 100))} /{' '}
                {Math.round(principal / Number(loan.dailyPayment || 100))}
              </p>

              {open ? (
                <form onSubmit={collect} className="mt-5 space-y-3">
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="block text-sm">
                      <span className="text-slate-400">Amount (AED)</span>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        className={`mt-1 w-32 rounded-lg border bg-ink-950 px-3 py-2 ring-2 ${
                          amountOk
                            ? 'border-teal-500/40 ring-teal-500/40'
                            : 'border-red-500/40 ring-red-500/50'
                        }`}
                      />
                    </label>
                    <span
                      className={`mb-2 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs ${
                        amountOk
                          ? 'bg-teal-900/50 text-teal-200'
                          : 'bg-red-900/50 text-red-200'
                      }`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          amountOk ? 'bg-teal-400' : 'bg-red-400'
                        }`}
                      />
                      {amountOk ? '100–1800 AED' : 'Outside 100–1800'}
                    </span>
                    <button
                      type="submit"
                      className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
                    >
                      Save payment
                    </button>
                  </div>
                  <label className="block text-sm">
                    <span className="text-slate-400">Note (optional)</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={2}
                      maxLength={500}
                      placeholder="Add a note if needed…"
                      className="mt-1 w-full rounded-lg border border-white/10 bg-ink-950 px-3 py-2"
                    />
                  </label>
                </form>
              ) : (
                <p className="mt-4 text-sm text-slate-400">Target reached</p>
              )}
              {message ? (
                <p className="mt-3 text-sm text-teal-200">{message}</p>
              ) : null}
              {waLink ? (
                <a
                  href={waLink}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-sm font-medium text-teal-300 underline"
                >
                  Send WhatsApp receipt
                </a>
              ) : null}
              {error ? (
                <p className="mt-3 text-sm text-red-300">{error}</p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-ink-900/70 p-5">
            <h2 className="font-display text-xl text-white">History</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {(loan?.repayments || []).map((r, idx) => {
                const a = Number(r.amount);
                const ok = a >= 100 && a <= 1800;
                return (
                  <li
                    key={r.id}
                    className="border-b border-white/5 py-2 text-sm"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        #{idx + 1} · {r.receiptNumber}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 ${
                          ok ? 'text-teal-200' : 'text-red-200'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            ok ? 'bg-teal-400' : 'bg-red-400'
                          }`}
                        />
                        {money(a)}
                      </span>
                      <span className="text-slate-400">
                        {new Date(r.collectedAt).toLocaleString()}
                      </span>
                    </div>
                    {r.notes?.trim() ? (
                      <p className="mt-1 text-xs text-slate-400">
                        Note: {r.notes}
                      </p>
                    ) : null}
                  </li>
                );
              })}
              {!loan?.repayments?.length ? (
                <li className="text-slate-500">No payments yet</li>
              ) : null}
            </ul>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
