'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { MessageSquareQuote, Star } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import type { Review } from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { PageLoader } from '@/components/page-loader';
import { StatCard } from '@/components/stat-card';
import { cn } from '@/lib/utils';

type Row = Review & {
  customers: { id: string; name: string } | null;
  services: { name: string } | null;
  staff: { name: string } | null;
};

export default function ReviewsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'low'>('all');

  useEffect(() => {
    supabase
      .from('reviews')
      .select('*, customers (id, name), services (name), staff (name)')
      .order('created_at', { ascending: false })
      .limit(500)
      .then(({ data }) => {
        setRows((data || []) as unknown as Row[]);
        setLoading(false);
      });
  }, []);

  const togglePublish = async (r: Row, is_published: boolean) => {
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, is_published } : x)));
    const { error } = await supabase.from('reviews').update({ is_published }).eq('id', r.id);
    if (error) toast.error('Không cập nhật được');
    else toast.success(is_published ? 'Đã hiện trên trang chủ' : 'Đã ẩn khỏi trang chủ');
  };

  if (loading) return <PageLoader fullScreen={false} />;

  const published = rows.filter((r) => r.is_published);
  const avg = published.length ? published.reduce((s, r) => s + r.rating, 0) / published.length : 0;
  const shown = filter === 'low' ? rows.filter((r) => r.rating <= 3) : rows;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Đánh giá</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Khách đánh giá sau khi lịch hẹn hoàn thành. Đánh giá thấp nên được gọi lại hỏi thăm; chỉ ẩn nội dung spam hoặc không phù hợp.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
        <StatCard icon={Star} label="Điểm trung bình (đang hiển thị)" value={avg ? avg.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—'} />
        <StatCard icon={MessageSquareQuote} label="Tổng đánh giá" value={rows.length} hint={`${rows.filter((r) => r.rating <= 3).length} đánh giá ≤ 3 sao`} />
      </div>

      <div className="flex gap-2">
        {(['all', 'low'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium',
              filter === f ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            {f === 'all' ? 'Tất cả' : 'Cần chú ý (≤ 3 sao)'}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="card-base py-12 text-center text-muted-foreground">Chưa có đánh giá nào.</p>
      ) : (
        <div className="space-y-3">
          {shown.map((r) => (
            <article key={r.id} className={cn('card-base p-4 sm:p-5', !r.is_published && 'opacity-60')}>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="flex" aria-label={`${r.rating} sao`}>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className={cn('h-4 w-4', i <= r.rating ? 'fill-[hsl(var(--gold))] text-[hsl(var(--gold))]' : 'text-border')} />
                  ))}
                </span>
                {r.customers && (
                  <Link href={`/admin/customers/${r.customers.id}`} className="font-semibold text-foreground hover:text-primary">
                    {r.customers.name}
                  </Link>
                )}
                <span className="text-sm text-muted-foreground">
                  {r.services?.name}
                  {r.staff?.name ? ` · ${r.staff.name}` : ''} · {new Date(r.created_at).toLocaleDateString('vi-VN')}
                </span>
                <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  {r.is_published ? 'Hiện trên trang chủ' : 'Đang ẩn'}
                  <Switch checked={r.is_published} onCheckedChange={(v) => togglePublish(r, v)} aria-label="Hiển thị đánh giá" />
                </label>
              </div>
              {r.comment ? (
                <p className="mt-2 text-[15px] text-foreground">“{r.comment}”</p>
              ) : (
                <p className="mt-2 text-sm italic text-muted-foreground">Không có nhận xét (chỉ chấm sao — không hiện trên trang chủ).</p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
