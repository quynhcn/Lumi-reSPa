'use client';

import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import {
  STATUS_LABELS,
  STATUS_COLORS,
  STATUS_DOT_COLORS,
  type AppointmentWithDetails,
  type AppointmentStatus,
  type Staff,
} from '@/lib/types';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type ViewMode = 'day' | 'week' | 'month';

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8:00 - 19:00
const DAY_LABELS = ['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'];
const DAY_LABELS_FULL = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export default function CalendarPage() {
  const [view, setView] = useState<ViewMode>('week');

  // A 7-column week does not fit a phone — start in day view there
  useEffect(() => {
    if (window.matchMedia('(max-width: 639px)').matches) setView('day');
  }, []);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: staffData } = await supabase
        .from('staff')
        .select('*')
        .eq('is_active', true)
        .order('name');
      setStaffList(staffData || []);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      let rangeStart: Date, rangeEnd: Date;

      if (view === 'day') {
        rangeStart = new Date(currentDate);
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd = new Date(currentDate);
        rangeEnd.setHours(23, 59, 59, 999);
      } else if (view === 'week') {
        const dayOfWeek = (currentDate.getDay() + 6) % 7; // Monday = 0
        rangeStart = new Date(currentDate);
        rangeStart.setDate(rangeStart.getDate() - dayOfWeek);
        rangeStart.setHours(0, 0, 0, 0);
        rangeEnd = new Date(rangeStart);
        rangeEnd.setDate(rangeEnd.getDate() + 6);
        rangeEnd.setHours(23, 59, 59, 999);
      } else {
        rangeStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
        rangeEnd = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59);
      }

      const { data } = await supabase
        .from('appointments')
        .select(`
          *,
          customers (name, phone, email),
          staff (name, avatar_url),
          services (name, duration_min, price, category)
        `)
        .gte('start_time', rangeStart.toISOString())
        .lte('start_time', rangeEnd.toISOString())
        // Cancelled bookings free the slot — drawing them would overlap the new booking in that slot
        .neq('status', 'cancelled')
        .order('start_time');

      setAppointments((data || []) as unknown as AppointmentWithDetails[]);
      setLoading(false);
    })();
  }, [currentDate, view]);

  const navigate = (direction: number) => {
    const newDate = new Date(currentDate);
    if (view === 'day') newDate.setDate(newDate.getDate() + direction);
    else if (view === 'week') newDate.setDate(newDate.getDate() + direction * 7);
    else newDate.setMonth(newDate.getMonth() + direction);
    setCurrentDate(newDate);
  };

  const todayStr = new Date().toDateString();

  const weekDays = useMemo(() => {
    const dayOfWeek = (currentDate.getDay() + 6) % 7; // Monday = 0
    const start = new Date(currentDate);
    start.setDate(start.getDate() - dayOfWeek);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      return d;
    });
  }, [currentDate]);

  const getAppointmentsForDate = (date: Date) => {
    const dateStr = date.toDateString();
    return appointments.filter((a) => new Date(a.start_time).toDateString() === dateStr);
  };

  const getAppointmentPosition = (apt: AppointmentWithDetails) => {
    const start = new Date(apt.start_time);
    const end = new Date(apt.end_time);
    const startHour = start.getHours() + start.getMinutes() / 60;
    const endHour = end.getHours() + end.getMinutes() / 60;
    const top = (startHour - 8) * 64; // 64px per hour
    const height = (endHour - startHour) * 64;
    return { top: Math.max(0, top), height: Math.max(24, height - 4) };
  };

  const headerLabel = useMemo(() => {
    if (view === 'day') {
      return currentDate.toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    } else if (view === 'week') {
      const start = weekDays[0];
      const end = weekDays[6];
      return `${start.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('vi-VN', { day: 'numeric', month: 'short', year: 'numeric' })}`;
    } else {
      return currentDate.toLocaleDateString('vi-VN', { month: 'long', year: 'numeric' });
    }
  }, [view, currentDate, weekDays]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Lịch</h1>
          <p className="text-sm text-muted-foreground mt-1">{headerLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-border bg-card p-0.5">
            {(['day', 'week', 'month'] as ViewMode[]).map((m) => (
              <button
                key={m}
                onClick={() => setView(m)}
                aria-pressed={view === m}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium rounded-md transition-all',
                  view === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m === 'day' ? 'Ngày' : m === 'week' ? 'Tuần' : 'Tháng'}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => navigate(-1)} aria-label="Trước">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
              Hôm nay
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigate(1)} aria-label="Sau">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : view === 'day' ? (
        <DayView
          date={currentDate}
          appointments={appointments}
          staffList={staffList}
          getAppointmentPosition={getAppointmentPosition}
        />
      ) : view === 'week' ? (
        <WeekView
          weekDays={weekDays}
          appointments={appointments}
          todayStr={todayStr}
          getAppointmentPosition={getAppointmentPosition}
        />
      ) : (
        <MonthView
          currentDate={currentDate}
          appointments={appointments}
          todayStr={todayStr}
        />
      )}
    </div>
  );
}

