#!/usr/bin/env node
/**
 * Chuyển DỮ LIỆU từ Supabase sang PostgreSQL mới (schema đã tạo bằng `npm run db:migrate`).
 *
 *   SUPABASE_DB_URL=postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres \
 *   DATABASE_URL=postgres://user:pass@host:5432/spaflow \
 *   node scripts/import-from-supabase.mjs [--dry-run] [--force]
 *
 *   --dry-run  chỉ kiểm tra kết nối, cấu trúc, số dòng; không ghi gì
 *   --force    xoá dữ liệu đang có ở DB đích trước khi chép (mặc định: dừng nếu DB đích đã có dữ liệu)
 *
 * Chép: auth.users (giữ id + mật khẩu bcrypt → khách đăng nhập bằng mật khẩu cũ) và toàn bộ bảng public.
 * KHÔNG chép: phiên đăng nhập (mọi người đăng nhập lại 1 lần), slot_holds (giữ chỗ 10 phút, tạm thời).
 * Toàn bộ chạy trong 1 transaction ở DB đích: lỗi giữa chừng → không ghi gì.
 * Sau khi chép: so số dòng và checksum từng bảng giữa 2 DB.
 */
import pg from 'pg';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const FORCE = args.has('--force');
const SRC_URL = process.env.SUPABASE_DB_URL;
const DST_URL = process.env.DATABASE_URL;
if (!SRC_URL || !DST_URL) {
  console.error('Cần SUPABASE_DB_URL (nguồn) và DATABASE_URL (đích)');
  process.exit(1);
}

const ssl = (url, envFlag) =>
  process.env[envFlag] === 'require' || /supabase\.(co|com)/.test(url) ? { rejectUnauthorized: false } : undefined;

// Thứ tự theo khoá ngoại. gift_cards ↔ appointments tham chiếu vòng → source_appointment_id cập nhật sau.
const TABLES = [
  'services', 'staff', 'profiles', 'customers', 'staff_services', 'staff_schedules', 'staff_time_off',
  'service_packages', 'app_settings', 'gift_cards', 'appointments', 'appointment_logs', 'reviews',
  'review_requests', 'leads',
];
const DEFERRED = { gift_cards: ['source_appointment_id'] };
const BATCH = 2000;

const src = new pg.Client({ connectionString: SRC_URL, ssl: ssl(SRC_URL, 'SUPABASE_DB_SSL') });
const dst = new pg.Client({ connectionString: DST_URL, ssl: ssl(DST_URL, 'DATABASE_SSL') });

const log = (...a) => console.log(...a);
const q = (id) => `"${id.replace(/"/g, '""')}"`;

async function columns(client, schema, table) {
  const { rows } = await client.query(
    `SELECT column_name FROM information_schema.columns
      WHERE table_schema = $1 AND table_name = $2 AND is_generated = 'NEVER' ORDER BY ordinal_position`,
    [schema, table]
  );
  return rows.map((r) => r.column_name);
}

async function pkColumns(client, schema, table) {
  const { rows } = await client.query(
    `SELECT a.attname FROM pg_index i
       JOIN pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = ANY(i.indkey)
      WHERE i.indrelid = format('%I.%I', $1::text, $2::text)::regclass AND i.indisprimary`,
    [schema, table]
  );
  return rows.map((r) => r.attname);
}

async function copyTable(table, cols, pk, transform) {
  const colList = cols.map(q).join(', ');
  const order = pk.map(q).join(', ');
  let offset = 0;
  let total = 0;
  for (;;) {
    // Lấy dạng JSON do Postgres tạo (giữ nguyên micro-giây của timestamptz, không qua kiểu Date của JS)
    const { rows } = await src.query(
      `SELECT count(*)::int AS n, coalesce(jsonb_agg(to_jsonb(t)), '[]'::jsonb)::text AS j
         FROM (SELECT ${colList} FROM public.${q(table)} ORDER BY ${order} LIMIT ${BATCH} OFFSET ${offset}) t`
    );
    const n = rows[0].n;
    if (n === 0) break;
    const json = transform ? JSON.stringify(JSON.parse(rows[0].j).map(transform)) : rows[0].j;
    await dst.query(
      `INSERT INTO public.${q(table)} (${colList})
       SELECT ${colList} FROM jsonb_populate_recordset(NULL::public.${q(table)}, $1::jsonb)`,
      [json]
    );
    total += n;
    offset += BATCH;
  }
  return total;
}

