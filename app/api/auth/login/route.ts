import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import { getPool, withContext } from '@/lib/server/db';
import { clientIp, createSession, getSessionByToken, rateLimited, sessionPayload, setSessionCookie } from '@/lib/server/auth';
import { json, readJson } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
// Hash giả để thời gian phản hồi như nhau dù email có tồn tại hay không
const DUMMY_HASH = bcrypt.hashSync('spaflow-dummy-password', 10);

export async function POST(req: NextRequest) {
  const body = await readJson<{ email?: string; password?: string }>(req);
  if (body instanceof NextResponse) return body;
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const ip = clientIp(req);

  if ((await rateLimited(`login:ip:${ip}`, 30, 900)) || (await rateLimited(`login:email:${email}`, 10, 900))) {
    return json({ error: { message: 'Too many login attempts, rate limit exceeded' } }, 429);
  }

  const { rows } = await getPool().query(
    `SELECT id, encrypted_password, email_confirmed_at, banned_until FROM auth.users WHERE email = $1`,
    [email]
  );
  const u = rows[0];
  const ok = await bcrypt.compare(password, u?.encrypted_password || DUMMY_HASH);
  if (!u || !u.encrypted_password || !ok) return json({ error: { message: 'Invalid login credentials' } }, 400);
  if (u.banned_until && new Date(u.banned_until) > new Date()) return json({ error: { message: 'User is banned' } }, 403);
  if (process.env.REQUIRE_EMAIL_CONFIRMATION === 'true' && !u.email_confirmed_at) {
    return json({ error: { message: 'Email not confirmed' } }, 400);
  }

  const s = await withContext({ userId: null }, (c) => createSession(c, u.id, req));
  const payload = sessionPayload(await getSessionByToken(s.token));
  const res = json({ ...payload, user: payload.session?.user ?? null });
  setSessionCookie(res, s.token, s.expires);
  return res;
}
