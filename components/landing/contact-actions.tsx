'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarCheck, MapPin, Phone } from 'lucide-react';
import { SITE, telHref } from '@/lib/site-config';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';

/** "Đang mở cửa · đóng lúc 20:00" computed in spa time (client-side so a cached page never shows a stale state). */
export function OpenStatus({ className }: { className?: string }) {
  const [label, setLabel] = useState<{ open: boolean; text: string } | null>(null);

  useEffect(() => {
    const update = () => {
      const now = new Date().toLocaleTimeString('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit' });
      const open = now >= SITE.open && now < SITE.close;
      setLabel({ open, text: open ? `Đang mở cửa · đóng lúc ${SITE.close}` : `Đã đóng cửa · mở lại lúc ${SITE.open}` });
    };
    update();
    const t = setInterval(update, 60_000);
    return () => clearInterval(t);
  }, []);

  if (!label) return null;
  return (
    <span className={cn('inline-flex items-center gap-2 text-sm font-semibold', label.open ? 'text-success' : 'text-muted-foreground', className)}>
      <span className={cn('h-2 w-2 rounded-full', label.open ? 'animate-pulse bg-success' : 'bg-muted-foreground')} aria-hidden />
      {label.text}
    </span>
  );
}

/** Call / Directions buttons (with click tracking). */
export function ContactButtons({ className }: { className?: string }) {
  const btn = 'inline-flex h-11 items-center justify-center gap-2 rounded-md border border-primary/30 px-4 text-sm font-semibold text-primary transition-colors hover:bg-secondary';
  return (
    <div className={cn('flex flex-wrap gap-2', className)}>
      <a href={telHref(SITE.phone)} onClick={() => track('click_call', { source: 'contact' })} className={btn}>
        <Phone className="h-4 w-4" /> Gọi {SITE.phone}
      </a>
      <a href={SITE.mapUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('click_directions')} className={btn}>
        <MapPin className="h-4 w-4" /> Chỉ đường
      </a>
    </div>
  );
}

/** Phones: sticky bottom bar with the primary actions. */
export function MobileActionBar() {
  const item = 'flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-semibold';
  return (
    <nav
      aria-label="Liên hệ nhanh"
      className="fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-[hsl(var(--cream-soft))]/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
    >
      <a href={telHref(SITE.phone)} onClick={() => track('click_call', { source: 'mobile_bar' })} className={cn(item, 'text-foreground')}>
        <Phone className="h-5 w-5" /> Gọi
      </a>
      <Link href="/booking" className={cn(item, 'm-1.5 rounded-lg bg-primary text-primary-foreground')}>
        <CalendarCheck className="h-5 w-5" /> Đặt lịch
      </Link>
    </nav>
  );
}
