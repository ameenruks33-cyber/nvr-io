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
import { AuthUser } from '../auth/decorators/current-user.decorator';

const SETTINGS_ID = 'default';

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
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
    if (!ok) throw new UnauthorizedException('Wrong gallery PIN');

    await this.audit.log({
      userId: actor.id,
      action: 'GALLERY_UNLOCK',
      recordType: 'gallery',
    });

    return {
      ok: true,
      unlockedAt: new Date().toISOString(),
      // Client stores unlock for this browser session
      unlockToken: Buffer.from(
        `${actor.id}:${Date.now()}:gallery`,
      ).toString('base64url'),
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
    const imageBytes =
      file.buffer.length <= maxDbBytes
        ? new Uint8Array(file.buffer)
        : undefined;

    const item = await this.prisma.galleryItem.create({
      data: {
        storageKey,
        imageBytes,
        mimeType: file.mimetype,
        caption: opts.caption?.trim() || null,
        note: opts.note?.trim() || null,
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
  list(status?: GalleryStatus, _user?: AuthUser) {
    const where: { status?: GalleryStatus } = {};
    if (status) where.status = status;

    return this.prisma.galleryItem.findMany({
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
    return item;
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
    return item;
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
        note: note?.trim() || existing.note,
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

    return item;
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
