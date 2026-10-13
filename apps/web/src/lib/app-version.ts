import { APP_VERSION } from '@/lib/app-branding';

export const APP_VERSION_STORAGE_KEY = 'nvr_app_version';

export function cmpVersion(a: string, b: string): number {
  const pa = String(a || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0').split('.').map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Version this device is actually running. The built bundle wins over localStorage
 * when storage was incorrectly set to the server version without applying an update.
 */
export function getInstalledAppVersion(): string {
  if (typeof window === 'undefined') return APP_VERSION;
  const stored = localStorage.getItem(APP_VERSION_STORAGE_KEY);
  if (!stored) return APP_VERSION;
  if (cmpVersion(stored, APP_VERSION) > 0) return APP_VERSION;
  return stored;
}

export function persistInstalledAppVersion(version: string): void {
  localStorage.setItem(APP_VERSION_STORAGE_KEY, version);
}
