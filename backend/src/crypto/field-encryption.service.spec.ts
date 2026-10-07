import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const MAGIC = Buffer.from('NVRE1');

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

function encryptBytes(plain: Buffer, key: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, encrypted]);
}

function decryptBytes(payload: Buffer, key: Buffer) {
  if (!payload.subarray(0, 5).equals(MAGIC)) return payload;
  const iv = payload.subarray(5, 17);
  const tag = payload.subarray(17, 33);
  const data = payload.subarray(33);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]);
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

  it('round-trips binary photo payloads', () => {
    const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const sealed = encryptBytes(jpeg, key);
    expect(sealed.subarray(0, 5).equals(MAGIC)).toBe(true);
    expect(sealed.equals(jpeg)).toBe(false);
    expect(decryptBytes(sealed, key).equals(jpeg)).toBe(true);
  });

  it('passes legacy plaintext bytes through', () => {
    const legacy = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);
    expect(decryptBytes(legacy, key).equals(legacy)).toBe(true);
  });
});
