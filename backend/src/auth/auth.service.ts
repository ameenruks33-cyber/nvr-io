import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { LoginDto } from './dto/auth.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  async login(dto: LoginDto, ip?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email.toLowerCase() },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await argon2.verify(user.passwordHash, dto.password);
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const tokens = await this.issueTokens(user.id, user.email, user.role);
    await this.audit.log({
      userId: user.id,
      action: 'LOGIN',
      recordType: 'user',
      recordId: user.id,
      ipAddress: ip,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: String(userId) },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid session');
    }
    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto, ip?: string) {
    const safeUserId = String(userId);
    if (!/^[a-zA-Z0-9_-]+$/.test(safeUserId)) {
      throw new UnauthorizedException('Invalid session');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: safeUserId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid session');
    }

    const changingEmail = Boolean(
      dto.email && dto.email.toLowerCase() !== user.email,
    );
    const changingPassword = Boolean(dto.newPassword);
    const changingName = Boolean(dto.name && dto.name.trim() !== user.name);

    if (!changingEmail && !changingPassword && !changingName) {
      throw new BadRequestException('Nothing to update');
    }

    if (changingEmail || changingPassword) {
      if (!dto.currentPassword) {
        throw new BadRequestException('Current password is required');
      }
      const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
      if (!valid) {
        throw new UnauthorizedException('Current password is incorrect');
      }
    }

    const data: {
      name?: string;
      email?: string;
      passwordHash?: string;
    } = {};

    if (changingName && dto.name) {
      data.name = dto.name.trim();
    }

    if (changingEmail && dto.email) {
      const email = dto.email.toLowerCase();
      const taken = await this.prisma.user.findUnique({ where: { email } });
      if (taken && taken.id !== safeUserId) {
        throw new ConflictException('Email already in use');
      }
      data.email = email;
    }

    if (changingPassword && dto.newPassword) {
      data.passwordHash = await argon2.hash(dto.newPassword, {
        type: argon2.argon2id,
      });
    }

    const updated = await this.prisma.user.update({
      where: { id: safeUserId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
      },
    });

    if (changingPassword) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: safeUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.log({
      userId: safeUserId,
      action: 'PROFILE_UPDATE',
      recordType: 'user',
      recordId: safeUserId,
      ipAddress: ip,
      metadata: {
        name: changingName,
        email: changingEmail,
        password: changingPassword,
      },
    });

    return updated;
  }

  async refresh(refreshToken: string) {
    const hash = this.hashToken(refreshToken);
    const stored = await this.prisma.refreshToken.findFirst({
      where: { tokenHash: hash, revokedAt: null },
      include: { user: true },
    });
    if (!stored || stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Invalid refresh token');
    }
    if (!stored.user.isActive) {
      throw new ForbiddenException('Account disabled');
    }

    await this.prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(
      stored.user.id,
      stored.user.email,
      stored.user.role,
    );
  }

  async logout(userId: string, refreshToken?: string, ip?: string) {
    const safeUserId = String(userId);
    if (!/^[a-zA-Z0-9_-]+$/.test(safeUserId)) {
      throw new UnauthorizedException('Invalid session');
    }

    if (refreshToken) {
      const hash = this.hashToken(String(refreshToken));
      await this.prisma.refreshToken.updateMany({
        where: {
          userId: { equals: safeUserId },
          tokenHash: { equals: hash },
          revokedAt: null,
        },
        data: { revokedAt: new Date() },
      });
    } else {
      await this.prisma.refreshToken.updateMany({
        where: { userId: { equals: safeUserId }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.log({
      userId: safeUserId,
      action: 'LOGOUT',
      recordType: 'user',
      recordId: safeUserId,
      ipAddress: ip,
    });
    return { ok: true };
  }

  private async issueTokens(userId: string, email: string, role: string) {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role },
      {
        secret: this.config.getOrThrow('JWT_ACCESS_SECRET'),
        expiresIn: this.config.get('JWT_ACCESS_TTL') || '15m',
      },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const days = 7;
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
