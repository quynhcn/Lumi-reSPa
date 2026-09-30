import type { NextRequest } from 'next/server';
import { getPool } from '@/lib/server/db';
import { getSession, sameOrigin } from '@/lib/server/auth';
import { json } from '@/lib/server/http';
import { sendSms, smsEnabled } from '@/lib/server/sms';
import { SITE } from '@/lib/site-config';

export const dynamic = 'force-dynamic';
const TZ = 'Asia/Ho_Chi_Minh';

function reminderText(name: string, service: string, startIso: string, code: string): string {
  const d = new Date(startIso);
  return SITE.reminderTemplate
    .replace('{name}', name?.trim().split(/\s+/).pop() || 'quý khách')
    .replace('{service}', service || 'dịch vụ')
    .replace('{time}', d.toLocaleTimeString('vi-VN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' }))
    .replace('{date}', d.toLocaleDateString('vi-VN', { timeZone: TZ, day: '2-digit', month: '2-digit' }))
    .replace('{code}', code);
}

/**
 * Gửi SMS nhắc lịch cho các lịch pending/confirmed chưa nhắc, bắt đầu trong `hours` giờ tới (mặc định 24, tối đa 48).
 * Quyền: admin đang đăng nhập (nút trên dashboard) hoặc cron với header Authorization: Bearer $CRON_SECRET.
 * Chỉ đánh dấu reminded_at khi SMS gửi thành công.
 */
async function run(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const isCron = !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
  if (!isCron) {
    if (!sameOrigin(req)) return json({ success: false, error: 'Forbidden origin' }, 403);
    const s = await getSession(req);
    if (s?.role !== 'admin') return json({ success: false, error: 'Forbidden' }, 403);
  }
  if (!smsEnabled()) {
    return json({ success: false, count: 0, error: 'Chưa cấu hình nhà cung cấp SMS (SMS_PROVIDER). Hãy nhắc thủ công qua Zalo.' }, 400);
  }

  const url = new URL(req.url);
  const hours = Math.min(Math.max(Number(url.searchParams.get('hours')) || 24, 1), 48);
  const id = url.searchParams.get('id');

  const db = getPool();
  const { rows } = await db.query(
    `SELECT a.id, a.start_time, a.booking_code, c.name AS customer_name, c.phone, s.name AS service_name
       FROM public.appointments a
       JOIN public.customers c ON c.id = a.customer_id
       LEFT JOIN public.services s ON s.id = a.service_id
      WHERE a.status IN ('pending', 'confirmed') AND a.reminded_at IS NULL
        AND ${id ? 'a.id = $1' : "a.start_time >= now() AND a.start_time < now() + make_interval(hours => $1)"}
      ORDER BY a.start_time
      LIMIT 200`,
    [id ?? hours]
  );

  const sent: unknown[] = [];
  const failed: { id: string; error: string }[] = [];
  for (const r of rows) {
    const digits = String(r.phone || '').replace(/\D/g, '');
    if (digits.length < 10) {
      failed.push({ id: r.id, error: 'SĐT không hợp lệ' });
      continue;
    }
    const start = new Date(r.start_time).toISOString();
    const message = reminderText(r.customer_name, r.service_name, start, r.booking_code);
    try {
      await sendSms(r.phone, message);
      // Chỉ đánh dấu khi chưa ai đánh dấu trong lúc gửi (tránh gửi trùng khi 2 lần chạy chồng nhau)
      await db.query(`UPDATE public.appointments SET reminded_at = now() WHERE id = $1 AND reminded_at IS NULL`, [r.id]);
      sent.push({ id: r.id, booking_code: r.booking_code, customer_name: r.customer_name, phone: r.phone, service: r.service_name, start_time: start, message });
    } catch (e) {
      failed.push({ id: r.id, error: e instanceof Error ? e.message : 'send failed' });
    }
  }
  return json({ success: failed.length === 0, count: sent.length, failed, reminded: sent, timestamp: new Date().toISOString() });
}

export const GET = run;
export const POST = run;
