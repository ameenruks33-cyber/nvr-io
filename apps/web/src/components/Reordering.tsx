'use client';

import type { Transition } from 'motion/react';
import * as motion from 'motion/react-client';
import { useEffect, useState } from 'react';

const TILES = [
  { id: 'accent', className: 'bg-accent' },
  { id: 'soft', className: 'bg-accent-soft' },
  { id: 'completed', className: 'bg-status-completed' },
  { id: 'active', className: 'bg-status-active' },
] as const;

type TileId = (typeof TILES)[number]['id'];

const tileClass = Object.fromEntries(
  TILES.map((t) => [t.id, t.className]),
) as Record<TileId, string>;

const initialOrder: TileId[] = TILES.map((t) => t.id);

const spring: Transition = {
  type: 'spring',
  damping: 20,
  stiffness: 300,
};

function shuffle<T>(array: T[]): T[] {
  const next = [...array];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

export function Reordering() {
  const [order, setOrder] = useState(initialOrder);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setOrder((prev) => shuffle(prev));
    }, 1000);
    return () => clearTimeout(timeout);
  }, [order]);

  return (
    <ul className="relative m-0 flex w-[300px] max-w-full list-none flex-wrap items-center justify-center gap-2.5 p-0">
      {order.map((id) => (
        <motion.li
          key={id}
          layout
          transition={spring}
          className={`h-[100px] w-[100px] rounded-xl ${tileClass[id]}`}
        />
      ))}
    </ul>
  );
}
