import { Module } from '@nestjs/common';
import { MonthlyAuditController } from './monthly-audit.controller';
import { MonthlyAuditService } from './monthly-audit.service';

@Module({
  controllers: [MonthlyAuditController],
  providers: [MonthlyAuditService],
  exports: [MonthlyAuditService],
})
export class MonthlyAuditModule {}
