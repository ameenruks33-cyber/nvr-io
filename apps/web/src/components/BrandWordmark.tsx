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
 * Wordmark like the brand photo: lowercase serif,
 * "crick" black + "herose" red.
 */
export function BrandWordmark({
  className = '',
  size = 'md',
  onDark = false,
}: BrandWordmarkProps) {
  const mark = (
    <span
      className={`font-display font-semibold tracking-tight lowercase leading-none ${sizeClass[size]} ${className}`}
    >
      <span className="text-black">crick</span>
      <span style={{ color: BRAND_HEROSE_RED }}>herose</span>
    </span>
  );

  if (!onDark) return mark;

  return (
    <span className="inline-flex items-center rounded-lg bg-white px-2.5 py-1 shadow-sm">
      {mark}
    </span>
  );
}
