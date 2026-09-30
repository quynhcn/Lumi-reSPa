import { randomUUID } from 'node:crypto';
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

/** Atomically claims each row before the external SMS call to prevent concurrent sends. */
export async function POST(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const isCron = !!secret && req.headers.get('authorization') === `Bearer ${secret}`;
  if (!isCron) {
    if (!sameOrigin(req)) return json({ success: false, error: 'Forbidden origin' }, 403);
    const session = await getSession(req);
    if (session?.role !== 'admin') return json({ success: false, error: 'Forbidden' }, 403);
  }
  if (!smsEnabled()) {
    return json({ success: false, count: 0, error: 'Chưa cấu hình nhà cung cấp SMS (SMS_PROVIDER).' }, 400);
  }

  const url = new URL(req.url);
  const hours = Math.min(Math.max(Number(url.searchParams.get('hours')) || 24, 1), 48);
  const id = url.searchParams.get('id');
  const claimToken = randomUUID();
  const db = getPool();
  const { rows } = await db.query(
    `WITH picked AS (
       SELECT a.id
         FROM public.appointments a
        WHERE a.status IN ('pending', 'confirmed')
          AND a.reminded_at IS NULL
          AND (a.reminder_claimed_at IS NULL OR a.reminder_claimed_at < now() - interval '10 minutes')
          AND ${id ? 'a.id = $1' : "a.start_time >= now() AND a.start_time < now() + make_interval(hours => $1)"}
        ORDER BY a.start_time
        FOR UPDATE SKIP LOCKED
        LIMIT 200
     ), claimed AS (
       UPDATE public.appointments a
          SET reminder_claimed_at = now(), reminder_claim_token = $2, reminder_attempts = reminder_attempts + 1
         FROM picked p
        WHERE a.id = p.id
        RETURNING a.id, a.start_time, a.booking_code, a.customer_id, a.service_id
     )
     SELECT a.id, a.start_time, a.booking_code, c.name AS customer_name, c.phone, s.name AS service_name
       FROM claimed a
       JOIN public.customers c ON c.id = a.customer_id
       LEFT JOIN public.services s ON s.id = a.service_id
      ORDER BY a.start_time`,
    [id ?? hours, claimToken]
  );

  const sent: unknown[] = [];
  const failed: { id: string; error: string }[] = [];

  const releaseClaim = async (appointmentId: string) => {
    await db.query(
      `UPDATE public.appointments SET reminder_claimed_at = NULL, reminder_claim_token = NULL
        WHERE id = $1 AND reminder_claim_token = $2`,
      [appointmentId, claimToken]
    ).catch(() => {});
  };

  for (const row of rows) {
    const digits = String(row.phone || '').replace(/\D/g, '');
    if (digits.length < 10) {
      await releaseClaim(row.id);
      failed.push({ id: row.id, error: 'SĐT không hợp lệ' });
      continue;
    }
    const start = new Date(row.start_time).toISOString();
    const message = reminderText(row.customer_name, row.service_name, start, row.booking_code);
    try {
      await sendSms(row.phone, message);
      await db.query(
        `UPDATE public.appointments
            SET reminded_at = now(), reminder_claimed_at = NULL, reminder_claim_token = NULL
          WHERE id = $1 AND reminder_claim_token = $2`,
        [row.id, claimToken]
      );
      sent.push({ id: row.id, booking_code: row.booking_code, customer_name: row.customer_name, phone: row.phone, service: row.service_name, start_time: start, message });
    } catch (error) {
      await releaseClaim(row.id);
      failed.push({ id: row.id, error: error instanceof Error ? error.message : 'send failed' });
    }
  }
  return json({ success: failed.length === 0, count: sent.length, failed, reminded: sent, timestamp: new Date().toISOString() });
}
