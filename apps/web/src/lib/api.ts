import { wipeLocalTraces } from './privacy';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

/** Production website must never call a cleartext API. */
function assertSecureTransport() {
  if (
    typeof window !== 'undefined' &&
    window.location.protocol === 'https:' &&
    API_URL.startsWith('http://')
  ) {
    throw new Error('Blocked insecure API URL over HTTPS');
  }
}

export type AuthSession = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
};

const SESSION_KEY = 'nvr_session';
/** Short-lived server token after gallery PIN unlock (session only). */
export const GALLERY_UNLOCK_KEY = 'nvr_gallery_unlock_token';

function attachGalleryUnlockHeader(path: string, headers: Headers) {
  if (typeof window === 'undefined') return;
  if (!path.startsWith('/gallery')) return;
  if (
    path.startsWith('/gallery/unlock') ||
    path.startsWith('/gallery/pin') ||
    path.startsWith('/gallery/pin-status')
  ) {
    return;
  }
  const token = sessionStorage.getItem(GALLERY_UNLOCK_KEY);
  if (token) headers.set('X-Gallery-Unlock', token);
}

function storage(): Storage | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage;
}

export function getSession(): AuthSession | null {
  const store = storage();
  if (!store) return null;
  const raw = store.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function setSession(session: AuthSession) {
  storage()?.setItem(SESSION_KEY, JSON.stringify(session));
}

export function clearSession() {
  storage()?.removeItem(SESSION_KEY);
  wipeLocalTraces();
}

export async function api<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const res = await authFetch(path, options, headers);

  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    const message = Array.isArray(err.message)
      ? err.message.join(', ')
      : err.message || 'Request failed';
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Authenticated file download (photos) with the same token refresh as `api`. */
export async function apiBlob(path: string): Promise<Blob> {
  let res = await authFetch(path, {}, new Headers());
  if (res.status === 429 || res.status >= 500) {
    await new Promise((r) => setTimeout(r, 800 + Math.random() * 1200));
    res = await authFetch(path, {}, new Headers());
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: res.statusText }));
    throw new Error(err.message || `Load failed (${res.status})`);
  }
  return res.blob();
}

async function authFetch(
  path: string,
  options: RequestInit & { auth?: boolean },
  headers: Headers,
): Promise<Response> {
  assertSecureTransport();
  let usedToken = '';
  if (options.auth !== false) {
    const session = getSession();
    if (session?.accessToken) {
      usedToken = session.accessToken;
      headers.set('Authorization', `Bearer ${session.accessToken}`);
    }
  }
  attachGalleryUnlockHeader(path, headers);

  let res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && options.auth !== false && usedToken) {
    const refreshed = await refreshOnce(usedToken);
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    } else if (
      typeof window !== 'undefined' &&
      !getSession() &&
      !path.startsWith('/auth/')
    ) {
      window.location.replace('/login');
    }
  }

  return res;
}

let refreshing: Promise<AuthSession | null> | null = null;

/**
 * Refresh tokens are single-use, so parallel 401s must share one refresh call;
 * a second call with the same token would be rejected and sign the user out.
 */
function refreshOnce(usedToken: string): Promise<AuthSession | null> {
  const current = getSession();
  if (current && current.accessToken !== usedToken) {
    return Promise.resolve(current);
  }
  if (!refreshing) {
    refreshing = tryRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function tryRefresh(): Promise<AuthSession | null> {
  const session = getSession();
  if (!session?.refreshToken) return null;
  try {
    const data = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: session.refreshToken }),
    }).then((r) => (r.ok ? r.json() : null));
    if (!data) {
      // Another tab may have rotated the token already.
      const latest = getSession();
      if (latest && latest.refreshToken !== session.refreshToken) return latest;
      clearSession();
      return null;
    }
    const next = {
      ...session,
      accessToken: data.accessToken,
      refreshToken: data.refreshToken,
    };
    setSession(next);
    return next;
  } catch {
    // Network error: keep the session so the next attempt can retry.
    return null;
  }
}

export function money(n: number | string) {
  const value = typeof n === 'string' ? Number(n) : n;
  return `AED ${value.toLocaleString('en-AE', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })}`;
}
