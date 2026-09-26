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
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function load() {
    const data = await api<CustomerDetail>(`/customers/${params.id}`);
    setCustomer(data);
  }

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [params.id]);

  async function collect(e: FormEvent) {
    e.preventDefault();
    if (!customer?.loans?.[0]) return;
    setMessage('');
    setError('');
    try {
      const result = await api<{
        collected: number;
        remaining: number;
        receiptNumber: string;
      }>(`/loans/${customer.loans[0].id}/repayments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      setMessage(
        `Saved ${result.receiptNumber}: ${money(result.collected)} collected`,
      );
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
                <form onSubmit={collect} className="mt-5 flex flex-wrap gap-2">
                  <input
                    type="number"
                    min={1}
                    step={1}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-32 rounded-lg border border-white/10 bg-ink-950 px-3 py-2"
                  />
                  <button
                    type="submit"
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
                  >
                    Save payment
                  </button>
                </form>
              ) : (
                <p className="mt-4 text-sm text-slate-400">Target reached</p>
              )}
              {message ? (
                <p className="mt-3 text-sm text-teal-200">{message}</p>
              ) : null}
              {error ? (
                <p className="mt-3 text-sm text-red-300">{error}</p>
              ) : null}
            </div>
          ) : null}

          <div className="rounded-2xl border border-white/10 bg-ink-900/70 p-5">
            <h2 className="font-display text-xl text-white">History</h2>
            <ul className="mt-4 space-y-2 text-sm">
              {(loan?.repayments || []).map((r, idx) => (
                <li
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-white/5 py-2"
                >
                  <span>
                    #{idx + 1} · {r.receiptNumber}
                  </span>
                  <span>{money(Number(r.amount))}</span>
                  <span className="text-slate-400">
                    {new Date(r.collectedAt).toLocaleString()}
                  </span>
                </li>
              ))}
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
