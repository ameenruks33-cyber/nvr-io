/** UAE wall clock `YYYY-MM-DD` + `HH:mm` → exact instant. */
export function uaeDateTimeToInstant(date: string, time: string) {
  const clock = String(time || '').slice(0, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error('Date must be YYYY-MM-DD');
  }
  if (!/^\d{2}:\d{2}$/.test(clock)) {
    throw new Error('Time must be HH:mm');
  }
  const at = new Date(`${date}T${clock}:00+04:00`);
  if (Number.isNaN(at.getTime())) {
    throw new Error('Invalid date or time');
  }
  return at;
}
