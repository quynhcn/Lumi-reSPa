import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getPool } from '@/lib/server/db';
import { clientIp, rateLimited } from '@/lib/server/auth';
import { otpHash } from '@/lib/server/otp';
import { json, readJson } from '@/lib/server/http';
import { normalizeVnPhone } from '@/lib/server/phone';
import { sendSms, smsEnabled, SmsDisabledError } from '@/lib/server/sms';

export const dynamic = 'force-dynamic';
const OTP_TTL_SEC = 300;
const RESEND_SEC = 60;

/** Số thử nghiệm không gửi SMS: SMS_TEST_OTP="84901234567:123456,84900000000:000000" (để trống trên production) */
function testCode(phone: string): string | null {
  for (const pair of (process.env.SMS_TEST_OTP || '').split(',')) {
    const [p, c] = pair.split(':').map((x) => x?.trim());
    if (p && c && p === phone) return c;
  }
  return null;
}

export async function POST(req: NextRequest) {
  const body = await readJson<{ phone?: string }>(req);
  if (body instanceof NextResponse) return body;
  const phone = normalizeVnPhone(body.phone);
  if (!phone) return json({ error: { message: 'Invalid phone number' } }, 400);

  const fixed = testCode(phone);
  if (!fixed && !smsEnabled()) return json({ error: { message: 'SMS provider disabled', code: 'sms_disabled' } }, 400);

  const db = getPool();
  const { rows } = await db.query(
    `SELECT created_at FROM auth.otp_codes WHERE phone = $1 ORDER BY created_at DESC LIMIT 1`,
    [phone]
  );
  if (rows[0] && Date.now() - new Date(rows[0].created_at).getTime() < RESEND_SEC * 1000) {
    return json({ error: { message: `For security purposes, you can only request this after ${RESEND_SEC} seconds` } }, 429);
  }
  const ip = clientIp(req);
  if ((await rateLimited(`otp:phone:${phone}`, 5, 3600)) || (await rateLimited(`otp:ip:${ip}`, 10, 3600))) {
    return json({ error: { message: 'Too many requests, rate limit exceeded' } }, 429);
  }

  const code = fixed ?? String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
  await db.query(`UPDATE auth.otp_codes SET consumed_at = now() WHERE phone = $1 AND consumed_at IS NULL`, [phone]);
  await db.query(
    `INSERT INTO auth.otp_codes (phone, code_hash, expires_at, ip) VALUES ($1, $2, now() + make_interval(secs => $3), $4)`,
    [phone, otpHash(phone, code), OTP_TTL_SEC, ip]
  );
  if (!fixed) {
    try {
      await sendSms(phone, `Ma xac minh Lumiere Spa cua ban la ${code}. Ma het han sau 5 phut. Khong chia se ma nay cho bat ky ai.`);
    } catch (e) {
      if (e instanceof SmsDisabledError) return json({ error: { message: 'SMS provider disabled', code: 'sms_disabled' } }, 400);
      console.error('[otp/send]', e);
      return json({ error: { message: 'Error sending SMS' } }, 502);
    }
  }
  return json({ ok: true });
}
