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
