'use client';

import { FormEvent, useMemo, useState } from 'react';
import { api, money } from '@/lib/api';
import { notifyDataChanged } from '@/lib/live-sync';
import { LOAN_PLAN_IDS, LOAN_PLANS, type LoanPlanId } from '@/lib/loan-plans';

type LoanLite = {
  id: string;
  status: string;
  remainingAmount: string | number;
  totalPayable?: string | number;
  principalAmount?: string | number;
};

type RenewResult = {
  outstandingSettled: number;
  cashGiven: number;
  cycle: number;
  wallet?: { walletOut: number };
  newPlan: {
    principal: number;
    totalPayable: number;
    dailyPayment: number;
  };
};

export function RenewPlanCard({
  customerId,
  loan,
  onDone,
}: {
  customerId: string;
  loan?: LoanLite | null;
  onDone: () => Promise<void> | void;
}) {
  const remaining = Math.max(0, Number(loan?.remainingAmount || 0));
  const defaultPlan: LoanPlanId =
    Number(loan?.totalPayable || loan?.principalAmount || 2000) <= 1000
      ? 'AED_1000'
      : 'AED_2000';

  const [planId, setPlanId] = useState<LoanPlanId>(defaultPlan);
  const [daily, setDaily] = useState(String(LOAN_PLANS[defaultPlan].defaultDaily));
  const [cashFromWallet, setCashFromWallet] = useState(remaining <= 0.001);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const plan = LOAN_PLANS[planId];
  const dailyNum = Number(daily);
  const hasOutstanding = remaining > 0.001;

  const summary = useMemo(() => {
    const outstanding = hasOutstanding ? remaining : 0;
    const given = cashFromWallet ? plan.principal : 0;
    return { outstanding, given, out: outstanding + given };
  }, [hasOutstanding, remaining, cashFromWallet, plan.principal]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!Number.isFinite(dailyNum) || dailyNum < 1) {
      setError('Enter a daily amount');
      return;
    }
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const result = await api<RenewResult>(`/customers/${customerId}/renew`, {
        method: 'POST',
        body: JSON.stringify({
          planId,
          dailyPayment: dailyNum,
          recordCashGiven: cashFromWallet,
        }),
      });
      notifyDataChanged();
      const bits = [
        result.outstandingSettled > 0
          ? `Outstanding ${money(result.outstandingSettled)} taken from the wallet and recorded as petty-cash paid out.`
          : 'No outstanding on this account.',
        `Same person, existing account — ${plan.label} restarted (cycle ${result.cycle}). Remaining ${money(result.newPlan.totalPayable)}.`,
        result.cashGiven > 0
          ? `Also paid the customer ${money(result.cashGiven)} from the wallet.`
          : null,
      ].filter(Boolean);
      setMessage(bits.join(' '));
      await onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not renew the plan');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(e) => void onSubmit(e)}
      className="rounded-2xl border border-teal-200 bg-teal-50/40 p-5"
    >
      <h2 className="font-display text-xl text-slate-900">Renew plan</h2>
      <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
        <li>
          {hasOutstanding
            ? `Deduct outstanding ${money(remaining)} from the wallet (petty-cash payout).`
            : 'No leftover balance to settle.'}
        </li>
        <li>Continue this person on the same account with a fresh plan cycle.</li>
        <li>Optionally pay new cash from the wallet (principal only).</li>
      </ol>

      {hasOutstanding ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          Outstanding {money(remaining)} will leave the wallet and appear under
          Petty Cash as paid to this customer. It is not collected again.
        </p>
      ) : (
        <p className="mt-4 text-sm text-teal-800">
          This account has no leftover cash.
        </p>
      )}

      <fieldset className="mt-4">
        <legend className="text-sm text-slate-600">Continue with plan</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {LOAN_PLAN_IDS.map((id) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPlanId(id);
                setDaily(String(LOAN_PLANS[id].defaultDaily));
              }}
              className={`rounded-lg border px-3 py-2 text-sm ${
                planId === id
                  ? 'border-teal-700 bg-white font-medium text-teal-900'
                  : 'border-slate-200 bg-white text-slate-600'
              }`}
            >
              {LOAN_PLANS[id].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Fresh cycle total {money(plan.totalPayable)}. Cash given if paid out is{' '}
          {money(plan.principal)}.
        </p>
      </fieldset>

      <label className="mt-3 block text-sm">
        <span className="text-slate-600">Daily collection (AED)</span>
        <input
          type="number"
          min={1}
          step={1}
          value={daily}
          onChange={(e) => setDaily(e.target.value)}
          className="mt-1 w-32 rounded-lg border border-slate-200 bg-white px-3 py-2"
        />
      </label>

      <label className="mt-3 flex items-start gap-2 text-sm text-slate-800">
        <input
          type="checkbox"
          className="mt-1"
          checked={cashFromWallet}
          onChange={(e) => setCashFromWallet(e.target.checked)}
        />
        <span>
          Also pay {money(plan.principal)} new cash from the wallet.
        </span>
      </label>

      <p className="mt-3 text-xs text-slate-500">
        Wallet payout: {money(summary.out)}
        {summary.outstanding > 0
          ? ` (outstanding ${money(summary.outstanding)}`
          : ' ('}
        {summary.given > 0
          ? `${summary.outstanding > 0 ? ' + ' : ''}new cash ${money(summary.given)})`
          : summary.outstanding > 0
            ? ')'
            : 'none)'}
        .
      </p>

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

      <button
        type="submit"
        disabled={saving}
        className="mt-4 w-full rounded-lg bg-teal-700 px-4 py-3 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60"
      >
        {saving
          ? 'Renewing…'
          : hasOutstanding
            ? `Deduct ${money(remaining)} from wallet and renew ${plan.label}`
            : `Renew ${plan.label} on this account`}
      </button>
    </form>
  );
}
