import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { getPool } from '@/lib/server/db';
import { getSession } from '@/lib/server/auth';
import { json, readJson } from '@/lib/server/http';

export const dynamic = 'force-dynamic';

/** Cột admin được phép sửa, kèm kiểm tra giá trị (DB cũng có CHECK tương ứng). */
const FIELDS: Record<string, (v: unknown) => boolean> = {
  first_visit_enabled: (v) => typeof v === 'boolean',
  first_visit_discount_pct: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 50,
  return_visit_enabled: (v) => typeof v === 'boolean',
  return_visit_pct: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 50,
  return_visit_days: (v) => Number.isInteger(v) && (v as number) >= 1 && (v as number) <= 365,
  no_show_threshold: (v) => Number.isInteger(v) && (v as number) >= 0 && (v as number) <= 10,
};

export async function GET() {
  try {
    const { rows } = await getPool().query('SELECT * FROM public.app_settings WHERE id = 1');
    if (!rows[0]) return json({ error: 'Settings not initialised' }, 503);
    return json(rows[0]);
  } catch (e) {
    console.error('[api/settings GET]', e);
    // Không trả giá trị mặc định giả: client sẽ ẩn ưu đãi thay vì hứa sai
    return json({ error: 'Database unavailable' }, 503);
  }
}

export async function POST(req: NextRequest) {
  const body = await readJson<Record<string, unknown>>(req);
  if (body instanceof NextResponse) return body;
  const session = await getSession(req);
  if (session?.role !== 'admin') return json({ error: 'Forbidden' }, 403);

  const entries = Object.entries(body || {}).filter(([k]) => k in FIELDS);
  if (entries.length === 0) return json({ error: 'Nothing to update' }, 400);
  const bad = entries.find(([k, v]) => !FIELDS[k](v));
  if (bad) return json({ error: `Giá trị không hợp lệ: ${bad[0]}` }, 400);

  const sets = entries.map(([k], i) => `"${k}" = $${i + 1}`).join(', ');
  try {
    const { rows } = await getPool().query(
      `UPDATE public.app_settings SET ${sets}, updated_at = now() WHERE id = 1 RETURNING *`,
      entries.map(([, v]) => v)
    );
    if (!rows[0]) return json({ error: 'Chưa khởi tạo cấu hình (chạy npm run db:migrate)' }, 500);
    return json(rows[0]);
  } catch (e) {
    console.error('[api/settings POST]', e);
    return json({ error: 'Không lưu được cài đặt' }, 500);
  }
}
