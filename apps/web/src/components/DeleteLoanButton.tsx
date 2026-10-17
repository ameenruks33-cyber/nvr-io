'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

type Props = {
  loanId: string;
  personLabel: string;
  collected: number;
  onDeleted: () => void | Promise<void>;
};

/** Admin / Super Admin — parent must hide this for collectors. */
export function DeleteLoanButton({
  loanId,
  personLabel,
  collected,
  onDeleted,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    const extra =
      collected > 0
        ? ' Collection history on this plan will be removed from the list.'
        : '';
    if (
      !window.confirm(
        `Delete this record for ${personLabel}?${extra} This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api(`/loans/${loanId}`, { method: 'DELETE' });
      await onDeleted();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not delete record');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void remove()}
      className="rounded-lg border border-red-200 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
    >
      {busy ? '…' : 'Delete'}
    </button>
  );
}
