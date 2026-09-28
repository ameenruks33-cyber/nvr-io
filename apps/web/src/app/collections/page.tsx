'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { api, money } from '@/lib/api';

const MIN_AED = 100;
const MAX_AED = 1800;

type CustomerRow = {
  id: string;
  customerCode: string;
  name: string;
  phone: string;
  loan?: {
    id: string;
    amountCollected: string | number;
    remainingAmount: string | number;
    principalAmount: string | number;
    dailyPayment: string | number;
    status: string;
  };
};

type RecentRow = {
  id: string;
  amount: string | number;
  receiptNumber: string;
  collectedAt: string;
  notes?: string | null;
  collectedBy: { name: string };
  loan: {
    customer: { name: string; customerCode: string };
  };
};

function amountTone(value: number) {
  if (!Number.isFinite(value) || value <= 0) {
    return {
      ok: false,
      ring: 'ring-red-500/60 border-red-500/40',
      badge: 'bg-red-50 text-red-600',
      label: 'Enter an amount',
    };
  }
  if (value >= MIN_AED && value <= MAX_AED) {
    return {
      ok: true,
      ring: 'ring-teal-500/50 border-teal-500/40',
      badge: 'bg-teal-50 text-teal-700',
      label: `Green · ${MIN_AED}–${MAX_AED} AED`,
    };
  }
  return {
    ok: false,
    ring: 'ring-red-500/60 border-red-500/40',
    badge: 'bg-red-50 text-red-600',
    label: `Red · outside ${MIN_AED}–${MAX_AED} AED`,
  };
}

