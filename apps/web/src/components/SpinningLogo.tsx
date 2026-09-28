import Image from 'next/image';
import { APP_ICONS } from '@/lib/app-branding';
import { APP_NAME } from '@/lib/brand';

type SpinningLogoProps = {
  size: number;
  /** Classes for the static tile behind the spinning ball */
  className?: string;
  priority?: boolean;
};

export function SpinningLogo({ size, className = '', priority }: SpinningLogoProps) {
  return (
    <span
      className={`logo-3d-stage inline-flex shrink-0 items-center justify-center bg-white ${className}`}
      style={{ width: size, height: size }}
    >
      <Image
        src={APP_ICONS.logo}
        alt={APP_NAME}
        width={size}
        height={size}
        className="logo-3d h-full w-full object-contain"
        unoptimized
        priority={priority}
      />
    </span>
  );
}
