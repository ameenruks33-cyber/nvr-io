import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createReadStream, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { basename } from 'path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';
import { resolveSafeUploadPath } from '../common/safe-input';

@Injectable()
export class StorageService implements OnModuleInit {
  private driver: 'local' | 'r2' = 'local';
  private s3?: S3Client;
  private bucket = '';
  private localRoot = '';

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const driver = (this.config.get('STORAGE_DRIVER') || 'local').toLowerCase();
    this.driver = driver === 'r2' || driver === 's3' ? 'r2' : 'local';
    const configuredPath = this.config.get<string>('STORAGE_LOCAL_PATH');
    const onServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
    this.localRoot =
      configuredPath ||
      (onServerless ? join('/tmp', 'nvr-io-uploads') : join(process.cwd(), 'uploads'));

    if (this.driver === 'r2') {
      const accountId = this.config.getOrThrow<string>('R2_ACCOUNT_ID');
      const endpoint =
        this.config.get('R2_ENDPOINT') ||
        `https://${accountId}.r2.cloudflarestorage.com`;
      this.bucket = this.config.getOrThrow<string>('R2_BUCKET');
      this.s3 = new S3Client({
        region: 'auto',
        endpoint,
        credentials: {
          accessKeyId: this.config.getOrThrow('R2_ACCESS_KEY_ID'),
          secretAccessKey: this.config.getOrThrow('R2_SECRET_ACCESS_KEY'),
        },
      });
    } else if (!existsSync(this.localRoot)) {
      mkdirSync(this.localRoot, { recursive: true });
    }
  }

  async saveImage(
    buffer: Buffer,
    mimeType: string,
    ext = '.jpg',
    namespace = 'nvr',
  ): Promise<string> {
    const safeNs = String(namespace || 'nvr').replace(/[^a-zA-Z0-9_-]/g, '');
    const safeExt = ext.startsWith('.') ? ext : `.${ext}`;
    const key = `${safeNs}-${randomUUID()}${safeExt}`;
    if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
      throw new Error('Invalid generated storage key');
    }

    if (this.driver === 'r2' && this.s3) {
      await this.s3.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: buffer,
          ContentType: mimeType,
          // Private object metadata — cloud gallery only
          Metadata: {
            'nvr-scope': 'cloud-gallery',
            'nvr-device-sync': 'false',
          },
        }),
      );
      return key;
    }

    const dest = join(this.localRoot, key);
    if (!dest.startsWith(this.localRoot)) {
      throw new Error('Invalid storage path');
    }
    writeFileSync(dest, buffer);
    return key;
  }

  async openStream(storageKey: string): Promise<Readable> {
    const key = basename(String(storageKey));
    if (!key || key.includes('..') || !/^[a-zA-Z0-9._-]+$/.test(key)) {
      throw new Error('Invalid storage key');
    }

    if (this.driver === 'r2' && this.s3) {
      const out = await this.s3.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      if (!out.Body) throw new Error('Empty R2 object');
      return out.Body as Readable;
    }

    const path = resolveSafeUploadPath(key);
    return createReadStream(path);
  }

  isRemote() {
    return this.driver === 'r2';
  }
}
