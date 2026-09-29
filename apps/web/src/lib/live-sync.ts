'use client';

import { useEffect, useRef } from 'react';
import { api, getSession } from './api';

const EVENT = 'nvr:data-changed';
const POLL_MS = 15_000;

let lastStamp: string | null = null;
let started = false;
let checking = false;

async function checkNow() {
  if (checking || !getSession() || document.visibilityState !== 'visible') return;
  checking = true;
  try {
    const { stamp } = await api<{ stamp: string }>('/sync/stamp');
    if (lastStamp !== null && stamp !== lastStamp) {
      window.dispatchEvent(new Event(EVENT));
    }
    lastStamp = stamp;
  } catch {
    /* offline or signed out */
  } finally {
    checking = false;
  }
}

/** Watches the server for changes made on any device (website or mobile app). */
export function startLiveSync() {
  if (started || typeof window === 'undefined') return;
  started = true;
  void checkNow();
  window.setInterval(() => void checkNow(), POLL_MS);
  window.addEventListener('focus', () => void checkNow());
  window.addEventListener('online', () => void checkNow());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void checkNow();
  });
}

/** Re-runs `reload` whenever data changes on another device. */
export function useLiveRefresh(reload: () => void) {
  const ref = useRef(reload);
  ref.current = reload;
  useEffect(() => {
    const onChange = () => ref.current();
    window.addEventListener(EVENT, onChange);
    return () => window.removeEventListener(EVENT, onChange);
  }, []);
}
