import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  private assertDay(day: string) {
    if (!DAY.test(day)) {
      throw new BadRequestException('Invalid calendar day');
    }
  }

  async listForUser(userId: string, from: string, to: string) {
    this.assertDay(from);
    this.assertDay(to);
    if (from > to) {
      throw new BadRequestException('from must be before to');
    }
    const rows = await this.prisma.calendarReminder.findMany({
      where: {
        userId,
        reminderDay: { gte: from, lte: to },
      },
      orderBy: { reminderDay: 'asc' },
      select: {
        id: true,
        reminderDay: true,
        message: true,
        updatedAt: true,
      },
    });
    return { reminders: rows };
  }

  async upsert(userId: string, day: string, message: string) {
    this.assertDay(day);
    const trimmed = message.trim();
    if (!trimmed) {
      throw new BadRequestException('Reminder message is required');
    }
    const row = await this.prisma.calendarReminder.upsert({
      where: {
        userId_reminderDay: { userId, reminderDay: day },
      },
      create: {
        userId,
        reminderDay: day,
        message: trimmed,
      },
      update: { message: trimmed },
      select: {
        id: true,
        reminderDay: true,
        message: true,
        updatedAt: true,
      },
    });
    return row;
  }

  async remove(userId: string, day: string) {
    this.assertDay(day);
    const existing = await this.prisma.calendarReminder.findUnique({
      where: { userId_reminderDay: { userId, reminderDay: day } },
    });
    if (!existing) {
      throw new NotFoundException('No reminder on this day');
    }
    await this.prisma.calendarReminder.delete({
      where: { id: existing.id },
    });
    return { ok: true };
  }
}
