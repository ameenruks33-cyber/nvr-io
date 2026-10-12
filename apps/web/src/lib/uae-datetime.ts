/** Matches backend `collections/uae-day.ts` — all user-visible dates use UAE. */
export const UAE_TIME_ZONE = 'Asia/Dubai';

export function formatUaeDateTime(value: string | Date): string {
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

export function formatUaeTime(value: string | Date): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleTimeString('en-GB', {
    timeZone: UAE_TIME_ZONE,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/** `YYYY-MM-DD` calendar day in UAE. */
/** Current UAE calendar day `YYYY-MM-DD`. */
export function uaeToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: UAE_TIME_ZONE }).format(
    new Date(),
  );
}

export function addUaeCalendarDays(day: string, delta: number): string {
  const d = new Date(`${day}T12:00:00+04:00`);
  d.setDate(d.getDate() + delta);
  return new Intl.DateTimeFormat('en-CA', { timeZone: UAE_TIME_ZONE }).format(
    d,
  );
}

export function uaeWeekdayShort(day: string): string {
  const d = new Date(`${day}T12:00:00+04:00`);
  return d
    .toLocaleDateString('en-US', { timeZone: UAE_TIME_ZONE, weekday: 'short' })
    .slice(0, 3)
    .toUpperCase();
}

export function uaeDayNumber(day: string): string {
  const d = new Date(`${day}T12:00:00+04:00`);
  return d.toLocaleDateString('en-GB', {
    timeZone: UAE_TIME_ZONE,
    day: 'numeric',
  });
}

export function uaeMonthYearLabel(month: string): string {
  const d = new Date(`${month}-01T12:00:00+04:00`);
  return d.toLocaleDateString('en-GB', {
    timeZone: UAE_TIME_ZONE,
    month: 'long',
    year: 'numeric',
  });
}

export function daysInUaeMonth(month: string): number {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
}

export function uaeWeekdayIndex(day: string): number {
  const d = new Date(`${day}T12:00:00+04:00`);
  const wd = d.toLocaleDateString('en-US', {
    timeZone: UAE_TIME_ZONE,
    weekday: 'short',
  });
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  return map[wd.slice(0, 3)] ?? 0;
}

export function shiftUaeMonth(month: string, delta: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(`${y}-${String(m).padStart(2, '0')}-01T12:00:00+04:00`);
  d.setMonth(d.getMonth() + delta);
  return new Intl.DateTimeFormat('en-CA', { timeZone: UAE_TIME_ZONE })
    .format(d)
    .slice(0, 7);
}

export function formatUaeCalendarDay(day: string): string {
  const d = new Date(`${day}T12:00:00+04:00`);
  if (Number.isNaN(d.getTime())) return day;
  return d.toLocaleDateString('en-GB', {
    timeZone: UAE_TIME_ZONE,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
