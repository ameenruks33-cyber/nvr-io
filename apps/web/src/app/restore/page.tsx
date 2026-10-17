'use client';

import { FormEvent, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { AdminOnly } from '@/components/AdminOnly';
import { api, money } from '@/lib/api';
import { notifyDataChanged } from '@/lib/live-sync';
import { formatUaeDateTime, uaeToday } from '@/lib/uae-datetime';

type Preview = {
  at: string;
  date: string;
  time: string;
  repayments: Array<{
    id: string;
    at: string;
    amount: number;
    receiptNumber: string;
    person: string;
  }>;
  expenses: Array<{
    id: string;
    at: string;
    amount: number;
    purpose: string;
    person: string;
  }>;
  renewals: Array<{
    id: string;
    at: string;
    cycle: number;
    person: string;
  }>;
  newPeople: Array<{
    id: string;
    at: string;
    person: string;
  }>;
  totals: {
    repayments: number;
    expenses: number;
    renewals: number;
    newPeople: number;
  };
};

function nowUaeTime() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Dubai',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const h = parts.find((p) => p.type === 'hour')?.value || '00';
  const m = parts.find((p) => p.type === 'minute')?.value || '00';
  return `${h}:${m}`;
}

export default function RestorePage() {
  const [date, setDate] = useState(uaeToday());
  const [time, setTime] = useState(nowUaeTime);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  async function loadPreview(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await api<Preview>(
        `/restore/preview?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}`,
      );
      setPreview(data);
    } catch (err) {
      setPreview(null);
      setError(err instanceof Error ? err.message : 'Could not load preview');
    } finally {
      setLoading(false);
    }
  }

  async function restore() {
    if (!preview) return;
    const total =
      preview.totals.repayments +
      preview.totals.expenses +
      preview.totals.renewals +
      (preview.totals.newPeople || 0);
    if (
      !window.confirm(
        `Restore to ${date} ${time} UAE? This undoes ${total} change(s) after that exact time. It cannot be undone automatically.`,
      )
    ) {
      return;
    }
    setRestoring(true);
    setError('');
    setMessage('');
    try {
      const result = await api<{
        repaymentsRemoved: number;
        expensesRemoved: number;
        peopleRemoved?: number;
        accountsReconciled: number;
      }>('/restore/to', {
        method: 'POST',
        body: JSON.stringify({ date, time }),
      });
      notifyDataChanged();
      setMessage(
        `Restored customer accounts to ${date} ${time} UAE. Removed ${result.peopleRemoved ?? 0} person(s), ${result.repaymentsRemoved} collection(s), and ${result.expensesRemoved} account petty-cash payout(s). Reconciled ${result.accountsReconciled} account(s). Staff, settings, and app updates were not changed.`,
      );
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore');
    } finally {
      setRestoring(false);
    }
  }

  const total = preview
    ? preview.totals.repayments +
      preview.totals.expenses +
      preview.totals.renewals +
      (preview.totals.newPeople || 0)
    : 0;

  return (
    <AppShell>
      <AdminOnly>
        <h1 className="font-display text-3xl text-slate-900">Undo / Restore</h1>
        <p className="mt-1 max-w-2xl text-sm text-slate-500">
          Choose the exact UAE date and time. Customer account data recorded
          after that moment — people added, collections, account petty-cash
          payouts, and plan renewals — is listed, then removed, and each
          remaining account is reconciled. Staff logins, gallery PIN, WhatsApp,
          and app updates are not changed.
        </p>

        <form
          onSubmit={(e) => void loadPreview(e)}
          className="mt-6 flex max-w-xl flex-wrap items-end gap-3 rounded-2xl border border-slate-200 bg-white p-4"
        >
          <label className="block text-sm">
            <span className="text-slate-600">Date (UAE)</span>
            <input
              type="date"
              value={date}
              max={uaeToday()}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Time (UAE)</span>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2"
              required
            />
          </label>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
          >
            {loading ? 'Checking…' : 'Preview'}
          </button>
        </form>

        {error ? (
          <p className="mt-4 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="mt-4 text-sm text-teal-800" role="status">
            {message}
          </p>
        ) : null}

        {preview ? (
          <section className="mt-6 max-w-3xl space-y-4">
            <p className="text-sm text-slate-600">
              After {formatUaeDateTime(preview.at)}:{' '}
              {preview.totals.newPeople || 0} new person(s),{' '}
              {preview.totals.repayments} collection(s),{' '}
              {preview.totals.expenses} account petty-cash payout(s),{' '}
              {preview.totals.renewals} renewal(s).
            </p>

            {preview.newPeople?.length ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="font-medium text-slate-900">People added</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {preview.newPeople.map((c) => (
                    <li key={c.id} className="flex flex-wrap justify-between gap-2">
                      <span>{c.person}</span>
                      <span>{formatUaeDateTime(c.at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.repayments.length ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="font-medium text-slate-900">Collections</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {preview.repayments.map((r) => (
                    <li key={r.id} className="flex flex-wrap justify-between gap-2">
                      <span>
                        {r.person} · {r.receiptNumber}
                      </span>
                      <span>
                        {money(r.amount)} · {formatUaeDateTime(r.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.expenses.length ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="font-medium text-slate-900">Petty cash payouts</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {preview.expenses.map((e) => (
                    <li key={e.id} className="flex flex-wrap justify-between gap-2">
                      <span>
                        {e.person} · {e.purpose}
                      </span>
                      <span>
                        {money(e.amount)} · {formatUaeDateTime(e.at)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {preview.renewals.length ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <h2 className="font-medium text-slate-900">Plan renewals</h2>
                <ul className="mt-2 space-y-1 text-sm">
                  {preview.renewals.map((l) => (
                    <li key={l.id} className="flex flex-wrap justify-between gap-2">
                      <span>
                        {l.person} · cycle {l.cycle}
                      </span>
                      <span>{formatUaeDateTime(l.at)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <button
              type="button"
              disabled={restoring || total === 0}
              onClick={() => void restore()}
              className="rounded-lg bg-red-700 px-4 py-3 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
            >
              {restoring
                ? 'Restoring…'
                : total === 0
                  ? 'Nothing to restore'
                  : `Restore to ${date} ${time} UAE`}
            </button>
          </section>
        ) : null}
      </AdminOnly>
    </AppShell>
  );
}
