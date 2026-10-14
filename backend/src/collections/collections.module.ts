import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CollectionsController } from './collections.controller';
import { CollectionsRemindersController } from './collections-reminders.controller';
import { CollectionsRemindersService } from './collections-reminders.service';
import { PendingCollectionsService } from './pending-collections.service';
import { CollectionsStickyService } from './collections-sticky.service';

@Module({
  imports: [NotificationsModule],
  controllers: [CollectionsController, CollectionsRemindersController],
  providers: [
    CollectionsRemindersService,
    PendingCollectionsService,
    CollectionsStickyService,
  ],
  exports: [PendingCollectionsService],
})
export class CollectionsModule {}
