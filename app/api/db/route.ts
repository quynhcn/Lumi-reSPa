import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import type { QuerySpec } from '@/lib/db-builder';
import { withContext } from '@/lib/server/db';
import { actorOf, clientIp, getSession, rateLimited } from '@/lib/server/auth';
import { executeQuery } from '@/lib/server/query-engine';
import { json, readJson } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/** Cổng truy vấn dữ liệu cho trình duyệt (thay /rest/v1 của Supabase). Quyền: lib/server/policies.ts */
export async function POST(req: NextRequest) {
  const spec = await readJson<QuerySpec>(req);
  if (spec instanceof NextResponse) return spec;
  const ip = clientIp(req);
  if (await rateLimited(`db:ip:${ip}`, 300, 60)) {
    return json({ data: null, error: { message: 'Too many requests', code: '429' }, count: null, status: 429 }, 429);
  }
  try {
    const session = await getSession(req);
    const actor = actorOf(session);
    const result = await withContext({ userId: actor.userId, ip: clientIp(req) }, (c) => executeQuery(c, actor, spec));
    return json(result, result.error ? result.status : 200);
  } catch (e) {
    console.error('[api/db]', e);
    return json({ data: null, error: { message: 'Internal error', code: 'SF500' }, count: null, status: 500 }, 500);
  }
}
