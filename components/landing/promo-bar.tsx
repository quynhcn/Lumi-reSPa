'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Gift, X } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';

const KEY = 'spaflow.promo.dismissed';

/** Thin announcement bar above the header for the first-visit offer (dismiss is remembered per browser). */
export function PromoBar({ pct }: { pct: number }) {
  const [hidden, setHidden] = useState(false);
  const { user, role } = useAuth();
  const [eligible, setEligible] = useState(true);

  // Returning customers (any non-cancelled booking) and staff accounts are not eligible — don't tease them.
  useEffect(() => {
    if (!user) return setEligible(true);
    if (role && role !== 'customer') return setEligible(false);
    supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .neq('status', 'cancelled')
      .then(({ count }) => setEligible(!count));
  }, [user, role]);

  useEffect(() => {
    try {
      if (localStorage.getItem(KEY) === String(pct)) setHidden(true);
    } catch {
      /* storage unavailable (private mode) — just show the bar */
    }
  }, [pct]);

  if (hidden || !eligible || pct <= 0) return null;

  const dismiss = () => {
    setHidden(true);
    try {
      localStorage.setItem(KEY, String(pct));
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="relative bg-[hsl(var(--deep))] text-[hsl(var(--cream))]">
      <div className="mx-auto flex max-w-[1200px] items-center justify-center gap-2 px-10 py-2 text-center text-[13px]">
        <Gift className="hidden h-4 w-4 shrink-0 text-[hsl(var(--gold-light))] sm:block" />
        <span>
          Giảm <b className="text-[hsl(var(--gold-light))]">{pct}%</b> cho lần đặt lịch online đầu tiên
        </span>
        <Link href="/booking" className="ml-1 font-semibold underline underline-offset-4 hover:text-white">
          Đặt ngay
        </Link>
      </div>
      <button
        onClick={dismiss}
        aria-label="Ẩn thông báo ưu đãi"
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-[hsl(var(--cream))]/70 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
