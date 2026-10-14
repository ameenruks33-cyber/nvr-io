'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Props = {
  customerId: string;
  customerCode: string;
  name: string;
  /** When true, confirm that collection history will be removed (Super Admin). */
  hasCollections: boolean;
  disabled?: boolean;
  disabledReason?: string;
  compact?: boolean;
};

export function DeleteCustomerButton({
  customerId,
  customerCode,
  name,
  hasCollections,
  disabled,
  disabledReason,
  compact,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    if (disabled) {
      if (disabledReason) window.alert(disabledReason);
      return;
    }
    const extra = hasCollections
      ? ' All collection history for this person will be removed.'
      : '';
    if (
      !window.confirm(
        `Delete ${name} (${customerCode}) from the app?${extra} This cannot be undone.`,
      )
    ) {
      return;
    }
    setBusy(true);
    try {
      await api(`/customers/${customerId}`, { method: 'DELETE' });
      router.push('/customers');
      router.refresh();
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Could not delete person');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy || disabled}
      title={disabled ? disabledReason : undefined}
      onClick={() => void remove()}
      className={
        compact
          ? 'w-full rounded-lg border-2 border-red-300 bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:border-red-100 disabled:text-red-400'
          : 'rounded-lg border-2 border-red-300 bg-white px-3 py-1.5 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-50 disabled:cursor-not-allowed disabled:border-red-100 disabled:text-red-400'
      }
    >
      {busy ? 'Deleting…' : 'Delete'}
    </button>
  );
}
