import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@Controller('users')
export class UsersController {
  constructor(private readonly users: UsersService) {}

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
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
    return this.users.setActive(id, false, user.id);
  }

  @Patch(':id/enable')
  @Roles(UserRole.SUPER_ADMIN)
  enable(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.users.setActive(id, true, user.id);
  }
}
