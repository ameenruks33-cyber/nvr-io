'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';

type Props = {
  customerId: string;
  customerCode: string;
  name: string;
  /** When true, warn that collections will be removed (Super Admin). */
  hasCollections: boolean;
};

export function DeleteCustomerButton({
  customerId,
  customerCode,
  name,
  hasCollections,
}: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function remove() {
    const extra = hasCollections
      ? ' All collection history for this person will be removed.'
      : '';
    if (
      !window.confirm(
        `Remove ${name} (${customerCode}) from the app?${extra} This cannot be undone.`,
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
      window.alert(e instanceof Error ? e.message : 'Could not remove person');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => void remove()}
      className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60"
    >
      {busy ? 'Removing…' : 'Remove person'}
    </button>
  );
}
