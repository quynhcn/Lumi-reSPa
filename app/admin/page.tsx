'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { ArrowRight, Calendar, CheckCircle2, Clock, PhoneCall, Wallet } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { addDays } from '@/lib/date';
import {
  expectedRevenue,
  formatPrice,
  OPEN_STATUSES,
  realizedRevenue,
  type AppointmentStatus,
  type AppointmentWithDetails,
} from '@/lib/types';
import type { RevenuePoint } from '@/components/admin/revenue-chart';
import { AppointmentRow } from '@/components/appointment-row';
import { PageLoader } from '@/components/page-loader';
import { StatCard } from '@/components/stat-card';
import { ReminderQueue } from '@/components/admin/reminder-queue';
import { ReviewRequestQueue } from '@/components/admin/review-request-queue';

// recharts is heavy — load it only on the dashboard, after first paint
const RevenueChart = dynamic(() => import('@/components/admin/revenue-chart'), {
  ssr: false,
  loading: () => <div className="h-[250px] animate-pulse rounded-lg bg-muted/60" />,
});

const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
type Lite = { start_time: string; price: number; status: AppointmentStatus };

export default function AdminDashboard() {
  const [today, setToday] = useState<AppointmentWithDetails[]>([]);
  const [week, setWeek] = useState<Lite[]>([]);
  const [counts, setCounts] = useState({ customers: 0, staff: 0, services: 0, leads: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const tomorrow = addDays(start, 1);
      const weekAgo = addDays(start, -6);

      const [{ data: todayApts }, { data: weekApts }, c, s, v, l] = await Promise.all([
        supabase
          .from('appointments')
          .select('*, customers (name, phone, email), staff (name, avatar_url), services (name, duration_min, price, category)')
          .gte('start_time', start.toISOString())
          .lt('start_time', tomorrow.toISOString())
          .order('start_time'),
        supabase
          .from('appointments')
          .select('start_time, price, status')
          .gte('start_time', weekAgo.toISOString())
          .lt('start_time', tomorrow.toISOString()),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase.from('staff').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('services').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('leads').select('id', { count: 'exact', head: true }).eq('status', 'new'),
      ]);
      setToday((todayApts || []) as unknown as AppointmentWithDetails[]);
      setWeek((weekApts || []) as Lite[]);
      setCounts({ customers: c.count || 0, staff: s.count || 0, services: v.count || 0, leads: l.count || 0 });
      setLoading(false);
    })();
  }, []);

  if (loading) return <PageLoader fullScreen={false} />;

  const active = today.filter((a) => a.status !== 'cancelled');
  const waiting = today.filter((a) => a.status === 'pending' || a.status === 'confirmed').length;
  const inProgress = today.filter((a) => a.status === 'checked_in' || a.status === 'in_service').length;

  const chart: RevenuePoint[] = Array.from({ length: 7 }, (_, i) => {
    const dayStart = addDays(new Date(new Date().setHours(0, 0, 0, 0)), i - 6);
    const dayEnd = addDays(dayStart, 1);
    const apts = week.filter((a) => {
      const d = new Date(a.start_time);
      return d >= dayStart && d < dayEnd;
    });
    return {
      day: DAY_LABELS[dayStart.getDay()],
      realized: realizedRevenue(apts),
      open: apts.filter((a) => OPEN_STATUSES.includes(a.status)).reduce((sum, a) => sum + a.price, 0),
    };
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="page-title">Tổng quan</h1>
        <p className="mt-1 text-sm font-medium text-foreground/85">
          {new Date().toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          <span className="mx-2">·</span>
          <Link href="/admin/customers" className="whitespace-nowrap hover:text-primary">{counts.customers} khách hàng</Link>
          <span className="mx-2">·</span>
          <Link href="/admin/staff" className="whitespace-nowrap hover:text-primary">{counts.staff} nhân viên</Link>
          <span className="mx-2">·</span>
          <Link href="/admin/services" className="whitespace-nowrap hover:text-primary">{counts.services} dịch vụ</Link>
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        <StatCard icon={Calendar} label="Lịch hẹn hôm nay" value={active.length} />
        <StatCard
          icon={Wallet}
          label="Đã thu hôm nay"
          value={formatPrice(realizedRevenue(today))}
          hint={`Dự kiến cả ngày: ${formatPrice(expectedRevenue(today))}`}
        />
        <StatCard icon={CheckCircle2} label="Đã hoàn thành" value={today.filter((a) => a.status === 'completed').length} />
        <StatCard icon={Clock} label="Chờ phục vụ" value={waiting} hint={inProgress ? `${inProgress} khách đang phục vụ` : undefined} />
      </div>

      {counts.leads > 0 && (
        <Link
          href="/admin/leads"
          className="flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4 text-sm transition-colors hover:bg-primary/10"
        >
          <PhoneCall className="h-5 w-5 text-primary" />
          <span>
            <b className="text-primary">{counts.leads} khách</b> đang chờ được gọi tư vấn
          </span>
          <ArrowRight className="ml-auto h-4 w-4 text-primary" />
        </Link>
      )}

      <ReminderQueue />
      <ReviewRequestQueue />

      <section className="card-base p-5 sm:p-6">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="block-title">Doanh thu 7 ngày</h2>
            <p className="text-sm font-medium text-foreground/85">
              Đã thu {formatPrice(realizedRevenue(week))} · Chưa hoàn thành{' '}
              {formatPrice(week.filter((a) => OPEN_STATUSES.includes(a.status)).reduce((s, a) => s + a.price, 0))}
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold text-foreground/80">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary" /> Đã thu</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-primary/25" /> Chưa hoàn thành</span>
          </div>
        </div>
        <RevenueChart data={chart} />
      </section>

      <section className="card-base p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="block-title">Lịch hẹn hôm nay</h2>
          <Link href="/admin/appointments" className="flex items-center gap-1 text-sm text-primary hover:underline">
            Xem tất cả <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
        {today.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            <Calendar className="mx-auto mb-3 h-10 w-10 opacity-30" />
            <p className="mb-4">Chưa có lịch hẹn nào hôm nay</p>
            <Link href="/booking" className="btn-outline">Tạo lịch hẹn</Link>
          </div>
        ) : (
          <div className="space-y-2">
            {today.map((apt) => (
              <AppointmentRow
                key={apt.id}
                href={`/admin/appointments/${apt.id}`}
                startTime={apt.start_time}
                durationMin={apt.duration_min}
                status={apt.status}
                price={apt.price}
                title={apt.services?.name || 'Dịch vụ'}
                meta={`${apt.customers?.name} · ${apt.staff?.name}`}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
