import {
  Controller,
  Get,
  NotFoundException,
  Param,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Throttle } from '@nestjs/throttler';
import { basename } from 'path';
import { Response } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { assertSafeId } from '../common/safe-input';
import { StorageService } from '../storage/storage.service';

@Controller('documents')
export class DocumentsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  @Get(':id/file')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  async getFile(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const safeId = assertSafeId(String(id));
    const doc = await this.prisma.document.findUnique({
      where: { id: safeId },
    });
    if (!doc) throw new NotFoundException('Document not found');

    const stream = await this.storage.openStream(doc.storageKey);

    await this.audit.log({
      userId: user.id,
      action: 'DOCUMENT_ACCESS',
      recordType: 'document',
      recordId: doc.id,
    });

    res.set({
      'Content-Type': doc.mimeType || 'application/octet-stream',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    });

    return new StreamableFile(stream);
  }

  @Get('by-storage/:key')
  @Throttle({ default: { limit: 120, ttl: 60_000 } })
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  async getByStorageKey(
    @Param('key') key: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true }) res: Response,
  ) {
    const safeKey = basename(String(key));
    const owned =
      (await this.prisma.document.findFirst({
        where: { storageKey: safeKey },
        select: { id: true, mimeType: true },
      })) ||
      (await this.prisma.galleryItem.findFirst({
        where: { storageKey: safeKey },
        select: { id: true, mimeType: true },
      }));
    if (!owned) {
      throw new NotFoundException('Document not found');
    }

    const stream = await this.storage.openStream(safeKey);

    await this.audit.log({
      userId: user.id,
      action: 'DOCUMENT_ACCESS',
      recordType: 'document',
      recordId: owned.id,
    });

    res.set({
      'Content-Type': owned.mimeType || 'image/jpeg',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store, no-cache, must-revalidate',
      Pragma: 'no-cache',
      'X-Content-Type-Options': 'nosniff',
      'X-Robots-Tag': 'noindex, nofollow, noarchive',
    });

    return new StreamableFile(stream);
  }
}
