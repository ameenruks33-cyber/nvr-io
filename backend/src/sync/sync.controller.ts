import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { SyncService } from './sync.service';
import { Roles } from '../auth/decorators/roles.decorator';

@Controller('sync')
export class SyncController {
  constructor(private readonly sync: SyncService) {}

  @Get('stamp')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  stamp() {
    return this.sync.stamp();
  }
}
