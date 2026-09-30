'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, Calendar, CalendarClock, CheckCircle2, Clock, Copy, Gift, Loader2, Mail, Pencil, Phone, Save, Star, X } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { SITE } from '@/lib/site-config';
import { track } from '@/lib/analytics';
import { isValidPhone } from '@/lib/utils';
import { OPEN_STATUSES, voucherLabel, type AppointmentWithDetails, type Customer, type Voucher } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { AppointmentRow } from '@/components/appointment-row';
import { PageLoader } from '@/components/page-loader';
import { RoleGate } from '@/components/role-gate';
import { SiteHeader } from '@/components/site-header';
import { StatCard } from '@/components/stat-card';
import { ReviewDialog } from '@/components/review-dialog';
import { RescheduleDialog } from '@/components/reschedule-dialog';

const CANCEL_ERRORS: Record<string, string> = {
  TOO_LATE: `Chỉ hủy được trước giờ hẹn ${SITE.cancelBeforeHours} tiếng. Vui lòng gọi ${SITE.phone}.`,
  NOT_CANCELLABLE: 'Lịch hẹn này không còn hủy được.',
  NOT_FOUND: 'Không tìm thấy lịch hẹn.',
};

export default function AccountPage() {
  return (
    <RoleGate message="Bạn cần đăng nhập để xem tài khoản.">
      <AccountContent />
    </RoleGate>
  );
}

