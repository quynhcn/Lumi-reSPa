'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { CalendarPlus, Inbox, MessageCircle, Phone } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth-context';
import { telHref, zaloHref } from '@/lib/site-config';
import { LEAD_STATUS_LABELS, type Lead, type LeadStatus } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/page-loader';
import { cn } from '@/lib/utils';

const FILTERS: { value: LeadStatus | 'open' | 'all'; label: string }[] = [
  { value: 'open', label: 'Cần xử lý' },
  { value: 'new', label: 'Mới' },
  { value: 'contacted', label: 'Đã gọi' },
  { value: 'booked', label: 'Đã đặt lịch' },
  { value: 'closed', label: 'Đóng' },
  { value: 'all', label: 'Tất cả' },
];

const STATUS_STYLE: Record<LeadStatus, string> = {
  new: 'bg-primary text-primary-foreground border-primary',
  contacted: 'bg-info/10 text-info border-info/20',
  booked: 'bg-success/10 text-success border-success/20',
  closed: 'bg-muted text-muted-foreground border-border',
};

function ago(iso: string) {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} phút trước`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)} giờ trước`;
  return new Date(iso).toLocaleDateString('vi-VN', { day: 'numeric', month: 'numeric' });
}

export default function LeadsPage() {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]['value']>('open');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    let list: Lead[] = [];
    try {
      let q = supabase.from('leads').select('*').order('created_at', { ascending: false }).limit(300);
      if (filter === 'open') q = q.in('status', ['new', 'contacted']);
      else if (filter !== 'all') q = q.eq('status', filter);
      const { data, error } = await q;
      if (!error && data) list = data as Lead[];
    } catch {}

    setLeads(list);
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    load();
  }, [load]);

  const setStatus = async (lead: Lead, status: LeadStatus) => {
    const { error } = await supabase
      .from('leads')
      .update({ status, handled_at: new Date().toISOString(), handled_by: user?.email })
      .eq('id', lead.id);
    if (error) {
      toast.error('Không cập nhật được trạng thái');
      return;
    }
    toast.success(`Đã chuyển sang “${LEAD_STATUS_LABELS[status]}”`);
    load();
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="page-title">Yêu cầu tư vấn</h1>
        <p className="mt-1 text-sm text-muted-foreground">Khách để lại SĐT trên trang chủ. Nên gọi lại trong vòng 30 phút.</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value)}
            aria-pressed={filter === f.value}
            className={cn(
              'shrink-0 rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              filter === f.value ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader fullScreen={false} />
      ) : leads.length === 0 ? (
        <div className="card-base py-16 text-center text-muted-foreground">
          <Inbox className="mx-auto mb-3 h-10 w-10 opacity-40" />
          Không có yêu cầu nào.
        </div>
      ) : (
        <div className="space-y-3">
          {leads.map((l) => (
            <article key={l.id} className="card-base flex flex-col gap-4 p-4 sm:p-5 lg:flex-row lg:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-semibold text-foreground">{l.name}</h3>
                  <span className={cn('rounded-full border px-2 py-0.5 text-xs font-semibold', STATUS_STYLE[l.status])}>
                    {LEAD_STATUS_LABELS[l.status]}
                  </span>
                  <span className="text-xs text-muted-foreground">{ago(l.created_at)}</span>
                </div>
                <p className="mt-1 text-sm text-foreground">
                  <a href={telHref(l.phone)} className="font-semibold text-primary hover:underline">{l.phone}</a>
                  {l.interest && <span className="text-muted-foreground"> · {l.interest}</span>}
                </p>
                {l.note && <p className="mt-1 text-sm text-muted-foreground">“{l.note}”</p>}
                {l.handled_by && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Cập nhật bởi {l.handled_by}
                    {l.handled_at ? ` · ${ago(l.handled_at)}` : ''}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button asChild size="sm" className="h-8">
                  <a href={telHref(l.phone)} onClick={() => l.status === 'new' && setStatus(l, 'contacted')}>
                    <Phone className="mr-1 h-3.5 w-3.5" /> Gọi
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8">
                  <a href={zaloHref(l.phone)} target="_blank" rel="noopener noreferrer">
                    <MessageCircle className="mr-1 h-3.5 w-3.5" /> Zalo
                  </a>
                </Button>
                <Button asChild size="sm" variant="outline" className="h-8">
                  <Link href={`/booking?name=${encodeURIComponent(l.name)}&phone=${encodeURIComponent(l.phone)}&lead=${l.id}`}>
                    <CalendarPlus className="mr-1 h-3.5 w-3.5" /> Đặt lịch hộ
                  </Link>
                </Button>
                <select
                  aria-label="Trạng thái"
                  value={l.status}
                  onChange={(e) => setStatus(l, e.target.value as LeadStatus)}
                  className="input-base h-8 w-auto py-0 text-xs"
                >
                  {(Object.keys(LEAD_STATUS_LABELS) as LeadStatus[]).map((s) => (
                    <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
                  ))}
                </select>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
