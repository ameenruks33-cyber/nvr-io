'use client';

import { FormEvent, useMemo, useState } from 'react';
import { api, money } from '@/lib/api';
import { notifyCollectionSaved, notifyDataChanged } from '@/lib/live-sync';
import { LOAN_PLAN_IDS, LOAN_PLANS, type LoanPlanId } from '@/lib/loan-plans';

type LoanLite = {
  id: string;
  status: string;
  remainingAmount: string | number;
  totalPayable?: string | number;
  principalAmount?: string | number;
};

type RenewResult = {
  collectedToClose: number;
  cashGiven: number;
  settlementReceipt: string | null;
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
  const open = loan?.status === 'ACTIVE';
  const needsSettle = open && remaining > 0.001;
  const defaultPlan: LoanPlanId =
    Number(loan?.totalPayable || loan?.principalAmount || 2000) <= 1000
      ? 'AED_1000'
      : 'AED_2000';

  const [planId, setPlanId] = useState<LoanPlanId>(defaultPlan);
  const [daily, setDaily] = useState(String(LOAN_PLANS[defaultPlan].defaultDaily));
  const [settle, setSettle] = useState(true);
  const [cashFromWallet, setCashFromWallet] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const plan = LOAN_PLANS[planId];
  const dailyNum = Number(daily);
  const canSubmit = !needsSettle || settle;

  const summary = useMemo(() => {
    const collect = needsSettle && settle ? remaining : 0;
    const given = cashFromWallet ? plan.principal : 0;
    return { collect, given, net: collect - given };
  }, [needsSettle, settle, remaining, cashFromWallet, plan.principal]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      setError('Collect the remaining cash to close this plan, then renew.');
      return;
    }
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
          settleRemaining: settle,
          recordCashGiven: cashFromWallet,
        }),
      });
      if (result.collectedToClose > 0) {
        notifyCollectionSaved({
          customerId,
          amount: result.collectedToClose,
        });
      } else {
        notifyDataChanged();
      }
      const bits = [
        result.collectedToClose > 0
          ? `Collected ${money(result.collectedToClose)} to close the old plan.`
          : 'Previous plan closed.',
        `Opened ${plan.label} (${money(result.newPlan.totalPayable)}).`,
        result.cashGiven > 0
          ? `${money(result.cashGiven)} taken from the wallet.`
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
          {needsSettle
            ? `Collect remaining ${money(remaining)} and close this plan.`
            : 'Close the current plan (nothing left to collect).'}
        </li>
        <li>Open the new plan on the same person.</li>
        <li>Optionally pay the new cash from the wallet.</li>
      </ol>

      {needsSettle ? (
        <label className="mt-4 flex items-start gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            className="mt-1"
            checked={settle}
            onChange={(e) => setSettle(e.target.checked)}
          />
          <span>
            Collect remaining <strong>{money(remaining)}</strong> now so this
            plan can close.
          </span>
        </label>
      ) : (
        <p className="mt-4 text-sm text-teal-800">
          No leftover cash on the current plan.
        </p>
      )}

      <fieldset className="mt-4">
        <legend className="text-sm text-slate-600">New plan</legend>
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
          Customer receives {money(plan.principal)}. New account total{' '}
          {money(plan.totalPayable)}.
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
          Pay {money(plan.principal)} from the wallet to the customer.
        </span>
      </label>

      <p className="mt-3 text-xs text-slate-500">
        Wallet change:{' '}
        {summary.net === 0
          ? 'no change'
          : summary.net > 0
            ? `+${money(summary.net)}`
            : `−${money(Math.abs(summary.net))}`}{' '}
        (collect {money(summary.collect)}, pay out {money(summary.given)}).
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
        disabled={saving || !canSubmit}
        className="mt-4 w-full rounded-lg bg-teal-700 px-4 py-3 text-sm font-medium text-white hover:bg-teal-600 disabled:opacity-60"
      >
        {saving
          ? 'Renewing…'
          : needsSettle
            ? `Settle ${money(remaining)} and open ${plan.label}`
            : `Open ${plan.label}`}
      </button>
    </form>
  );
}
