import 'server-only';
import { createDbClient, type DbResult } from '@/lib/db-builder';
import { withContext } from '@/lib/server/db';
import { executeQuery, executeRpc } from '@/lib/server/query-engine';
import type { Actor } from '@/lib/server/policies';

const failed = (e: unknown): DbResult => {
  console.error('[server-db]', e);
  return { data: null, error: { message: 'Database unavailable', code: 'SF503' }, count: null, status: 503 };
};

/**
 * Client dữ liệu dùng trong Server Component / route handler, cùng cú pháp from().select()...
 * Mặc định chạy với quyền khách vãng lai (anon) → chỉ đọc được dữ liệu công khai.
 */
export function createServerDb(actor: Actor = { userId: null, role: 'anon', staffId: null }) {
  return createDbClient({
    query: (spec) => withContext({ userId: actor.userId }, (c) => executeQuery(c, actor, spec)).catch(failed),
    rpc: (fn, args) => withContext({ userId: actor.userId }, (c) => executeRpc(c, actor, fn, args)).catch(failed),
  });
}
