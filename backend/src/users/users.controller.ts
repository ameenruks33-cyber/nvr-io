import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserRoleDto } from './dto/update-user-role.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { assertSafeId } from '../common/safe-input';

/** User management — Super Admin only */
@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN)
  list() {
    return this.users.findAll();
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN)
  create(@Body() dto: CreateUserDto, @CurrentUser() user: AuthUser) {
    return this.users.create(dto, user.id);
  }

  @Patch(':id/disable')
  @Roles(UserRole.SUPER_ADMIN)
  disable(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.users.setActive(assertSafeId(String(id)), false, user);
  }

  @Patch(':id/enable')
  @Roles(UserRole.SUPER_ADMIN)
  enable(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.users.setActive(assertSafeId(String(id)), true, user);
  }

  @Patch(':id/role')
  @Roles(UserRole.SUPER_ADMIN)
  setRole(
    @Param('id') id: string,
    @Body() dto: UpdateUserRoleDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.users.setRole(assertSafeId(String(id)), dto.role, user);
  }
}
