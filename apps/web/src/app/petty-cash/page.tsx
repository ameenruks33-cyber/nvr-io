'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AppShell } from '@/components/AppShell';
import { api, getSession, money } from '@/lib/api';
import { useLiveRefresh } from '@/lib/live-sync';
import { formatUaeCalendarDay, formatUaeTime } from '@/lib/uae-datetime';

type ExpenseKind = 'general' | 'person';

type Expense = {
  id: string;
  amount: number;
  purpose: string;
  paidToName?: string | null;
  recordedBy: { id: string; name: string };
  createdAt: string;
};

type Day = {
  date: string;
  collected: number;
  spent: number;
  expenses: Expense[];
};

type Summary = {
  today: string;
  totalCollected: number;
  totalSpent: number;
  totalPersonPaid: number;
  totalGeneralSpent: number;
  balance: number;
  todayCollected: number;
  todaySpent: number;
  days: Day[];
};

function dayLabel(date: string, today: string) {
  if (date === today) return 'Today';
  return formatUaeCalendarDay(date);
}

function splitExpenses(expenses: Expense[]) {
  const personPayments: Expense[] = [];
  const generalExpenses: Expense[] = [];
  for (const e of expenses) {
    if (e.paidToName?.trim()) personPayments.push(e);
    else generalExpenses.push(e);
  }
  return { personPayments, generalExpenses };
}

const inputClass =
  'mt-1 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 outline-none ring-blue-500 focus:ring-2';

