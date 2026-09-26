import { Controller, Get, Param, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { LoansService } from './loans.service';
import { Roles } from '../auth/decorators/roles.decorator';

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
}
