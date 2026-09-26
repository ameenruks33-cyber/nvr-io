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
    this.localRoot =
      this.config.get('STORAGE_LOCAL_PATH') || join(process.cwd(), 'uploads');

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
  ): Promise<string> {
    const key = `${randomUUID()}${ext.startsWith('.') ? ext : `.${ext}`}`;
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