export default function PettyCashPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [amount, setAmount] = useState('');
  const [spentOn, setSpentOn] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expenseKind, setExpenseKind] = useState<ExpenseKind>('general');
  const [paidToName, setPaidToName] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await api<Summary>('/petty-cash');
      setData(s);
      setSpentOn((prev) => prev || s.today);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load petty cash');
    }
  }, []);

  useEffect(() => {
    setIsSuperAdmin(getSession()?.user.role === 'SUPER_ADMIN');
    void load();
  }, [load]);

  useLiveRefresh(() => void load());

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const value = Number(amount);
    if (!Number.isFinite(value) || value <= 0) {
      setError('Enter the amount taken');
      return;
    }
    const person = paidToName.trim();
    if (expenseKind === 'person' && person.length < 2) {
      setError('Enter who was paid');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      await api('/petty-cash', {
        method: 'POST',
        body: JSON.stringify({
          amount: Math.round(value * 100) / 100,
          spentOn,
          purpose: purpose.trim(),
          ...(expenseKind === 'person' ? { paidToName: person } : {}),
        }),
      });
      setMessage(
        expenseKind === 'person'
          ? `Recorded ${money(value)} paid to ${person}.`
          : `Recorded ${money(value)} for ${purpose.trim()}.`,
      );
      setAmount('');
      setPurpose('');
      setPaidToName('');
      setExpenseKind('general');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save expense');
    } finally {
      setSaving(false);
    }
  }

  async function removeExpense(expense: Expense) {
    const label = expense.paidToName
      ? `${money(expense.amount)} to ${expense.paidToName}`
      : `${money(expense.amount)} — ${expense.purpose}`;
    if (
      !window.confirm(
        `Delete ${label}? The amount goes back into the wallet.`,
      )
    ) {
      return;
    }
    setDeletingId(expense.id);
    setError('');
    setMessage('');
    try {
      await api(`/petty-cash/${expense.id}`, { method: 'DELETE' });
      setMessage('Expense deleted.');
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not delete');
    } finally {
      setDeletingId('');
    }
  }

  const negative = (data?.balance ?? 0) < 0;

  function renderExpenseList(items: Expense[], variant: 'person' | 'general') {
    if (!items.length) return null;
    return (
      <ul className="mt-2 divide-y divide-slate-100 text-sm">
        {items.map((x) => (
          <li
            key={x.id}
            className="flex flex-wrap items-center justify-between gap-2 py-2"
          >
            <div>
              {variant === 'person' ? (
                <>
                  <p className="font-medium text-slate-900">{x.paidToName}</p>
                  <p className="text-xs text-slate-600">{x.purpose}</p>
                </>
              ) : (
                <p className="text-slate-900">{x.purpose}</p>
              )}
              <p className="text-xs text-slate-500">
                by {x.recordedBy.name} · {formatUaeTime(x.createdAt)}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-medium text-red-600">−{money(x.amount)}</span>
              {isSuperAdmin ? (
                <button
                  type="button"
                  onClick={() => void removeExpense(x)}
                  disabled={deletingId === x.id}
                  className="text-xs text-slate-500 underline hover:text-red-600 disabled:opacity-60"
                >
                  Delete
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <AppShell>
      <h1 className="font-display text-3xl text-slate-900">Petty Cash</h1>
      <p className="mt-1 max-w-xl text-sm text-slate-500">
        Money taken from collections for expenses. Paying a person creates a
        separate line from general expenses (fuel, tea, etc.).
      </p>

      <section className="mt-6 grid max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div
          className={`rounded-2xl border p-4 sm:col-span-2 lg:col-span-3 ${
            negative
              ? 'border-red-200 bg-red-50'
              : 'border-blue-200 bg-blue-600 text-white'
          }`}
        >
          <p className={`text-xs ${negative ? 'text-red-700' : 'text-blue-100'}`}>
            Wallet balance
          </p>
          <p
            className={`mt-1 text-3xl font-semibold ${
              negative ? 'text-red-700' : 'text-white'
            }`}
          >
            {data ? money(data.balance) : '…'}
          </p>
          <p className={`mt-1 text-xs ${negative ? 'text-red-700' : 'text-blue-100'}`}>
            {data
              ? `Total collected ${money(data.totalCollected)} − Total expenses ${money(data.totalSpent)}`
              : ''}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Total collected</p>
          <p className="mt-1 text-lg font-medium text-teal-700">
            {data ? money(data.totalCollected) : '…'}
          </p>
        </div>
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4">
          <p className="text-xs text-red-700">Total expenses</p>
          <p className="mt-1 text-lg font-semibold text-red-700">
            {data ? money(data.totalSpent) : '…'}
          </p>
          <p className="mt-1 text-xs text-red-600/80">
            General {data ? money(data.totalGeneralSpent) : '…'} · People{' '}
            {data ? money(data.totalPersonPaid) : '…'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Collected today</p>
          <p className="mt-1 text-lg font-medium text-teal-700">
            {data ? money(data.todayCollected) : '…'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Spent today</p>
          <p className="mt-1 text-lg font-medium text-red-600">
            {data ? money(data.todaySpent) : '…'}
          </p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 sm:col-span-2 lg:col-span-1">
          <p className="text-xs text-slate-500">Net today</p>
          <p className="mt-1 text-lg font-medium text-slate-900">
            {data ? money(data.todayCollected - data.todaySpent) : '…'}
          </p>
        </div>
      </section>

      <form
        onSubmit={onSubmit}
        className="mt-6 max-w-3xl space-y-3 rounded-2xl border border-slate-200 bg-white p-5"
      >
        <h2 className="text-lg font-medium text-slate-900">Record an expense</h2>
        <fieldset className="space-y-2">
          <legend className="text-sm text-slate-600">Type</legend>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setExpenseKind('general')}
              className={`rounded-lg border px-3 py-2 text-sm ${
                expenseKind === 'general'
                  ? 'border-blue-600 bg-blue-50 font-medium text-blue-900'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              General expense
            </button>
            <button
              type="button"
              onClick={() => setExpenseKind('person')}
              className={`rounded-lg border px-3 py-2 text-sm ${
                expenseKind === 'person'
                  ? 'border-blue-600 bg-blue-50 font-medium text-blue-900'
                  : 'border-slate-200 text-slate-600'
              }`}
            >
              Pay to a person
            </button>
          </div>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block text-sm">
            <span className="text-slate-600">Amount (AED)</span>
            <input
              className={inputClass}
              type="number"
              inputMode="decimal"
              min={1}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 50"
              required
            />
          </label>
          <label className="block text-sm">
            <span className="text-slate-600">Date taken</span>
            <input
              className={inputClass}
              type="date"
              value={spentOn}
              max={data?.today}
              onChange={(e) => setSpentOn(e.target.value)}
              required
            />
          </label>
        </div>
        {expenseKind === 'person' ? (
          <label className="block text-sm">
            <span className="text-slate-600">Person paid</span>
            <input
              className={inputClass}
              value={paidToName}
              onChange={(e) => setPaidToName(e.target.value)}
              placeholder="e.g. Rajesh, driver Ahmed"
              minLength={2}
              maxLength={120}
              required
            />
          </label>
        ) : null}
        <label className="block text-sm">
          <span className="text-slate-600">
            {expenseKind === 'person' ? 'Reason / note' : 'What was it for?'}
          </span>
          <input
            className={inputClass}
            value={purpose}
            onChange={(e) => setPurpose(e.target.value)}
            placeholder={
              expenseKind === 'person'
                ? 'e.g. Advance, commission, refund'
                : 'e.g. Fuel, tea, printing'
            }
            minLength={2}
            maxLength={200}
            required
          />
        </label>
        {error ? (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="text-sm text-teal-700" role="status">
            {message}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-blue-600 px-4 py-3 font-medium text-white hover:bg-blue-500 disabled:opacity-60"
        >
          {saving
            ? 'Saving…'
            : expenseKind === 'person'
              ? 'Record payment to person'
              : 'Record expense'}
        </button>
      </form>

      <section className="mt-8 max-w-3xl">
        <h2 className="mb-3 text-lg font-medium text-slate-900">Daily log</h2>
        <div className="space-y-3">
          {(data?.days || []).map((day) => {
            const { personPayments, generalExpenses } = splitExpenses(day.expenses);
            return (
              <div
                key={day.date}
                className="rounded-2xl border border-slate-200 bg-white p-4"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="font-medium text-slate-900">
                    {dayLabel(day.date, data?.today || '')}
                  </p>
                  <p className="text-xs text-slate-500">
                    <span className="text-teal-700">+{money(day.collected)}</span>
                    {' · '}
                    <span className="text-red-600">−{money(day.spent)}</span>
                    {' · '}
                    Net {money(day.collected - day.spent)}
                  </p>
                </div>
                {day.expenses.length ? (
                  <div className="mt-3 space-y-4">
                    {personPayments.length ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-violet-700">
                          Payments to people
                        </p>
                        {renderExpenseList(personPayments, 'person')}
                      </div>
                    ) : null}
                    {generalExpenses.length ? (
                      <div>
                        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                          Other expenses
                        </p>
                        {renderExpenseList(generalExpenses, 'general')}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-slate-500">No expenses this day.</p>
                )}
              </div>
            );
          })}
          {data && !data.days.length ? (
            <p className="text-sm text-slate-500">Nothing recorded yet.</p>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}
