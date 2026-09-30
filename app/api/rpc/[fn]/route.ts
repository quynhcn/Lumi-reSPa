import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withContext } from '@/lib/server/db';
import { actorOf, clientIp, getSession, rateLimited } from '@/lib/server/auth';
import { RPC_POLICIES } from '@/lib/server/policies';
import { executeRpc } from '@/lib/server/query-engine';
import { json, readJson } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/** Gọi hàm nghiệp vụ trong DB (thay /rest/v1/rpc của Supabase). Danh sách hàm được phép: RPC_POLICIES. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ fn: string }> }) {
  const { fn } = await params;
  const args = await readJson<Record<string, unknown>>(req);
  if (args instanceof NextResponse) return args;
  try {
    const limit = RPC_POLICIES[fn]?.rateLimit;
    if (limit && (await rateLimited(`rpc:${fn}:${clientIp(req)}`, limit.max, limit.windowSec))) {
      return json({ data: null, error: { message: 'RATE_LIMITED', code: 'P0001' }, count: null, status: 429 }, 429);
    }
    const session = await getSession(req);
    const actor = actorOf(session);
    const result = await withContext({ userId: actor.userId, ip: clientIp(req) }, (c) => executeRpc(c, actor, fn, args || {}));
    return json(result, result.error ? result.status : 200);
  } catch (e) {
    console.error('[api/rpc]', e);
    return json({ data: null, error: { message: 'Internal error', code: 'SF500' }, count: null, status: 500 }, 500);
  }
}
