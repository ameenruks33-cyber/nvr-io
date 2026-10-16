'use client';

import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useLiveRefresh } from '@/lib/live-sync';
import {
  TodayPendingNotice,
  type PendingTodayItem,
} from '@/components/TodayPendingNotice';

type PendingToday = {
  date: string;
  items: PendingTodayItem[];
};

/** Pending daily collections for every open account (Home, Collection, People, Records). */
export function PendingTodayBanner() {
  const [pending, setPending] = useState<PendingToday | null>(null);

  const load = () => {
    api<PendingToday>('/collections/pending-today')
      .then(setPending)
      .catch(() => setPending(null));
  };

  useEffect(load, []);
  useLiveRefresh(load);

  if (!pending?.items.length) return null;
  return <TodayPendingNotice date={pending.date} items={pending.items} />;
}
