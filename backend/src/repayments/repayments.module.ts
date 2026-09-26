import { Module, forwardRef } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { RepaymentsController } from './repayments.controller';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [forwardRef(() => NotificationsModule)],
  providers: [RepaymentsService],
  controllers: [RepaymentsController],
  exports: [RepaymentsService],
})
export class RepaymentsModule {}
