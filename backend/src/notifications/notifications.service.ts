import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createLoanCompleted(customerId: string, loanId: string) {
    return this.prisma.notification.create({
      data: {
        customerId,
        loanId,
        type: 'LOAN_COMPLETED',
        message:
          'NVR.io: Target reached for this record.',
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async createRepaymentReceived(
    customerId: string,
    loanId: string,
    amount: number,
  ) {
    return this.prisma.notification.create({
      data: {
        customerId,
        loanId,
        type: 'REPAYMENT_RECEIVED',
        message: `NVR.io: Payment of AED ${amount.toFixed(2)} saved.`,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  findAll(limit = 50) {
    return this.prisma.notification.findMany({
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customer: {
          select: { id: true, name: true, customerCode: true },
        },
      },
    });
  }
}
