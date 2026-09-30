import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { formatDuration, formatPrice, STATUS_DOT_COLORS, type AppointmentStatus } from '@/lib/types';
import { StatusBadge } from '@/components/status-badge';
import { cn } from '@/lib/utils';

interface AppointmentRowProps {
  startTime: string;
  durationMin: number;
  status: AppointmentStatus;
  price: number;
  title: string;
  /** Secondary line, e.g. "Khách A · 0901… · Lan" */
  meta?: string;
  /** "time": big time + duration (day lists) · "date": big date + time (history lists) */
  lead?: 'time' | 'date';
  code?: string;
  href?: string;
  /** Extra content under the text (notes, action buttons) */
  children?: React.ReactNode;
  className?: string;
}

/**
 * The single appointment list row used everywhere (dashboard, list, staff, account, customer detail).
 * Mobile: title gets the full width and wraps; status + price move to their own line under it.
 */
export function AppointmentRow({
  startTime, durationMin, status, price, title, meta, lead = 'time', code, href, children, className,
}: AppointmentRowProps) {
  const start = new Date(startTime);
  const time = start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const big = lead === 'time' ? time : start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
  const small = lead === 'time' ? formatDuration(durationMin) : time;

  const body = (
    <>
      <div className="w-14 shrink-0 text-center">
        <p className="text-base font-bold text-foreground">{big}</p>
        <p className="text-xs text-muted-foreground">{small}</p>
      </div>
      <span className={cn('w-1 shrink-0 self-stretch rounded-full', STATUS_DOT_COLORS[status])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug text-foreground">
          {title}
          {code && <span className="ml-2 align-middle text-xs font-normal text-muted-foreground">#{code}</span>}
        </p>
        {meta && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground sm:truncate">{meta}</p>}
        <div className="mt-2 flex items-center justify-between gap-2 sm:hidden">
          <StatusBadge status={status} />
          <span className="text-sm font-semibold text-primary">{formatPrice(price)}</span>
        </div>
        {children}
      </div>
      <div className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
        <StatusBadge status={status} />
        <span className="text-sm font-semibold text-primary">{formatPrice(price)}</span>
      </div>
      {href && <ChevronRight className="hidden h-4 w-4 shrink-0 self-center text-muted-foreground sm:block" aria-hidden />}
    </>
  );

  const cls = cn('flex gap-3 rounded-xl border border-border bg-card p-3 sm:items-center sm:p-4', className);
  return href ? (
    <Link href={href} className={cn(cls, 'transition-colors hover:border-primary/30 hover:bg-muted/40')}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}
