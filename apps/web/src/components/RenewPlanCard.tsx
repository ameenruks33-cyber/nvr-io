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
  previousBalance: number;
  renewalBalance: number;
  cycle: number;
  wallet?: { walletIn: number; walletOut: number; walletNet: number };
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
  const [cashFromWallet, setCashFromWallet] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const plan = LOAN_PLANS[planId];
  const dailyNum = Number(daily);
  const hasOutstanding = remaining > 0.001;

  const split = useMemo(() => {
    const previous = hasOutstanding ? remaining : 0;
    const renewal = cashFromWallet
      ? Math.max(0, Math.round((plan.principal - previous) * 100) / 100)
      : 0;
    return { previous, renewal, netOut: renewal };
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
        result.previousBalance > 0
          ? `Previous balance ${money(result.previousBalance)} added to the wallet. The old ${money(plan.totalPayable)} plan is closed (full total paid on the books).`
          : `Old plan had nothing outstanding.`,
        `Existing account restarted — remaining ${money(result.newPlan.totalPayable)}.`,
        result.renewalBalance > 0
          ? `Renewal balance ${money(result.renewalBalance)} paid from the wallet to the customer.`
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
      <p className="mt-2 text-sm text-slate-600">
        The old plan closes only when the full {money(plan.totalPayable)} is on
        the books. Outstanding is posted as <strong>Previous balance</strong>{' '}
        into the wallet. Cash given is{' '}
        <strong>Renewal balance</strong> ({money(plan.principal)} minus
        outstanding).
      </p>

      {hasOutstanding ? (
        <div className="mt-4 rounded-lg border border-teal-200 bg-white px-3 py-2 text-sm text-slate-800">
          <p>
            Previous balance {money(split.previous)} → wallet (closes this{' '}
            {money(plan.totalPayable)} cycle).
          </p>
          <p className="mt-1">
            Renewal balance {money(split.renewal)} → paid to the customer (
            {money(plan.principal)} − {money(split.previous)}).
          </p>
        </div>
      ) : (
        <p className="mt-4 text-sm text-teal-800">
          Nothing outstanding. Renewal cash is {money(plan.principal)}.
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
          Pay renewal balance {money(split.renewal)} from the wallet (cash
          renewal).
        </span>
      </label>

      <p className="mt-3 text-xs text-slate-500">
        Wallet: +{money(split.previous)} previous balance, then −
        {money(split.previous + split.renewal)} on petty cash (previous{' '}
        {money(split.previous)} + renewal {money(split.renewal)}). Customer
        receives {money(split.netOut)}.
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
            ? `Add ${money(split.previous)} previous balance and pay ${money(split.renewal)} renewal`
            : `Renew ${plan.label}`}
      </button>
    </form>
  );
}
