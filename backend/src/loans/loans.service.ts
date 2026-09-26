import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(status?: string) {
    return this.prisma.loan.findMany({
      where: status ? { status: status as 'ACTIVE' | 'COMPLETED' | 'CLOSED' } : undefined,
      orderBy: { openedAt: 'desc' },
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            name: true,
            phone: true,
          },
        },
      },
    });
  }

  async findOne(id: string) {
    const loan = await this.prisma.loan.findUnique({
      where: { id },
      include: {
        customer: {
          select: {
            id: true,
            customerCode: true,
            name: true,
            phone: true,
            address: true,
            latitude: true,
            longitude: true,
          },
        },
        repayments: {
          orderBy: { collectedAt: 'asc' },
          include: {
            collectedBy: { select: { id: true, name: true } },
          },
        },
      },
    });
    if (!loan) throw new NotFoundException('Loan not found');
    return loan;
  }
}
