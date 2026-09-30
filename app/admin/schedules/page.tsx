'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  DAY_NAMES_FULL,
  type Staff,
  type StaffSchedule,
  type StaffTimeOff,
} from '@/lib/types';
import {
  Clock,
  Plus,
  Loader2,
  Trash2,
  CalendarOff,
  Save,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { parseDateKey, toDateKey } from '@/lib/date';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
import { toast } from 'sonner';

export default function SchedulesPage() {
  const [staffList, setStaffList] = useState<Staff[]>([]);
  const [schedules, setSchedules] = useState<Record<string, StaffSchedule[]>>({});
  const [timeOff, setTimeOff] = useState<Record<string, StaffTimeOff[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [timeOffDialog, setTimeOffDialog] = useState(false);
  const [deleteTimeOffId, setDeleteTimeOffId] = useState<string | null>(null);
  const [timeOffForm, setTimeOffForm] = useState({ date: '', reason: '' });

  useEffect(() => {
    (async () => {
      const [{ data: staffData }, { data: schedData }, { data: toData }] = await Promise.all([
        supabase.from('staff').select('*').eq('is_active', true).order('name'),
        supabase.from('staff_schedules').select('*'),
        supabase.from('staff_time_off').select('*').gte('date', toDateKey()).order('date'),
      ]);

      setStaffList(staffData || []);
      if (staffData && staffData.length > 0) setSelectedStaff(staffData[0].id);

      const schedMap: Record<string, StaffSchedule[]> = {};
      (schedData || []).forEach((s: StaffSchedule) => {
        if (!schedMap[s.staff_id]) schedMap[s.staff_id] = [];
        schedMap[s.staff_id].push(s);
      });
      setSchedules(schedMap);

      const toMap: Record<string, StaffTimeOff[]> = {};
      (toData || []).forEach((t: StaffTimeOff) => {
        if (!toMap[t.staff_id]) toMap[t.staff_id] = [];
        toMap[t.staff_id].push(t);
      });
      setTimeOff(toMap);

      setLoading(false);
    })();
  }, []);

  const updateSchedule = async (staffId: string, dayOfWeek: number, field: string, value: string) => {
    const existing = (schedules[staffId] || []).find((s) => s.day_of_week === dayOfWeek);
    if (!existing) return;

    const updates: Record<string, string | null> = { [field]: value || null };
    if (field === 'break_start' && !value) updates.break_end = null;
    if (field === 'break_start' && value && !existing.break_end) {
      const [h, m] = value.split(':').map(Number);
      updates.break_end = `${String(Math.min(h + 1, 23)).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    }

    // Validate before saving (DB CHECK constraints would reject it with a generic error)
    const next = { ...existing, ...updates };
    const t = (v: string | null) => (v ? v.slice(0, 5) : null);
    const [start, end, bStart, bEnd] = [t(next.start_time), t(next.end_time), t(next.break_start), t(next.break_end)];
    if (!start || !end) return;
    if (end <= start) {
      toast.error('Giờ kết thúc phải sau giờ bắt đầu');
      return;
    }
    if (bStart && bEnd && (bEnd <= bStart || bStart < start || bEnd > end)) {
      toast.error('Giờ nghỉ phải nằm trong ca làm và kết thúc sau khi bắt đầu');
      return;
    }
    if (bStart && !bEnd) {
      // Wait for the second half of the break before saving
      setSchedules((prev) => ({
        ...prev,
        [staffId]: (prev[staffId] || []).map((s) => (s.id === existing.id ? ({ ...existing, ...updates } as StaffSchedule) : s)),
      }));
      return;
    }

    const { error } = await supabase
      .from('staff_schedules')
      .update(updates)
      .eq('id', existing.id);
    if (error) toast.error('Không thể cập nhật lịch');
    else {
      toast.success('Đã lưu', { duration: 1200 });
      const updated = { ...existing, ...updates } as StaffSchedule;
      setSchedules((prev) => ({
        ...prev,
        [staffId]: (prev[staffId] || []).map((s) => s.id === existing.id ? updated : s),
      }));
    }
  };

  /** Copy one day's hours to all 7 days (updates existing rows, creates missing ones). */
  const applyToWeek = async (staffId: string, sourceDay: number) => {
    const src = (schedules[staffId] || []).find((x) => x.day_of_week === sourceDay);
    if (!src) return;
    const hours = { start_time: src.start_time, end_time: src.end_time, break_start: src.break_start, break_end: src.break_end };
    const existing = schedules[staffId] || [];
    const ops = Array.from({ length: 7 }, (_, d) => d)
      .filter((d) => d !== sourceDay)
      .map((d) => {
        const row = existing.find((x) => x.day_of_week === d);
        return row
          ? supabase.from('staff_schedules').update(hours).eq('id', row.id)
          : supabase.from('staff_schedules').insert({ staff_id: staffId, day_of_week: d, ...hours });
      });
    const results = await Promise.all(ops);
    if (results.some((r) => r.error)) toast.error('Một số ngày không cập nhật được');
    else toast.success('Đã áp dụng cho cả tuần');
    const { data } = await supabase.from('staff_schedules').select('*').eq('staff_id', staffId).order('day_of_week');
    setSchedules((prev) => ({ ...prev, [staffId]: (data || []) as StaffSchedule[] }));
  };

  const toggleDay = async (staffId: string, dayOfWeek: number, enable: boolean) => {
    if (enable) {
      const { data, error } = await supabase
        .from('staff_schedules')
        .insert({
          staff_id: staffId,
          day_of_week: dayOfWeek,
          start_time: '08:00',
          end_time: '17:00',
          break_start: '12:00',
          break_end: '13:00',
        })
        .select('*')
        .single();
      if (error) toast.error('Không thể thêm lịch');
      else if (data) {
        setSchedules((prev) => ({
          ...prev,
          [staffId]: [...(prev[staffId] || []), data as StaffSchedule].sort((a, b) => a.day_of_week - b.day_of_week),
        }));
      }
    } else {
      const existing = (schedules[staffId] || []).find((s) => s.day_of_week === dayOfWeek);
      if (!existing) return;
      const { error } = await supabase.from('staff_schedules').delete().eq('id', existing.id);
      if (error) toast.error('Không thể xóa lịch');
      else {
        setSchedules((prev) => ({
          ...prev,
          [staffId]: (prev[staffId] || []).filter((s) => s.id !== existing.id),
        }));
      }
    }
  };

  const addTimeOff = async () => {
    if (!timeOffForm.date) {
      toast.error('Vui lòng chọn ngày');
      return;
    }
    const { data, error } = await supabase
      .from('staff_time_off')
      .insert({
        staff_id: selectedStaff,
        date: timeOffForm.date,
        reason: timeOffForm.reason.trim() || null,
      })
      .select('*')
      .single();
    if (error) toast.error('Không thể thêm ngày nghỉ');
    else {
      toast.success('Đã thêm ngày nghỉ');
      setTimeOff((prev) => ({
        ...prev,
        [selectedStaff]: [...(prev[selectedStaff] || []), data as StaffTimeOff].sort((a, b) => a.date.localeCompare(b.date)),
      }));
      setTimeOffDialog(false);
      setTimeOffForm({ date: '', reason: '' });
    }
  };

  const deleteTimeOff = async () => {
    if (!deleteTimeOffId) return;
    const { error } = await supabase.from('staff_time_off').delete().eq('id', deleteTimeOffId);
    if (error) toast.error('Không thể xóa');
    else {
      toast.success('Đã xóa ngày nghỉ');
      setTimeOff((prev) => ({
        ...prev,
        [selectedStaff]: (prev[selectedStaff] || []).filter((t) => t.id !== deleteTimeOffId),
      }));
    }
    setDeleteTimeOffId(null);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const currentStaff = staffList.find((s) => s.id === selectedStaff);
  const currentSchedules = schedules[selectedStaff] || [];
  const currentTimeOff = timeOff[selectedStaff] || [];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Lịch làm việc</h1>
        <p className="text-sm text-muted-foreground mt-1">Quản lý giờ làm việc và ngày nghỉ của nhân viên</p>
      </div>

      {/* Staff selector */}
      <div className="flex flex-wrap gap-2">
        {staffList.map((staff) => (
          <button
            key={staff.id}
            onClick={() => setSelectedStaff(staff.id)}
            className={cn(
              'flex items-center gap-2 rounded-xl border px-4 py-2.5 transition-all',
              selectedStaff === staff.id
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-card hover:bg-muted'
            )}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-semibold text-sm">
              {staff.name.charAt(0)}
            </div>
            <span className={cn('font-medium text-sm', selectedStaff === staff.id ? 'text-primary' : 'text-foreground')}>
              {staff.name}
            </span>
          </button>
        ))}
      </div>

      {currentStaff && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Weekly schedule */}
          <div className="card-base p-5 sm:p-6 lg:col-span-2">
            <h2 className="block-title mb-4 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Lịch tuần — {currentStaff.name}
            </h2>
            <div className="space-y-3">
              {DAY_NAMES_FULL.map((dayName, dayIdx) => {
                const sched = currentSchedules.find((s) => s.day_of_week === dayIdx);
                return (
                  <div key={dayIdx} className={cn(
                    'flex flex-wrap items-center gap-x-4 gap-y-2 p-3 rounded-xl border transition-all',
                    sched ? 'border-border bg-muted/20' : 'border-border bg-card'
                  )}>
                    <div className="w-24 shrink-0">
                      <span className="text-sm font-medium">{dayName}</span>
                    </div>
                    {sched ? (
                      <>
                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <TimeSelect label={`Bắt đầu ${dayName}`} value={sched.start_time} onChange={(v) => updateSchedule(selectedStaff, dayIdx, 'start_time', v)} />
                          <span className="text-muted-foreground">→</span>
                          <TimeSelect label={`Kết thúc ${dayName}`} value={sched.end_time} onChange={(v) => updateSchedule(selectedStaff, dayIdx, 'end_time', v)} />
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs text-muted-foreground">Nghỉ</span>
                            <TimeSelect
                              label={`Bắt đầu nghỉ ${dayName}`}
                              value={sched.break_start || ''}
                              allowEmpty
                              onChange={(v) => updateSchedule(selectedStaff, dayIdx, 'break_start', v)}
                            />
                            {sched.break_start && (
                              <>
                                <span className="text-muted-foreground">→</span>
                                <TimeSelect label={`Kết thúc nghỉ ${dayName}`} value={sched.break_end || ''} onChange={(v) => updateSchedule(selectedStaff, dayIdx, 'break_end', v)} />
                              </>
                            )}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-xs text-primary"
                            onClick={() => applyToWeek(selectedStaff, dayIdx)}
                            title="Dùng giờ của ngày này cho cả 7 ngày"
                          >
                            Áp dụng cả tuần
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => toggleDay(selectedStaff, dayIdx, false)}
                            aria-label={`Cho nghỉ ${dayName}`}
                            title="Cho nghỉ ngày này"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="flex-1 text-sm text-muted-foreground">Nghỉ</div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="shrink-0"
                          onClick={() => toggleDay(selectedStaff, dayIdx, true)}
                        >
                          <Plus className="h-3.5 w-3.5 mr-1" />
                          Thêm giờ
                        </Button>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time off */}
          <div className="card-base p-5 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="block-title flex items-center gap-2">
                <CalendarOff className="h-4 w-4" />
                Ngày nghỉ
              </h2>
              <Button size="sm" variant="outline" onClick={() => setTimeOffDialog(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" />
                Thêm
              </Button>
            </div>
            {currentTimeOff.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Chưa có ngày nghỉ nào</p>
            ) : (
              <div className="space-y-2">
                {currentTimeOff.map((to) => (
                  <div key={to.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30">
                    <div>
                      <p className="text-sm font-medium">
                        {parseDateKey(to.date).toLocaleDateString('vi-VN', { weekday: 'long', day: 'numeric', month: 'numeric' })}
                      </p>
                      {to.reason && <p className="text-xs text-muted-foreground">{to.reason}</p>}
                    </div>
                    <button
                      onClick={() => setDeleteTimeOffId(to.id)}
                      aria-label="Xóa ngày nghỉ"
                      title="Xóa ngày nghỉ"
                      className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Time off dialog */}
      <Dialog open={timeOffDialog} onOpenChange={setTimeOffDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Thêm ngày nghỉ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="to-date">Ngày</Label>
              <Input
                id="to-date"
                type="date"
                min={toDateKey()}
                value={timeOffForm.date}
                onChange={(e) => setTimeOffForm({ ...timeOffForm, date: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="to-reason">Lý do (tùy chọn)</Label>
              <Input
                id="to-reason"
                value={timeOffForm.reason}
                onChange={(e) => setTimeOffForm({ ...timeOffForm, reason: e.target.value })}
                placeholder="Ốm, việc cá nhân, phép..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTimeOffDialog(false)}>Hủy</Button>
            <Button onClick={addTimeOff}>
              <Save className="h-4 w-4 mr-1" />
              Thêm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTimeOffId} onOpenChange={(open) => !open && setDeleteTimeOffId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Xóa ngày nghỉ?</AlertDialogTitle>
            <AlertDialogDescription>Ngày nghỉ sẽ được xóa, nhân viên sẽ lại nhận lịch hẹn vào ngày này.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Hủy</AlertDialogCancel>
            <AlertDialogAction onClick={deleteTimeOff}>Xóa</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/** 24h time picker in 30-minute steps (native <input type=time> shows AM/PM on many browsers). */
const TIME_OPTIONS = Array.from({ length: 36 }, (_, i) => {
  const mins = 6 * 60 + i * 30; // 06:00 → 23:30
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
});

function TimeSelect({ value, onChange, label, allowEmpty }: { value: string; onChange: (v: string) => void; label: string; allowEmpty?: boolean }) {
  const v = value ? value.slice(0, 5) : '';
  const options = v && !TIME_OPTIONS.includes(v) ? [...TIME_OPTIONS, v].sort() : TIME_OPTIONS;
  return (
    <select aria-label={label} value={v} onChange={(e) => onChange(e.target.value)} className="input-base h-9 w-[5.5rem] px-2 py-1">
      {allowEmpty && <option value="">Không</option>}
      {options.map((t) => (
        <option key={t} value={t}>{t}</option>
      ))}
    </select>
  );
}
