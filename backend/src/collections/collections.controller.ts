import { Controller, Get } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { PendingCollectionsService } from './pending-collections.service';

@Controller('collections')
export class CollectionsController {
  constructor(private readonly pending: PendingCollectionsService) {}

  @Get('pending-today')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  pendingToday() {
    return this.pending.listPendingToday();
  }
}
