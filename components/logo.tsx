import Link from 'next/link';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  href?: string;
  subtitle?: string;
  inverted?: boolean;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

const SIZE_CLASSES = {
  sm: 'h-9 sm:h-10',
  md: 'h-11 sm:h-12',
  lg: 'h-13 sm:h-14 md:h-[60px]',
  xl: 'h-14 sm:h-16 md:h-[66px]',
};

/** Single brand mark used everywhere (public site, auth, staff, admin). */
export function Logo({ href = '/', subtitle, inverted = false, className, size = 'lg' }: LogoProps) {
  return (
    <Link href={href} aria-label="Lumière Spa" className={cn('inline-flex items-center gap-3 group', className)}>
      <div className={cn('relative w-auto shrink-0 transition-transform duration-200 group-hover:scale-[1.03]', SIZE_CLASSES[size])}>
        <Image
          src="/logo-ngang.png"
          alt="Lumière Spa"
          width={220}
          height={84}
          className="h-full w-auto object-contain"
          priority
        />
      </div>
      {subtitle && (
        <span
          className={cn(
            'text-xs font-medium px-2.5 py-0.5 rounded-full border self-center',
            inverted
              ? 'bg-white/10 text-white border-white/20'
              : 'bg-primary/10 text-primary border-primary/20'
          )}
        >
          {subtitle}
        </span>
      )}
    </Link>
  );
}