const hm = (iso: string) => new Date(iso).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Side-by-side lanes for overlapping appointments in one column (e.g. several staff at 10:00). */
function layoutLanes(apts: AppointmentWithDetails[]) {
  const sorted = [...apts].sort((a, b) => a.start_time.localeCompare(b.start_time));
  const out = new Map<string, { lane: number; lanes: number }>();
  let group: AppointmentWithDetails[] = [];
  let laneEnds: number[] = [];
  let groupEnd = 0;
  const flush = () => {
    group.forEach((a) => (out.get(a.id)!.lanes = laneEnds.length));
    group = [];
    laneEnds = [];
  };
  for (const apt of sorted) {
    const start = new Date(apt.start_time).getTime();
    const end = new Date(apt.end_time).getTime();
    if (group.length && start >= groupEnd) flush();
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) lane = laneEnds.push(end) - 1;
    else laneEnds[lane] = end;
    out.set(apt.id, { lane, lanes: 1 });
    group.push(apt);
    groupEnd = Math.max(groupEnd, end);
  }
  flush();
  return out;
}

function DayView({
  date,
  appointments,
  staffList,
  getAppointmentPosition,
}: {
  date: Date;
  appointments: AppointmentWithDetails[];
  staffList: Staff[];
  getAppointmentPosition: (apt: AppointmentWithDetails) => { top: number; height: number };
}) {
  const dayApts = appointments.filter(
    (a) => new Date(a.start_time).toDateString() === date.toDateString()
  );

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex">
        {/* Time column */}
        <div className="w-16 shrink-0 border-r border-border">
          <div className="h-12 border-b border-border" />
          {HOURS.map((h) => (
            <div key={h} className="h-16 text-xs text-muted-foreground text-right pr-2 pt-1">
              {h}:00
            </div>
          ))}
        </div>
        {/* Staff columns */}
        <div className="flex-1 overflow-x-auto scrollbar-thin">
          <div className="flex min-w-full">
            {staffList.map((staff) => {
              const staffApts = dayApts.filter((a) => a.staff_id === staff.id);
              return (
                <div key={staff.id} className="flex-1 min-w-[180px] border-r border-border last:border-r-0">
                  <div className="h-12 border-b border-border flex flex-col items-center justify-center px-2">
                    <span className="text-sm font-medium truncate">{staff.name}</span>
                  </div>
                  <div className="relative h-[768px]">
                    {HOURS.map((h) => (
                      <div key={h} className="h-16 border-b border-border/50" />
                    ))}
                    {staffApts.map((apt) => {
                      const { top, height } = getAppointmentPosition(apt);
                      return (
                        <Link
                          key={apt.id}
                          href={`/admin/appointments/${apt.id}`}
                          className={cn(
                            'absolute left-1 right-1 rounded-md p-1.5 text-xs overflow-hidden border-l-2 hover:shadow-md transition-shadow cursor-pointer',
                            STATUS_COLORS[apt.status as AppointmentStatus]
                          )}
                          style={{ top, height }}
                        >
                          {height < 40 ? (
                            <p className="truncate font-semibold">{hm(apt.start_time)} · {apt.customers?.name}</p>
                          ) : (
                            <>
                              <p className="truncate font-semibold">{apt.services?.name}</p>
                              <p className="truncate opacity-75">{apt.customers?.name}</p>
                              <p className="opacity-60">{hm(apt.start_time)}</p>
                            </>
                          )}
                        </Link>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekView({
  weekDays,
  appointments,
  todayStr,
  getAppointmentPosition,
}: {
  weekDays: Date[];
  appointments: AppointmentWithDetails[];
  todayStr: string;
  getAppointmentPosition: (apt: AppointmentWithDetails) => { top: number; height: number };
}) {
  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="flex">
        {/* Time column */}
        <div className="w-14 shrink-0 border-r border-border">
          <div className="h-10 border-b border-border" />
          {HOURS.map((h) => (
            <div key={h} className="h-16 text-xs text-muted-foreground text-right pr-2 pt-1">
              {h}:00
            </div>
          ))}
        </div>
        {/* Day columns */}
        <div className="flex-1 overflow-x-auto scrollbar-thin">
          <div className="flex min-w-full">
            {weekDays.map((day, i) => {
              const dayApts = appointments.filter(
                (a) => new Date(a.start_time).toDateString() === day.toDateString()
              );
              const isToday = day.toDateString() === todayStr;
              return (
                <div key={i} className="flex-1 min-w-[140px] border-r border-border last:border-r-0">
                  <div className={cn(
                    'h-10 border-b border-border flex flex-col items-center justify-center',
                    isToday && 'bg-primary/5'
                  )}>
                    <span className="text-xs text-muted-foreground">{DAY_LABELS[day.getDay()]}</span>
                    <span className={cn('text-sm font-semibold', isToday && 'text-primary')}>{day.getDate()}</span>
                  </div>
                  <div className="relative h-[768px]">
                    {HOURS.map((h) => (
                      <div key={h} className="h-16 border-b border-border/50" />
                    ))}
                    {(() => {
                      const lanes = layoutLanes(dayApts);
                      return dayApts.map((apt) => {
                      const { top, height } = getAppointmentPosition(apt);
                      const { lane, lanes: n } = lanes.get(apt.id)!;
                      return (
                        <Link
                          key={apt.id}
                          href={`/admin/appointments/${apt.id}`}
                          title={`${apt.services?.name} · ${apt.customers?.name} · ${apt.staff?.name}`}
                          className={cn(
                            'absolute rounded-md p-1 text-xs overflow-hidden border-l-2 hover:z-10 hover:shadow-md transition-shadow cursor-pointer',
                            STATUS_COLORS[apt.status as AppointmentStatus]
                          )}
                          style={{ top, height, left: `calc(${(lane / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)` }}
                        >
                          {height < 40 ? (
                            <p className="truncate font-semibold">{hm(apt.start_time)} · {apt.customers?.name}</p>
                          ) : (
                            <>
                              <p className="truncate font-semibold">{apt.services?.name}</p>
                              <p className="truncate opacity-75">{apt.customers?.name}</p>
                            </>
                          )}
                        </Link>
                      );
                    });
                    })()}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthView({
  currentDate,
  appointments,
  todayStr,
}: {
  currentDate: Date;
  appointments: AppointmentWithDetails[];
  todayStr: string;
}) {
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDayOfWeek = (firstDay.getDay() + 6) % 7; // Monday-first grid
  const daysInMonth = lastDay.getDate();

  const cells: (Date | null)[] = [];
  for (let i = 0; i < startDayOfWeek; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
      <div className="grid grid-cols-7 border-b border-border">
        {[...DAY_LABELS_FULL.slice(1), DAY_LABELS_FULL[0]].map((label, i) => (
          <div key={i} className="px-3 py-2.5 text-center text-xs font-medium text-muted-foreground border-r border-border last:border-r-0">
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((date, i) => {
          if (!date) {
            return <div key={i} className="min-h-[100px] border-r border-b border-border last:border-r-0 bg-muted/20" />;
          }
          const dayApts = appointments.filter(
            (a) => new Date(a.start_time).toDateString() === date.toDateString()
          );
          const isToday = date.toDateString() === todayStr;
          return (
            <div key={i} className="min-h-[100px] border-r border-b border-border last:border-r-0 p-1.5">
              <div className={cn(
                'inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium',
                isToday ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'
              )}>
                {date.getDate()}
              </div>
              <div className="mt-1 space-y-0.5">
                {dayApts.slice(0, 3).map((apt) => (
                  <Link
                    key={apt.id}
                    href={`/admin/appointments/${apt.id}`}
                    className={cn(
                      'flex items-center gap-1 rounded px-1 py-0.5 text-xs hover:opacity-80 transition-opacity',
                      STATUS_COLORS[apt.status as AppointmentStatus]
                    )}
                  >
                    <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STATUS_DOT_COLORS[apt.status as AppointmentStatus])} />
                    <span className="truncate">
                      {new Date(apt.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })} {apt.services?.name}
                    </span>
                  </Link>
                ))}
                {dayApts.length > 3 && (
                  <p className="text-xs text-muted-foreground px-1">+{dayApts.length - 3} khác</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
