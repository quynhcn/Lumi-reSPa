import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { withContext } from '@/lib/server/db';
import { createSession, getSessionByToken, sessionPayload, setSessionCookie } from '@/lib/server/auth';
import { json, readJson } from '@/lib/server/http';
import { normalizeVnPhone } from '@/lib/server/phone';
import { otpHash } from '@/lib/server/otp';

export const dynamic = 'force-dynamic';
const MAX_ATTEMPTS = 5;
const INVALID = { error: { message: 'Token has expired or is invalid', code: 'otp_expired' } };

export async function POST(req: NextRequest) {
  const body = await readJson<{ phone?: string; token?: string; name?: string }>(req);
  if (body instanceof NextResponse) return body;
  const phone = normalizeVnPhone(body.phone);
  const code = String(body.token || '').trim();
  if (!phone) return json({ error: { message: 'Invalid phone number' } }, 400);
  if (!/^\d{6}$/.test(code)) return json(INVALID, 400);
  const name = String(body.name || '').trim().slice(0, 100);

  const result = await withContext({ userId: null }, async (c) => {
    const { rows } = await c.query(
      `SELECT id, code_hash, attempts FROM auth.otp_codes
        WHERE phone = $1 AND consumed_at IS NULL AND expires_at > now()
        ORDER BY created_at DESC LIMIT 1 FOR UPDATE`,
      [phone]
    );
    const otp = rows[0];
    if (!otp || otp.attempts >= MAX_ATTEMPTS) return null;
    const a = Buffer.from(otp.code_hash);
    const b = Buffer.from(otpHash(phone, code));
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      await c.query(`UPDATE auth.otp_codes SET attempts = attempts + 1 WHERE id = $1`, [otp.id]);
      return null;
    }
    await c.query(`UPDATE auth.otp_codes SET consumed_at = now() WHERE id = $1`, [otp.id]);

    // Tìm hoặc tạo tài khoản theo SĐT đã xác minh.
    // Tạo mới → trigger handle_new_user tạo profile và nhận lại hồ sơ khách walk-in cùng SĐT (lịch sử do lễ tân đặt hộ).
    let { rows: users } = await c.query(`SELECT id, banned_until FROM auth.users WHERE phone = $1`, [phone]);
    if (!users[0]) {
      ({ rows: users } = await c.query(
        `INSERT INTO auth.users (phone, phone_confirmed_at, raw_user_meta_data) VALUES ($1, now(), $2::jsonb) RETURNING id, banned_until`,
        [phone, JSON.stringify(name ? { name } : {})]
      ));
    } else {
      await c.query(`UPDATE auth.users SET phone_confirmed_at = coalesce(phone_confirmed_at, now()) WHERE id = $1`, [users[0].id]);
    }
    if (users[0].banned_until && new Date(users[0].banned_until) > new Date()) return 'banned' as const;
    return createSession(c, users[0].id, req);
  });

  if (result === null) return json(INVALID, 400);
  if (result === 'banned') return json({ error: { message: 'User is banned' } }, 403);
  const payload = sessionPayload(await getSessionByToken(result.token));
  const res = json({ ...payload, user: payload.session?.user ?? null });
  setSessionCookie(res, result.token, result.expires);
  return res;
}
