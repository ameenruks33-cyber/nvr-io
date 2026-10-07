import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { FieldEncryptionService } from '../crypto/field-encryption.service';
import { AuditService } from '../audit/audit.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { AuthUser } from '../auth/decorators/current-user.decorator';
import { StorageService } from '../storage/storage.service';
import { assertImageBuffer } from '../common/image-bytes';

@Injectable()
export class CustomersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldEncryptionService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
    private readonly storage: StorageService,
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
    // `principal` is given; the account closes once the full `total` is repaid.
    const total = Math.max(
      Number(this.config.get('DEFAULT_TOTAL_AMOUNT') ?? 2000),
      principal,
    );

    const customerCode = await this.nextCustomerCode();

    const result = await this.prisma.$transaction(async (tx) => {
      const customer = await tx.customer.create({
        data: {
          customerCode,
          name: dto.name.trim(),
          phone: dto.phone.trim(),
          address: dto.address.trim(),
          botimNumber: dto.botimNumber?.trim() || null,
          mobileNumber: dto.mobileNumber?.trim() || null,
          careOfName: dto.careOfName?.trim() || null,
          careOfPhone: dto.careOfPhone?.trim() || null,
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
          totalPayable: new Prisma.Decimal(total),
          remainingAmount: new Prisma.Decimal(total),
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

  async attachPhoto(
    customerId: string,
    bytes: Buffer,
    mimeType: string,
    actorId: string,
  ) {
    const existing = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!existing) throw new NotFoundException('Customer not found');

    assertImageBuffer(bytes);

    // Also acts as a cache-busting version for the photo URL.
    const storageKey = `db-${Date.now()}`;
    // AES-256-GCM at rest — DB holds ciphertext only.
    const data = new Uint8Array(this.crypto.encryptBytes(bytes));
    const [, customer] = await this.prisma.$transaction([
      this.prisma.customerPhoto.upsert({
        where: { customerId },
        create: { customerId, bytes: data, mimeType },
        update: { bytes: data, mimeType },
      }),
      this.prisma.customer.update({
        where: { id: customerId },
        data: { photoStorageId: storageKey },
      }),
    ]);

    await this.audit.log({
      userId: actorId,
      action: 'DOCUMENT_UPLOAD',
      recordType: 'customer',
      recordId: customerId,
      metadata: { documentType: 'CUSTOMER_PHOTO' },
    });

    return { id: customer.id, photoStorageId: storageKey };
  }

  /** Photo bytes: database copy first, then legacy file storage, then a linked cloud photo. */
  async getPhoto(customerId: string, actorId: string) {
    const customer = await this.prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true, photoStorageId: true, photo: true },
    });
    if (!customer) throw new NotFoundException('Customer not found');

    let result: { bytes: Buffer; mimeType: string } | null = null;
    if (customer.photo) {
      const stored = Buffer.from(customer.photo.bytes);
      const plain = this.crypto.decryptBytes(stored);
      // Rewrite legacy plaintext rows as ciphertext on first read.
      if (!this.crypto.isEncryptedBytes(stored)) {
        void this.prisma.customerPhoto
          .update({
            where: { customerId },
            data: { bytes: new Uint8Array(this.crypto.encryptBytes(plain)) },
          })
          .catch(() => undefined);
      }
      result = {
        bytes: plain,
        mimeType: customer.photo.mimeType,
      };
    }

    if (!result && customer.photoStorageId && !customer.photoStorageId.startsWith('db-')) {
      try {
        const stream = await this.storage.openStream(customer.photoStorageId);
        const chunks: Buffer[] = [];
        for await (const chunk of stream) chunks.push(Buffer.from(chunk));
        result = { bytes: Buffer.concat(chunks), mimeType: 'image/jpeg' };
      } catch {
        // file was on ephemeral storage and is gone
      }
    }

    if (!result) {
      const cloud = await this.prisma.galleryItem.findFirst({
        where: { customerId: { equals: customerId }, imageBytes: { not: null } },
        orderBy: { createdAt: 'desc' },
        select: { imageBytes: true, mimeType: true },
      });
      if (cloud?.imageBytes) {
        result = {
          bytes: this.crypto.decryptBytes(Buffer.from(cloud.imageBytes)),
          mimeType: cloud.mimeType || 'image/jpeg',
        };
      }
    }

    if (!result) throw new NotFoundException('No photo for this customer');

    await this.audit.log({
      userId: actorId,
      action: 'DOCUMENT_ACCESS',
      recordType: 'customer',
      recordId: customerId,
      metadata: { documentType: 'CUSTOMER_PHOTO' },
    });
    return result;
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
      botimNumber?: string | null;
      mobileNumber?: string | null;
      careOfName?: string | null;
      careOfPhone?: string | null;
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
      botimNumber: customer.botimNumber ?? null,
      mobileNumber: customer.mobileNumber ?? null,
      careOfName: customer.careOfName ?? null,
      careOfPhone: customer.careOfPhone ?? null,
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
