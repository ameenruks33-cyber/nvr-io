import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { LoansService } from './loans.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { assertSafeId } from '../common/safe-input';
import { UpdateLoanPlanDto } from './dto/update-loan-plan.dto';

@Controller('loans')
export class LoansController {
  constructor(private readonly loans: LoansService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  list(@Query('status') status?: string) {
    return this.loans.findAll(status);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  getOne(@Param('id') id: string) {
    return this.loans.findOne(id);
  }

  @Patch(':id/plan')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  updatePlan(@Param('id') id: string, @Body() dto: UpdateLoanPlanDto) {
    return this.loans.updatePlan(assertSafeId(String(id)), dto);
  }
}
