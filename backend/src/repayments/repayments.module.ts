import { Module, forwardRef } from '@nestjs/common';
import { RepaymentsService } from './repayments.service';
import { RepaymentsController } from './repayments.controller';
import { NotificationsModule } from '../notifications/notifications.module';
import { WhatsappModule } from '../whatsapp/whatsapp.module';

@Module({
  imports: [forwardRef(() => NotificationsModule), WhatsappModule],
  providers: [RepaymentsService],
  controllers: [RepaymentsController],
  exports: [RepaymentsService],
})
export class RepaymentsModule {}
