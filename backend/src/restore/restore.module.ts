import { Module } from '@nestjs/common';
import { RestoreService } from './restore.service';
import { RestoreController } from './restore.controller';

@Module({
  providers: [RestoreService],
  controllers: [RestoreController],
})
export class RestoreModule {}
