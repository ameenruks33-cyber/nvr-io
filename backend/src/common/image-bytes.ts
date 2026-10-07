import { BadRequestException } from '@nestjs/common';

/** Reject disguised malware uploads — MIME types alone are not trustworthy. */
export function assertImageBuffer(buf: Buffer): 'image/jpeg' | 'image/png' | 'image/webp' {
  if (!buf || buf.length < 12) {
    throw new BadRequestException('File is not a valid image');
  }
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf[0] === 0x89 &&
    buf[1] === 0x50 &&
    buf[2] === 0x4e &&
    buf[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return 'image/webp';
  }
  throw new BadRequestException('Only JPG, PNG or WebP image data is allowed');
}
