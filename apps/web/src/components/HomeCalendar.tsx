'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  addUaeCalendarDays,
  daysInUaeMonth,
  shiftUaeMonth,
  uaeClockParts,
  uaeDayNumber,
  uaeMonthYearLabel,
  uaeToday,
  uaeWeekdayIndex,
} from '@/lib/uae-datetime';

type ReminderRow = {
  id: string;
  reminderDay: string;
  message: string;
};

function AnalogClock({ hours, minutes }: { hours: number; minutes: number }) {
  const minuteAngle = minutes * 6;
  const hourAngle = (hours % 12) * 30 + minutes * 0.5;
  return (
    <svg width="72" height="72" viewBox="0 0 72 72" aria-hidden>
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
  const [today, setToday] = useState(uaeToday);
  const [clock, setClock] = useState(() => uaeClockParts());
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => uaeToday().slice(0, 7));
  const [reminders, setReminders] = useState<Record<string, string>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const previewDays = useMemo(() => {
    const start = addUaeCalendarDays(today, -10);
    return Array.from({ length: 20 }, (_, i) => addUaeCalendarDays(start, i));
  }, [today]);

  useEffect(() => {
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

  const monthLabel = uaeMonthYearLabel(today.slice(0, 7));

  return (
    <>
      <button
        type="button"
        onClick={() => openMonth()}
        className="group mx-auto mb-6 block w-full max-w-[17.5rem] rounded-3xl bg-gradient-to-br from-blue-500 via-blue-600 to-blue-700 p-4 shadow-lg ring-1 ring-blue-400/40 transition hover:shadow-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-white"
        aria-label="Open calendar and reminders"
      >
        <div className="relative pb-2">
          <div className="overflow-hidden rounded-2xl bg-white shadow-md">
            <div className="bg-gradient-to-b from-red-500 to-red-600 px-3 pb-2 pt-2">
              <div className="mb-1 flex justify-center gap-3">
                <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-b from-slate-200 to-slate-400 shadow-inner" />
                <span className="h-2.5 w-2.5 rounded-full bg-gradient-to-b from-slate-200 to-slate-400 shadow-inner" />
              </div>
              <p className="text-center text-xs font-semibold tracking-wide text-white">
                {monthLabel}
              </p>
            </div>
            <div className="grid grid-cols-5 gap-1.5 p-2.5">
              {previewDays.map((day) => {
                const isToday = day === today;
                const hasReminder = Boolean(reminders[day]);
                return (
                  <span
                    key={day}
                    className={`flex aspect-square items-center justify-center rounded-md text-[10px] font-semibold sm:text-xs ${
                      isToday
                        ? 'bg-red-500 text-white shadow-sm'
                        : hasReminder
                          ? 'bg-amber-100 text-amber-900 ring-1 ring-amber-300'
                          : 'bg-slate-200/80 text-slate-600'
                    }`}
                  >
                    {uaeDayNumber(day)}
                  </span>
                );
              })}
            </div>
          </div>
          <div
            className="absolute -bottom-1 -right-1 rounded-full bg-blue-600 p-0.5 shadow-lg ring-2 ring-white"
            aria-hidden
          >
            <AnalogClock hours={clock.hours} minutes={clock.minutes} />
          </div>
        </div>
        <p className="mt-3 text-center text-xs font-medium text-blue-100 group-hover:text-white">
          Tap for full calendar · UAE time
        </p>
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-3 sm:items-center"
          role="dialog"
          aria-modal="true"
          aria-labelledby="home-calendar-title"
          onClick={() => setOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setViewMonth((m) => shiftUaeMonth(m, -1))}
              >
                ‹
              </button>
              <h2
                id="home-calendar-title"
                className="font-display text-lg text-slate-900"
              >
                {uaeMonthYearLabel(viewMonth)}
              </h2>
              <button
                type="button"
                className="rounded-lg px-2 py-1 text-sm text-slate-600 hover:bg-slate-100"
                onClick={() => setViewMonth((m) => shiftUaeMonth(m, 1))}
              >
                ›
              </button>
              <button
                type="button"
                className="ml-1 rounded-lg px-2 py-1 text-lg text-slate-500 hover:bg-slate-100"
                onClick={() => setOpen(false)}
                aria-label="Close calendar"
              >
                ×
              </button>
            </div>

            <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs font-medium text-slate-500">
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((w) => (
                <span key={w}>{w}</span>
              ))}
            </div>
            <div className="mt-1 grid grid-cols-7 gap-1">
              {monthCells.map((day, i) =>
                day ? (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setSelectedDay(day)}
                    className={`relative flex h-10 flex-col items-center justify-center rounded-lg text-sm ${
                      day === today
                        ? 'bg-red-500 font-semibold text-white'
                        : selectedDay === day
                          ? 'bg-blue-100 font-medium text-slate-900'
                          : 'text-slate-800 hover:bg-slate-100'
                    }`}
                  >
                    {Number(uaeDayNumber(day))}
                    {reminders[day] ? (
                      <span className="absolute bottom-1 h-1 w-1 rounded-full bg-amber-500" />
                    ) : null}
                  </button>
                ) : (
                  <span key={`e-${i}`} />
                ),
              )}
            </div>

            {selectedDay ? (
              <form
                onSubmit={saveReminder}
                className="mt-4 space-y-2 border-t border-slate-200 pt-4"
              >
                <p className="text-sm font-medium text-slate-900">
                  Reminder · {selectedDay}
                </p>
                <textarea
                  className="min-h-[4.5rem] w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm outline-none ring-accent focus:ring-2"
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
                <div className="flex flex-wrap gap-2">
                  <button
                    type="submit"
                    disabled={busy || !draft.trim()}
                    className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
                  >
                    {busy ? 'Saving…' : 'Save reminder'}
                  </button>
                  {reminders[selectedDay] ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void clearReminder()}
                      className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                    >
                      Remove
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
