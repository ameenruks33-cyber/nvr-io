import { Body, Controller, Post } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { AdminService } from './admin.service';
import { ClearDatabaseDto } from './dto/clear-database.dto';

@Controller('admin')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Post('clear-database')
  @Roles(UserRole.SUPER_ADMIN)
  clearDatabase(
    @Body() dto: ClearDatabaseDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.admin.clearOldData(user.id, dto.confirmation);
  }
}
