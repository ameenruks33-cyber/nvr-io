'use client';

import { useState } from 'react';
import { api } from '@/lib/api';

type Props = {
  repaymentId: string;
  receiptNumber: string;
  onDeleted: () => void | Promise<void>;
  compact?: boolean;
};

/** Super-admin-only control — parent must not render for other roles. */
export function DeleteCollectionButton({
  repaymentId,
  receiptNumber,
  onDeleted,
  compact,
}: Props) {
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (
      !window.confirm(
        `Delete collection ${receiptNumber}? The customer balance will be adjusted.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api(`/repayments/${repaymentId}`, { method: 'DELETE' });
      await onDeleted();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not delete collection');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void remove()}
      className={
        compact
          ? 'rounded-lg border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60'
          : 'rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-60'
      }
      aria-label={`Delete ${receiptNumber}`}
    >
      {busy ? '…' : 'Delete'}
    </button>
  );
}
