export const UAE_TIME_ZONE = 'Asia/Dubai';

export function uaeCalendarDay(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: UAE_TIME_ZONE }).format(d);
}

/** UTC instant for 00:00 on a UAE YYYY-MM-DD calendar day. */
export function startOfUaeDayUtc(day: string): Date {
  return new Date(`${day}T00:00:00+04:00`);
}

export function nextUaeCalendarDay(day: string): string {
  const d = new Date(`${day}T12:00:00+04:00`);
  d.setDate(d.getDate() + 1);
  return uaeCalendarDay(d);
}

export function uaeDayBounds(day = uaeCalendarDay()) {
  const start = startOfUaeDayUtc(day);
  const end = startOfUaeDayUtc(nextUaeCalendarDay(day));
  return { day, start, end };
}
