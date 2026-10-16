import { Body, Controller, Get, Logger, Put } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { PendingCollectionsService } from './pending-collections.service';
import { CollectionsRemindersService } from './collections-reminders.service';
import { CollectionsStickyService } from './collections-sticky.service';
import { CollectionsStickyDto } from './dto/collections-sticky.dto';

@Controller('collections')
export class CollectionsController {
  private readonly logger = new Logger(CollectionsController.name);

  constructor(
    private readonly pending: PendingCollectionsService,
    private readonly reminders: CollectionsRemindersService,
    private readonly sticky: CollectionsStickyService,
  ) {}

  @Get('pending-today')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  async pendingToday() {
    const data = await this.pending.listPendingToday();
    try {
      await this.reminders.runDailyPendingReminders();
    } catch (e) {
      this.logger.warn(
        `Pending reminders skipped: ${e instanceof Error ? e.message : e}`,
      );
    }
    return data;
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
