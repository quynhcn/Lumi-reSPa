import 'server-only';
import { Pool, type PoolClient } from 'pg';

/**
 * Kết nối PostgreSQL (một pool dùng chung cho cả tiến trình Next.js).
 * DATABASE_URL=postgres://user:pass@host:5432/dbname
 * DATABASE_SSL=require            → bật TLS (hầu hết managed DB yêu cầu)
 * DATABASE_SSL_REJECT_UNAUTHORIZED=false → chấp nhận chứng chỉ tự ký (chỉ khi nhà cung cấp dùng CA riêng)
 */
declare global {
  var __spaflowPool: Pool | undefined;
}

export function getPool(): Pool {
  if (!global.__spaflowPool) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error('Missing DATABASE_URL (see .env.example)');
    global.__spaflowPool = new Pool({
      connectionString: url,
      max: Number(process.env.DATABASE_POOL_MAX || 5),
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl:
        process.env.DATABASE_SSL === 'require'
          ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' }
          : undefined,
    });
  }
  return global.__spaflowPool;
}

export interface DbContext {
  /** auth.users.id của người gọi, null = khách chưa đăng nhập */
  userId: string | null;
  /** IP thật của người gọi (đã qua reverse proxy tin cậy), dùng cho rate-limit trong hold_slot */
  ip?: string | null;
}

/**
 * Chạy fn trong 1 transaction, với auth.uid() = ctx.userId.
 * Các hàm nghiệp vụ trong DB (book_appointment, reschedule_appointment, ...) đọc người dùng hiện tại qua auth.uid().
 */
export async function withContext<T>(ctx: DbContext, fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query(
      `SELECT set_config('app.user_id', $1, true),
              set_config('request.headers', $2, true),
              set_config('TimeZone', 'UTC', true)`,
      [ctx.userId ?? '', JSON.stringify({ 'x-forwarded-for': ctx.ip ?? '' })]
    );
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}
