import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const BINARY_MAGIC = Buffer.from('NVRE1'); // Nest encrypted blob v1

/**
 * AES-256-GCM encryption for sensitive fields and image bytes at rest.
 * String payload: base64(iv).base64(authTag).base64(ciphertext)
 * Binary payload: magic(5) + iv(12) + tag(16) + ciphertext
 */
@Injectable()
export class FieldEncryptionService implements OnModuleInit {
  private key!: Buffer;

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const raw = this.config.get<string>('FIELD_ENCRYPTION_KEY');
    if (!raw) {
      throw new Error('FIELD_ENCRYPTION_KEY is required');
    }
    const key = Buffer.from(raw, 'base64');
    if (key.length !== 32) {
      throw new Error('FIELD_ENCRYPTION_KEY must decode to 32 bytes (AES-256)');
    }
    this.key = key;
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('base64')}.${tag.toString('base64')}.${encrypted.toString('base64')}`;
  }

  decrypt(payload: string): string {
    const [ivB64, tagB64, dataB64] = payload.split('.');
    if (!ivB64 || !tagB64 || !dataB64) {
      throw new Error('Invalid encrypted payload');
    }
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.key,
      Buffer.from(ivB64, 'base64'),
    );
    decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, 'base64')),
      decipher.final(),
    ]);
    return decrypted.toString('utf8');
  }

  /** Encrypt optional text; blank becomes null. Legacy plaintext still decrypts via decryptLoose. */
  encryptOptional(value?: string | null): string | null {
    const trimmed = value?.trim();
    if (!trimmed) return null;
    return this.encrypt(trimmed);
  }

  /** Decrypt when possible; if the value is still legacy plaintext, return it as-is. */
  decryptLoose(value?: string | null): string | null {
    if (value == null || value === '') return value ?? null;
    try {
      return this.decrypt(value);
    } catch {
      return value;
    }
  }

  /** AES-GCM wrap for photo / gallery bytes stored in Postgres. */
  encryptBytes(plain: Buffer | Uint8Array): Buffer {
    const input = Buffer.isBuffer(plain) ? plain : Buffer.from(plain);
    if (this.isEncryptedBytes(input)) return input;
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key, iv);
    const encrypted = Buffer.concat([cipher.update(input), cipher.final()]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([BINARY_MAGIC, iv, tag, encrypted]);
  }

  /**
   * Unwrap encrypted bytes. Plain legacy rows (no magic header) pass through unchanged
   * so old photos keep working until they are rewritten.
   */
  decryptBytes(payload: Buffer | Uint8Array): Buffer {
    const input = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    if (!this.isEncryptedBytes(input)) return input;
    const iv = input.subarray(5, 17);
    const tag = input.subarray(17, 33);
    const data = input.subarray(33);
    const decipher = createDecipheriv('aes-256-gcm', this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]);
  }

  isEncryptedBytes(payload: Buffer | Uint8Array): boolean {
    const input = Buffer.isBuffer(payload) ? payload : Buffer.from(payload);
    return (
      input.length >= 5 + 12 + 16 &&
      input.subarray(0, 5).equals(BINARY_MAGIC)
    );
  }

  /** Mask for list views — never return full identity numbers in search. */
  maskIdentity(value: string): string {
    if (value.length <= 4) return '****';
    return `${'*'.repeat(Math.max(value.length - 4, 4))}${value.slice(-4)}`;
  }
}
