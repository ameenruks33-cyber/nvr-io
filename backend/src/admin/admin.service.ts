import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Wipe business/customer data. Keeps staff user accounts so admins can still sign in.
   */
  async clearOldData(actorId: string, confirmation: string) {
    if (confirmation !== 'DELETE_OLD_DATA') {
      throw new BadRequestException(
        'Type DELETE_OLD_DATA to confirm clearing the old database',
      );
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const gallery = await tx.galleryItem.deleteMany();
      const notifications = await tx.notification.deleteMany();
      const documents = await tx.document.deleteMany();
      const repayments = await tx.repayment.deleteMany();
      const loans = await tx.loan.deleteMany();
      await tx.customerPhoto.deleteMany();
      const customers = await tx.customer.deleteMany();
      const auditLogs = await tx.auditLog.deleteMany({
        where: {
          OR: [
            { recordType: 'customer' },
            { recordType: 'loan' },
            { recordType: 'repayment' },
            { recordType: 'document' },
            { recordType: 'notification' },
            { recordType: 'gallery' },
          ],
        },
      });

      return {
        gallery: gallery.count,
        notifications: notifications.count,
        documents: documents.count,
        repayments: repayments.count,
        loans: loans.count,
        customers: customers.count,
        relatedAuditLogs: auditLogs.count,
      };
    });

    await this.audit.log({
      userId: actorId,
      action: 'CLEAR_OLD_DATABASE',
      recordType: 'system',
      recordId: 'database',
      metadata: result,
    });

    return {
      ok: true,
      message: 'Old customer/records database cleared. Staff accounts kept.',
      deleted: result,
    };
  }
}
