import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { CreateUserDto } from './dto/create-user.dto';
import { AuthUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async create(dto: CreateUserDto, actorId: string) {
    const email = dto.email.toLowerCase().trim();
    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) throw new ConflictException('Email already in use');

    const passwordHash = await argon2.hash(dto.password, {
      type: argon2.argon2id,
    });

    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(),
        email,
        phone: dto.phone?.trim() || null,
        passwordHash,
        role: dto.role,
        isActive: true,
        otpEnabled: Boolean(dto.phone?.trim()),
      },
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

    await this.audit.log({
      userId: actorId,
      action: 'USER_CREATE',
      recordType: 'user',
      recordId: user.id,
      metadata: { role: user.role },
    });

    return user;
  }

  findAll() {
    return this.prisma.user.findMany({
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
      orderBy: { createdAt: 'desc' },
    });
  }

  /** Lost-phone recovery: turn off WhatsApp login codes for another user. */
  async resetOtp(id: string, actor: AuthUser) {
    await this.assertCanManage(id, actor);
    await this.prisma.user.update({
      where: { id },
      data: { otpEnabled: false },
    });
    await this.prisma.loginChallenge.updateMany({
      where: { userId: { equals: String(id) }, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.audit.log({
      userId: actor.id,
      action: 'USER_OTP_RESET',
      recordType: 'user',
      recordId: id,
    });
    return { otpEnabled: false };
  }

  private async assertCanManage(targetId: string, actor: AuthUser) {
    if (targetId === actor.id) {
      throw new BadRequestException('You cannot change your own access here');
    }
    const target = await this.prisma.user.findUnique({ where: { id: targetId } });
    if (!target) throw new NotFoundException('User not found');

    if (
      actor.role === UserRole.ADMIN &&
      target.role === UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Admins cannot manage super admins');
    }

    return target;
  }

  async setActive(id: string, isActive: boolean, actor: AuthUser) {
    await this.assertCanManage(id, actor);

    const updated = await this.prisma.user.update({
      where: { id },
      data: { isActive },
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

    // Kick them out of the app immediately when disabled
    if (!isActive) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: { equals: String(id) }, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }

    await this.audit.log({
      userId: actor.id,
      action: isActive ? 'USER_ENABLE' : 'USER_DISABLE',
      recordType: 'user',
      recordId: id,
    });

    return updated;
  }

  async setRole(id: string, role: UserRole, actor: AuthUser) {
    const target = await this.assertCanManage(id, actor);

    if (
      actor.role === UserRole.ADMIN &&
      target.role === UserRole.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Admins cannot change super admin roles');
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: { role },
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

    await this.audit.log({
      userId: actor.id,
      action: 'USER_ROLE_CHANGE',
      recordType: 'user',
      recordId: id,
      metadata: { role },
    });

    return updated;
  }
}
