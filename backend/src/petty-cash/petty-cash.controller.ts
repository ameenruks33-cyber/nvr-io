import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PettyCashService } from './petty-cash.service';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { assertSafeId } from '../common/safe-input';

@Controller('petty-cash')
export class PettyCashController {
  constructor(private readonly pettyCash: PettyCashService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  summary() {
    return this.pettyCash.summary();
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  create(@Body() dto: CreateExpenseDto, @CurrentUser() user: AuthUser) {
    return this.pettyCash.create(dto, user.id);
  }

  @Delete(':id')
  @Roles(UserRole.SUPER_ADMIN)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.pettyCash.remove(assertSafeId(String(id)), user.id);
  }
}
