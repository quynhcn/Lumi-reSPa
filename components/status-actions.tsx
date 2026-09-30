'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  ACTION_LABELS,
  DESTRUCTIVE_STATUSES,
  STATUS_FLOW,
  type AppointmentStatus,
} from '@/lib/types';
import { Button } from '@/components/ui/button';
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
import { cn } from '@/lib/utils';

interface StatusActionsProps {
  status: AppointmentStatus;
  startTime: string;
  onChange: (next: AppointmentStatus) => Promise<void> | void;
  className?: string;
}

const CONFIRM_TEXT: Partial<Record<AppointmentStatus, { title: string; body: string }>> = {
  cancelled: { title: 'Hủy lịch hẹn này?', body: 'Khung giờ sẽ được giải phóng cho khách khác. Lịch hẹn vẫn được lưu trong lịch sử.' },
  no_show: { title: 'Đánh dấu khách không đến?', body: 'Chỉ dùng khi đã quá giờ hẹn mà khách chưa tới.' },
};

/**
 * Next-step buttons for an appointment, shared by the staff page and the admin detail page.
 * - Labels are verbs ("Check-in", "Hoàn thành"), not past-tense state names.
 * - The main forward step is a filled button; cancel / no-show are secondary and need confirmation.
 * - "Khách không đến" only appears once the appointment start time has passed.
 */
export function StatusActions({ status, startTime, onChange, className }: StatusActionsProps) {
  const [busy, setBusy] = useState<AppointmentStatus | null>(null);
  const [confirm, setConfirm] = useState<AppointmentStatus | null>(null);
  const started = new Date(startTime).getTime() <= Date.now();

  const next = (STATUS_FLOW[status] || []).filter((s) => s !== 'no_show' || started);
  if (next.length === 0) return null;
  const forward = next.filter((s) => !DESTRUCTIVE_STATUSES.includes(s));
  const destructive = next.filter((s) => DESTRUCTIVE_STATUSES.includes(s));

  const run = async (s: AppointmentStatus) => {
    setBusy(s);
    try {
      await onChange(s);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className={cn('flex flex-wrap items-center gap-2', className)}>
      {forward.map((s, i) => (
        <Button key={s} size="sm" variant={i === 0 ? 'default' : 'outline'} disabled={!!busy} onClick={() => run(s)}>
          {busy === s && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          {ACTION_LABELS[s]}
        </Button>
      ))}
      {destructive.map((s) => (
        <Button
          key={s}
          size="sm"
          variant="ghost"
          disabled={!!busy}
          onClick={() => setConfirm(s)}
          className="text-destructive hover:bg-destructive/10 hover:text-destructive"
        >
          {busy === s && <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />}
          {ACTION_LABELS[s]}
        </Button>
      ))}

      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{confirm && CONFIRM_TEXT[confirm]?.title}</AlertDialogTitle>
            <AlertDialogDescription>{confirm && CONFIRM_TEXT[confirm]?.body}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Quay lại</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirm && run(confirm)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {confirm && ACTION_LABELS[confirm]}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
