'use client';

import { useEffect, useState } from 'react';
import { CalendarClock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { addDays, parseDateKey, toDateKey } from '@/lib/date';
import { track } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const ERRORS: Record<string, string> = {
  TOO_LATE: 'Chỉ đổi giờ được trước giờ hẹn 2 tiếng. Vui lòng gọi spa.',
  RESCHEDULE_LIMIT: 'Lịch này đã đổi giờ 2 lần. Vui lòng gọi spa để được hỗ trợ.',
  NOT_RESCHEDULABLE: 'Lịch này không còn đổi giờ được.',
  SLOT_UNAVAILABLE: 'Khung giờ này vừa có người đặt. Vui lòng chọn giờ khác.',
  DATE_TOO_FAR: 'Chỉ đặt trước tối đa 60 ngày.',
};

interface RescheduleTarget {
  id: string;
  service_id: string;
  staff_id: string;
  start_time: string;
  staffName?: string | null;
  serviceName?: string | null;
}

/** Pick a new date / time for an existing appointment. Keeps booking code, price and gift card. */
export function RescheduleDialog({
  appointment,
  open,
  onOpenChange,
  onDone,
}: {
  appointment: RescheduleTarget;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [date, setDate] = useState('');
  const [keepStaff, setKeepStaff] = useState(true);
  const [slots, setSlots] = useState<string[]>([]);
  const [time, setTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setDate(toDateKey(new Date(appointment.start_time)));
      setTime('');
      setKeepStaff(true);
    }
  }, [open, appointment.start_time]);

  useEffect(() => {
    if (!open || !date) return;
    let cancelled = false;
    setLoading(true);
    setTime('');
    supabase
      .rpc('get_available_slots', {
        p_service_id: appointment.service_id,
        p_staff_id: keepStaff ? appointment.staff_id : null,
        p_date: date,
        p_ignore_appointment: appointment.id,
      })
      .then(({ data }) => {
        if (cancelled) return;
        setSlots(((data as { slot_time: string }[]) || []).map((s) => s.slot_time));
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, date, keepStaff, appointment.id, appointment.service_id, appointment.staff_id]);

  const save = async () => {
    setSaving(true);
    const { data, error } = await supabase.rpc('reschedule_appointment', {
      p_id: appointment.id,
      p_date: date,
      p_time: time,
      p_staff_id: keepStaff ? appointment.staff_id : null,
    });
    setSaving(false);
    if (error) {
      const code = Object.keys(ERRORS).find((k) => error.message.includes(k));
      toast.error(code ? ERRORS[code] : 'Không đổi được giờ. Vui lòng thử lại.');
      return;
    }
    const row = ((data as { staff_name: string }[]) || [])[0];
    toast.success(`Đã đổi sang ${time} ngày ${parseDateKey(date).toLocaleDateString('vi-VN')}${row?.staff_name ? ` · ${row.staff_name}` : ''}`);
    track('reschedule');
    onOpenChange(false);
    onDone();
  };

  const today = new Date();
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <CalendarClock className="h-5 w-5 text-primary" /> Đổi giờ hẹn
          </DialogTitle>
          <DialogDescription>
            {appointment.serviceName} · giữ nguyên mã đặt lịch, giá và ưu đãi.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label htmlFor="rs-date" className="mb-1.5 block text-sm font-semibold">Ngày mới</label>
            <input
              id="rs-date"
              type="date"
              min={toDateKey(today)}
              max={toDateKey(addDays(today, 30))}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="input-base h-11 max-w-xs"
            />
          </div>
          {appointment.staffName && (
            <div className="flex flex-wrap gap-2 text-sm">
              {[true, false].map((k) => (
                <button
                  key={String(k)}
                  type="button"
                  onClick={() => setKeepStaff(k)}
                  aria-pressed={keepStaff === k}
                  className={cn(
                    'rounded-full border px-3 py-1.5 font-medium',
                    keepStaff === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card text-muted-foreground hover:bg-muted'
                  )}
                >
                  {k ? `Giữ ${appointment.staffName}` : 'Bất kỳ nhân viên'}
                </button>
              ))}
            </div>
          )}
          <div>
            <p className="mb-2 text-sm font-semibold">Giờ còn trống</p>
            {loading ? (
              <p className="flex items-center gap-2 py-3 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Đang tìm…</p>
            ) : slots.length === 0 ? (
              <p className="rounded-lg bg-muted/60 p-3 text-center text-sm text-muted-foreground">
                Hết giờ trống ngày này{keepStaff && appointment.staffName ? ' — thử “Bất kỳ nhân viên” hoặc ngày khác' : ''}.
              </p>
            ) : (
              <div className="grid grid-cols-4 gap-2 sm:grid-cols-5" role="group" aria-label="Giờ còn trống">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setTime(s)}
                    aria-pressed={time === s}
                    className={cn(
                      'rounded-lg border-2 px-2 py-2 text-sm font-semibold',
                      time === s ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40'
                    )}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Đóng</Button>
          <Button onClick={save} disabled={!time || saving}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Đổi sang {time || '…'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
