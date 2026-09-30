'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  BellRing,
  Check,
  MessageCircle,
  MessageSquareText,
  Phone,
  Zap,
  Settings,
  Loader2,
  Clock,
  History,
  Bot,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import { SITE, telHref, zaloHref } from '@/lib/site-config';
import type { AppointmentWithDetails } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';

type Row = Pick<AppointmentWithDetails, 'id' | 'start_time' | 'booking_code' | 'customers' | 'services' | 'staff'>;

export function reminderText(apt: Row): string {
  const start = new Date(apt.start_time);
  const name = apt.customers?.name?.trim().split(/\s+/).pop() || 'quý khách';
  return SITE.reminderTemplate
    .replace('{name}', name)
    .replace('{service}', apt.services?.name || 'dịch vụ')
    .replace('{time}', start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }))
    .replace('{date}', start.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }))
    .replace('{code}', apt.booking_code);
}

const VN_OFFSET = 7 * 3600_000;

function endOfTomorrowVN(now: Date) {
  const vn = new Date(now.getTime() + VN_OFFSET);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate() + 2) - VN_OFFSET);
}

interface ReminderSettings {
  hoursAhead: number;
}

const DEFAULT_SETTINGS: ReminderSettings = {
  hoursAhead: 24,
};

interface SentLog {
  id: string;
  customerName: string;
  phone: string;
  service: string;
  time: string;
  sentAt: string;
  channel: string;
}

