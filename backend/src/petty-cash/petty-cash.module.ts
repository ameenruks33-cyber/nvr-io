import { Module } from '@nestjs/common';
import { PettyCashService } from './petty-cash.service';
import { PettyCashController } from './petty-cash.controller';

@Module({
  providers: [PettyCashService],
  controllers: [PettyCashController],
})
export class PettyCashModule {}