export default function CollectionsPage() {
  const [q, setQ] = useState('');
  const [rows, setRows] = useState<CustomerRow[]>([]);
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [amount, setAmount] = useState('100');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [waLink, setWaLink] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => rows.find((r) => r.id === selectedId) || null,
    [rows, selectedId],
  );

  const amountNum = Number(amount);
  const tone = amountTone(amountNum);

  async function loadCustomers(search = '') {
    try {
      const data = await api<CustomerRow[]>(
        `/customers${search ? `?q=${encodeURIComponent(search)}` : ''}`,
      );
      setRows(data);
      setError('');
      if (selectedId && !data.some((r) => r.id === selectedId)) {
        setSelectedId('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load customers');
    }
  }

  async function loadRecent() {
    try {
      const data = await api<RecentRow[]>('/repayments?limit=30');
      setRecent(data);
    } catch {
      /* optional panel */
    }
  }

  useEffect(() => {
    void loadCustomers();
    void loadRecent();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function onSearch(e: FormEvent) {
    e.preventDefault();
    void loadCustomers(q);
  }

  async function onCollect(e: FormEvent) {
    e.preventDefault();
    if (!selected?.loan?.id) {
      setError('Select a registered customer with an open record');
      return;
    }
    if (selected.loan.status !== 'ACTIVE') {
      setError('This customer’s target is already complete');
      return;
    }
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      setError('Enter a valid collection amount');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');
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
      }>(`/loans/${selected.loan.id}/repayments`, {
        method: 'POST',
        body: JSON.stringify({
          amount: amountNum,
          notes: notes.trim() || undefined,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const target = Number(result.principal) || MAX_AED;
      const wa = result.whatsapp;
      let waNote = '';
      if (wa?.sent) {
        waNote = ' Receipt sent to customer WhatsApp.';
      } else if (wa?.deepLink) {
        setWaLink(wa.deepLink);
        const waWindow = window.open(wa.deepLink, '_blank');
        if (waWindow) {
          waWindow.opener = null;
          waNote = ' WhatsApp opened — tap Send to deliver the receipt.';
        } else {
          waNote = ' Tap "Send WhatsApp receipt" below to deliver it.';
        }
      } else if (wa?.error) {
        waNote = ` ${wa.error}`;
      }
      setMessage(
        `Collected ${money(result.amount || amountNum)}. Remaining balance ${money(result.remaining)} of ${money(target)}.${waNote}`,
      );
      setAmount('100');
      setNotes('');
      await Promise.all([loadCustomers(q), loadRecent()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Collection failed');
    } finally {
      setSaving(false);
    }
  }

  const collected = Number(selected?.loan?.amountCollected || 0);
  const principal = Number(selected?.loan?.principalAmount || MAX_AED);
  const remaining = Number(
    selected?.loan?.remainingAmount ?? Math.max(principal - collected, 0),
  );
  const open = selected?.loan?.status === 'ACTIVE';

  return (
    <AppShell>
      <header className="mb-6">
        <h1 className="font-display text-3xl text-slate-900">Collection</h1>
        <p className="mt-1 max-w-xl text-sm text-slate-500">
          Collect from registered customers. Target is {money(MAX_AED)} — after
          each collection the remaining balance updates (e.g. collect{' '}
          {money(MIN_AED)} → remaining {money(MAX_AED - MIN_AED)}).
        </p>
      </header>

      <form onSubmit={onSearch} className="mb-4 flex gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search registered customers…"
          className="w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2"
        />
        <button
          type="submit"
          className="rounded-lg border border-slate-200 px-4 py-2 text-sm hover:bg-blue-50"
        >
          Search
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white text-slate-500">
              <tr>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">WhatsApp</th>
                <th className="px-4 py-3 font-medium">Collected</th>
                <th className="px-4 py-3 font-medium">Remaining</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const rowCollected = Number(row.loan?.amountCollected || 0);
                const rowPrincipal = Number(
                  row.loan?.principalAmount || MAX_AED,
                );
                const rowRemaining = Number(
                  row.loan?.remainingAmount ??
                    Math.max(rowPrincipal - rowCollected, 0),
                );
                const active = row.id === selectedId;
                return (
                  <tr
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={`cursor-pointer border-t border-slate-100 ${
                      active
                        ? 'bg-blue-100'
                        : 'hover:bg-white/[0.03]'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{row.name}</p>
                      <p className="text-xs text-slate-500">
                        {row.customerCode}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-slate-600">{row.phone}</td>
                    <td className="px-4 py-3">
                      {money(rowCollected)} / {money(rowPrincipal)}
                    </td>
                    <td className="px-4 py-3 font-medium text-amber-700">
                      {money(rowRemaining)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-md px-2 py-0.5 text-xs ${
                          row.loan?.status === 'ACTIVE'
                            ? 'bg-teal-50 text-teal-700'
                            : 'bg-slate-200 text-slate-500'
                        }`}
                      >
                        {row.loan?.status || '—'}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!rows.length ? (
            <p className="p-6 text-center text-sm text-slate-500">
              No registered customers.{' '}
              <Link href="/customers/new" className="text-teal-700 underline">
                Add a person
              </Link>
            </p>
          ) : null}
        </div>

        <aside className="space-y-4 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-lg font-medium text-slate-900">Record collection</h2>
          {selected ? (
            <>
              <div>
                <p className="text-sm text-slate-900">{selected.name}</p>
                <p className="text-xs text-slate-500">
                  {selected.customerCode} · {selected.phone}
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-center">
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      Target
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-slate-900">
                      {money(principal)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      Collected
                    </p>
                    <p className="mt-0.5 text-sm font-medium text-teal-700">
                      {money(collected)}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">
                      Remaining
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-amber-700">
                      {money(remaining)}
                    </p>
                  </div>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-teal-500 transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        principal > 0 ? (collected / principal) * 100 : 0,
                      )}%`,
                    }}
                  />
                </div>
                <Link
                  href={`/customers/${selected.id}`}
                  className="mt-2 inline-block text-xs text-teal-700 underline"
                >
                  Open customer
                </Link>
              </div>

              {open ? (
                <form onSubmit={onCollect} className="space-y-3">
                  <label className="block text-sm">
                    <span className="text-slate-600">Amount (AED)</span>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      className={`mt-1 w-full rounded-lg border bg-slate-50 px-3 py-3 outline-none ring-2 ${tone.ring}`}
                      required
                    />
                    <span
                      className={`mt-2 inline-flex items-center gap-2 rounded-md px-2 py-1 text-xs ${tone.badge}`}
                    >
                      <span
                        className={`h-2 w-2 rounded-full ${
                          tone.ok ? 'bg-teal-400' : 'bg-red-400'
                        }`}
                        aria-hidden
                      />
                      {tone.label}
                    </span>
                  </label>

                  <label className="block text-sm">
                    <span className="text-slate-600">Note (optional)</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      maxLength={500}
                      placeholder="Add a note if you need to remember something…"
                      className="mt-1 w-full resize-y rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 outline-none ring-blue-500 focus:ring-2"
                    />
                  </label>

                  <button
                    type="submit"
                    disabled={saving}
                    className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
                  >
                    {saving ? 'Saving…' : 'Save collection'}
                  </button>
                </form>
              ) : (
                <p className="text-sm text-slate-500">
                  Target reached — no more collections for this customer.
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-slate-500">
              Select a registered customer from the list.
            </p>
          )}

          {message ? (
            <p className="text-sm text-teal-700" role="status">
              {message}
            </p>
          ) : null}
          {waLink ? (
            <a
              href={waLink}
              target="_blank"
              rel="noreferrer"
              className="inline-flex text-sm font-medium text-teal-700 underline"
            >
              Send WhatsApp receipt
            </a>
          ) : null}
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
        </aside>
      </div>

      <section className="mt-8">
        <h2 className="mb-3 text-lg font-medium text-slate-900">
          Recent collections
        </h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-white text-slate-500">
              <tr>
                <th className="px-4 py-3">Receipt</th>
                <th className="px-4 py-3">Customer</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Note</th>
                <th className="px-4 py-3">When</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((row) => {
                const a = Number(row.amount);
                const ok = a >= MIN_AED && a <= MAX_AED;
                return (
                  <tr key={row.id} className="border-t border-slate-100">
                    <td className="px-4 py-3 font-mono text-xs">
                      {row.receiptNumber}
                    </td>
                    <td className="px-4 py-3">
                      {row.loan.customer.customerCode} ·{' '}
                      {row.loan.customer.name}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1.5 ${
                          ok ? 'text-teal-700' : 'text-red-600'
                        }`}
                      >
                        <span
                          className={`h-2 w-2 rounded-full ${
                            ok ? 'bg-teal-400' : 'bg-red-400'
                          }`}
                          aria-hidden
                        />
                        {money(a)}
                      </span>
                    </td>
                    <td className="max-w-[220px] truncate px-4 py-3 text-slate-500">
                      {row.notes?.trim() || '—'}
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {new Date(row.collectedAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!recent.length ? (
            <p className="p-5 text-center text-sm text-slate-500">
              No collections yet.
            </p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
