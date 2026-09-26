'use client';

/**
 * Updates are for the mobile app (installed PWA / phone), not the desktop website.
 */
export function isMobileAppSurface(): boolean {
  if (typeof window === 'undefined') return false;

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

  if (standalone) return true;

  const ua = navigator.userAgent || '';
  const mobileUa =
    /Android|iPhone|iPad|iPod|Mobile|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
      ua,
    );

  // Flutter / WebView shells often include Mobile in UA
  if (mobileUa) return true;

  return false;
}

export function isDesktopWebsite(): boolean {
  return !isMobileAppSurface();
}

/** Close all NVR update notifications from the system tray / notification bar. */
export async function clearUpdateNotifications(version?: string) {
  try {
    if (!('serviceWorker' in navigator)) return;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg?.getNotifications) return;

    const all = await reg.getNotifications();
    for (const n of all) {
      const tag = String(n.tag || '');
      if (tag.startsWith('nvr-update-')) {
        n.close();
      }
    }

    if (version) {
      const tagged = await reg.getNotifications({
        tag: `nvr-update-${version}`,
      });
      tagged.forEach((n) => n.close());
    }
  } catch {
    /* ignore */
  }
}
