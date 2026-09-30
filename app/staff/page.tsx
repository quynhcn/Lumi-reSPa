'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, Clock, Phone, Scissors } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/lib/auth-context';
import { supabase } from '@/lib/supabase';
import { addDays, dayRangeISO, parseDateKey, toDateKey } from '@/lib/date';
import {
  DAY_NAMES_FULL,
  STATUS_LABELS,
  type AppointmentStatus,
  type AppointmentWithDetails,
  type Staff,
  type StaffSchedule,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
import { AppointmentRow } from '@/components/appointment-row';
import { PageLoader } from '@/components/page-loader';
import { RoleGate } from '@/components/role-gate';
import { SiteHeader } from '@/components/site-header';
import { StatCard } from '@/components/stat-card';
import { StatusActions } from '@/components/status-actions';

export default function StaffPage() {
  return (
    <RoleGate allow={['staff']}>
      <StaffContent />
    </RoleGate>
  );
}

function StaffContent() {
  const router = useRouter();
  const { session, signOut } = useAuth();

  const [staffProfile, setStaffProfile] = useState<Staff | null>(null);
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [schedules, setSchedules] = useState<StaffSchedule[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(() => toDateKey());
  const [showWeek, setShowWeek] = useState(false);

  // Profile + weekly schedule (once)
  useEffect(() => {
    if (!session) return;
    (async () => {
      const { data: profile } = await supabase.from('profiles').select('staff_id').eq('id', session.user.id).maybeSingle();
      const staffId = profile?.staff_id ?? null;
      if (staffId) {
        const [{ data: staff }, { data: sched }] = await Promise.all([
          supabase.from('staff').select('*').eq('id', staffId).maybeSingle(),
          supabase.from('staff_schedules').select('*').eq('staff_id', staffId).order('day_of_week'),
        ]);
        setStaffProfile((staff as Staff) || null);
        setSchedules((sched || []) as StaffSchedule[]);
      }
      setLoading(false);
    })();
  }, [session]);

  const loadAppointments = useCallback(async (staffId: string, dateKey: string) => {
    const { start, end } = dayRangeISO(dateKey);
    const { data } = await supabase
      .from('appointments')
      .select('*, customers (name, phone, email), staff (name, avatar_url, phone), services (name, duration_min, price, category, description)')
      .eq('staff_id', staffId)
      .gte('start_time', start)
      .lt('start_time', end)
      .order('start_time', { ascending: true });
    setAppointments((data || []) as unknown as AppointmentWithDetails[]);
  }, []);

  useEffect(() => {
    if (staffProfile) loadAppointments(staffProfile.id, selectedDate);
  }, [staffProfile, selectedDate, loadAppointments]);

  const updateStatus = async (aptId: string, next: AppointmentStatus) => {
    const { error } = await supabase.rpc('transition_appointment', { p_id: aptId, p_status: next });
    if (error) {
      toast.error('Không thể cập nhật trạng thái');
      return;
    }
    toast.success(`Đã chuyển sang: ${STATUS_LABELS[next]}`);
    setAppointments((prev) => prev.map((a) => (a.id === aptId ? { ...a, status: next } : a)));
  };

  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };

  if (loading) return <PageLoader />;

  if (!staffProfile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="card-base w-full max-w-md px-8 py-10 text-center">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full border-[1.5px] border-primary text-primary">
            <Scissors className="h-6 w-6" strokeWidth={1.5} />
          </div>
          <h1 className="page-title mb-2 text-2xl">Tài khoản chưa liên kết nhân viên</h1>
          <p className="mb-6 text-sm text-muted-foreground">Vui lòng liên hệ quản trị viên để được cấp quyền nhân viên.</p>
          <Button onClick={handleSignOut} variant="outline">Đăng xuất</Button>
        </div>
      </div>
    );
  }

  const isToday = selectedDate === toDateKey();
  const dayLabel = isToday ? 'hôm nay' : 'ngày này';
  const shift = schedules.find((s) => s.day_of_week === parseDateKey(selectedDate).getDay());
  const active = appointments.filter((a) => a.status !== 'cancelled');
  const changeDate = (delta: number) => setSelectedDate(toDateKey(addDays(parseDateKey(selectedDate), delta)));

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader showCta={false} />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-8 sm:px-6">
        {/* Profile */}
        <section className="card-base flex items-center gap-4 p-5 sm:p-6">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xl font-semibold text-primary">
            {staffProfile.name.charAt(0)}
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Nhân viên</p>
            <h1 className="page-title text-2xl">{staffProfile.name}</h1>
            <p className="text-sm text-muted-foreground">{staffProfile.role === 'therapist' ? 'Kỹ thuật viên' : staffProfile.role}</p>
          </div>
        </section>

        {/* Day picker + shift */}
        <section className="card-base flex items-center justify-between p-3">
          <Button variant="ghost" size="icon" onClick={() => changeDate(-1)} aria-label="Ngày trước">
            <ChevronLeft className="h-5 w-5" />
          </Button>
          <div className="text-center">
            <p className="font-semibold text-foreground">
              {parseDateKey(selectedDate).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}
              {isToday && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">Hôm nay</span>}
            </p>
            <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" />
              {shift
                ? `Ca làm: ${shift.start_time.slice(0, 5)} – ${shift.end_time.slice(0, 5)}`
                : `Không có ca ${dayLabel}`}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={() => changeDate(1)} aria-label="Ngày sau">
            <ChevronRight className="h-5 w-5" />
          </Button>
        </section>

        <div className="grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard icon={Calendar} label="Lịch hẹn" value={active.length} />
          <StatCard icon={CheckCircle2} label="Hoàn thành" value={appointments.filter((a) => a.status === 'completed').length} />
        </div>

        {/* Appointments */}
        <section className="card-base p-5 sm:p-6">
          <h2 className="block-title mb-4">Lịch hẹn trong ngày</h2>
          {appointments.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <Calendar className="mx-auto mb-2 h-10 w-10 opacity-30" />
              <p className="text-sm">Không có lịch hẹn nào {dayLabel}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {appointments.map((apt) => (
                <AppointmentRow
                  key={apt.id}
                  startTime={apt.start_time}
                  durationMin={apt.duration_min}
                  status={apt.status}
                  title={apt.services?.name || 'Dịch vụ'}
                  meta={apt.customers?.name}
                >
                  {apt.customers?.phone && (
                    <a href={`tel:${apt.customers.phone}`} className="mt-1 inline-flex items-center gap-1 text-sm text-primary hover:underline">
                      <Phone className="h-3.5 w-3.5" /> {apt.customers.phone}
                    </a>
                  )}
                  {apt.notes && (
                    <p className="mt-2 rounded-lg border border-warning/20 bg-warning/10 px-2.5 py-1.5 text-xs text-foreground">
                      <span className="font-semibold text-warning">Ghi chú: </span>
                      {apt.notes}
                    </p>
                  )}
                  <StatusActions
                    className="mt-3"
                    status={apt.status}
                    startTime={apt.start_time}
                    onChange={(next) => updateStatus(apt.id, next)}
                  />
                </AppointmentRow>
              ))}
            </div>
          )}
        </section>

        {/* Weekly schedule — collapsed by default, it rarely changes */}
        <section className="card-base">
          <button
            onClick={() => setShowWeek((v) => !v)}
            className="flex w-full items-center justify-between p-5 text-left sm:px-6"
            aria-expanded={showWeek}
          >
            <span className="block-title flex items-center gap-2 text-lg">
              <Clock className="h-4 w-4" /> Lịch làm việc cả tuần
            </span>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${showWeek ? 'rotate-180' : ''}`} />
          </button>
          {showWeek && (
            <div className="space-y-2 px-5 pb-5 sm:px-6">
              {schedules.length === 0 ? (
                <p className="text-sm text-muted-foreground">Chưa có lịch làm việc được thiết lập.</p>
              ) : (
                DAY_NAMES_FULL.map((name, dow) => {
                  const s = schedules.find((x) => x.day_of_week === dow);
                  return (
                    <div key={dow} className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 px-4 py-2.5 text-sm">
                      <span className="font-medium text-foreground">{name}</span>
                      <span className="text-right text-muted-foreground">
                        {s ? (
                          <>
                            {s.start_time.slice(0, 5)} – {s.end_time.slice(0, 5)}
                            {s.break_start && <span className="block text-xs sm:inline sm:before:content-['_·_']">nghỉ {s.break_start.slice(0, 5)}–{s.break_end?.slice(0, 5)}</span>}
                          </>
                        ) : (
                          'Nghỉ'
                        )}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
