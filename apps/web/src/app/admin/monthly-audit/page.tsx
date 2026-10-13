'use client';

import { useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { AdminOnly } from '@/components/AdminOnly';
import { api, money } from '@/lib/api';
import { formatUaeDateTime } from '@/lib/uae-datetime';

type AuditSummary = {
  totalCustomers: number;
  activeLoansEnd: number;
  completedLoansInMonth: number;
  collectionsInMonth: number;
  collectionReceiptsInMonth: number;
  expensesInMonth: number;
  netCashflowInMonth: number;
  totalOutstandingEnd: number;
  totalCollectedAllTime: number;
  totalDisbursedAllTime: number;
  pendingDailyAccountsEnd: number;
};

type AuditReport = {
  summary: AuditSummary;
  ledger: Array<{ date: string; collected: number; spent: number; net: number }>;
  expenses: Array<{
    id: string;
    spentOn: string;
    amount: number;
    purpose: string;
    recordedBy: string;
  }>;
  collectionsByDay: Array<{ date: string; total: number; count: number }>;
  openAccounts: Array<{
    customerCode: string;
    customerName: string;
    remainingBalance: number;
    collectedInMonth: number;
  }>;
  pendingDailyAtMonthEnd: Array<{
    customerCode: string;
    customerName: string;
    pendingAed: number;
    remainingBalance: number;
  }>;
};

type AuditRow = {
  id: string;
  periodMonth: string;
  title: string;
  generatedAt: string;
  report: AuditReport;
};

export default function MonthlyAuditPage() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const load = useCallback(() => {
    api<AuditRow[]>('/monthly-audit')
      .then((data) => {
        setRows(data);
        setSelected((prev) => prev ?? data[0]?.id ?? null);
      })
      .catch((e) => setError(e.message));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = rows.find((r) => r.id === selected) ?? rows[0];
  const report = current?.report;

  async function runNow() {
    setBusy(true);
    setStatus('');
    setError('');
    try {
      await api('/monthly-audit/generate', { method: 'POST' });
      setStatus('Audit generated for the previous UAE month (or existing report returned).');
      load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not generate audit');
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <AdminOnly>
        <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl text-slate-900">Monthly audit</h1>
            <p className="mt-1 text-sm text-slate-500">
              Automatic account review — collections, expenses, ledger, and pending balances.
              View only; runs on the 1st of each month (UAE).
            </p>
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => void runNow()}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-blue-50 disabled:opacity-60"
          >
            {busy ? 'Running…' : 'Run previous month now'}
          </button>
        </header>

        {error ? <p className="mb-4 text-red-600">{error}</p> : null}
        {status ? (
          <p className="mb-4 text-sm text-teal-700" role="status">
            {status}
          </p>
        ) : null}

        {!rows.length ? (
          <p className="text-slate-500">
            No monthly audits yet. The first run happens automatically on the 1st, or tap
            &quot;Run previous month now&quot;.
          </p>
        ) : (
          <div className="flex flex-col gap-6 lg:flex-row">
            <ul className="shrink-0 space-y-2 lg:w-56">
              {rows.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setSelected(row.id)}
                    className={`w-full rounded-xl border px-3 py-2 text-left text-sm ${
                      current?.id === row.id
                        ? 'border-blue-500 bg-blue-50 font-medium text-blue-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {row.title}
                    <span className="mt-0.5 block text-xs text-slate-500">
                      {formatUaeDateTime(row.generatedAt)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {report && current ? (
              <div className="min-w-0 flex-1 space-y-6">
                <section>
                  <h2 className="mb-3 font-display text-xl text-slate-900">Summary</h2>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {[
                      ['Collections (month)', money(report.summary.collectionsInMonth)],
                      ['Expenses (month)', money(report.summary.expensesInMonth)],
                      ['Net cashflow', money(report.summary.netCashflowInMonth)],
                      ['Outstanding (end)', money(report.summary.totalOutstandingEnd)],
                      ['Receipts (month)', String(report.summary.collectionReceiptsInMonth)],
                      ['Open accounts (end)', String(report.summary.activeLoansEnd)],
                      ['Pending daily (last day)', String(report.summary.pendingDailyAccountsEnd)],
                      ['Closed in month', String(report.summary.completedLoansInMonth)],
                      ['People (total)', String(report.summary.totalCustomers)],
                    ].map(([label, value]) => (
                      <div
                        key={label}
                        className="rounded-xl border border-slate-200 bg-white p-4"
                      >
                        <p className="text-xs uppercase text-slate-500">{label}</p>
                        <p className="mt-1 font-display text-lg text-slate-900">{value}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h2 className="mb-3 font-display text-xl text-slate-900">Daily ledger</h2>
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="min-w-full text-sm">
                      <thead className="bg-slate-50 text-left text-xs uppercase text-slate-500">
                        <tr>
                          <th className="px-3 py-2">Date</th>
                          <th className="px-3 py-2">Collected</th>
                          <th className="px-3 py-2">Spent</th>
                          <th className="px-3 py-2">Net</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.ledger.map((line) => (
                          <tr key={line.date} className="border-t border-slate-100">
                            <td className="px-3 py-2">{line.date}</td>
                            <td className="px-3 py-2">{money(line.collected)}</td>
                            <td className="px-3 py-2">{money(line.spent)}</td>
                            <td className="px-3 py-2">{money(line.net)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section>
                  <h2 className="mb-3 font-display text-xl text-slate-900">Expenses</h2>
                  <ul className="space-y-2 text-sm">
                    {report.expenses.length ? (
                      report.expenses.map((e) => (
                        <li
                          key={e.id}
                          className="flex flex-wrap justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2"
                        >
                          <span>
                            {e.spentOn} · {e.purpose}
                            <span className="text-slate-500"> · {e.recordedBy}</span>
                          </span>
                          <span className="font-medium">{money(e.amount)}</span>
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500">No expenses recorded this month.</li>
                    )}
                  </ul>
                </section>

                <section>
                  <h2 className="mb-3 font-display text-xl text-slate-900">
                    Pending at month end
                  </h2>
                  <ul className="space-y-2 text-sm">
                    {report.pendingDailyAtMonthEnd.length ? (
                      report.pendingDailyAtMonthEnd.map((p) => (
                        <li
                          key={`${p.customerCode}-${p.pendingAed}`}
                          className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2"
                        >
                          {p.customerName} ({p.customerCode}) — pending{' '}
                          {money(p.pendingAed)}, balance {money(p.remainingBalance)}
                        </li>
                      ))
                    ) : (
                      <li className="text-slate-500">
                        No daily collection pending on the last day of the month.
                      </li>
                    )}
                  </ul>
                </section>

                <section>
                  <h2 className="mb-3 font-display text-xl text-slate-900">Open accounts</h2>
                  <ul className="max-h-64 space-y-1 overflow-y-auto text-sm">
                    {report.openAccounts.map((a) => (
                      <li
                        key={a.customerCode}
                        className="flex justify-between gap-2 rounded-lg border border-slate-100 px-3 py-1.5"
                      >
                        <span>
                          {a.customerName}{' '}
                          <span className="text-slate-500">({a.customerCode})</span>
                        </span>
                        <span className="text-slate-600">
                          {money(a.collectedInMonth)} / {money(a.remainingBalance)} left
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              </div>
            ) : null}
          </div>
        )}
      </AdminOnly>
    </AppShell>
  );
}
