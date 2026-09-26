import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async createLoanCompleted(
    customerId: string,
    loanId: string,
    amountPaid?: number,
    remaining?: number,
    principal?: number,
  ) {
    const paid =
      typeof amountPaid === 'number' ? `AED ${amountPaid.toFixed(2)}` : null;
    const rem =
      typeof remaining === 'number' && typeof principal === 'number'
        ? `Remaining AED ${remaining.toFixed(2)} of AED ${principal.toFixed(2)}`
        : null;
    const message = [
      'CrickHerose: Target reached for this record.',
      paid ? `Last payment ${paid}.` : null,
      rem,
      'WhatsApp receipt sent to customer when configured.',
    ]
      .filter(Boolean)
      .join(' ');

    return this.prisma.notification.create({
      data: {
        customerId,
        loanId,
        type: 'LOAN_COMPLETED',
        message,
        status: 'SENT',
        sentAt: new Date(),
      },
    });
  }

  async createRepaymentReceived(
    customerId: string,
    loanId: string,
    amount: number,
    remaining?: number,
    principal?: number,
  ) {
    const rem =
      typeof remaining === 'number' && typeof principal === 'number'
        ? ` Remaining balance AED ${remaining.toFixed(2)} of AED ${principal.toFixed(2)}.`
        : '';
    return this.prisma.notification.create({
      data: {
        customerId,
        loanId,
        type: 'REPAYMENT_RECEIVED',
        message: `CrickHerose: Payment of AED ${amount.toFixed(2)} saved.${rem}`,
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
