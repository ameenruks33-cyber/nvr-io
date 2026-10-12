'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import {
  addUaeCalendarDays,
  daysInUaeMonth,
  shiftUaeMonth,
  uaeDayNumber,
  uaeMonthYearLabel,
  uaeToday,
  uaeWeekdayIndex,
  uaeWeekdayShort,
} from '@/lib/uae-datetime';

type ReminderRow = {
  id: string;
  reminderDay: string;
  message: string;
};

function CalendarCard({
  day,
  emphasis,
  tilt,
  zIndex,
}: {
  day: string;
  emphasis?: boolean;
  tilt: string;
  zIndex: number;
}) {
  return (
    <div
      className={`pointer-events-none absolute w-[5.5rem] select-none sm:w-[6.25rem] ${tilt}`}
      style={{ zIndex }}
      aria-hidden
    >
      <div className="overflow-hidden rounded-2xl shadow-lg">
        <div className="relative bg-gradient-to-b from-red-500 to-red-600 px-3 pb-2 pt-3 text-center">
          <div className="mx-auto mb-1 flex justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-white/40" />
            <span className="h-2 w-2 rounded-full bg-white/40" />
          </div>
          <p className="text-xs font-bold tracking-wide text-white">
            {uaeWeekdayShort(day)}
          </p>
        </div>
        <div
          className={`px-2 py-4 text-center ${
            emphasis
              ? 'bg-white/90 backdrop-blur-sm'
              : 'bg-slate-800 text-white'
          }`}
        >
          <p
            className={`font-display text-4xl leading-none ${
              emphasis ? 'text-slate-900' : 'text-white'
            }`}
          >
            {uaeDayNumber(day)}
          </p>
        </div>
      </div>
    </div>
  );
}

export function HomeCalendar() {
  const [today, setToday] = useState(uaeToday);
  const [open, setOpen] = useState(false);
  const [viewMonth, setViewMonth] = useState(() => uaeToday().slice(0, 7));
  const [reminders, setReminders] = useState<Record<string, string>>({});
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const triplet = useMemo(
    () => ({
      prev: addUaeCalendarDays(today, -1),
      current: today,
      next: addUaeCalendarDays(today, 1),
    }),
    [today],
  );

  useEffect(() => {
    const tick = () => setToday(uaeToday());
    tick();
    const id = window.setInterval(tick, 60_000);
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

  return (
    <>
      <button
        type="button"
        onClick={() => openMonth()}
        className="group relative mx-auto mb-6 flex h-[9.5rem] w-full max-w-xs items-center justify-center rounded-2xl bg-gradient-to-b from-slate-100 to-slate-200/80 ring-1 ring-slate-200 transition hover:from-slate-50 hover:ring-accent/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        aria-label="Open calendar and reminders"
      >
        <CalendarCard day={triplet.prev} tilt="-rotate-6 -translate-x-14" zIndex={1} />
        <CalendarCard
          day={triplet.current}
          emphasis
          tilt="-translate-y-1"
          zIndex={3}
        />
        <CalendarCard day={triplet.next} tilt="rotate-6 translate-x-14" zIndex={2} />
        <span className="absolute bottom-2 text-xs font-medium text-slate-600 group-hover:text-accent">
          Tap for full calendar
        </span>
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
                        ? 'bg-accent font-semibold text-white'
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
              <form onSubmit={saveReminder} className="mt-4 space-y-2 border-t border-slate-200 pt-4">
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
