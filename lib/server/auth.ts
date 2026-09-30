import 'server-only';
import crypto from 'node:crypto';
import type { NextRequest, NextResponse } from 'next/server';
import type { PoolClient } from 'pg';
import { getPool, withContext } from '@/lib/server/db';
import type { Actor, AppRole } from '@/lib/server/policies';

export const SESSION_COOKIE = 'sf_session';
const SESSION_DAYS = Number(process.env.SESSION_DAYS || 30);

export interface AuthUser {
  id: string;
  email: string | null;
  phone: string | null;
  user_metadata: Record<string, unknown>;
  created_at: string;
}

const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex');

// ── IP & Origin ──────────────────────────────────────────────────────────
/**
 * IP người dùng. Chỉ tin header do reverse proxy của mình ghi:
 * TRUST_PROXY=1 (mặc định) → lấy phần tử CUỐI của X-Forwarded-For (do proxy gần nhất thêm vào),
 * hoặc X-Real-IP. Không lấy phần tử đầu vì client tự đặt được.
 */
export function clientIp(req: NextRequest): string {
  const hops = Number(process.env.TRUST_PROXY ?? 1);
  if (hops > 0) {
    const xff = (req.headers.get('x-forwarded-for') || '').split(',').map((s) => s.trim()).filter(Boolean);
    if (xff.length >= hops) return xff[xff.length - hops];
    const real = req.headers.get('x-real-ip');
    if (real) return real.trim();
  }
  return req.ip || 'unknown';
}

/** Chặn CSRF: request ghi dữ liệu phải đến từ chính site này. */
export function sameOrigin(req: NextRequest): boolean {
  if (req.method === 'GET' || req.method === 'HEAD') return true;
  const origin = req.headers.get('origin');
  if (!origin) return true; // request server-to-server / curl (cookie SameSite=Lax đã chặn phần lớn tình huống)
  const host = req.headers.get('x-forwarded-host') || req.headers.get('host');
  try {
    const o = new URL(origin);
    const allowed = (process.env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
    return o.host === host || allowed.includes(o.origin);
  } catch {
    return false;
  }
}

// ── Session ──────────────────────────────────────────────────────────────
export async function createSession(client: PoolClient, userId: string, req: NextRequest): Promise<{ token: string; expires: Date }> {
  const token = crypto.randomBytes(32).toString('base64url');
  const expires = new Date(Date.now() + SESSION_DAYS * 86400_000);
  await client.query(
    `INSERT INTO auth.sessions (user_id, token_hash, expires_at, ip, user_agent) VALUES ($1, $2, $3, $4, $5)`,
    [userId, sha256(token), expires, clientIp(req), (req.headers.get('user-agent') || '').slice(0, 300)]
  );
  await client.query(`UPDATE auth.users SET last_sign_in_at = now() WHERE id = $1`, [userId]);
  return { token, expires };
}

export function setSessionCookie(res: NextResponse, token: string, expires: Date) {
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && process.env.COOKIE_INSECURE !== 'true',
    sameSite: 'lax',
    path: '/',
    expires,
  });
}

export function clearSessionCookie(res: NextResponse) {
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
}

export async function destroySession(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) await getPool().query(`DELETE FROM auth.sessions WHERE token_hash = $1`, [sha256(token)]);
}

export interface SessionInfo {
  user: AuthUser;
  role: Exclude<AppRole, 'anon'>;
  staffId: string | null;
}

/** Đọc phiên từ cookie → người dùng + vai trò (bảng profiles). null nếu chưa đăng nhập / hết hạn / bị khoá. */
export async function getSession(req: NextRequest): Promise<SessionInfo | null> {
  return getSessionByToken(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function getSessionByToken(token: string | undefined): Promise<SessionInfo | null> {
  if (!token) return null;
  const { rows } = await getPool().query(
    `UPDATE auth.sessions s SET last_seen_at = now()
       FROM auth.users u
      WHERE s.token_hash = $1 AND s.expires_at > now() AND u.id = s.user_id
        AND (u.banned_until IS NULL OR u.banned_until < now())
     RETURNING u.id, u.email, u.phone, u.raw_user_meta_data, u.created_at,
               (SELECT p.role FROM public.profiles p WHERE p.id = u.id) AS role,
               (SELECT p.staff_id FROM public.profiles p WHERE p.id = u.id) AS staff_id`,
    [sha256(token)]
  );
  const r = rows[0];
  if (!r) return null;
  return {
    user: {
      id: r.id,
      email: r.email,
      phone: r.phone,
      user_metadata: r.raw_user_meta_data || {},
      created_at: new Date(r.created_at).toISOString(),
    },
    role: (r.role as SessionInfo['role']) || 'customer',
    staffId: r.staff_id,
  };
}

export function actorOf(s: SessionInfo | null): Actor {
  if (!s) return { userId: null, role: 'anon', staffId: null };
  return { userId: s.user.id, role: s.role, staffId: s.staffId };
}

/** Trả về payload phiên cho client (giống cấu trúc supabase-js để code cũ dùng tiếp). */
export function sessionPayload(s: SessionInfo | null) {
  if (!s) return { session: null };
  return {
    session: {
      user: {
        ...s.user,
        email: s.user.email ?? undefined,
        phone: s.user.phone ?? undefined,
        app_metadata: { role: s.role, staff_id: s.staffId },
      },
    },
  };
}

// ── Rate limit ───────────────────────────────────────────────────────────
/** true nếu `key` đã vượt `max` lần trong `windowSec` giây; nếu chưa thì ghi nhận thêm 1 lần. */
export async function rateLimited(key: string, max: number, windowSec: number): Promise<boolean> {
  return withContext({ userId: null }, async (c) => {
    await c.query('SELECT pg_advisory_xact_lock(hashtext($1))', [key]);
    const { rows } = await c.query(
      `SELECT count(*)::int AS n FROM auth.rate_events WHERE key = $1 AND created_at > now() - make_interval(secs => $2)`,
      [key, windowSec]
    );
    if (rows[0].n >= max) return true;
    await c.query(`INSERT INTO auth.rate_events (key) VALUES ($1)`, [key]);
    return false;
  });
}

export { sha256 };
