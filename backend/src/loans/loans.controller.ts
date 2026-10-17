import { Body, Controller, Delete, Get, Param, Patch, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { LoansService } from './loans.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
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
    return this.loans.findOne(assertSafeId(String(id)));
  }

  @Patch(':id/plan')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  updatePlan(@Param('id') id: string, @Body() dto: UpdateLoanPlanDto) {
    return this.loans.updatePlan(assertSafeId(String(id)), dto);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.loans.remove(assertSafeId(String(id)), user.id);
  }
}
