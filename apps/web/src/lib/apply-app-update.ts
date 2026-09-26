'use client';

import type { AppUpdateInfo } from '@/components/UpdateNotifier';

const STORAGE_KEY = 'nvr_app_version';

type UpdateIcons = {
  favicon?: string;
  icon192?: string;
  icon512?: string;
  apple?: string;
  logo?: string;
};

export type AppUpdatePayload = AppUpdateInfo & {
  iconsUpdated?: boolean;
  icons?: UpdateIcons;
};

function safePath(url?: string) {
  if (!url || typeof url !== 'string') return '';
  if (!url.startsWith('/') || url.startsWith('//') || url.includes('\\')) {
    return '';
  }
  return url;
}

/** Hard-refresh icons + caches so installed devices pick up the new app icon. */
export async function applyAppUpdate(
  info: AppUpdatePayload,
  nextPath = '/updates?updated=1',
) {
  const iconUrls = [
    safePath(info.icons?.favicon),
    safePath(info.icons?.icon192),
    safePath(info.icons?.icon512),
    safePath(info.icons?.apple),
    safePath(info.icons?.logo),
    `/icon-192.png?v=${info.version}`,
    `/icon-512.png?v=${info.version}`,
    `/apple-touch-icon.png?v=${info.version}`,
    `/favicon.png?v=${info.version}`,
    `/logo.jpg?v=${info.version}`,
    `/manifest.webmanifest?v=${info.version}`,
    `/sw.js?v=${info.version}`,
  ].filter(Boolean);

  await Promise.all(
    iconUrls.map((u) =>
      fetch(`${u}${u.includes('?') ? '&' : '?'}cb=${Date.now()}`, {
        cache: 'reload',
      }).catch(() => undefined),
    ),
  );

  // Swap document icons immediately (browser tab / some launchers)
  const head = document.head;
  head
    .querySelectorAll('link[rel="icon"], link[rel="apple-touch-icon"]')
    .forEach((n) => n.remove());
  if (info.icons?.favicon) {
    const link = document.createElement('link');
    link.rel = 'icon';
    link.href = `${info.icons.favicon}?v=${info.version}`;
    link.type = 'image/png';
    head.appendChild(link);
  }
  if (info.icons?.apple) {
    const link = document.createElement('link');
    link.rel = 'apple-touch-icon';
    link.href = `${info.icons.apple}?v=${info.version}`;
    head.appendChild(link);
  }

  if ('serviceWorker' in navigator) {
    const regs = await navigator.serviceWorker.getRegistrations();
    await Promise.all(
      regs.map(async (reg) => {
        reg.active?.postMessage({
          type: 'ACK_UPDATE',
          version: info.version,
        });
        reg.waiting?.postMessage({ type: 'SKIP_WAITING' });
        await reg.unregister();
      }),
    );
  }

  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((k) => caches.delete(k)));
  }

  localStorage.setItem(STORAGE_KEY, info.version);
  if (info.iconsUpdated) {
    sessionStorage.setItem('nvr_icon_updated', info.version);
  }

  const target = nextPath.startsWith('/') ? nextPath : '/updates?updated=1';
  window.location.replace(`${target}${target.includes('?') ? '&' : '?'}v=${info.version}`);
}
