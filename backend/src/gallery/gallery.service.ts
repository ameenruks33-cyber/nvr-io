import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { GalleryStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { assertImageBuffer } from '../common/image-bytes';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { GalleryUnlockService } from './gallery-unlock.service';

const SETTINGS_ID = 'default';

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly crypto: FieldEncryptionService,
    private readonly galleryUnlock: GalleryUnlockService,
  ) {}

  private async getSettings() {
    return this.prisma.appSetting.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID },
      update: {},
    });
  }

  async pinStatus() {
    try {
      const s = await this.getSettings();
      return {
        pinSet: Boolean(s.galleryPinHash),
      };
    } catch {
      return { pinSet: false };
    }
  }

  async setPin(pin: string, actor: AuthUser) {
    if (actor.role !== UserRole.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can set the gallery PIN');
    }
    const digits = String(pin || '').trim();
    if (!/^\d{4,8}$/.test(digits)) {
      throw new BadRequestException('PIN must be 4–8 digits');
    }
    const galleryPinHash = await argon2.hash(digits, {
      type: argon2.argon2id,
    });
    await this.prisma.appSetting.upsert({
      where: { id: SETTINGS_ID },
      create: { id: SETTINGS_ID, galleryPinHash },
      update: { galleryPinHash },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'GALLERY_PIN_SET',
      recordType: 'gallery',
    });
    return { ok: true, pinSet: true };
  }

  async unlock(pin: string, actor: AuthUser) {
    const s = await this.getSettings();
    if (!s.galleryPinHash) {
      throw new BadRequestException(
        'Gallery PIN is not set yet. Ask the super admin to set a number password.',
      );
    }
    const digits = String(pin || '').trim();
    if (!/^\d{4,8}$/.test(digits)) {
      throw new UnauthorizedException('Invalid PIN');
    }
    const ok = await argon2.verify(s.galleryPinHash, digits);
    if (!ok) {
      await this.audit.log({
        userId: actor.id,
        action: 'GALLERY_UNLOCK_FAILED',
        recordType: 'gallery',
      });
      throw new UnauthorizedException('Wrong gallery PIN');
    }

    await this.audit.log({
      userId: actor.id,
      action: 'GALLERY_UNLOCK',
      recordType: 'gallery',
    });

    return {
      ok: true,
      unlockedAt: new Date().toISOString(),
      unlockToken: this.galleryUnlock.issueToken(actor.id),
      expiresInSeconds: 8 * 60 * 60,
    };
  }

  async upload(
    file: Express.Multer.File,
    user: AuthUser,
    opts: { caption?: string; note?: string; customerId?: string },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Image file is required');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException(
        'Only images are allowed in the cloud gallery',
      );
    }
    assertImageBuffer(file.buffer);

    const ext = file.originalname?.includes('.')
      ? `.${file.originalname.split('.').pop()?.toLowerCase()}`
      : '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp', '.heic'].includes(ext)
      ? ext === '.jpeg'
        ? '.jpg'
        : ext
      : '.jpg';

    const storageKey = await this.storage.saveImage(
      file.buffer,
      file.mimetype,
      safeExt,
      'nvr-gallery',
    );

    const maxDbBytes = 4 * 1024 * 1024;
    // Store ciphertext in Neon — even a DB dump cannot open the photo.
    const sealed =
      file.buffer.length <= maxDbBytes
        ? new Uint8Array(this.crypto.encryptBytes(file.buffer))
        : undefined;

    const item = await this.prisma.galleryItem.create({
      data: {
        storageKey,
        imageBytes: sealed,
        mimeType: file.mimetype,
        caption: this.crypto.encryptOptional(opts.caption),
        note: this.crypto.encryptOptional(opts.note),
        customerId: opts.customerId || null,
        uploadedById: user.id,
        status: GalleryStatus.PENDING,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
      },
    });

    // Never return raw bytes to API clients
    const { imageBytes: _omit, ...safe } = item;
    void _omit;
    Object.assign(safe, {
      caption: this.crypto.decryptLoose(safe.caption),
      note: this.crypto.decryptLoose(safe.note),
    });

    await this.audit.log({
      userId: user.id,
      action: 'GALLERY_UPLOAD',
      recordType: 'gallery',
      recordId: item.id,
    });

    // Notify shared cloud feed (admin + users see in Notes)
    await this.prisma.notification.create({
      data: {
        type: 'SYSTEM',
        message: `Cloud gallery: ${user.name} uploaded a photo${
          item.caption ? ` — ${item.caption}` : ''
        }. Waiting for verification.`,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return safe;
  }

  /** Shared cloud gallery — all staff can read; filter by status for verification. */
  async list(status?: GalleryStatus, _user?: AuthUser) {
    const where: { status?: GalleryStatus } = {};
    if (status) where.status = status;

    const rows = await this.prisma.galleryItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        storageKey: true,
        mimeType: true,
        caption: true,
        note: true,
        status: true,
        uploadedById: true,
        verifiedById: true,
        verifiedAt: true,
        customerId: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
        customer: { select: { id: true, name: true, customerCode: true } },
      },
    });
    return rows.map((row) => this.revealTextFields(row));
  }

  async getOne(id: string) {
    const item = await this.prisma.galleryItem.findUnique({
      where: { id },
      select: {
        id: true,
        storageKey: true,
        mimeType: true,
        caption: true,
        note: true,
        status: true,
        uploadedById: true,
        verifiedById: true,
        verifiedAt: true,
        customerId: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
        customer: { select: { id: true, name: true, customerCode: true } },
      },
    });
    if (!item) throw new NotFoundException('Gallery item not found');
    return this.revealTextFields(item);
  }

  async getFilePayload(id: string) {
    const item = await this.prisma.galleryItem.findUnique({
      where: { id },
      select: {
        id: true,
        storageKey: true,
        mimeType: true,
        imageBytes: true,
      },
    });
    if (!item) throw new NotFoundException('Gallery item not found');

    if (item.imageBytes && item.imageBytes.length > 0) {
      const stored = Buffer.from(item.imageBytes);
      const plain = this.crypto.decryptBytes(stored);
      if (!this.crypto.isEncryptedBytes(stored)) {
        void this.prisma.galleryItem
          .update({
            where: { id },
            data: { imageBytes: new Uint8Array(this.crypto.encryptBytes(plain)) },
          })
          .catch(() => undefined);
      }
      return { ...item, imageBytes: plain };
    }
    return item;
  }

  private revealTextFields<T extends { caption?: string | null; note?: string | null }>(
    row: T,
  ): T {
    return {
      ...row,
      caption: this.crypto.decryptLoose(row.caption ?? null),
      note: this.crypto.decryptLoose(row.note ?? null),
    };
  }

  async setStatus(
    id: string,
    status: GalleryStatus,
    actor: AuthUser,
    note?: string,
  ) {
    if (status === GalleryStatus.PENDING) {
      throw new BadRequestException('Cannot set status back to PENDING');
    }

    const existing = await this.prisma.galleryItem.findUnique({
      where: { id },
    });
    if (!existing) throw new NotFoundException('Gallery item not found');

    const item = await this.prisma.galleryItem.update({
      where: { id },
      data: {
        status,
        verifiedById: actor.id,
        verifiedAt: new Date(),
        note: note?.trim()
          ? this.crypto.encryptOptional(note)
          : existing.note,
      },
      select: {
        id: true,
        storageKey: true,
        mimeType: true,
        caption: true,
        note: true,
        status: true,
        uploadedById: true,
        verifiedById: true,
        verifiedAt: true,
        customerId: true,
        createdAt: true,
        updatedAt: true,
        uploadedBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.audit.log({
      userId: actor.id,
      action:
        status === GalleryStatus.VERIFIED ? 'GALLERY_VERIFY' : 'GALLERY_REJECT',
      recordType: 'gallery',
      recordId: id,
    });

    await this.prisma.notification.create({
      data: {
        type: 'SYSTEM',
        message: `Cloud gallery photo ${
          status === GalleryStatus.VERIFIED ? 'verified' : 'rejected'
        } by ${actor.name}.`,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return this.revealTextFields(item);
  }

  async remove(id: string, actor: AuthUser) {
    const existing = await this.prisma.galleryItem.findUnique({
      where: { id },
      select: { id: true, storageKey: true, caption: true },
    });
    if (!existing) throw new NotFoundException('Gallery item not found');

    await this.prisma.galleryItem.delete({ where: { id } });

    await this.audit.log({
      userId: actor.id,
      action: 'GALLERY_DELETE',
      recordType: 'gallery',
      recordId: id,
      metadata: { storageKey: existing.storageKey, caption: existing.caption },
    });

    await this.prisma.notification.create({
      data: {
        type: 'SYSTEM',
        message: `Cloud gallery photo deleted by ${actor.name}${
          existing.caption ? ` — ${existing.caption}` : ''
        }.`,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    return { ok: true, id };
  }
}
