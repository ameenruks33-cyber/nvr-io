import {
  expiresInSeconds,
  jwtExpiresIn,
  parseTtlMs,
  refreshExpiresAt,
  UNLIMITED_REFRESH_EXPIRES_AT,
} from './token-ttl';

describe('token TTL', () => {
  it('treats missing and unlimited values as never expiring', () => {
    expect(parseTtlMs(undefined)).toBeNull();
    expect(parseTtlMs('unlimited')).toBeNull();
    expect(parseTtlMs('never')).toBeNull();
    expect(jwtExpiresIn('unlimited')).toBeUndefined();
    expect(refreshExpiresAt('unlimited')).toEqual(UNLIMITED_REFRESH_EXPIRES_AT);
    expect(expiresInSeconds('unlimited')).toBe(0);
  });

  it('still parses finite durations when set', () => {
    expect(parseTtlMs('15m')).toBe(15 * 60 * 1000);
    expect(parseTtlMs('7d')).toBe(7 * 86_400_000);
    expect(jwtExpiresIn('15m')).toBe(900);
  });
});
