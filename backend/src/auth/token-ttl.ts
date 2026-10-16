/** Session / gallery tokens stay valid forever unless a finite TTL is set. */

const UNLIMITED = new Set(['', 'unlimited', 'never', '0', 'none', 'false']);

export const UNLIMITED_REFRESH_EXPIRES_AT = new Date('9999-12-31T23:59:59.000Z');
export const UNLIMITED_UNIX_SEC = Math.floor(
  UNLIMITED_REFRESH_EXPIRES_AT.getTime() / 1000,
);

const UNIT_MS: Record<string, number> = {
  ms: 1,
  s: 1000,
  m: 60_000,
  h: 3_600_000,
  d: 86_400_000,
  y: 365.25 * 86_400_000,
};

export function parseTtlMs(raw: string | undefined | null): number | null {
  const v = String(raw ?? 'unlimited').trim().toLowerCase();
  if (UNLIMITED.has(v)) return null;
  const m = v.match(/^(\d+(?:\.\d+)?)(ms|s|m|h|d|y)?$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = m[2] || 's';
  const ms = n * UNIT_MS[unit];
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

export function jwtExpiresIn(raw: string | undefined | null): number | undefined {
  const ms = parseTtlMs(raw);
  if (ms == null) return undefined;
  return Math.max(1, Math.round(ms / 1000));
}

export function refreshExpiresAt(raw: string | undefined | null): Date {
  const ms = parseTtlMs(raw);
  if (ms == null) return UNLIMITED_REFRESH_EXPIRES_AT;
  return new Date(Date.now() + ms);
}

export function unixExpirySec(raw: string | undefined | null): number {
  const ms = parseTtlMs(raw);
  if (ms == null) return UNLIMITED_UNIX_SEC;
  return Math.floor((Date.now() + ms) / 1000);
}

export function expiresInSeconds(raw: string | undefined | null): number {
  const ms = parseTtlMs(raw);
  if (ms == null) return 0;
  return Math.max(1, Math.round(ms / 1000));
}
