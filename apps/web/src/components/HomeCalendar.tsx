'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  addUaeCalendarDays,
  daysInUaeMonth,
  formatUaeTime,
  shiftUaeMonth,
  uaeClockParts,
  uaeDayNumber,
  uaeMonthYearLabel,
  uaeToday,
  uaeWeekdayIndex,
} from '@/lib/uae-datetime';

/** SSR / deploy check — must stay in sync with verify-production-security.mjs */
export const HOME_CALENDAR_MARKER = 'nvr-home-calendar-app-icon';

type ReminderRow = {
  id: string;
  reminderDay: string;
  message: string;
};

function AnalogClock({
  hours,
  minutes,
  className,
}: {
  hours: number;
  minutes: number;
  className?: string;
}) {
  const minuteAngle = minutes * 6;
  const hourAngle = (hours % 12) * 30 + minutes * 0.5;
  return (
    <svg
      viewBox="0 0 72 72"
      className={className}
      aria-hidden
    >
      <circle cx="36" cy="36" r="34" fill="#1d4ed8" />
      <circle cx="36" cy="36" r="28" fill="#fff" />
      {[...Array(12)].map((_, i) => {
        const a = (i * 30 * Math.PI) / 180;
        const x1 = 36 + Math.sin(a) * 22;
        const y1 = 36 - Math.cos(a) * 22;
        const x2 = 36 + Math.sin(a) * 25;
        const y2 = 36 - Math.cos(a) * 25;
        return (
          <line
            key={i}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="#1d4ed8"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        );
      })}
      <line
        x1="36"
        y1="36"
        x2={36 + Math.sin((hourAngle * Math.PI) / 180) * 14}
        y2={36 - Math.cos((hourAngle * Math.PI) / 180) * 14}
        stroke="#1e3a8a"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <line
        x1="36"
        y1="36"
        x2={36 + Math.sin((minuteAngle * Math.PI) / 180) * 20}
        y2={36 - Math.cos((minuteAngle * Math.PI) / 180) * 20}
        stroke="#1e40af"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="36" cy="36" r="3" fill="#dc2626" />
    </svg>
  );
}

