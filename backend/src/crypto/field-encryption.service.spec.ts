import { createCipheriv, randomBytes } from 'crypto';

/**
 * Lightweight mirror of FieldEncryptionService for unit tests
 * without Nest DI bootstrap.
 */
function encrypt(plaintext: string, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
}

function decrypt(payload: string, key: Buffer) {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  const { createDecipheriv } = require('crypto');
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivB64, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

describe('field encryption format', () => {
  const key = Buffer.alloc(32, 7);

  it('round-trips passport-like values', () => {
    const payload = encrypt('P1234567', key);
    expect(decrypt(payload, key)).toBe('P1234567');
  });

  it('produces iv.tag.ciphertext structure', () => {
    const parts = encrypt('123456789012', key).split('.');
    expect(parts).toHaveLength(3);
  });
});
