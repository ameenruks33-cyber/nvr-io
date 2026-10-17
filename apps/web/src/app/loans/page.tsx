'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { AppShell } from '@/components/AppShell';
import { ArrearsBadge } from '@/components/ArrearsBadge';
import { PendingTodayBanner } from '@/components/PendingTodayBanner';
import { ClosedBadge } from '@/components/ClosedBadge';
import { DeleteLoanButton } from '@/components/DeleteLoanButton';
import { api, getSession, money } from '@/lib/api';
import { loanDaysInArrears } from '@/lib/arrears';
import { loanTotals } from '@/lib/loan-plans';
import { useLiveRefresh } from '@/lib/live-sync';
import { isAdminRole } from '@/lib/roles';

type LoanRow = {
  id: string;
  status: string;
  principalAmount: string | number;
  totalPayable?: string | number;
  amountCollected: string | number;
  remainingAmount: string | number;
  dailyPayment?: string | number;
  openedAt?: string;
  daysInArrears?: number;
  customer: {
    id: string;
    customerCode: string;
    name: string;
    phone: string;
  };
};

export default function LoansPage() {
  const [rows, setRows] = useState<LoanRow[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);

  const load = () => {
    api<LoanRow[]>('/loans').then(setRows).catch(() => undefined);
  };

  useEffect(load, []);
  useEffect(() => {
    setIsAdmin(isAdminRole(getSession()?.user.role));
  }, []);
  useLiveRefresh(load);

  return (
    <AppShell>
      <PendingTodayBanner />
      <header className="mb-6">
        <h1 className="font-display text-3xl text-slate-900">Records</h1>
        <p className="mt-1 text-sm text-slate-500">
          Paying the remaining balance closes the plan and adds that cash to the
          wallet. Cash paid out is only the amount given to the customer.
        </p>
      </header>
      <div className="overflow-x-auto rounded-2xl border border-slate-200">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-white text-slate-500">
            <tr>
              <th className="px-4 py-3">Person</th>
              <th className="px-4 py-3">Collected</th>
              <th className="px-4 py-3">Balance</th>
              {isAdmin ? <th className="px-4 py-3 text-right"> </th> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const collected = Number(row.amountCollected);
              const totals = loanTotals(row);
              const remaining = Number(row.remainingAmount);
              const closed = row.status !== 'ACTIVE';
              const label = `${row.customer.customerCode} · ${row.customer.name}`;
              return (
                <tr key={row.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${row.customer.id}`}
                      className="text-teal-700 hover:underline"
                    >
                      {label}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    {money(collected)} / {money(totals.total)}
                    {collected > 0 ? (
                      <p className="text-xs text-teal-700">
                        In wallet {money(collected)}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {closed ? (
                      <div>
                        <ClosedBadge label="Closed" />
                        <p className="mt-1 text-xs text-slate-500">
                          Remaining {money(0)}
                        </p>
                      </div>
                    ) : (
                      <span className="inline-flex flex-wrap items-center gap-2">
                        {money(remaining)}
                        <ArrearsBadge days={loanDaysInArrears(row)} />
                      </span>
                    )}
                  </td>
                  {isAdmin ? (
                    <td className="px-4 py-3 text-right">
                      <DeleteLoanButton
                        loanId={row.id}
                        personLabel={label}
                        collected={collected}
                        onDeleted={load}
                      />
                    </td>
                  ) : null}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
