import { BadRequestException, NotFoundException } from '@nestjs/common';
import { createReadStream, existsSync, ReadStream } from 'fs';
import { basename, isAbsolute, join, normalize, resolve, sep } from 'path';

/** Reject non-string / operator-injection style values from request params. */
export function assertSafeId(value: unknown, label = 'id'): string {
  if (typeof value !== 'string' || value.length < 8 || value.length > 64) {
    throw new BadRequestException(`Invalid ${label}`);
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
    throw new BadRequestException(`Invalid ${label}`);
  }
  return value;
}

export function resolveSafeUploadPath(storageKey: string): string {
  const key = basename(String(storageKey));
  if (!key || key !== storageKey || key.includes('..')) {
    throw new NotFoundException('File not found');
  }
  if (!/^[a-zA-Z0-9._-]+$/.test(key)) {
    throw new NotFoundException('File not found');
  }

  const root = resolve(
    process.env.STORAGE_LOCAL_PATH || join(process.cwd(), 'uploads'),
  );
  const fullPath = resolve(root, key);
  const normalizedRoot = normalize(root + sep);

  if (isAbsolute(storageKey) || !fullPath.startsWith(normalizedRoot)) {
    throw new NotFoundException('File not found');
  }
  if (!existsSync(fullPath)) {
    throw new NotFoundException('File missing');
  }
  return fullPath;
}

/** Open only paths already validated by resolveSafeUploadPath. */
export function openSafeUploadStream(storageKey: string): ReadStream {
  return createReadStream(resolveSafeUploadPath(storageKey));
}
