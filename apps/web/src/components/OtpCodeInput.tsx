'use client';

import { useEffect, useRef } from 'react';

type Props = {
  value: string;
  onChange: (code: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  status?: { text: string; tone?: 'error' | 'success' } | null;
};

/** 6-digit one-time code field; the code is always checked by the server. */
export function OtpCodeInput({ value, onChange, onSubmit, disabled, status }: Props) {
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  const statusText = status?.text || 'Enter your 6-digit code.';
  const statusClass =
    status?.tone === 'error'
      ? 'text-red-600'
      : status?.tone === 'success'
        ? 'text-emerald-600'
        : 'text-slate-500';

  return (
    <div>
      <input
        ref={ref}
        className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-3 text-center font-mono text-2xl tracking-[0.5em] outline-none ring-blue-500 focus:ring-2"
        type="text"
        inputMode="numeric"
        pattern="\d{6}"
        maxLength={6}
        autoComplete="one-time-code"
        placeholder="••••••"
        aria-label="6-digit code"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onSubmit();
          }
        }}
      />
      <p className={`mt-2 text-sm ${statusClass}`} role="status" aria-live="polite">
        {statusText}
      </p>
    </div>
  );
}
