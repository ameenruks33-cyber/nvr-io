import { IsString, Matches, MaxLength, MinLength } from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class UpsertCalendarReminderDto {
  @IsString()
  @Matches(DAY, { message: 'day must be YYYY-MM-DD' })
  day!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  message!: string;
}

export class CalendarRangeQueryDto {
  @IsString()
  @Matches(DAY)
  from!: string;

  @IsString()
  @Matches(DAY)
  to!: string;
}
