import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'default';
const MAX_LEN = 1000;

@Injectable()
export class CollectionsStickyService {
  constructor(private readonly prisma: PrismaService) {}

  async get() {
    const row = await this.prisma.appSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: { collectionsStickyNote: true, updatedAt: true },
    });
    return {
      text: row?.collectionsStickyNote?.trim() || '',
      updatedAt: row?.updatedAt?.toISOString() ?? null,
    };
  }

  async save(text: string) {
    const trimmed = text.trim();
    if (trimmed.length > MAX_LEN) {
      throw new BadRequestException(`Sticky note must be at most ${MAX_LEN} characters`);
    }
    const row = await this.prisma.appSetting.upsert({
      where: { id: SETTINGS_ID },
      create: {
        id: SETTINGS_ID,
        collectionsStickyNote: trimmed || null,
      },
      update: {
        collectionsStickyNote: trimmed || null,
      },
      select: { collectionsStickyNote: true, updatedAt: true },
    });
    return {
      text: row.collectionsStickyNote?.trim() || '',
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
