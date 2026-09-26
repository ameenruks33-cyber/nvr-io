import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RepaymentsService } from './repayments.service';
import { CreateRepaymentDto } from './dto/create-repayment.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@Controller()
export class RepaymentsController {
  constructor(private readonly repayments: RepaymentsService) {}

  @Post('loans/:id/repayments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  create(
    @Param('id') loanId: string,
    @Body() dto: CreateRepaymentDto,
    @CurrentUser() user: AuthUser,
    @Headers('idempotency-key') idempotencyHeader?: string,
  ) {
    return this.repayments.recordRepayment({
      loanId,
      amount: dto.amount,
      collectorId: user.id,
      latitude: dto.latitude,
      longitude: dto.longitude,
      notes: dto.notes,
      idempotencyKey: dto.idempotencyKey || idempotencyHeader,
    });
  }

  @Get('loans/:id/repayments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  listForLoan(@Param('id') loanId: string) {
    return this.repayments.listForLoan(loanId);
  }

  @Get('repayments')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  listRecent(@Query('limit') limit?: string) {
    const n = limit ? Number(limit) : 20;
    const safe = Number.isFinite(n) ? Math.min(Math.max(Math.floor(n), 1), 100) : 20;
    return this.repayments.listRecent(safe);
  }
}
