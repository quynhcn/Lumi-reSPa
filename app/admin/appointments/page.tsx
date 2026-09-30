'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { STATUS_LABELS, type AppointmentWithDetails } from '@/lib/types';
import { ClipboardList, Search, Loader2, Plus } from 'lucide-react';
import { AppointmentRow } from '@/components/appointment-row';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'pending', label: STATUS_LABELS.pending },
  { value: 'confirmed', label: STATUS_LABELS.confirmed },
  { value: 'checked_in', label: STATUS_LABELS.checked_in },
  { value: 'in_service', label: STATUS_LABELS.in_service },
  { value: 'completed', label: STATUS_LABELS.completed },
  { value: 'cancelled', label: STATUS_LABELS.cancelled },
  { value: 'no_show', label: STATUS_LABELS.no_show },
];

const RANGE_FILTERS = [
  { value: 'upcoming', label: 'Sắp tới', days: 0 },
  { value: '30d', label: '30 ngày qua', days: 30 },
  { value: '90d', label: '90 ngày qua', days: 90 },
] as const;
type RangeValue = (typeof RANGE_FILTERS)[number]['value'];
const PAGE_LIMIT = 500;

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<AppointmentWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [range, setRange] = useState<RangeValue>('upcoming');

  useEffect(() => {
    (async () => {
      setLoading(true);
      const from = new Date();
      from.setHours(0, 0, 0, 0);
      from.setDate(from.getDate() - RANGE_FILTERS.find((r) => r.value === range)!.days);
      const { data } = await supabase
        .from('appointments')
        .select(`
          *,
          customers (name, phone, email),
          staff (name, avatar_url),
          services (name, duration_min, price, category)
        `)
        .gte('start_time', from.toISOString())
        .order('start_time', { ascending: range === 'upcoming' })
        .limit(PAGE_LIMIT);
      setAppointments((data || []) as unknown as AppointmentWithDetails[]);
      setLoading(false);
    })();
  }, [range]);

  const filtered = appointments.filter((apt) => {
    if (statusFilter !== 'all' && apt.status !== statusFilter) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        apt.customers?.name?.toLowerCase().includes(q) ||
        apt.staff?.name?.toLowerCase().includes(q) ||
        apt.services?.name?.toLowerCase().includes(q) ||
        apt.booking_code?.toLowerCase().includes(q) ||
        apt.customers?.phone?.includes(q)
      );
    }
    return true;
  });

  const groupedByDate: Record<string, AppointmentWithDetails[]> = {};
  filtered.forEach((apt) => {
    const dateKey = new Date(apt.start_time).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric', year: 'numeric' });
    if (!groupedByDate[dateKey]) groupedByDate[dateKey] = [];
    groupedByDate[dateKey].push(apt);
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title">Lịch hẹn</h1>
          <p className="text-sm text-muted-foreground mt-1">{filtered.length} lịch hẹn</p>
        </div>
        <Button asChild>
          <Link href="/booking">
            <Plus className="h-4 w-4 mr-1" />
            Tạo lịch hẹn
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <select
          value={range}
          onChange={(e) => setRange(e.target.value as RangeValue)}
          className="input-base h-10 sm:w-44"
          aria-label="Khoảng thời gian"
        >
          {RANGE_FILTERS.map((r) => (
            <option key={r.value} value={r.value}>{r.label}</option>
          ))}
        </select>
        <div className="relative order-first flex-1 sm:order-none">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tìm theo tên, SĐT, mã lịch hẹn..."
            className="pl-10"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="input-base h-10 sm:w-48"
          aria-label="Trạng thái"
        >
          {STATUS_FILTERS.map((f) => (
            <option key={f.value} value={f.value}>{f.value === 'all' ? 'Mọi trạng thái' : f.label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 opacity-30" />
          <p>Không tìm thấy lịch hẹn nào</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedByDate).map(([dateLabel, dayApts]) => (
            <div key={dateLabel}>
              <h2 className="text-sm font-medium text-muted-foreground mb-2 capitalize">{dateLabel}</h2>
              <div className="space-y-2">
                {dayApts.map((apt) => (
                  <AppointmentRow
                    key={apt.id}
                    href={`/admin/appointments/${apt.id}`}
                    startTime={apt.start_time}
                    durationMin={apt.duration_min}
                    status={apt.status}
                    price={apt.price}
                    title={apt.services?.name || 'Dịch vụ'}
                    code={apt.booking_code}
                    meta={`${apt.customers?.name} · ${apt.customers?.phone} · ${apt.staff?.name}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
