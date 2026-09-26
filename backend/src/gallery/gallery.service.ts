import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { GalleryStatus, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { StorageService } from '../storage/storage.service';
import { AuthUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class GalleryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
  ) {}

  async upload(
    file: Express.Multer.File,
    user: AuthUser,
    opts: { caption?: string; note?: string; customerId?: string },
  ) {
    if (!file?.buffer) {
      throw new BadRequestException('Image file is required');
    }
    if (!file.mimetype?.startsWith('image/')) {
      throw new BadRequestException('Only images are allowed in the secret gallery');
    }

    const ext =
      file.originalname?.includes('.')
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
    );

    const item = await this.prisma.galleryItem.create({
      data: {
        storageKey,
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

    await this.audit.log({
      userId: user.id,
      action: 'GALLERY_UPLOAD',
      recordType: 'gallery',
      recordId: item.id,
    });

    return item;
  }

  list(status?: GalleryStatus, user?: AuthUser) {
    const where: { status?: GalleryStatus; uploadedById?: string } = {};
    if (status) where.status = status;

    // Collectors see their uploads; admins see all
    if (
      user &&
      user.role === UserRole.COLLECTOR
    ) {
      where.uploadedById = user.id;
    }

    return this.prisma.galleryItem.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
        customer: { select: { id: true, name: true, customerCode: true } },
      },
    });
  }

  async getOne(id: string) {
    const item = await this.prisma.galleryItem.findUnique({
      where: { id },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
        customer: { select: { id: true, name: true, customerCode: true } },
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

    const existing = await this.prisma.galleryItem.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Gallery item not found');

    const item = await this.prisma.galleryItem.update({
      where: { id },
      data: {
        status,
        verifiedById: actor.id,
        verifiedAt: new Date(),
        note: note?.trim() || existing.note,
      },
      include: {
        uploadedBy: { select: { id: true, name: true, email: true } },
        verifiedBy: { select: { id: true, name: true, email: true } },
      },
    });

    await this.audit.log({
      userId: actor.id,
      action: status === GalleryStatus.VERIFIED ? 'GALLERY_VERIFY' : 'GALLERY_REJECT',
      recordType: 'gallery',
      recordId: id,
    });

    return item;
  }
}
