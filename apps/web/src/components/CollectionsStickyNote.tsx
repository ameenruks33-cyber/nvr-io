'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { useLiveRefresh } from '@/lib/live-sync';
import { formatUaeDateTime } from '@/lib/uae-datetime';

type StickyPayload = {
  text: string;
  updatedAt: string | null;
};

type Props = {
  /** Fits the Record collection sidebar column */
  embedded?: boolean;
};

export function CollectionsStickyNote({ embedded }: Props) {
  const [text, setText] = useState('');
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'loading' | 'saving' | 'saved' | 'error'>(
    'loading',
  );
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const skipNextSave = useRef(true);

  const load = useCallback(async () => {
    try {
      const data = await api<StickyPayload>('/collections/sticky-note');
      setText(data.text);
      setUpdatedAt(data.updatedAt);
      skipNextSave.current = true;
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useLiveRefresh(() => void load());

  useEffect(() => {
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setStatus('saving');
      api<StickyPayload>('/collections/sticky-note', {
        method: 'PUT',
        body: JSON.stringify({ text }),
      })
        .then((data) => {
          setUpdatedAt(data.updatedAt);
          setStatus('saved');
        })
        .catch(() => setStatus('error'));
    }, 700);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [text]);

  return (
    <div
      className={`relative rounded-sm border border-amber-200/80 bg-gradient-to-br from-amber-100 via-yellow-100 to-amber-50 p-3 shadow-md shadow-amber-900/10 ${
        embedded ? 'w-full rotate-0' : 'max-w-2xl rotate-[0.35deg] p-4'
      }`}
      style={{
        boxShadow:
          '2px 3px 12px rgba(120, 53, 15, 0.12), inset 0 -2px 0 rgba(251, 191, 36, 0.35)',
      }}
    >
      <div
        className="pointer-events-none absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 rounded-sm bg-amber-300/70 shadow-sm"
        aria-hidden
      />
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="font-medium text-amber-950">Sticky note</h2>
        <p className="text-xs text-amber-900/70">
          {status === 'loading'
            ? 'Loading…'
            : status === 'saving'
              ? 'Saving…'
              : status === 'saved'
                ? 'Saved'
                : status === 'error'
                  ? 'Could not sync'
                  : updatedAt
                    ? `Updated ${formatUaeDateTime(updatedAt)}`
                    : 'Shared with your team'}
        </p>
      </div>
      <textarea
        value={text}
        onChange={(e) => {
          setStatus('idle');
          setText(e.target.value);
        }}
        rows={embedded ? 5 : 4}
        maxLength={1000}
        placeholder={
          embedded
            ? 'Team reminders for collections…'
            : 'Write reminders for today’s collections — visible to everyone on this screen.'
        }
        className="mt-2 w-full resize-y border-0 bg-transparent text-sm leading-relaxed text-amber-950 placeholder:text-amber-800/45 outline-none focus:ring-0"
        aria-label="Collections sticky note"
      />
      <p className="mt-1 text-right text-[10px] text-amber-900/50">
        {text.length}/1000 · auto-saves
      </p>
    </div>
  );
}
