'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Copy, ExternalLink, Gift, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { SITE } from '@/lib/site-config';
import { track } from '@/lib/analytics';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Logo } from '@/components/logo';
import { PageLoader } from '@/components/page-loader';
import { StarPicker } from '@/components/star-picker';

type Invite = {
  given_name: string;
  service_name: string | null;
  staff_name: string | null;
  visit_date: string;
  can_review: boolean;
  reviewed: boolean;
  voucher_code: string | null;
  voucher_pct: number | null;
  voucher_expires: string | null;
};

/** Review link sent by Zalo/SMS after a visit — works without signing in (the token is the key). */
export default function ReviewByLinkPage({ params }: { params: { token: string } }) {
  const [invite, setInvite] = useState<Invite | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const valid = /^[0-9a-f-]{36}$/i.test(params.token);
    if (!valid) {
      setLoading(false);
      return;
    }
    supabase.rpc('get_review_invite', { p_token: params.token }).then(({ data }) => {
      const row = ((data as Invite[]) || [])[0] ?? null;
      setInvite(row);
      setDone(!!row?.reviewed);
      setLoading(false);
    });
  }, [params.token]);

  const submit = async () => {
    setSending(true);
    const { error } = await supabase.rpc('submit_review_by_token', { p_token: params.token, p_rating: rating, p_comment: comment });
    setSending(false);
    if (error && !error.message.includes('ALREADY_REVIEWED')) {
      toast.error(error.message.includes('EXPIRED') ? 'Link đánh giá đã hết hạn.' : 'Không gửi được đánh giá. Vui lòng thử lại.');
      return;
    }
    track('review_submit', { rating, via: 'link' });
    setDone(true);
  };

  if (loading) return <PageLoader />;

  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-10">
      <Link href="/" className="mb-8"><Logo /></Link>
      <main className="card-base w-full max-w-md p-6 sm:p-8">
        {!invite ? (
          <div className="text-center">
            <h1 className="page-title text-2xl">Link không hợp lệ</h1>
            <p className="mt-2 text-sm text-muted-foreground">Link đánh giá không đúng hoặc đã hết hạn.</p>
            <Button asChild className="mt-6"><Link href="/">Về trang chủ</Link></Button>
          </div>
        ) : done ? (
          <div className="text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-success" />
            <h1 className="page-title mt-3 text-2xl">Cảm ơn {invite.given_name}!</h1>
            <p className="mt-2 text-sm text-muted-foreground">Đánh giá của bạn giúp {SITE.name} phục vụ tốt hơn mỗi ngày.</p>
            {SITE.googleReviewUrl && (
              <Button asChild variant="outline" className="mt-5 w-full">
                <a href={SITE.googleReviewUrl} target="_blank" rel="noopener noreferrer" onClick={() => track('google_review_click')}>
                  Chia sẻ thêm trên Google Maps <ExternalLink className="ml-1.5 h-4 w-4" />
                </a>
              </Button>
            )}
          </div>
        ) : !invite.can_review ? (
          <div className="text-center">
            <h1 className="page-title text-2xl">Chưa thể đánh giá</h1>
            <p className="mt-2 text-sm text-muted-foreground">Buổi hẹn chưa hoàn thành hoặc link đã quá 30 ngày.</p>
          </div>
        ) : (
          <>
            <p className="eyebrow text-center">Đánh giá buổi hẹn</p>
            <h1 className="page-title mt-2 text-center text-2xl">{invite.given_name} ơi, buổi hẹn thế nào?</h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              {invite.service_name}
              {invite.staff_name ? ` · ${invite.staff_name}` : ''} · {new Date(invite.visit_date).toLocaleDateString('vi-VN')}
            </p>
            <div className="mt-4">
              <StarPicker value={rating} onChange={setRating} />
            </div>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder="Điều bạn thích nhất, hoặc điều spa nên cải thiện…"
              aria-label="Nhận xét"
              className="mt-2"
            />
            <Button onClick={submit} disabled={!rating || sending} size="lg" className="mt-4 w-full">
              {sending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />} Gửi đánh giá
            </Button>
          </>
        )}

        {invite?.voucher_code && (
          <div className="mt-6 rounded-xl border border-dashed border-primary/50 bg-primary/5 p-4 text-center">
            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-primary">
              <Gift className="h-4 w-4" /> Quà cảm ơn cho lần sau
            </p>
            <button
              onClick={() => navigator.clipboard?.writeText(invite.voucher_code!).then(() => toast.success('Đã sao chép mã'), () => {})}
              className="mt-2 inline-flex items-center gap-2 font-mono text-2xl font-bold tracking-wider text-foreground"
            >
              {invite.voucher_code} <Copy className="h-4 w-4 text-muted-foreground" />
            </button>
            <p className="mt-1 text-sm text-muted-foreground">
              Giảm {invite.voucher_pct}%{invite.voucher_expires ? ` · dùng trước ${new Date(invite.voucher_expires).toLocaleDateString('vi-VN')}` : ''}
            </p>
            <Button asChild size="sm" className="mt-3">
              <Link href={`/booking?gift=${invite.voucher_code}`}>Đặt lịch dùng mã</Link>
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
