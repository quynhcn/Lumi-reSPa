'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Check, MessageCircle, MessageSquareHeart, MessageSquareText } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { SITE, zaloHref } from '@/lib/site-config';
import { Button } from '@/components/ui/button';

type Row = {
  id: string;
  start_time: string;
  customers: { name: string; phone: string } | null;
  services: { name: string } | null;
  staff: { name: string } | null;
  reviews: { id: string } | { id: string }[] | null;
  review_requests: { sent_at: string | null } | { sent_at: string | null }[] | null;
  vouchers: { code: string; percent_off: number | null; expires_at: string | null; sessions_left: number | null }[];
};

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);

/**
 * After-visit follow-up: completed appointments of the last 3 days that have no review and no request sent yet.
 * The message carries a no-login review link and the automatic "lần sau" voucher.
 */
export function ReviewRequestQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 3 * 24 * 3600_000).toISOString();
    const { data } = await supabase
      .from('appointments')
      .select('id, start_time, customers (name, phone), services (name), staff (name), reviews (id), review_requests (sent_at), vouchers:gift_cards!source_appointment_id (code, percent_off, expires_at, sessions_left)')
      .eq('status', 'completed')
      .gte('start_time', since)
      .order('start_time', { ascending: false })
      .limit(50);
    const list = ((data || []) as unknown as Row[]).filter((r) => !one(r.reviews) && !one(r.review_requests)?.sent_at && r.customers?.phone);
    setRows(list);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const message = async (apt: Row) => {
    const { data: token, error } = await supabase.rpc('review_request_token', { p_appointment_id: apt.id });
    if (error || !token) {
      toast.error('Không tạo được link đánh giá');
      return null;
    }
    const v = apt.vouchers?.find((x) => (x.sessions_left ?? 0) > 0);
    const gift = v
      ? SITE.reviewGiftTemplate
          .replace('{code}', v.code)
          .replace('{pct}', String(v.percent_off ?? ''))
          .replace('{date}', v.expires_at ? new Date(v.expires_at).toLocaleDateString('vi-VN') : '')
      : '';
    return SITE.reviewTemplate
      .replace('{name}', apt.customers?.name?.trim().split(/\s+/).pop() || 'quý khách')
      .replace('{service}', apt.services?.name || 'dịch vụ')
      .replace('{link}', `${window.location.origin}/review/${token}`)
      .replace('{gift}', gift);
  };

  const markSent = async (id: string) => {
    const { error } = await supabase.from('review_requests').update({ sent_at: new Date().toISOString() }).eq('appointment_id', id);
    if (error) toast.error('Không cập nhật được');
    else setRows((r) => r.filter((x) => x.id !== id));
  };

  const viaZalo = async (apt: Row) => {
    const text = await message(apt);
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Đã sao chép tin nhắn — dán vào khung chat Zalo');
    } catch {
      toast.message(text);
    }
    window.open(zaloHref(apt.customers?.phone || ''), '_blank', 'noopener');
    markSent(apt.id);
  };

  const viaSms = async (apt: Row) => {
    const text = await message(apt);
    if (!text) return;
    window.location.href = `sms:${(apt.customers?.phone || '').replace(/\s/g, '')}?body=${encodeURIComponent(text)}`;
    markSent(apt.id);
  };

  if (!loading && rows.length === 0) return null; // nothing to follow up — keep the dashboard quiet

  return (
    <section className="card-base p-5 sm:p-6" aria-labelledby="review-queue">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 id="review-queue" className="block-title flex items-center gap-2">
          <MessageSquareHeart className="h-5 w-5 text-primary" /> Xin đánh giá &amp; gửi quà
          {rows.length > 0 && <span className="rounded-full bg-primary px-2 py-0.5 font-sans text-xs font-bold text-primary-foreground">{rows.length}</span>}
        </h2>
        <span className="text-xs text-muted-foreground">Khách đã làm xong trong 3 ngày qua</span>
      </div>
      {loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted/60" />
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((apt) => {
            const start = new Date(apt.start_time);
            const v = apt.vouchers?.find((x) => (x.sessions_left ?? 0) > 0);
            return (
              <li key={apt.id} className="flex flex-col gap-3 py-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <Link href={`/admin/appointments/${apt.id}`} className="font-semibold text-foreground hover:text-primary">
                    {apt.customers?.name}
                  </Link>
                  <p className="truncate text-sm text-muted-foreground">
                    {apt.services?.name} · {apt.staff?.name} · {start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' })}
                    {v && <span className="text-success"> · quà {v.code} (−{v.percent_off}%)</span>}
                  </p>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <Button size="sm" variant="outline" className="h-8" onClick={() => viaZalo(apt)}>
                    <MessageCircle className="mr-1 h-3.5 w-3.5" /> Zalo
                  </Button>
                  <Button size="sm" variant="outline" className="h-8" onClick={() => viaSms(apt)}>
                    <MessageSquareText className="mr-1 h-3.5 w-3.5" /> SMS
                  </Button>
                  <Button
                    size="sm"
                    className="h-8"
                    onClick={async () => {
                      await supabase.rpc('review_request_token', { p_appointment_id: apt.id });
                      markSent(apt.id);
                    }}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Đã gửi
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
