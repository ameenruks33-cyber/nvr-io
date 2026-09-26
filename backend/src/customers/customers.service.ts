import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { AuthUser } from '../auth/decorators/current-user.decorator';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldEncryptionService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  private async nextCustomerCode() {
    const count = await this.prisma.customer.count();
    return `JB-CUS-${String(count + 1).padStart(6, '0')}`;
  }

  async create(dto: CreateCustomerDto, actor: AuthUser, ip?: string) {
    const principal = Number(
      dto.principalAmount ??
        this.config.get('DEFAULT_LOAN_AMOUNT') ??
        1800,
    );
    const daily = Number(
      dto.dailyPayment ?? this.config.get('DEFAULT_DAILY_PAYMENT') ?? 100,
    );

    const customerCode = await this.nextCustomerCode();

    const result = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          customerCode,
          name: dto.name.trim(),
          phone: dto.phone.trim(),
          address: dto.address.trim(),
          passportEncrypted: this.crypto.encrypt(dto.passportNumber.trim()),
          aadhaarEncrypted: this.crypto.encrypt(dto.aadhaarNumber.trim()),
          latitude: dto.latitude,
          longitude: dto.longitude,
          locationAccuracy: dto.locationAccuracy,
          consentVersion: dto.consentVersion || 'v1',
          registeredById: actor.id,
        },
      });

      const loan = await tx.loan.create({
        data: {
          customerId: customer.id,
          principalAmount: new Prisma.Decimal(principal),
          dailyPayment: new Prisma.Decimal(daily),
          totalPayable: new Prisma.Decimal(principal),
          remainingAmount: new Prisma.Decimal(principal),
          amountCollected: new Prisma.Decimal(0),
          status: 'ACTIVE',
        },
      });

      return { customer, loan };
    });

    await this.audit.log({
      userId: actor.id,
      action: 'CUSTOMER_CREATE',
      recordType: 'customer',
      recordId: result.customer.id,
      ipAddress: ip,
      metadata: { customerCode, loanId: result.loan.id },
    });

    return this.toSafeCustomer(result.customer, actor, {
      includeSensitive: this.canViewSensitive(actor.role as UserRole),
      loan: result.loan,
    });
  }

  async findAll(query?: string, actor?: AuthUser) {
    const where = query
      ? {
          OR: [
            { customerCode: { contains: query } },
            { name: { contains: query } },
            { phone: { contains: query } },
          ],
        }
      : {};

    const customers = await this.prisma.customer.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        loans: {
          orderBy: { openedAt: 'desc' },
          take: 1,
        },
      },
    });

    return customers.map((c) =>
      this.toSafeCustomer(c, actor, {
        includeSensitive: false,
        loan: c.loans[0],
      }),
    );
  }

  async findOne(id: string, actor: AuthUser, ip?: string) {
    const safeId = String(id);
    const customer = await this.prisma.customer.findUnique({
      where: { id: safeId },
      include: {
        loans: {
          include: {
            repayments: {
              orderBy: { collectedAt: 'asc' },
              include: {
                collectedBy: { select: { id: true, name: true } },
              },
            },
          },
          orderBy: { openedAt: 'desc' },
        },
        documents: true,
      },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    await this.audit.log({
      userId: actor.id,
      action: 'CUSTOMER_ACCESS',
      recordType: 'customer',
      recordId: safeId,
      ipAddress: ip,
    });

    return this.toSafeCustomer(customer, actor, {
      includeSensitive: this.canViewSensitive(actor.role as UserRole),
      loans: customer.loans,
      documents: customer.documents,
    });
  }

  async attachPhoto(customerId: string, storageKey: string, actorId: string) {
    const customer = await this.prisma.customer.update({
      where: { id: customerId },
      data: { photoStorageId: storageKey },
    });

    await this.prisma.document.create({
      data: {
        customerId,
        documentType: 'CUSTOMER_PHOTO',
        storageKey,
        mimeType: 'image/jpeg',
      },
    });

    await this.audit.log({
      userId: actorId,
      action: 'DOCUMENT_UPLOAD',
      recordType: 'customer',
      recordId: customerId,
      metadata: { documentType: 'CUSTOMER_PHOTO' },
    });

    return { id: customer.id, photoStorageId: storageKey };
  }

  private canViewSensitive(role: UserRole) {
    return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
  }

  private toSafeCustomer(
    customer: {
      id: string;
      customerCode: string;
      name: string;
      phone: string;
      address: string;
      passportEncrypted: string;
      aadhaarEncrypted: string;
      photoStorageId: string | null;
      latitude: number;
      longitude: number;
      locationAccuracy: number | null;
      consentVersion: string;
      createdAt: Date;
      updatedAt: Date;
    },
    _actor?: AuthUser,
    opts?: {
      includeSensitive?: boolean;
      loan?: unknown;
      loans?: unknown;
      documents?: unknown;
    },
  ) {
    let passportMasked = '****';
    let aadhaarMasked = '****';
    let passportNumber: string | undefined;
    let aadhaarNumber: string | undefined;

    try {
      const passport = this.crypto.decrypt(customer.passportEncrypted);
      const aadhaar = this.crypto.decrypt(customer.aadhaarEncrypted);
      passportMasked = this.crypto.maskIdentity(passport);
      aadhaarMasked = this.crypto.maskIdentity(aadhaar);
      if (opts?.includeSensitive) {
        passportNumber = passport;
        aadhaarNumber = aadhaar;
      }
    } catch {
      // keep masked placeholders
    }

    return {
      id: customer.id,
      customerCode: customer.customerCode,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      passportMasked,
      aadhaarMasked,
      ...(opts?.includeSensitive ? { passportNumber, aadhaarNumber } : {}),
      photoStorageId: customer.photoStorageId,
      latitude: customer.latitude,
      longitude: customer.longitude,
      locationAccuracy: customer.locationAccuracy,
      consentVersion: customer.consentVersion,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
      loan: opts?.loan,
      loans: opts?.loans,
      documents: opts?.documents,
    };
  }
}
