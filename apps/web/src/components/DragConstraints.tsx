'use client';

import * as motion from 'motion/react-client';
import { useRef } from 'react';

export function DragConstraints() {
  const constraintsRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      ref={constraintsRef}
      className="relative h-[300px] w-[300px] max-w-full rounded-xl bg-accent/15"
    >
      <motion.div
        drag
        dragConstraints={constraintsRef}
        dragElastic={0.2}
        className="absolute left-0 top-0 h-[100px] w-[100px] cursor-grab touch-none rounded-xl bg-accent active:cursor-grabbing"
      />
    </motion.div>
  );
}
