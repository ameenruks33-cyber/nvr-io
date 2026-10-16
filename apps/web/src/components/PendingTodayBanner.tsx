'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import {
  COLLECTION_SAVED,
  type CollectionSavedDetail,
  useLiveRefresh,
} from '@/lib/live-sync';
import {
  TodayPendingNotice,
  type PendingTodayItem,
} from '@/components/TodayPendingNotice';

type PendingToday = {
  date: string;
  items: PendingTodayItem[];
};

function deductPayment(
  items: PendingTodayItem[],
  customerId: string,
  amount: number,
): PendingTodayItem[] {
  return items
    .map((row) => {
      if (row.customerId !== customerId) return row;
      const daily = row.dailyPayment || 100;
      const overdue = Math.max(0, (row.overdueAed ?? row.pendingTodayAed) - amount);
      const pendingToday = Math.max(0, row.pendingTodayAed - amount);
      if (overdue <= 0.001 && pendingToday <= 0.001) return null;
      return {
        ...row,
        overdueAed: overdue,
        pendingTodayAed: pendingToday,
        daysInArrears: Math.max(1, Math.ceil(overdue / daily - 1e-9)),
      };
    })
    .filter((row): row is PendingTodayItem => row != null);
}

/** Pending daily collections for every open account (Home, Collection, People, Records). */
export function PendingTodayBanner() {
  const [pending, setPending] = useState<PendingToday | null>(null);

  const load = () => {
    api<PendingToday>(`/collections/pending-today?t=${Date.now()}`)
      .then(setPending)
      .catch(() => setPending(null));
  };

  useEffect(load, []);
  useLiveRefresh(load);

  useEffect(() => {
    const onSaved = (event: Event) => {
      const detail = (event as CustomEvent<CollectionSavedDetail>).detail;
      if (!detail?.customerId || !(detail.amount > 0)) {
        load();
        return;
      }
      setPending((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: deductPayment(prev.items, detail.customerId, detail.amount),
        };
      });
      load();
    };
    window.addEventListener(COLLECTION_SAVED, onSaved);
    return () => window.removeEventListener(COLLECTION_SAVED, onSaved);
  }, []);

  if (!pending?.items.length) return null;
  return <TodayPendingNotice date={pending.date} items={pending.items} />;
}
