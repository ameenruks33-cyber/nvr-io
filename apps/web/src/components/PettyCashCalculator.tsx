'use client';

import { useCallback, useState } from 'react';

type Op = '+' | '-' | '×' | '÷';

function parseDisplay(display: string): number {
  const n = Number.parseFloat(display);
  return Number.isFinite(n) ? n : 0;
}

function formatAmount(n: number): string {
  if (!Number.isFinite(n)) return '0';
  const rounded = Math.round(n * 100) / 100;
  const s = String(rounded);
  return s.includes('.') ? s.replace(/\.?0+$/, '') : s;
}

function applyOp(a: number, b: number, op: Op): number | null {
  switch (op) {
    case '+':
      return a + b;
    case '-':
      return a - b;
    case '×':
      return a * b;
    case '÷':
      return b === 0 ? null : a / b;
    default:
      return null;
  }
}

type Props = {
  onUseAmount?: (value: number) => void;
};

export function PettyCashCalculator({ onUseAmount }: Props) {
  const [display, setDisplay] = useState('0');
  const [accumulator, setAccumulator] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<Op | null>(null);
  const [freshEntry, setFreshEntry] = useState(true);

  const reset = useCallback(() => {
    setDisplay('0');
    setAccumulator(null);
    setPendingOp(null);
    setFreshEntry(true);
  }, []);

  const commitPending = useCallback(
    (nextOp: Op | null) => {
      const current = parseDisplay(display);
      if (accumulator !== null && pendingOp) {
        const result = applyOp(accumulator, current, pendingOp);
        if (result === null) {
          setDisplay('Error');
          setAccumulator(null);
          setPendingOp(null);
          setFreshEntry(true);
          return;
        }
        const formatted = formatAmount(result);
        setDisplay(formatted);
        setAccumulator(result);
      } else {
        setAccumulator(current);
      }
      setPendingOp(nextOp);
      setFreshEntry(true);
    },
    [accumulator, display, pendingOp],
  );

  const pressDigit = (digit: string) => {
    if (display === 'Error') {
      reset();
      if (digit !== '.') setDisplay(digit);
      else setDisplay('0.');
      setFreshEntry(false);
      return;
    }
    if (freshEntry || display === '0') {
      setFreshEntry(false);
      setDisplay(digit === '.' ? '0.' : digit);
      return;
    }
    if (digit === '.' && display.includes('.')) return;
    setDisplay(display + digit);
  };

  const pressOp = (op: Op) => {
    if (display === 'Error') return;
    commitPending(op);
  };

  const pressEquals = () => {
    if (display === 'Error') return;
    commitPending(null);
  };

  const pressBackspace = () => {
    if (display === 'Error' || freshEntry) return;
    setDisplay((prev) => {
      if (prev.length <= 1) return '0';
      return prev.slice(0, -1);
    });
  };

  const useForAmount = () => {
    if (display === 'Error') return;
    const value = parseDisplay(display);
    if (value <= 0) return;
    onUseAmount?.(Math.round(value * 100) / 100);
  };

  const btn =
    'flex h-11 items-center justify-center rounded-lg text-sm font-medium transition active:scale-[0.98]';
  const num = `${btn} bg-slate-100 text-slate-900 hover:bg-slate-200`;
  const op = `${btn} bg-blue-100 text-blue-900 hover:bg-blue-200`;
  const util = `${btn} bg-slate-50 text-slate-600 hover:bg-slate-100 text-xs`;

  return (
    <aside
      className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"
      aria-label="Quick calculator"
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-900">Calculator</h2>
        <p className="text-xs text-slate-500">For amounts in AED</p>
      </div>
      <div
        className="mt-3 rounded-lg bg-slate-900 px-3 py-2 text-right font-mono text-2xl tabular-nums text-white"
        aria-live="polite"
      >
        {display}
      </div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        <button type="button" className={util} onClick={reset}>
          C
        </button>
        <button type="button" className={util} onClick={pressBackspace}>
          ⌫
        </button>
        <button type="button" className={op} onClick={() => pressOp('÷')}>
          ÷
        </button>
        <button type="button" className={op} onClick={() => pressOp('×')}>
          ×
        </button>
        {(['7', '8', '9'] as const).map((d) => (
          <button key={d} type="button" className={num} onClick={() => pressDigit(d)}>
            {d}
          </button>
        ))}
        <button type="button" className={op} onClick={() => pressOp('-')}>
          −
        </button>
        {(['4', '5', '6'] as const).map((d) => (
          <button key={d} type="button" className={num} onClick={() => pressDigit(d)}>
            {d}
          </button>
        ))}
        <button type="button" className={op} onClick={() => pressOp('+')}>
          +
        </button>
        {(['1', '2', '3'] as const).map((d) => (
          <button key={d} type="button" className={num} onClick={() => pressDigit(d)}>
            {d}
          </button>
        ))}
        <button type="button" className={op} onClick={pressEquals}>
          =
        </button>
        <button
          type="button"
          className={`${num} col-span-2`}
          onClick={() => pressDigit('0')}
        >
          0
        </button>
        <button type="button" className={num} onClick={() => pressDigit('.')}>
          .
        </button>
        <button
          type="button"
          className={`${btn} bg-teal-600 text-white hover:bg-teal-500 text-xs leading-tight px-1`}
          onClick={useForAmount}
          title="Copy result into the expense amount field"
        >
          Use amount
        </button>
      </div>
    </aside>
  );
}
