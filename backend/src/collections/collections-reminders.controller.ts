import {
  Controller,
  Get,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { timingSafeEqual } from 'crypto';
import { Public } from '../auth/decorators/public.decorator';
import { CollectionsRemindersService } from './collections-reminders.service';

@Controller('collections/reminders')
export class CollectionsRemindersController {
  constructor(
    private readonly reminders: CollectionsRemindersService,
    private readonly config: ConfigService,
  ) {}

  /** Vercel cron — pending collection reminders (UAE morning). */
  @Public()
  @Get('daily')
  async daily(@Headers('authorization') auth?: string) {
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
    return this.reminders.runDailyPendingReminders();
  }
}
