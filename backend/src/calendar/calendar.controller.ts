import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Put,
  Query,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { CalendarService } from './calendar.service';
import { UpsertCalendarReminderDto } from './dto/calendar-reminder.dto';

@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  @Get('reminders')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  list(
    @CurrentUser() user: AuthUser,
    @Query('month') month?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    let rangeFrom = from;
    let rangeTo = to;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      const [y, m] = month.split('-').map(Number);
      const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
      rangeFrom = `${month}-01`;
      rangeTo = `${month}-${String(last).padStart(2, '0')}`;
    }
    if (!rangeFrom || !rangeTo) {
      throw new BadRequestException('Provide month=YYYY-MM or from and to');
    }
    return this.calendar.listForUser(user.id, rangeFrom, rangeTo);
  }

  @Put('reminders')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  upsert(@CurrentUser() user: AuthUser, @Body() dto: UpsertCalendarReminderDto) {
    return this.calendar.upsert(user.id, dto.day, dto.message);
  }

  @Delete('reminders/:day')
  @Roles(UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.COLLECTOR)
  remove(@CurrentUser() user: AuthUser, @Param('day') day: string) {
    return this.calendar.remove(user.id, day);
  }
}