export function ReminderQueue() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [settings, setSettings] = useState<ReminderSettings>(() => {
    try {
      const saved = localStorage.getItem('lumiere_reminder_settings');
      const parsed = saved ? JSON.parse(saved) : {};
      return { hoursAhead: Number(parsed.hoursAhead) || DEFAULT_SETTINGS.hoursAhead };
    } catch {
      return DEFAULT_SETTINGS;
    }
  });
  const [sentLogs, setSentLogs] = useState<SentLog[]>(() => {
    try {
      const saved = localStorage.getItem('lumiere_sent_reminder_logs');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  const load = useCallback(async () => {
    const now = new Date();
    const until = endOfTomorrowVN(now);
    let { data, error } = await supabase
      .from('appointments')
      .select('id, start_time, booking_code, customers (name, phone), services (name), staff (name)')
      .in('status', ['pending', 'confirmed'])
      .is('reminded_at', null)
      .gte('start_time', now.toISOString())
      .lt('start_time', until.toISOString())
      .order('start_time');

    if (error && error.message?.includes('reminded_at')) {
      const res = await supabase
        .from('appointments')
        .select('id, start_time, booking_code, customers (name, phone), services (name), staff (name)')
        .in('status', ['pending', 'confirmed'])
        .gte('start_time', now.toISOString())
        .lt('start_time', until.toISOString())
        .order('start_time');

      const localReminded = new Set<string>();
      try {
        const saved: SentLog[] = JSON.parse(localStorage.getItem('lumiere_sent_reminder_logs') || '[]');
        saved.forEach((x) => localReminded.add(x.id));
      } catch {}

      data = (res.data || []).filter((apt) => !localReminded.has(apt.id));
    }

    setRows((data || []) as unknown as Row[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const saveSettings = (newSettings: ReminderSettings) => {
    const safeSettings = { hoursAhead: newSettings.hoursAhead };
    setSettings(safeSettings);
    try {
      localStorage.setItem('lumiere_reminder_settings', JSON.stringify(safeSettings));
    } catch {}
  };

  const addLog = (log: SentLog) => {
    setSentLogs((prev) => {
      const updated = [log, ...prev].slice(0, 50);
      try {
        localStorage.setItem('lumiere_sent_reminder_logs', JSON.stringify(updated));
      } catch {}
      return updated;
    });
  };

  const markDone = async (id: string, apt?: Row) => {
    const timestamp = new Date().toISOString();
    const { error } = await supabase.from('appointments').update({ reminded_at: timestamp }).eq('id', id);
    if (error) {
      toast.error('Không cập nhật được');
    } else {
      setRows((r) => r.filter((x) => x.id !== id));
      if (apt) {
        addLog({
          id,
          customerName: apt.customers?.name || 'Khách hàng',
          phone: apt.customers?.phone || '',
          service: apt.services?.name || 'Dịch vụ',
          time: new Date(apt.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          sentAt: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }),
          channel: 'Thủ công',
        });
      }
    }
  };

  const copyAndOpenZalo = async (apt: Row) => {
    try {
      await navigator.clipboard.writeText(reminderText(apt));
      toast.success('Đã sao chép tin nhắn — dán vào khung chat Zalo');
    } catch {
      toast.message(reminderText(apt));
    }
    window.open(zaloHref(apt.customers?.phone || ''), '_blank', 'noopener');
  };

  // 1-Click Batch Auto-Send
  const handleAutoSendAll = async () => {
    if (rows.length === 0) return;
    setSendingBatch(true);
    try {
      const res = await fetch(`/api/reminders/send?hours=${settings.hoursAhead}`, { method: 'POST' });
      const data = await res.json();
      const sentCount: number = data.count || 0;
      const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' });
      // Chỉ ghi log cho những lịch server xác nhận đã gửi thật
      ((data.reminded || []) as { id: string; customer_name: string; phone: string; service: string; start_time: string }[]).forEach((r) => {
        addLog({
          id: r.id,
          customerName: r.customer_name || 'Khách hàng',
          phone: r.phone || '',
          service: r.service || 'Dịch vụ',
          time: new Date(r.start_time).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }),
          sentAt: nowStr,
          channel: 'SMS',
        });
      });
      if (!res.ok) toast.error(data.error || 'Không gửi được nhắc lịch');
      else if (data.failed?.length) toast.warning(`Đã gửi ${sentCount} tin, lỗi ${data.failed.length} tin — hãy nhắc thủ công các lịch còn lại.`);
      else toast.success(sentCount > 0 ? `Đã gửi nhắc lịch cho ${sentCount} khách hàng` : 'Không có lịch nào cần nhắc trong khoảng thời gian này');
      await load();
    } catch {
      toast.error('Lỗi khi kích hoạt gửi tự động. Vui lòng thử lại.');
    } finally {
      setSendingBatch(false);
    }
  };

  return (
    <section className="card-base p-5 sm:p-6">
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h2 className="block-title flex items-center gap-2">
            <BellRing className="h-5 w-5 text-primary" /> Nhắc lịch hẹn
            {rows.length > 0 ? (
              <span className="rounded-full bg-primary px-2.5 py-0.5 font-sans text-xs font-bold text-primary-foreground">
                {rows.length} cần nhắc
              </span>
            ) : (
              <span className="rounded-full bg-success/15 px-2.5 py-0.5 font-sans text-xs font-semibold text-success">
                Đã hoàn tất
              </span>
            )}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Lịch hẹn hôm nay & ngày mai · Tự động hóa qua Zalo ZNS / SMS
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Auto-pilot toggle */}
          <div className="flex items-center gap-2 rounded-xl border border-border bg-muted/30 px-3 py-1.5 text-xs font-medium">
            <Bot className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              Lịch tự động: cấu hình phía server
            </span>
            <Switch
              checked={false}
              disabled
              aria-label="Bật chế độ tự động nhắc lịch"
            />
          </div>

          {/* Settings button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSettingsOpen(true)}
            className="h-8 gap-1.5 text-xs"
            title="Cài đặt kênh gửi tự động"
          >
            <Settings className="h-3.5 w-3.5" />
            Cài đặt
          </Button>

          {/* History log button */}
          {sentLogs.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setHistoryOpen(true)}
              className="h-8 gap-1.5 text-xs"
              title="Xem lịch sử đã nhắc"
            >
              <History className="h-3.5 w-3.5" />
              Lịch sử ({sentLogs.length})
            </Button>
          )}

          {/* Batch auto-send button */}
          {rows.length > 0 && (
            <Button
              size="sm"
              onClick={handleAutoSendAll}
              disabled={sendingBatch}
              className="h-8 gap-1.5 text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
            >
              {sendingBatch ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5 text-amber-300" />
              )}
              Tự động gửi tất cả ({rows.length})
            </Button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="h-16 animate-pulse rounded-lg bg-muted/60" />
      ) : rows.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm font-medium text-foreground">Đã nhắc hết các lịch sắp tới 🎉</p>
          <p className="text-xs text-muted-foreground mt-1">
            Hệ thống sẽ tiếp tục giám sát và tự động nhắc khi có lịch hẹn mới.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {rows.map((apt) => {
            const start = new Date(apt.start_time);
            const phone = apt.customers?.phone || '';
            return (
              <li key={apt.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Link href={`/admin/appointments/${apt.id}`} className="font-semibold text-foreground hover:text-primary">
                      {start.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}{' '}
                      {start.toDateString() === new Date().toDateString() ? 'hôm nay' : start.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit' })}
                      {' · '}
                      {apt.customers?.name}
                    </Link>
                    <span className="font-mono text-[11px] text-muted-foreground">({apt.booking_code})</span>
                  </div>
                  <p className="truncate text-sm text-muted-foreground mt-0.5">
                    {apt.services?.name} · {apt.staff?.name} · <span className="font-mono">{phone}</span>
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <Button size="sm" variant="outline" className="h-8" onClick={() => copyAndOpenZalo(apt)}>
                    <MessageCircle className="mr-1 h-3.5 w-3.5 text-[#0068FF]" /> Zalo
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-8">
                    <a href={`sms:${phone.replace(/\s/g, '')}?body=${encodeURIComponent(reminderText(apt))}`}>
                      <MessageSquareText className="mr-1 h-3.5 w-3.5" /> SMS
                    </a>
                  </Button>
                  <Button asChild size="sm" variant="outline" className="h-8">
                    <a href={telHref(phone)}>
                      <Phone className="mr-1 h-3.5 w-3.5" /> Gọi
                    </a>
                  </Button>
                  <Button
                    size="sm"
                    className="h-8 bg-success/15 text-success hover:bg-success/25 border border-success/30"
                    onClick={() => markDone(apt.id, apt)}
                  >
                    <Check className="mr-1 h-3.5 w-3.5" /> Đã nhắc
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" /> Cấu hình Tự động nhắc lịch
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-sm">
            <div>
              <Label className="font-semibold">Kênh gửi tin tự động</Label>
              <select
                value="system"
                disabled
                className="input-base mt-1"
              >
                <option value="system">Tự động ghi nhận & Đồng bộ hệ thống (Mặc định)</option>
                <option value="zalo_zns">Zalo ZNS (Zalo Notification Service qua OA)</option>
                <option value="sms">SMS Brandname (eSMS / SpeedSMS / VietGuys)</option>
                <option value="webhook">Webhook tự động (Make.com / n8n / Bot riêng)</option>
              </select>
            </div>

            <div>
              <Label className="font-semibold">Thời điểm gửi tự động</Label>
              <select
                value={settings.hoursAhead}
                onChange={(e) => setSettings({ ...settings, hoursAhead: parseInt(e.target.value, 10) })}
                className="input-base mt-1"
              >
                <option value={2}>Trước 2 tiếng so với giờ hẹn (Khuyên dùng)</option>
                <option value={4}>Trước 4 tiếng so với giờ hẹn</option>
                <option value={12}>Trước 12 tiếng</option>
                <option value={24}>Trước 24 tiếng (Ngày hôm trước)</option>
              </select>
            </div>

            <div>
              <Label className="font-semibold">Tên hiển thị / Brandname</Label>
              <Input
                value="Cấu hình bằng biến môi trường trên server"
                readOnly
                disabled
                className="mt-1"
              />
            </div>

            {false && (
              <div>
                <Label className="font-semibold">Webhook URL</Label>
                <Input
                  value=""
                  readOnly
                  disabled
                  placeholder="https://hook.eu1.make.com/..."
                  className="mt-1 font-mono text-xs"
                />
              </div>
            )}

            {false && (
              <div>
                <Label className="font-semibold">API Key / Access Token</Label>
                <Input
                  type="password"
                  value=""
                  readOnly
                  disabled
                  placeholder="Nhập khóa API của nhà mạng..."
                  className="mt-1 font-mono text-xs"
                />
              </div>
            )}

            <div className="rounded-xl border border-border bg-muted/40 p-3">
              <span className="text-xs font-semibold text-muted-foreground block mb-1">Xem trước tin nhắn tự động:</span>
              <p className="text-xs text-foreground bg-card p-2.5 rounded-lg border border-border/70 leading-relaxed font-sans">
                {SITE.reminderTemplate
                  .replace('{name}', 'Chị Lan')
                  .replace('{service}', 'Massage Body')
                  .replace('{time}', '14:00')
                  .replace('{date}', '25/09')
                  .replace('{code}', 'LF-9824')}
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setSettingsOpen(false)}>Đóng</Button>
            <Button onClick={() => {
              saveSettings(settings);
              toast.success('Đã lưu cấu hình tự động nhắc lịch');
              setSettingsOpen(false);
            }}>
              Lưu cấu hình
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Log Dialog */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5 text-primary" /> Lịch sử nhắc lịch tự động gần đây
            </DialogTitle>
          </DialogHeader>

          {sentLogs.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Chưa có lịch sử nhắc nào.</p>
          ) : (
            <div className="space-y-2 py-2">
              {sentLogs.map((log, idx) => (
                <div key={idx} className="flex items-center justify-between rounded-xl border border-border p-3 text-xs bg-card">
                  <div>
                    <span className="font-semibold text-foreground">{log.customerName}</span>
                    <span className="text-muted-foreground font-mono ml-2">({log.phone})</span>
                    <p className="text-muted-foreground mt-0.5">{log.service} · Lúc {log.time}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-success/15 px-2 py-0.5 font-semibold text-success text-[10px]">
                      {log.channel}
                    </span>
                    <span className="block text-muted-foreground mt-1 text-[11px]">{log.sentAt}</span>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setHistoryOpen(false)}>Đóng</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
