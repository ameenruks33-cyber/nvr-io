'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, money } from '@/lib/api';
import { notifyDataChanged } from '@/lib/live-sync';
import { formatUaeDateTime, uaeNowTime, uaeToday } from '@/lib/uae-datetime';

type Preview = {
  at: string;
  date: string;
  time: string;
  personWouldBeRemoved?: boolean;
  repayments: Array<{
    id: string;
    at: string;
    amount: number;
    receiptNumber: string;
  }>;
  expenses: Array<{
    id: string;
    at: string;
    amount: number;
    purpose: string;
  }>;
  renewals: Array<{
    id: string;
    at: string;
    cycle: number;
  }>;
  files: Array<{
    id: string;
    at: string;
    kind: 'document' | 'photo';
  }>;
  totals: {
    repayments: number;
    expenses: number;
    renewals: number;
    newPeople: number;
    files: number;
  };
};

export function RestorePersonCard({
  customerId,
  customerName,
  onDone,
}: {
  customerId: string;
  customerName: string;
  onDone: () => Promise<void> | void;
}) {
  const router = useRouter();
  const [date, setDate] = useState(uaeToday);
  const [time, setTime] = useState(uaeNowTime);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);

  const total = preview
    ? preview.totals.repayments +
      preview.totals.expenses +
      preview.totals.renewals +
      (preview.totals.files || 0) +
      (preview.personWouldBeRemoved ? 1 : 0)
    : 0;

  async function loadPreview(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const data = await api<Preview>(
        `/restore/preview?date=${encodeURIComponent(date)}&time=${encodeURIComponent(time)}&customerId=${encodeURIComponent(customerId)}`,
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
    const warning = preview.personWouldBeRemoved
      ? `${customerName} was added after ${date} ${time} UAE and will be removed.`
      : `Restore ${customerName} to ${date} ${time} UAE? Later collections, files, photos, and renewals are undone. The account then works as it did at that moment.`;
    if (!window.confirm(warning)) return;
    setRestoring(true);
    setError('');
    setMessage('');
    try {
      const result = await api<{
        repaymentsRemoved: number;
        expensesRemoved: number;
        filesRemoved?: number;
        personRemoved?: boolean;
        accountsReconciled: number;
      }>('/restore/to', {
        method: 'POST',
        body: JSON.stringify({ date, time, customerId }),
      });
      notifyDataChanged();
      if (result.personRemoved) {
        router.replace('/customers');
        return;
      }
      setMessage(
        `Restored to ${date} ${time} UAE. Removed ${result.repaymentsRemoved} collection(s), ${result.filesRemoved ?? 0} file(s), and ${result.expensesRemoved} petty-cash payout(s). Remaining and status now match that moment.`,
      );
      await onDone();
      await loadPreview();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore');
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <h2 className="font-display text-xl text-slate-900">Restore this account</h2>
      <p className="mt-1 text-sm text-slate-500">
        Choose the exact UAE date and time. Everything on this profile from that
        moment onward — collections, files, photos, and renewals — is undone.
        Remaining, status, and history then match that moment, and you continue
        from there.
      </p>
      <form
        onSubmit={(e) => void loadPreview(e)}
        className="mt-4 flex flex-wrap items-end gap-3"
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
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-3 text-sm text-teal-800" role="status">
          {message}
        </p>
      ) : null}

      {preview ? (
        <div className="mt-4 space-y-3">
          {preview.personWouldBeRemoved ? (
            <p className="text-sm text-amber-800">
              This person was added after {formatUaeDateTime(preview.at)}. Restoring
              that time removes them from the app.
            </p>
          ) : (
            <p className="text-sm text-slate-600">
              After {formatUaeDateTime(preview.at)}: {preview.totals.repayments}{' '}
              collection(s), {preview.totals.files} file(s),{' '}
              {preview.totals.expenses} petty-cash payout(s),{' '}
              {preview.totals.renewals} renewal(s).
            </p>
          )}

          {preview.repayments.length ? (
            <ul className="space-y-1 text-sm text-slate-700">
              {preview.repayments.map((r) => (
                <li key={r.id} className="flex flex-wrap justify-between gap-2">
                  <span>{r.receiptNumber}</span>
                  <span>
                    {money(r.amount)} · {formatUaeDateTime(r.at)}
                  </span>
                </li>
              ))}
            </ul>
          ) : null}

          {preview.files?.length ? (
            <ul className="space-y-1 text-sm text-slate-700">
              {preview.files.map((f) => (
                <li key={`${f.kind}-${f.id}`}>
                  {f.kind === 'photo' ? 'Photo' : 'File'} · {formatUaeDateTime(f.at)}
                </li>
              ))}
            </ul>
          ) : null}

          <button
            type="button"
            disabled={restoring || total === 0}
            onClick={() => void restore()}
            className="rounded-lg bg-red-700 px-4 py-2.5 text-sm font-medium text-white hover:bg-red-600 disabled:opacity-60"
          >
            {restoring
              ? 'Restoring…'
              : total === 0
                ? 'Already at that time'
                : `Restore to ${date} ${time} UAE`}
          </button>
        </div>
      ) : null}
    </div>
  );
}
