'use client';

import * as motion from 'motion/react-client';
import { useState } from 'react';

export function StateAnimations() {
  const [x, setX] = useState(0);
  const [y, setY] = useState(0);
  const [rotate, setRotate] = useState(0);

  return (
    <div className="flex flex-col items-center gap-8 sm:flex-row">
      <div className="flex h-56 w-56 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-slate-200 bg-slate-50">
        <motion.div
          className="pointer-events-none h-[200px] w-[200px] rounded-[20px] border-[5px] border-dotted border-accent"
          animate={{ x, y, rotate }}
          transition={{ type: 'spring' }}
        />
      </div>
      <div className="flex w-full min-w-0 flex-col">
        <Input value={x} set={setX}>
          x
        </Input>
        <Input value={y} set={setY}>
          y
        </Input>
        <Input value={rotate} set={setRotate} min={-180} max={180}>
          rotate
        </Input>
      </div>
    </div>
  );
}

type InputProps = {
  children: string;
  value: number;
  set: (newValue: number) => void;
  min?: number;
  max?: number;
};

function Input({ value, children, set, min = -200, max = 200 }: InputProps) {
  return (
    <label className="my-2.5 flex items-center gap-2">
      <code className="w-20 shrink-0 font-mono text-sm text-accent">{children}</code>
      <input
        className="h-2.5 w-full max-w-[12rem] cursor-pointer appearance-none accent-accent [&::-webkit-slider-runnable-track]:h-2.5 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:border [&::-webkit-slider-runnable-track]:border-slate-200 [&::-webkit-slider-runnable-track]:bg-slate-50 [&::-webkit-slider-thumb]:relative [&::-webkit-slider-thumb]:-mt-1 [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-accent"
        value={value}
        type="range"
        min={min}
        max={max}
        onChange={(e) => set(parseFloat(e.target.value))}
      />
      <input
        className="ml-1 w-16 border-0 border-b border-dotted border-accent bg-transparent font-mono text-sm text-accent outline-none focus:border-solid focus:border-b-2 [&::-webkit-inner-spin-button]:appearance-none"
        type="number"
        value={value}
        min={min}
        max={max}
        onChange={(e) => set(parseFloat(e.target.value) || 0)}
      />
    </label>
  );
}
