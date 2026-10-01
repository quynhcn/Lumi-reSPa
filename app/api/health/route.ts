import { getPool } from '@/lib/server/db';
import { json } from '@/lib/server/http';

export const dynamic = 'force-dynamic';
const REQUIRED_MIGRATION = '0011_assign_active_staff_to_catalog.sql';

export async function GET() {
  try {
    const { rows } = await getPool().query(
      `SELECT EXISTS (
         SELECT 1 FROM public.schema_migrations WHERE name = $1
       ) AS migration_ready`,
      [REQUIRED_MIGRATION]
    );
    if (!rows[0]?.migration_ready) {
      return json({ status: 'not_ready', database: 'connected', migrations: 'pending' }, 503);
    }
    return json({ status: 'ok', database: 'connected', migrations: 'current' });
  } catch (error) {
    console.error('[health]', error);
    return json({ status: 'not_ready', database: 'unavailable' }, 503);
  }
}