function AccountContent() {
  const { session, user } = useAuth();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', email: '', notes: '' });
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reviewed, setReviewed] = useState<Record<string, number>>({}); // appointment_id → stars
  const [reviewFor, setReviewFor] = useState<AppointmentWithDetails | null>(null);
  const [moveFor, setMoveFor] = useState<AppointmentWithDetails | null>(null);
  const [vouchers, setVouchers] = useState<Voucher[]>([]);

  const load = useCallback(async () => {
    if (!session) return;
    const { data: cust } = await supabase.from('customers').select('*').eq('user_id', session.user.id).maybeSingle();
    if (cust) {
      const c = cust as Customer;
      setCustomer(c);
      setForm({ name: c.name, phone: c.phone, email: c.email || '', notes: c.notes || '' });
      const { data: apts } = await supabase
        .from('appointments')
        .select('*, customers (name, phone, email), staff (name, avatar_url, phone), services (name, duration_min, price, category, description)')
        .eq('customer_id', c.id)
        .order('start_time', { ascending: false });
      setAppointments((apts || []) as unknown as AppointmentWithDetails[]);
      const { data: revs } = await supabase.from('reviews').select('appointment_id, rating').eq('customer_id', c.id);
      setReviewed(Object.fromEntries((revs || []).map((r) => [r.appointment_id, r.rating])));
    }
    const { data: vs } = await supabase.rpc('my_vouchers');
    setVouchers((vs as Voucher[]) || []);
    setLoading(false);
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async () => {
    if (!customer) return;
    if (!form.name.trim() || !isValidPhone(form.phone)) {
      toast.error('Vui lòng nhập họ tên và số điện thoại hợp lệ');
      return;
    }
    setSaving(true);
    const patch = {
      name: form.name.trim(),
      phone: form.phone.trim(),
      email: form.email.trim() || null,
      notes: form.notes.trim() || null,
    };
    const { error } = await supabase.from('customers').update(patch).eq('id', customer.id);
    setSaving(false);
    if (error) {
      toast.error('Không thể cập nhật');
      return;
    }
    toast.success('Đã cập nhật thông tin');
    setCustomer({ ...customer, ...patch });
    setEditing(false);
  };

  const handleCancel = async () => {
    if (!cancelId) return;
    const { error } = await supabase.rpc('cancel_my_appointment', { p_id: cancelId });
    setCancelId(null);
    if (error) {
      const code = Object.keys(CANCEL_ERRORS).find((k) => error.message.includes(k));
      toast.error(code ? CANCEL_ERRORS[code] : 'Không thể hủy lịch hẹn');
      return;
    }
    toast.success('Đã hủy lịch hẹn');
    track('cancel_booking', { by: 'customer' });
    load();
  };

  if (loading) return <PageLoader />;

  const now = Date.now();
  const cancelDeadline = now + SITE.cancelBeforeHours * 3600_000;
  const isUpcoming = (a: AppointmentWithDetails) => OPEN_STATUSES.includes(a.status) && new Date(a.end_time).getTime() >= now;
  const upcoming = appointments.filter(isUpcoming).reverse(); // soonest first
  const past = appointments.filter((a) => !isUpcoming(a));
  const booked = appointments.filter((a) => a.status !== 'cancelled').length;
  const completed = appointments.filter((a) => a.status === 'completed').length;

  const row = (apt: AppointmentWithDetails, withCancel: boolean) => {
    const canCancel =
      withCancel && (apt.status === 'pending' || apt.status === 'confirmed') && new Date(apt.start_time).getTime() > cancelDeadline;
    return (
      <AppointmentRow
        key={apt.id}
        lead="date"
        startTime={apt.start_time}
        durationMin={apt.duration_min}
        status={apt.status}
        price={apt.price - (apt.gift_amount ?? 0)} /* what the customer still pays at the spa */
        title={apt.services?.name || 'Dịch vụ'}
        meta={`${apt.staff?.name} · Mã ${apt.booking_code}`}
      >
        {apt.status === 'completed' &&
          (reviewed[apt.id] ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
              Bạn đã đánh giá
              {Array.from({ length: reviewed[apt.id] }, (_, i) => (
                <Star key={i} className="h-3 w-3 fill-[hsl(var(--gold))] text-[hsl(var(--gold))]" />
              ))}
            </p>
          ) : (
            <Button size="sm" variant="outline" className="mt-2 h-8" onClick={() => setReviewFor(apt)}>
              <Star className="mr-1.5 h-3.5 w-3.5" /> Đánh giá buổi hẹn
            </Button>
          ))}
        {apt.status === 'pending' && withCancel && (
          <p className="mt-1 text-xs text-warning">Spa sẽ gọi cho bạn để xác nhận lịch này.</p>
        )}
        {canCancel && (
          <div className="-ml-2 mt-1 flex flex-wrap gap-1">
            {(apt.reschedule_count ?? 0) < 2 && (
              <Button size="sm" variant="ghost" onClick={() => setMoveFor(apt)} className="h-8 text-primary hover:bg-primary/10">
                <CalendarClock className="mr-1 h-3.5 w-3.5" /> Đổi giờ
              </Button>
            )}
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setCancelId(apt.id)}
              className="h-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
              Hủy lịch
            </Button>
          </div>
        )}
      </AppointmentRow>
    );
  };

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        {/* Profile */}
        <section className="card-base p-5 sm:p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
                {(customer?.name || user?.email || '?').charAt(0)}
              </span>
              <div className="min-w-0">
                <p className="eyebrow">Tài khoản</p>
                <h1 className="page-title truncate text-2xl">{customer?.name || 'Khách hàng'}</h1>
              </div>
            </div>
            {!editing && (
              <Button variant="outline" size="sm" onClick={() => setEditing(true)} className="shrink-0">
                <Pencil className="mr-1 h-3.5 w-3.5" /> Sửa hồ sơ
              </Button>
            )}
          </div>

          {editing ? (
            <div className="mt-6 grid max-w-xl gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="p-name">Họ và tên</Label>
                <Input id="p-name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="p-phone">Số điện thoại</Label>
                <Input id="p-phone" type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="p-email">Email</Label>
                <Input id="p-email" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <Label htmlFor="p-notes">Ghi chú cho spa</Label>
                <Input id="p-notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Dị ứng, ưu tiên..." />
              </div>
              <div className="flex gap-2 pt-1 sm:col-span-2">
                <Button size="sm" onClick={handleSave} disabled={saving}>
                  {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Save className="mr-1 h-3.5 w-3.5" />}
                  Lưu
                </Button>
                <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                  <X className="mr-1 h-3.5 w-3.5" /> Hủy
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
              {customer?.phone && (
                <span className="flex items-center gap-1.5"><Phone className="h-4 w-4" /> {customer.phone}</span>
              )}
              {(customer?.email || user?.email) && (
                <span className="flex items-center gap-1.5"><Mail className="h-4 w-4" /> {customer?.email || user?.email}</span>
              )}
            </div>
          )}
        </section>

        <div className="grid grid-cols-3 gap-3 sm:gap-4">
          <StatCard icon={Clock} label="Sắp tới" value={upcoming.length} />
          <StatCard icon={CheckCircle2} label="Đã hoàn thành" value={completed} />
          <StatCard icon={Calendar} label="Tổng lịch đã đặt" value={booked} />
        </div>

        {vouchers.length > 0 && (
          <section className="card-base border-primary/30 bg-primary/5 p-5 sm:p-6" aria-labelledby="my-vouchers">
            <h2 id="my-vouchers" className="block-title mb-3 flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" /> Quà &amp; ưu đãi của bạn
            </h2>
            <ul className="space-y-2">
              {vouchers.map((v) => (
                <li key={v.code} className="flex flex-col gap-2 rounded-lg border border-dashed border-primary/40 bg-card p-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <button
                      onClick={() => navigator.clipboard?.writeText(v.code).then(() => toast.success(`Đã sao chép ${v.code}`), () => {})}
                      className="inline-flex items-center gap-1.5 font-mono text-base font-bold text-primary"
                      title="Sao chép mã"
                    >
                      {v.code} <Copy className="h-3.5 w-3.5" />
                    </button>
                    <p className="text-sm text-foreground">
                      {v.kind === 'percent' ? `Giảm ${v.percent_off}% cho lần đặt tiếp theo` : `Thẻ ${voucherLabel(v)}`}
                      {v.expires_at && <span className="text-muted-foreground"> · HSD {new Date(v.expires_at).toLocaleDateString('vi-VN')}</span>}
                    </p>
                  </div>
                  <Link href={`/booking?gift=${v.code}`} className="btn-primary h-9 shrink-0 px-4 text-sm">
                    Đặt lịch dùng mã
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card-base p-5 sm:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="block-title">Lịch hẹn sắp tới</h2>
            <Link href="/booking" className="flex items-center gap-1 text-sm text-primary hover:underline">
              Đặt lịch mới <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
          {upcoming.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-3 h-10 w-10 opacity-30" />
              <p className="mb-4 text-sm">Bạn chưa có lịch hẹn nào sắp tới</p>
              <Link href="/booking" className="btn-primary">Đặt lịch ngay</Link>
            </div>
          ) : (
            <>
              <div className="space-y-2">{upcoming.map((a) => row(a, true))}</div>
              <p className="mt-3 text-xs text-muted-foreground">
                Bạn có thể tự đổi giờ (tối đa 2 lần) hoặc hủy trước giờ hẹn {SITE.cancelBeforeHours} tiếng. Sát giờ hơn, vui lòng gọi {SITE.phone}.
              </p>
            </>
          )}
        </section>

        {past.length > 0 && (
          <section className="card-base p-5 sm:p-6">
            <h2 className="block-title mb-4">Lịch sử</h2>
            <div className="space-y-2">{past.map((a) => row(a, false))}</div>
          </section>
        )}
      </div>

      <ReviewDialog
        appointmentId={reviewFor?.id ?? null}
        serviceName={reviewFor?.services?.name}
        onClose={() => setReviewFor(null)}
        onDone={(stars) => {
          if (reviewFor) setReviewed((r) => ({ ...r, [reviewFor.id]: stars }));
          setReviewFor(null);
        }}
      />

      {moveFor && (
        <RescheduleDialog
          appointment={{
            id: moveFor.id,
            service_id: moveFor.service_id,
            staff_id: moveFor.staff_id,
            start_time: moveFor.start_time,
            staffName: moveFor.staff?.name,
            serviceName: moveFor.services?.name,
          }}
          open={!!moveFor}
          onOpenChange={(o) => !o && setMoveFor(null)}
          onDone={load}
        />
      )}

      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hủy lịch hẹn này?</AlertDialogTitle>
            <AlertDialogDescription>Khung giờ sẽ được nhường cho khách khác. Bạn có thể đặt lại bất cứ lúc nào.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Giữ lịch</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancel} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Hủy lịch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
