import {
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { UserRole } from '@prisma/client';
import { timingSafeEqual } from 'crypto';
import { Public } from '../auth/decorators/public.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { assertSafeId } from '../common/safe-input';
import { MonthlyAuditService } from './monthly-audit.service';

@Controller('monthly-audit')
export class MonthlyAuditController {
  constructor(
    private readonly audits: MonthlyAuditService,
    private readonly config: ConfigService,
  ) {}

  private assertCron(auth?: string) {
    const secret = this.config.get<string>('CRON_SECRET')?.trim();
    const expected = Buffer.from(`Bearer ${secret ?? ''}`);
    const given = Buffer.from(auth ?? '');
    if (
      !secret ||
      expected.length !== given.length ||
      !timingSafeEqual(expected, given)
    ) {
      throw new UnauthorizedException();
    }
  }

  /** Vercel cron — 1st of each month (UTC), audits previous UAE month. */
  @Public()
  @Get('run')
  async cronRun(@Headers('authorization') auth?: string) {
    this.assertCron(auth);
    return this.audits.generate();
  }

  @Get()
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  list(@Query('limit') limit?: string) {
    return this.audits.list(limit ? Number(limit) : 24);
  }

  @Get(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  one(@Param('id') id: string) {
    const safeId = assertSafeId(id, 'audit id');
    return this.audits.getById(safeId);
  }

  /** Admin-only manual run (previous month or ?month=YYYY-MM). */
  @Post('generate')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN)
  generate(@Query('month') month?: string) {
    if (month && !/^\d{4}-\d{2}$/.test(month)) {
      throw new BadRequestException('month must be YYYY-MM');
    }
    return this.audits.generate(month);
  }
}
