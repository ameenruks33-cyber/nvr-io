import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    userId?: string | null;
    action: string;
    recordType: string;
    recordId?: string | null;
    ipAddress?: string | null;
    deviceId?: string | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    // Never put passport/Aadhaar/passwords/tokens in metadata
    return this.prisma.auditLog.create({
      data: {
        userId: input.userId ?? undefined,
        action: input.action,
        recordType: input.recordType,
        recordId: input.recordId ?? undefined,
        ipAddress: input.ipAddress ?? undefined,
        deviceId: input.deviceId ?? undefined,
        metadata: input.metadata,
      },
    });
  }

  findAll(limit = 100) {
    return this.prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
    });
  }
}
