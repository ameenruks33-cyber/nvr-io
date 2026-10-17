import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { RestoreService } from './restore.service';
import { RestoreToDto } from './dto/restore-to.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';

@Controller('restore')
export class RestoreController {
  constructor(private readonly restore: RestoreService) {}

  @Get('preview')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  preview(@Query('date') date?: string, @Query('time') time?: string) {
    return this.restore.preview(String(date || ''), String(time || ''));
  }

  @Post('to')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  restoreTo(@Body() dto: RestoreToDto, @CurrentUser() user: AuthUser) {
    return this.restore.restoreTo(dto.date, dto.time, user.id);
  }
}
