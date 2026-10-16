import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { attachArrears } from '../collections/daily-collection';
import { resolveLoanAmounts } from './loan-plans';
import { UpdateLoanPlanDto } from './dto/update-loan-plan.dto';

@Injectable()
export class LoansService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(status?: string) {
    const rows = await this.prisma.loan.findMany({
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
    return rows.map((row) => attachArrears(row));
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
    return attachArrears(loan);
  }

  async updatePlan(loanId: string, dto: UpdateLoanPlanDto) {
    const loan = await this.prisma.loan.findUnique({ where: { id: loanId } });
    if (!loan) throw new NotFoundException('Loan not found');
    if (loan.status !== 'ACTIVE') {
      throw new BadRequestException('Cannot change plan on a closed record');
    }
    if (Number(loan.amountCollected) > 0) {
      throw new BadRequestException(
        'Cannot change plan after collections have started',
      );
    }

    const { principal, totalPayable, daily } = resolveLoanAmounts({
      planId: dto.planId,
      dailyPayment: dto.dailyPayment,
    });

    return this.prisma.loan.update({
      where: { id: loanId },
      data: {
        principalAmount: new Prisma.Decimal(principal),
        totalPayable: new Prisma.Decimal(totalPayable),
        remainingAmount: new Prisma.Decimal(totalPayable),
        dailyPayment: new Prisma.Decimal(daily),
      },
    });
  }
}
