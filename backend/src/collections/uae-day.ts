export const UAE_TIME_ZONE = 'Asia/Dubai';

export function uaeCalendarDay(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: UAE_TIME_ZONE }).format(d);
}

/** Inclusive UAE calendar days from `from` through `to` (both dates count). */
export function uaeCalendarDaysInclusive(from: Date, to: Date = new Date()): number {
  const start = startOfUaeDayUtc(uaeCalendarDay(from)).getTime();
  const end = startOfUaeDayUtc(uaeCalendarDay(to)).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return 1;
  return Math.floor((end - start) / 86_400_000) + 1;
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

export function formatUaeDateTime(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-GB', {
    timeZone: UAE_TIME_ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function uaeDayBounds(day = uaeCalendarDay()) {
  const start = startOfUaeDayUtc(day);
  const end = startOfUaeDayUtc(nextUaeCalendarDay(day));
  return { day, start, end };
}
