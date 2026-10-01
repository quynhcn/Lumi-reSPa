import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { withContext } from '@/lib/server/db';
import { clientIp, createSession, rateLimited, sessionPayload, setSessionCookie, getSessionByToken } from '@/lib/server/auth';
import { json, readJson } from '@/lib/server/http';
import { normalizeVnPhone } from '@/lib/server/phone';

export const dynamic = 'force-dynamic';
import { z } from 'zod';

const signupSchema = z.object({
  email: z.string().email('Invalid email').max(254),
  password: z.string().min(8, 'Password should be at least 8 characters').max(72),
  data: z.object({
    name: z.string().max(100).optional(),
    phone: z.string().optional(),
  }).optional(),
});

export async function POST(req: NextRequest) {
  const body = await readJson(req);
  if (body instanceof NextResponse) return body;
  
  const parsed = signupSchema.safeParse(body);
  if (!parsed.success) {
    return json({ error: { message: parsed.error.issues[0].message } }, 400);
  }

  const email = parsed.data.email.toLowerCase();
  const password = parsed.data.password;
  const name = parsed.data.data?.name?.trim() || '';
  const phoneRaw = parsed.data.data?.phone?.trim() || '';

  if (phoneRaw && !normalizeVnPhone(phoneRaw)) return json({ error: { message: 'Invalid phone number' } }, 400);
  if (await rateLimited(`signup:ip:${clientIp(req)}`, 10, 3600)) {
    return json({ error: { message: 'Too many requests, rate limit exceeded' } }, 429);
  }

  const hash = await bcrypt.hash(password, 10);
  try {
    const out = await withContext({ userId: null }, async (c) => {
      const { rows } = await c.query(
        `INSERT INTO auth.users (email, encrypted_password, email_confirmed_at, raw_user_meta_data)
         VALUES ($1, $2, now(), $3::jsonb) RETURNING id`,
        [email, hash, JSON.stringify({ name, phone: phoneRaw })]
      );
      return createSession(c, rows[0].id, req);
    });
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
