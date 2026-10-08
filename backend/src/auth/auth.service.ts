import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  ConflictException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { WhatsappService } from '../whatsapp/whatsapp.service';
import { LoginDto, VerifyOtpDto } from './dto/auth.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';

type OtpPurpose = 'LOGIN' | 'ENABLE';

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_MAX_ATTEMPTS = 5;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly whatsapp: WhatsappService,
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

    // Two-step login: password, then WhatsApp code — only when a code can
    // actually be delivered. If auto-send is not connected, do not block sign-in.
    if (
      this.loginRequiresOtp(user) &&
      user.phone?.trim() &&
      (await this.whatsapp.isAutoSendReady())
    ) {
      const challenge = await this.createChallenge(user, 'LOGIN');
      await this.audit.log({
        userId: user.id,
        action: 'LOGIN_OTP_SENT',
        recordType: 'user',
        recordId: user.id,
        ipAddress: ip,
      });
      return challenge;
    }

    return this.completeLogin(user, ip);
  }

  async verifyLoginOtp(dto: VerifyOtpDto, ip?: string) {
    const challenge = await this.consumeChallenge(dto, 'LOGIN');
    const user = await this.prisma.user.findUnique({
      where: { id: challenge.userId },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid credentials');
    }
    return this.completeLogin(user, ip);
  }

  async startOtpEnable(userId: string) {
    const user = await this.activeUser(userId);
    if (!(await this.whatsapp.isAutoSendReady())) {
      throw new BadRequestException(
        'Automatic WhatsApp sending is not connected yet — ask the Super admin to set it up in Settings.',
      );
    }
    return this.createChallenge(user, 'ENABLE');
  }

  async confirmOtpEnable(userId: string, dto: VerifyOtpDto, ip?: string) {
    const user = await this.activeUser(userId);
    await this.consumeChallenge(dto, 'ENABLE', user.id);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpEnabled: true },
    });
    await this.audit.log({
      userId: user.id,
      action: 'OTP_ENABLED',
      recordType: 'user',
      recordId: user.id,
      ipAddress: ip,
    });
    return { otpEnabled: true };
  }

  async disableOtp(userId: string, password: string, ip?: string) {
    const user = await this.activeUser(userId);
    if (!(await argon2.verify(user.passwordHash, password))) {
      throw new UnauthorizedException('Password is incorrect');
    }
    await this.prisma.user.update({
      where: { id: user.id },
      data: { otpEnabled: false },
    });
    await this.audit.log({
      userId: user.id,
      action: 'OTP_DISABLED',
      recordType: 'user',
      recordId: user.id,
      ipAddress: ip,
    });
    return { otpEnabled: false };
  }

  /** Production defaults to mandatory WhatsApp second step for every login. */
  private loginRequiresOtp(user: User): boolean {
    if (this.config.get('OTP_DISABLED') === 'true') return false;
    const flag = this.config.get<string>('REQUIRE_TWO_FACTOR');
    if (flag === 'false') return user.otpEnabled;
    if (flag === 'true') return true;
    return (
      this.config.get('NODE_ENV') === 'production' ||
      user.otpEnabled
    );
  }

  isTwoFactorRequiredGlobally(): boolean {
    if (this.config.get('OTP_DISABLED') === 'true') return false;
    const flag = this.config.get<string>('REQUIRE_TWO_FACTOR');
    if (flag === 'false') return false;
    if (flag === 'true') return true;
    return this.config.get('NODE_ENV') === 'production';
  }

  private async activeUser(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: String(userId) },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid session');
    }
    return user;
  }

  private hashCode(salt: string, code: string) {
    return createHmac('sha256', this.config.getOrThrow<string>('JWT_ACCESS_SECRET'))
      .update(`${salt}:${code}`)
      .digest('hex');
  }

  private async createChallenge(user: User, purpose: OtpPurpose) {
    if (!user.phone?.trim()) {
      throw new BadRequestException(
        'No WhatsApp number on this account — add it in Settings first.',
      );
    }

    await this.prisma.loginChallenge.updateMany({
      where: {
        userId: { equals: String(user.id) },
        purpose: { equals: purpose },
        consumedAt: null,
      },
      data: { consumedAt: new Date() },
    });

    const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
    const salt = randomBytes(16).toString('hex');
    const challenge = await this.prisma.loginChallenge.create({
      data: {
        userId: user.id,
        purpose,
        codeHash: `${salt}:${this.hashCode(salt, code)}`,
        expiresAt: new Date(Date.now() + OTP_TTL_MS),
      },
    });

    const intro =
      purpose === 'LOGIN'
        ? 'CrickHerose login code'
        : 'CrickHerose code to turn on WhatsApp login codes';
    const result = await this.whatsapp.sendText(
      user.phone,
      `${intro}: ${code}\nValid for 5 minutes. Do not share this code with anyone.`,
    );
    if (!result.sent) {
      await this.prisma.loginChallenge.delete({ where: { id: challenge.id } });
      throw new ServiceUnavailableException(
        `Could not send the WhatsApp code${result.error ? `: ${result.error}` : ''}. Try again shortly.`,
      );
    }

    const digits = user.phone.replace(/\D/g, '');
    return {
      otpRequired: true as const,
      challengeId: challenge.id,
      phoneHint: `•••• ${digits.slice(-4)}`,
      expiresInSeconds: OTP_TTL_MS / 1000,
    };
  }

  private async consumeChallenge(
    dto: VerifyOtpDto,
    purpose: OtpPurpose,
    userId?: string,
  ) {
    const invalid = new UnauthorizedException(
      'Code expired or invalid — request a new code.',
    );
    const challenge = await this.prisma.loginChallenge.findUnique({
      where: { id: dto.challengeId },
    });
    if (
      !challenge ||
      challenge.purpose !== purpose ||
      (userId && challenge.userId !== userId) ||
      challenge.consumedAt ||
      challenge.expiresAt < new Date()
    ) {
      throw invalid;
    }
    if (challenge.attempts >= OTP_MAX_ATTEMPTS) {
      throw new UnauthorizedException('Too many wrong codes — request a new code.');
    }

    const [salt, stored] = challenge.codeHash.split(':');
    const given = Buffer.from(this.hashCode(salt, dto.code));
    const expected = Buffer.from(stored ?? '');
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) {
      await this.prisma.loginChallenge.update({
        where: { id: challenge.id },
        data: { attempts: { increment: 1 } },
      });
      const left = OTP_MAX_ATTEMPTS - challenge.attempts - 1;
      throw new UnauthorizedException(
        left > 0 ? `Wrong code — ${left} tries left.` : 'Too many wrong codes — request a new code.',
      );
    }

    const claimed = await this.prisma.loginChallenge.updateMany({
      where: { id: { equals: String(challenge.id) }, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (claimed.count !== 1) throw invalid;
    return challenge;
  }

  private async completeLogin(user: User, ip?: string) {
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
        otpEnabled: true,
        createdAt: true,
      },
    });
    if (!user || !user.isActive) {
      throw new UnauthorizedException('Invalid session');
    }
    const whatsappReady = await this.whatsapp.isAutoSendReady();
    return {
      ...user,
      whatsappReady,
      twoFactorRequired:
        this.loginRequiresOtp(user as User) &&
        Boolean(user.phone?.trim()) &&
        whatsappReady,
      twoFactorPolicy: this.isTwoFactorRequiredGlobally()
        ? 'required'
        : user.otpEnabled
          ? 'optional'
          : 'off',
    };
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
    const newPhone = dto.phone === undefined ? undefined : dto.phone.trim();
    const changingPhone =
      newPhone !== undefined && newPhone !== (user.phone ?? '');

    if (!changingEmail && !changingPassword && !changingName && !changingPhone) {
      throw new BadRequestException('Nothing to update');
    }

    if (changingEmail || changingPassword || changingPhone) {
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
      phone?: string | null;
      otpEnabled?: boolean;
      passwordHash?: string;
    } = {};

    if (changingName && dto.name) {
      data.name = dto.name.trim();
    }

    if (changingPhone) {
      data.phone = newPhone || null;
      // Codes must be re-confirmed on the new number.
      if (user.otpEnabled) data.otpEnabled = false;
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
        otpEnabled: true,
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
        phone: changingPhone,
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
