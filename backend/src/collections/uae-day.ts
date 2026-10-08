export const UAE_TIME_ZONE = 'Asia/Dubai';

export function uaeCalendarDay(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: UAE_TIME_ZONE }).format(d);
}
