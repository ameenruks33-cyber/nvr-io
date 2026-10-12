'use client';

import { useState, type InputHTMLAttributes } from 'react';

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a14.28 14.28 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A14.28 14.28 0 0 0 2 12s3 7 10 7a9.9 9.9 0 0 0 5.39-1.61" />
      <line x1="2" x2="22" y1="2" y2="22" />
    </svg>
  );
}

type PasswordInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'type'> & {
  showToggle?: boolean;
};

export function PasswordInput({
  showToggle = false,
  className = '',
  ...props
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  if (!showToggle) {
    return <input {...props} type="password" className={className} />;
  }

  const inputClass = className.includes('pr-')
    ? className
    : `${className} pr-11`.trim();

  return (
    <div className="relative w-full">
      <input
        {...props}
        type={visible ? 'text' : 'password'}
        className={inputClass}
      />
      <button
        type="button"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
        onClick={() => setVisible((v) => !v)}
        aria-label={visible ? 'Hide password' : 'Show password'}
        aria-pressed={visible}
      >
        {visible ? <EyeOffIcon /> : <EyeIcon />}
      </button>
    </div>
  );
}
