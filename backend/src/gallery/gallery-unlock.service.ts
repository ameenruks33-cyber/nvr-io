import {
  ForbiddenException,
  Injectable,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { PrismaService } from '../prisma/prisma.service';

const SETTINGS_ID = 'default';
const TOKEN_TTL_SEC = 8 * 60 * 60;

/**
 * When a gallery PIN is set, file/list/upload routes require a short-lived unlock
 * token so staff cannot bypass the PIN by calling the API directly.
 */
@Injectable()
export class GalleryUnlockService implements OnModuleInit {
  private secret!: string;

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit() {
    this.secret =
      this.config.get<string>('GALLERY_UNLOCK_SECRET') ||
      this.config.getOrThrow<string>('JWT_ACCESS_SECRET');
  }

  issueToken(userId: string): string {
    const exp = Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC;
    const payload = `${userId}.${exp}`;
    const sig = createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
    return `${payload}.${sig}`;
  }

  verifyToken(userId: string, token: string | undefined): boolean {
    if (!token?.trim()) return false;
    const parts = token.trim().split('.');
    if (parts.length !== 3) return false;
    const [uid, expStr, sig] = parts;
    if (uid !== userId) return false;
    const exp = Number(expStr);
    if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) {
      return false;
    }
    const payload = `${uid}.${expStr}`;
    const expected = createHmac('sha256', this.secret)
      .update(payload)
      .digest('base64url');
    try {
      const a = Buffer.from(sig);
      const b = Buffer.from(expected);
      return a.length === b.length && timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  async pinIsSet(): Promise<boolean> {
    const row = await this.prisma.appSetting.findUnique({
      where: { id: SETTINGS_ID },
      select: { galleryPinHash: true },
    });
    return Boolean(row?.galleryPinHash);
  }

  async assertUnlocked(user: AuthUser, unlockHeader?: string) {
    if (!(await this.pinIsSet())) return;
    if (!this.verifyToken(user.id, unlockHeader)) {
      throw new ForbiddenException(
        'Gallery is locked. Enter the gallery PIN on this device.',
      );
    }
  }
}