export function HomeCalendar() {
  const [mounted, setMounted] = useState(false);
  const [today, setToday] = useState('');
  const [clock, setClock] = useState({ hours: 0, minutes: 0 });
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => uaeToday().slice(0, 7));
  const [reminders, setReminders] = useState<Record<string, string>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const previewDays = useMemo(() => {
    if (!today) return [];
    const start = addUaeCalendarDays(today, -10);
    return Array.from({ length: 20 }, (_, i) => addUaeCalendarDays(start, i));
  }, [today]);

  useEffect(() => {
    setMounted(true);
    const tick = () => {
      setToday(uaeToday());
      setClock(uaeClockParts());
    };
    tick();
    const id = window.setInterval(tick, 30_000);
    return () => window.clearInterval(id);
  }, []);

  const loadReminders = useCallback(async (month: string) => {
    const data = await api<{ reminders: ReminderRow[] }>(
      `/calendar/reminders?month=${encodeURIComponent(month)}`,
    );
    const map: Record<string, string> = {};
    for (const r of data.reminders) {
      map[r.reminderDay] = r.message;
    }
    setReminders(map);
  }, []);

  useEffect(() => {
    if (!today) return;
    void loadReminders(today.slice(0, 7)).catch(() => setReminders({}));
  }, [today, loadReminders]);

  useEffect(() => {
    if (!open) return;
    void loadReminders(viewMonth).catch(() => setReminders({}));
  }, [open, viewMonth, loadReminders]);

  useEffect(() => {
    if (!selectedDay) {
      setDraft('');
      return;
    }
    setDraft(reminders[selectedDay] || '');
    setStatus('');
  }, [selectedDay, reminders]);

  const monthCells = useMemo(() => {
    const first = `${viewMonth}-01`;
    const leading = uaeWeekdayIndex(first);
    const total = daysInUaeMonth(viewMonth);
    const cells: (string | null)[] = [];
    for (let i = 0; i < leading; i += 1) cells.push(null);
    for (let d = 1; d <= total; d += 1) {
      cells.push(`${viewMonth}-${String(d).padStart(2, '0')}`);
    }
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [viewMonth]);

  async function saveReminder(e: FormEvent) {
    e.preventDefault();
    if (!selectedDay || !draft.trim()) return;
    setBusy(true);
    setStatus('');
    try {
      await api('/calendar/reminders', {
        method: 'PUT',
        body: JSON.stringify({ day: selectedDay, message: draft.trim() }),
      });
      setReminders((prev) => ({ ...prev, [selectedDay]: draft.trim() }));
      setStatus('Reminder saved.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  }

  async function clearReminder() {
    if (!selectedDay || !reminders[selectedDay]) return;
    setBusy(true);
    setStatus('');
    try {
      await api(`/calendar/reminders/${selectedDay}`, { method: 'DELETE' });
      setReminders((prev) => {
        const next = { ...prev };
        delete next[selectedDay];
        return next;
      });
      setDraft('');
      setStatus('Reminder removed.');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : 'Could not remove');
    } finally {
      setBusy(false);
    }
  }

  function openMonth(day?: string) {
    const t = uaeToday();
    setToday(t);
    setViewMonth((day || t).slice(0, 7));
    setSelectedDay(day || t);
    setOpen(true);
  }

  const monthLabel = today ? uaeMonthYearLabel(today.slice(0, 7)) : '';
  const timeLabel =
    mounted && today
      ? formatUaeTime(new Date())
      : '';

  return (
    <>
      <span className="sr-only">{HOME_CALENDAR_MARKER}</span>

      {!mounted || !today ? (
        <div
          data-calendar={HOME_CALENDAR_MARKER}
          className="mx-auto mb-4 aspect-[4/5] w-[10.5rem] max-w-[85%] animate-pulse rounded-2xl bg-gradient-to-br from-blue-400/50 to-blue-700/50 shadow-inner sm:w-44"
          aria-hidden
        />
      ) : (
        <button
          type="button"
          data-calendar={HOME_CALENDAR_MARKER}
          onClick={() => openMonth()}
          className="group mx-auto mb-4 flex w-[10.5rem] max-w-[85%] touch-manipulation flex-col rounded-2xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 p-2 shadow-md ring-1 ring-blue-400/50 transition active:scale-[0.98] hover:shadow-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-white sm:w-44 sm:p-2.5"
          aria-label="Open calendar and reminders"
        >
          <div className="relative w-full pb-2">
            <div className="overflow-hidden rounded-xl bg-white shadow-sm ring-1 ring-black/5">
              <div className="bg-gradient-to-b from-red-500 to-red-600 px-2 pb-1.5 pt-1.5">
                <div className="mb-0.5 flex justify-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-b from-slate-100 to-slate-400 shadow-sm" />
                  <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-b from-slate-100 to-slate-400 shadow-sm" />
                </div>
                <p className="text-center text-[9px] font-bold uppercase tracking-wide text-white">
                  {monthLabel}
                </p>
              </div>
              <div
                className="grid grid-cols-5 gap-0.5 p-1.5"
                aria-hidden
              >
                {previewDays.map((day) => {
                  const isToday = day === today;
                  const hasReminder = Boolean(reminders[day]);
                  return (
                    <span
                      key={day}
                      className={`flex aspect-square items-center justify-center rounded-[3px] text-[8px] font-bold leading-none sm:text-[9px] ${
                        isToday
                          ? 'bg-red-500 text-white ring-1 ring-red-600'
                          : hasReminder
                            ? 'bg-amber-100 text-amber-950 ring-1 ring-amber-300'
                            : 'bg-slate-200/90 text-slate-600 ring-1 ring-slate-300/60'
                      }`}
                    >
                      {uaeDayNumber(day)}
                    </span>
                  );
                })}
              </div>
            </div>
            <div
              className="pointer-events-none absolute -bottom-0.5 -right-0.5 rounded-full bg-blue-600 p-px shadow-md ring-2 ring-white"
              aria-hidden
            >
              <AnalogClock
                hours={clock.hours}
                minutes={clock.minutes}
                className="h-9 w-9 sm:h-10 sm:w-10"
              />
            </div>
          </div>
          <p className="text-center text-[9px] font-semibold leading-tight text-blue-100">
            Tap for full calendar
          </p>
          {timeLabel ? (
            <p className="mt-px text-center text-[8px] font-medium leading-tight text-blue-200/90">
              {timeLabel} · UAE
            </p>
          ) : null}
        </button>
      )}

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-calendar-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[min(92vh,40rem)] w-full max-w-md overflow-y-auto rounded-t-2xl border border-slate-200 bg-white p-4 shadow-xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-1">
              <button
                type="button"
                className="min-h-11 min-w-11 rounded-xl text-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200"
                onClick={() => setViewMonth((m) => shiftUaeMonth(m, -1))}
                aria-label="Previous month"
              >
                ‹
              </button>
              <h2
                id="home-calendar-title"
                className="font-display text-base text-slate-900 sm:text-lg"
              >
                {uaeMonthYearLabel(viewMonth)}
              </h2>
              <button
                type="button"
                className="min-h-11 min-w-11 rounded-xl text-lg text-slate-600 hover:bg-slate-100 active:bg-slate-200"
                onClick={() => setViewMonth((m) => shiftUaeMonth(m, 1))}
                aria-label="Next month"
              >
                ›
              </button>
              <button
                type="button"
                className="min-h-11 min-w-11 rounded-xl text-xl text-slate-500 hover:bg-slate-100"
                onClick={() => setOpen(false)}
                aria-label="Close calendar"
              >
                ×
              </button>
            </div>

            <div className="mt-2 grid grid-cols-7 gap-0.5 text-center text-[11px] font-semibold text-slate-500 sm:text-xs">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => (
                <span key={w} className="py-1">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {monthCells.map((day, i) =>
                day ? (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`relative flex min-h-11 flex-col items-center justify-center rounded-xl text-sm font-medium touch-manipulation active:scale-95 sm:min-h-10 ${
                      day === today
                        ? 'bg-red-500 text-white shadow-sm'
                        : selectedDay === day
                          ? 'bg-blue-100 text-slate-900'
                          : 'text-slate-800 hover:bg-slate-100 active:bg-slate-200'
                    }`}
                  >
                    {Number(uaeDayNumber(day))}
                    {reminders[day] ? (
                      <span className="absolute bottom-1.5 h-1.5 w-1.5 rounded-full bg-amber-500" />
                    ) : null}
                  </button>
                ) : (
                  <span key={`e-${i}`} aria-hidden />
                ),
              )}
            </div>

            {selectedDay ? (
              <form
                onSubmit={saveReminder}
                className="mt-4 space-y-3 border-t border-slate-200 pt-4"
              >
                <p className="text-sm font-medium text-slate-900">
                  Reminder · {selectedDay}
                </p>
                <textarea
                  className="min-h-[5rem] w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-base outline-none ring-accent focus:ring-2 sm:text-sm"
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="Note for this day (e.g. follow up collection)"
                  maxLength={500}
                />
                {status ? (
                  <p className="text-xs text-teal-700" role="status">
                    {status}
                  </p>
                ) : null}
                <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                  <button
                    type="submit"
                    disabled={busy || !draft.trim()}
                    className="min-h-11 flex-1 rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60 sm:flex-none"
                  >
                    {busy ? 'Saving…' : 'Save reminder'}
                  </button>
                  {reminders[selectedDay] || draft.trim() ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (reminders[selectedDay]) void clearReminder();
                        else setDraft('');
                      }}
                      className="min-h-11 flex-1 rounded-xl border border-slate-300 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60 sm:flex-none"
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
              </form>
            ) : (
              <p className="mt-4 text-sm text-slate-500">
                Select a day to add or edit a reminder.
              </p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
