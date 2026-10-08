import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { CollectionsRemindersController } from './collections-reminders.controller';
import { CollectionsRemindersService } from './collections-reminders.service';

@Module({
  imports: [NotificationsModule],
  controllers: [CollectionsRemindersController],
  providers: [CollectionsRemindersService],
})
export class CollectionsModule {}
