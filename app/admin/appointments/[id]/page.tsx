'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ArrowLeft, Calendar, CalendarClock, Clock, Gift, History, Mail, Phone, Sparkles, StickyNote, User, UserCircle, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import {
  formatDuration,
  formatPrice,
  STATUS_DOT_COLORS,
  STATUS_LABELS,
  type AppointmentLog,
  type AppointmentStatus,
  type AppointmentWithDetails,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { PageLoader } from '@/components/page-loader';
import { StatusActions } from '@/components/status-actions';
import { StatusBadge } from '@/components/status-badge';
import { cn } from '@/lib/utils';
import { discountLabel } from '@/components/booking/booking-summary';
import { RescheduleDialog } from '@/components/reschedule-dialog';

type Detail = AppointmentWithDetails & { customers: AppointmentWithDetails['customers'] & { id?: string } };

export default function AppointmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [appointment, setAppointment] = useState<Detail | null>(null);
  const [logs, setLogs] = useState<AppointmentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [noShows, setNoShows] = useState(0);
  const [moving, setMoving] = useState(false);

  const load = useCallback(async () => {
    const [{ data }, { data: logData }] = await Promise.all([
      supabase
        .from('appointments')
        .select('*, customers (id, name, phone, email, notes), staff (name, avatar_url, phone), services (name, duration_min, price, category, description)')
        .eq('id', id)
        .maybeSingle(),
      supabase.from('appointment_logs').select('*').eq('appointment_id', id).order('changed_at', { ascending: false }),
    ]);
    setAppointment(data as unknown as Detail);
    setLogs(logData || []);
    const custId = (data as unknown as Detail | null)?.customers?.id;
    if (custId) {
      const { count } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('customer_id', custId)
        .eq('status', 'no_show');
      setNoShows(count || 0);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const updateStatus = async (next: AppointmentStatus) => {
    const { error } = await supabase.rpc('transition_appointment', { p_id: id, p_status: next });
    if (error) {
      toast.error('Không thể cập nhật trạng thái');
      return;
    }
    toast.success(`Đã chuyển sang: ${STATUS_LABELS[next]}`);
    load();
  };

  if (loading) return <PageLoader fullScreen={false} />;

  if (!appointment) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Không tìm thấy lịch hẹn</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/admin/appointments')}>
          Quay lại danh sách
        </Button>
      </div>
    );
  }

  const start = new Date(appointment.start_time);
  const end = new Date(appointment.end_time);
  const hm = (d: Date) => d.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  const dm = (iso: string) => new Date(iso).toLocaleString('vi-VN', { day: 'numeric', month: 'numeric', hour: '2-digit', minute: '2-digit' });
  const c = appointment.customers;

  const facts = [
    { icon: Calendar, label: 'Ngày', value: start.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long' }) },
    { icon: Clock, label: 'Giờ', value: `${hm(start)} – ${hm(end)}` },
    { icon: Sparkles, label: 'Thời lượng', value: formatDuration(appointment.duration_min) },
    { icon: Wallet, label: 'Thanh toán tại spa', value: formatPrice(appointment.price - (appointment.gift_amount ?? 0)) },
  ];
  const isUpcoming = ['pending', 'confirmed'].includes(appointment.status) && start.getTime() > Date.now();

  return (
    <div className="max-w-5xl space-y-6">
      <RescheduleDialog
        appointment={{
          id: appointment.id,
          service_id: appointment.service_id,
          staff_id: appointment.staff_id,
          start_time: appointment.start_time,
          staffName: appointment.staff?.name,
          serviceName: appointment.services?.name,
        }}
        open={moving}
        onOpenChange={setMoving}
        onDone={load}
      />
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.back()} aria-label="Quay lại" className="shrink-0">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="page-title">{appointment.services?.name}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <StatusBadge status={appointment.status} />
            <span>Mã {appointment.booking_code}</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="card-base space-y-4 p-5 sm:p-6">
            <h2 className="block-title">Chi tiết lịch hẹn</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {facts.map((f) => (
                <div key={f.label} className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
                  <f.icon className="h-5 w-5 shrink-0 text-primary" />
                  <div>
                    <p className="text-xs text-muted-foreground">{f.label}</p>
                    <p className="font-medium">{f.value}</p>
                  </div>
                </div>
              ))}
            </div>
            {(!!appointment.discount_amount || !!appointment.gift_amount) && (
              <dl className="space-y-1 rounded-lg border border-border p-3 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Giá niêm yết</dt><dd>{formatPrice(appointment.list_price ?? appointment.price)}</dd></div>
                {!!appointment.discount_amount && (
                  <div className="flex justify-between text-success"><dt>{discountLabel(appointment.discount_reason)}</dt><dd>−{formatPrice(appointment.discount_amount)}</dd></div>
                )}
                {!!appointment.gift_amount && (
                  <div className="flex justify-between text-success"><dt className="flex items-center gap-1"><Gift className="h-3.5 w-3.5" /> Trừ vào thẻ quà tặng / gói</dt><dd>−{formatPrice(appointment.gift_amount)}</dd></div>
                )}
                <div className="flex justify-between border-t border-border pt-1 font-semibold"><dt>Khách trả tại spa</dt><dd>{formatPrice(appointment.price - (appointment.gift_amount ?? 0))}</dd></div>
              </dl>
            )}
            <p className="text-xs text-muted-foreground">
              {appointment.source === 'front_desk' ? 'Lễ tân đặt hộ' : 'Khách tự đặt online'}
            </p>
            {noShows > 0 && (
              <p className="flex items-center gap-2 rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                <AlertTriangle className="h-4 w-4 shrink-0" /> Khách này đã bỏ hẹn {noShows} lần — nên gọi xác nhận trước giờ hẹn.
              </p>
            )}
            {appointment.notes && (
              <div className="flex items-start gap-3 rounded-lg border border-warning/20 bg-warning/10 p-3">
                <StickyNote className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
                <div>
                  <p className="text-xs font-medium text-warning">Ghi chú của khách</p>
                  <p className="text-sm text-foreground">{appointment.notes}</p>
                </div>
              </div>
            )}
            <StatusActions
              status={appointment.status}
              startTime={appointment.start_time}
              onChange={updateStatus}
              className="border-t border-border pt-4"
            />
          </section>

          <section className="card-base p-5 sm:p-6">
            <h2 className="block-title mb-4 flex items-center gap-2">
              <History className="h-4 w-4" /> Lịch sử thay đổi
            </h2>
            <ol className="space-y-3 text-sm">
              {logs.map((log) => (
                <li key={log.id} className="flex items-start gap-3">
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', STATUS_DOT_COLORS[log.new_status])} />
                  <div className="min-w-0 flex-1">
                    <p className="text-foreground">
                      {log.note ? (
                        log.note
                      ) : (
                        <>
                          {log.old_status ? STATUS_LABELS[log.old_status] : 'Tạo mới'} → <strong>{STATUS_LABELS[log.new_status]}</strong>
                        </>
                      )}
                    </p>
                    {log.changed_by && <p className="truncate text-xs text-muted-foreground">bởi {log.changed_by}</p>}
                  </div>
                  <span className="shrink-0 text-xs text-muted-foreground">{dm(log.changed_at)}</span>
                </li>
              ))}
              <li className="flex items-start gap-3 text-muted-foreground">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-border" />
                <p className="flex-1">Đặt lịch</p>
                <span className="shrink-0 text-xs">{dm(appointment.created_at)}</span>
              </li>
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card-base p-5 sm:p-6">
            <h2 className="block-title mb-3 flex items-center gap-2 text-lg">
              <User className="h-4 w-4" /> Khách hàng
            </h2>
            {c?.id ? (
              <Link href={`/admin/customers/${c.id}`} className="font-semibold text-foreground hover:text-primary hover:underline">
                {c.name}
              </Link>
            ) : (
              <p className="font-semibold">{c?.name}</p>
            )}
            {c?.notes && <p className="mt-1 text-sm text-muted-foreground">{c.notes}</p>}
            <div className="mt-4 flex flex-wrap gap-2">
              {c?.phone && (
                <Button asChild size="sm">
                  <a href={`tel:${c.phone}`}>
                    <Phone className="mr-1.5 h-3.5 w-3.5" /> Gọi {c.phone}
                  </a>
                </Button>
              )}
              {isUpcoming && (
                <Button size="sm" variant="outline" onClick={() => setMoving(true)}>
                  <CalendarClock className="mr-1.5 h-3.5 w-3.5" /> Đổi giờ
                </Button>
              )}
              {c?.email && (
                <Button asChild size="sm" variant="outline">
                  <a href={`mailto:${c.email}`}>
                    <Mail className="mr-1.5 h-3.5 w-3.5" /> Email
                  </a>
                </Button>
              )}
            </div>
          </section>

          <section className="card-base p-5 sm:p-6">
            <h2 className="block-title mb-3 flex items-center gap-2 text-lg">
              <UserCircle className="h-4 w-4" /> Nhân viên
            </h2>
            <p className="font-semibold">{appointment.staff?.name}</p>
            {appointment.staff?.phone && (
              <a href={`tel:${appointment.staff.phone}`} className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                <Phone className="h-3.5 w-3.5" /> {appointment.staff.phone}
              </a>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
