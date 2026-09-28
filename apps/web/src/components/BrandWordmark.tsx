import { BRAND_HEROSE_RED } from '@/lib/brand';

type BrandWordmarkProps = {
  className?: string;
  /** Visual size */
  size?: 'sm' | 'md' | 'lg' | 'xl';
  /**
   * Photo-style wordmark sits on white; use `onDark` chip for dark UI.
   */
  onDark?: boolean;
};

const sizeClass = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
  xl: 'text-4xl',
} as const;

/**
 * Wordmark like the brand photo: serif,
 * "Crick" black + "herose" red.
 */
export function BrandWordmark({
  className = '',
  size = 'md',
  onDark = false,
}: BrandWordmarkProps) {
  const letters = [
    ...Array.from('Crick', (ch) => ({ ch, color: '#000000' })),
    ...Array.from('herose', (ch) => ({ ch, color: BRAND_HEROSE_RED })),
  ];
  const mark = (
    <span
      role="img"
      aria-label="Crickherose"
      className={`wordmark-3d whitespace-nowrap font-display font-semibold tracking-tight leading-none ${sizeClass[size]} ${className}`}
    >
      {letters.map(({ ch, color }, i) => (
        <span
          key={i}
          aria-hidden="true"
          className="wordmark-letter"
          style={{ color, animationDelay: `${i * 0.15}s` }}
        >
          {ch}
        </span>
      ))}
    </span>
  );

  if (!onDark) return mark;

  return (
    <span className="inline-flex shrink-0 items-center whitespace-nowrap rounded-lg bg-white px-2.5 py-1 shadow-sm">
      {mark}
    </span>
  );
}
