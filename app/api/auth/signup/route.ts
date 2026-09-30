import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withContext } from '@/lib/server/db';
import { clientIp, createSession, rateLimited, sessionPayload, setSessionCookie, getSessionByToken } from '@/lib/server/auth';
import { json, readJson } from '@/lib/server/http';
import { normalizeVnPhone } from '@/lib/server/phone';

export const dynamic = 'force-dynamic';
const MIN_PASSWORD = 8;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Body = { email?: string; password?: string; data?: { name?: string; phone?: string } };

export async function POST(req: NextRequest) {
  const body = await readJson<Body>(req);
  if (body instanceof NextResponse) return body;
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const name = String(body.data?.name || '').trim().slice(0, 100);
  const phoneRaw = String(body.data?.phone || '').trim();

  if (!EMAIL.test(email) || email.length > 254) return json({ error: { message: 'Invalid email' } }, 400);
  if (password.length < MIN_PASSWORD || password.length > 72) return json({ error: { message: 'Password should be at least 8 characters' } }, 400);
  if (phoneRaw && !normalizeVnPhone(phoneRaw)) return json({ error: { message: 'Invalid phone number' } }, 400);
  if (await rateLimited(`signup:ip:${clientIp(req)}`, 10, 3600)) {
    return json({ error: { message: 'Too many requests, rate limit exceeded' } }, 429);
  }

  const hash = await bcrypt.hash(password, 10);
  const requiresConfirmation = process.env.REQUIRE_EMAIL_CONFIRMATION === 'true';
  try {
    const out = await withContext({ userId: null }, async (c) => {
      const { rows } = await c.query(
        `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
         VALUES ($1, $2, CASE WHEN $3::boolean THEN NULL ELSE now() END, $4::jsonb) RETURNING id`,
        [email, hash, requiresConfirmation, JSON.stringify({ name, phone: phoneRaw })]
      );
      if (requiresConfirmation) return null;
      return createSession(c, rows[0].id, req);
    });
    if (!out) return json({ session: null, user: null, confirmation_required: true }, 202);
    const payload = sessionPayload(await getSessionByToken(out.token));
    const res = json({ ...payload, user: payload.session?.user ?? null });
    setSessionCookie(res, out.token, out.expires);
    return res;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return json({ error: { message: 'User already registered' } }, 400);
    console.error('[auth/signup]', e);
    return json({ error: { message: 'Không thể đăng ký' } }, 500);
  }
}
