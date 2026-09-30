import type { NextRequest } from 'next/server';
import { getPool } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/** Dọn phiên/OTP/slot hold hết hạn. Gọi định kỳ (ví dụ mỗi giờ): curl -H "Authorization: Bearer $CRON_SECRET" .../api/cron/cleanup */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get('authorization') !== `Bearer ${secret}`) return json({ error: 'Unauthorized' }, 401);
  await getPool().query('SELECT auth.cleanup()');
  return json({ ok: true });
}
