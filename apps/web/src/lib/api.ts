const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

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
}

export async function api<T>(
  path: string,
  options: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers = new Headers(options.headers || {});
  if (!(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.auth !== false) {
    const session = getSession();
    if (session?.accessToken) {
      headers.set('Authorization', `Bearer ${session.accessToken}`);
    }
  }

  let res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 401 && options.auth !== false) {
    const refreshed = await tryRefresh();
    if (refreshed) {
      headers.set('Authorization', `Bearer ${refreshed.accessToken}`);
      res = await fetch(`${API_URL}${path}`, { ...options, headers });
    }
  }

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
    clearSession();
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
