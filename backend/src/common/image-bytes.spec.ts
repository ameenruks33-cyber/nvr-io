import { BadRequestException } from '@nestjs/common';
import { assertImageBuffer } from './image-bytes';

describe('assertImageBuffer', () => {
  it('accepts JPEG magic bytes', () => {
    const buf = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 0, 0, 0, 0]);
    expect(assertImageBuffer(buf)).toBe('image/jpeg');
  });

  it('rejects non-image payloads', () => {
    expect(() => assertImageBuffer(Buffer.from('<?php'))).toThrow(
      BadRequestException,
    );
  });
});
