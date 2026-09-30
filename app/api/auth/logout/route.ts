import type { NextRequest } from 'next/server';
import { clearSessionCookie, destroySession, sameOrigin } from '@/lib/server/auth';
import { json } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return json({ error: { message: 'Forbidden origin' } }, 403);
  await destroySession(req).catch((e) => console.error('[auth/logout]', e));
  const res = json({ ok: true });
  clearSessionCookie(res);
  return res;
}
