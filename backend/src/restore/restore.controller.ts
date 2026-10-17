import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Post,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RestoreService } from './restore.service';
import { RestoreToDto } from './dto/restore-to.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { assertSafeId } from '../common/safe-input';

function isAdminRole(role: UserRole) {
  return role === UserRole.SUPER_ADMIN || role === UserRole.ADMIN;
}

@Controller('restore')
export class RestoreController {
  constructor(private readonly restore: RestoreService) {}

  @Get('preview')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  preview(
    @Query('date') date?: string,
    @Query('time') time?: string,
    @Query('customerId') customerId?: string,
    @CurrentUser() user?: AuthUser,
  ) {
    const personId = customerId
      ? assertSafeId(String(customerId), 'person')
      : undefined;
    this.assertCanRestore(user, personId);
    return this.restore.preview(String(date || ''), String(time || ''), personId);
  }

  @Post('to')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  restoreTo(@Body() dto: RestoreToDto, @CurrentUser() user: AuthUser) {
    this.assertCanRestore(user, dto.customerId);
    return this.restore.restoreTo(dto.date, dto.time, user.id, dto.customerId);
  }

  private assertCanRestore(user: AuthUser | undefined, customerId?: string) {
    if (user && isAdminRole(user.role)) return;
    if (!customerId) {
      throw new ForbiddenException('Restore from the person’s profile');
    }
  }
}
