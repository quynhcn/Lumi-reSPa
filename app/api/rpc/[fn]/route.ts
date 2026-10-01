import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { withContext } from '@/lib/server/db';
import { actorOf, clientIp, getSession, rateLimited } from '@/lib/server/auth';
import { RPC_POLICIES } from '@/lib/server/policies';
import { executeRpc } from '@/lib/server/query-engine';
import { json, readJson } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/** Gọi hàm nghiệp vụ trong DB (thay /rest/v1/rpc của Supabase). Danh sách hàm được phép: RPC_POLICIES. */
import { z } from 'zod';

const bookingSchema = z.object({
  p_service_id: z.string().uuid(),
  p_staff_id: z.string().uuid().nullable().optional(),
  p_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  p_time: z.string().regex(/^\d{2}:\d{2}$/),
  p_name: z.string().min(1).max(100),
  p_phone: z.string().min(9).max(15),
  p_email: z.string().email().max(254).nullable().optional(),
  p_notes: z.string().max(500).nullable().optional(),
  p_gift_code: z.string().max(50).nullable().optional(),
  p_holder: z.string().uuid().nullable().optional(),
  p_apply_first_visit: z.boolean().nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ fn: string }> }) {
  const { fn } = await params;
  const args = await readJson<Record<string, unknown>>(req);
  if (args instanceof NextResponse) return args;

  if (fn === 'book_appointment') {
    const parsed = bookingSchema.safeParse(args);
    if (!parsed.success) {
      return json({ data: null, error: { message: parsed.error.issues[0].message, code: 'VALIDATION' }, count: null, status: 400 }, 400);
    }
  }
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
