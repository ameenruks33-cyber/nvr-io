import { Body, Controller, Get, Put } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { PendingCollectionsService } from './pending-collections.service';
import { CollectionsStickyService } from './collections-sticky.service';
import { CollectionsStickyDto } from './dto/collections-sticky.dto';

@Controller('collections')
export class CollectionsController {
  constructor(
    private readonly pending: PendingCollectionsService,
    private readonly sticky: CollectionsStickyService,
  ) {}

  @Get('pending-today')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  pendingToday() {
    return this.pending.listPendingToday();
  }

  @Get('sticky-note')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  stickyNote() {
    return this.sticky.get();
  }

  @Put('sticky-note')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  saveStickyNote(
    @Body() dto: CollectionsStickyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.sticky.save(dto.text, user.id);
  }
}