async function checksum(client, schema, table, cols, pk) {
  const { rows } = await client.query(
    `SELECT count(*)::int AS n,
            coalesce(md5(string_agg(md5(row(${cols.map((c) => 't.' + q(c)).join(', ')})::text), '' ORDER BY ${pk.map((c) => 't.' + q(c)).join(', ')})), '-') AS sum
       FROM ${schema}.${q(table)} t`
  );
  return rows[0];
}

const AUTH_COLS = [
  'id', 'email', 'phone', 'encrypted_password', 'email_confirmed_at', 'phone_confirmed_at',
  'raw_user_meta_data', 'banned_until', 'last_sign_in_at', 'created_at', 'updated_at',
];

async function main() {
  await src.connect();
  await dst.connect();
  for (const c of [src, dst]) await c.query(`SET TimeZone = 'UTC'; SET DateStyle = 'ISO, YMD'; SET extra_float_digits = 3`);

  // ── 1. Kiểm tra trước ────────────────────────────────────────────────
  log('1) Kiểm tra cấu trúc');
  const { rows: mig } = await dst.query(`SELECT count(*)::int AS n FROM public.schema_migrations`).catch(() => ({ rows: [{ n: 0 }] }));
  if (!mig[0].n) throw new Error('DB đích chưa có schema. Chạy `npm run db:migrate` trước.');

  const plan = [];
  let drift = false;
  for (const t of TABLES) {
    const sCols = await columns(src, 'public', t);
    const dCols = await columns(dst, 'public', t);
    if (sCols.length === 0) {
      log(`   - ${t}: không có ở nguồn, bỏ qua`);
      continue;
    }
    const missing = sCols.filter((c) => !dCols.includes(c));
    if (missing.length) {
      drift = true;
      log(`   ✗ ${t}: cột có ở Supabase nhưng thiếu ở DB mới: ${missing.join(', ')}`);
    }
    const cols = sCols.filter((c) => dCols.includes(c));
    const pk = await pkColumns(dst, 'public', t);
    const { rows } = await src.query(`SELECT count(*)::int AS n FROM public.${q(t)}`);
    plan.push({ table: t, cols, pk, count: rows[0].n });
  }
  const { rows: users } = await src.query(`SELECT count(*)::int AS n FROM auth.users`);
  const { rows: anon } = await src.query(`SELECT count(*)::int AS n FROM auth.users WHERE coalesce(email, '') = '' AND coalesce(phone, '') = ''`);
  log(`   auth.users: ${users[0].n} tài khoản (${anon[0].n} tài khoản ẩn danh không email/SĐT sẽ bị bỏ qua)`);
  plan.forEach((p) => log(`   ${p.table}: ${p.count} dòng`));
  if (drift) throw new Error('Cấu trúc 2 DB khác nhau (xem ✗ ở trên). Thêm migration cho các cột thiếu rồi chạy lại.');

  const { rows: existing } = await dst.query(
    `SELECT (SELECT count(*) FROM auth.users) + (SELECT count(*) FROM public.services) + (SELECT count(*) FROM public.appointments) AS n`
  );
  if (Number(existing[0].n) > 0 && !FORCE) throw new Error('DB đích đã có dữ liệu. Dùng --force để xoá và chép lại.');
  if (DRY) {
    log('\n--dry-run: không ghi dữ liệu.');
    return;
  }

  // ── 2. Chép dữ liệu (1 transaction) ─────────────────────────────────
  log('\n2) Chép dữ liệu');
  await dst.query('BEGIN');
  try {
    if (FORCE) {
      await dst.query(`TRUNCATE ${TABLES.map((t) => 'public.' + q(t)).join(', ')}, public.slot_holds, auth.sessions, auth.otp_codes, auth.rate_events, auth.users CASCADE`);
    }
    // Không để trigger tự tạo profile/customer khi chép auth.users (dữ liệu đó được chép riêng)
    await dst.query('ALTER TABLE auth.users DISABLE TRIGGER on_auth_user_created');

    const { rows: au } = await src.query(
      `SELECT count(*)::int AS n, coalesce(jsonb_agg(to_jsonb(u) ORDER BY u.created_at), '[]'::jsonb)::text AS j FROM (
         SELECT id, lower(nullif(trim(email), '')) AS email, nullif(trim(phone), '') AS phone,
                nullif(encrypted_password, '') AS encrypted_password, email_confirmed_at, phone_confirmed_at,
                coalesce(raw_user_meta_data, '{}'::jsonb) AS raw_user_meta_data, banned_until, last_sign_in_at,
                coalesce(created_at, now()) AS created_at, coalesce(updated_at, now()) AS updated_at
           FROM auth.users
          WHERE coalesce(email, '') <> '' OR coalesce(phone, '') <> '') u`
    );
    await dst.query(
      `INSERT INTO auth.users (${AUTH_COLS.join(', ')})
       SELECT ${AUTH_COLS.join(', ')} FROM jsonb_populate_recordset(NULL::auth.users, $1::jsonb)`,
      [au[0].j]
    );
    log(`   auth.users: ${au[0].n}`);

    for (const p of plan) {
      if (p.table === 'app_settings') {
        await dst.query('DELETE FROM public.app_settings'); // dòng mặc định do migration tạo
      }
      const deferred = DEFERRED[p.table] || [];
      const n = await copyTable(p.table, p.cols, p.pk, deferred.length
        ? (r) => { const c = { ...r }; deferred.forEach((k) => { c[k] = null; }); return c; }
        : undefined);
      log(`   ${p.table}: ${n}`);
    }
    // Hoàn tất tham chiếu vòng gift_cards.source_appointment_id
    const { rows: links } = await src.query(`SELECT id, source_appointment_id FROM public.gift_cards WHERE source_appointment_id IS NOT NULL`);
    if (links.length) {
      await dst.query(
        `UPDATE public.gift_cards g SET source_appointment_id = x.source_appointment_id
           FROM jsonb_to_recordset($1::jsonb) AS x(id uuid, source_appointment_id uuid) WHERE g.id = x.id`,
        [JSON.stringify(links)]
      );
    }
    await dst.query('ALTER TABLE auth.users ENABLE TRIGGER on_auth_user_created');
    await dst.query('COMMIT');
  } catch (e) {
    await dst.query('ROLLBACK');
    throw e;
  }

  // ── 3. Đối chiếu ────────────────────────────────────────────────────
  log('\n3) Đối chiếu số dòng + checksum');
  let ok = true;
  const authCols = ['id', 'email', 'phone', 'encrypted_password'];
  const sa = await src.query(
    `SELECT count(*)::int AS n, md5(string_agg(md5(row(id, lower(nullif(trim(email), '')), nullif(trim(phone), ''), nullif(encrypted_password, ''))::text), '' ORDER BY id)) AS sum
       FROM auth.users WHERE coalesce(email, '') <> '' OR coalesce(phone, '') <> ''`
  );
  const da = await checksum(dst, 'auth', 'users', authCols, ['id']);
  const authOk = sa.rows[0].n === da.n && sa.rows[0].sum === da.sum;
  ok &&= authOk;
  log(`   ${authOk ? '✓' : '✗'} auth.users ${da.n}/${sa.rows[0].n}`);
  for (const p of plan) {
    const a = await checksum(src, 'public', p.table, p.cols, p.pk);
    const b = await checksum(dst, 'public', p.table, p.cols, p.pk);
    const same = a.n === b.n && a.sum === b.sum;
    ok &&= same;
    log(`   ${same ? '✓' : '✗'} ${p.table} ${b.n}/${a.n}`);
  }
  if (!ok) {
    process.exitCode = 2;
    log('\n✗ Có bảng không khớp. KHÔNG chuyển DNS sang hệ thống mới; kiểm tra lại rồi chạy với --force.');
  } else {
    log('\n✓ Dữ liệu khớp hoàn toàn.');
  }
}

main()
  .catch((e) => {
    console.error('\n✗ ' + e.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await src.end().catch(() => {});
    await dst.end().catch(() => {});
  });
