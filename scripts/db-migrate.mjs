#!/usr/bin/env node
/**
 * Chạy các file db/migrations/*.sql chưa áp dụng (theo thứ tự tên), mỗi file trong 1 transaction.
 *   DATABASE_URL=postgres://... node scripts/db-migrate.mjs            # áp dụng
 *   DATABASE_URL=postgres://... node scripts/db-migrate.mjs --status   # chỉ xem trạng thái
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import pg from 'pg';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('Thiếu DATABASE_URL');
  process.exit(1);
}
import { fileURLToPath } from 'node:url';
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../db/migrations');
const files = fs.readdirSync(dir).filter((f) => /^\d{4}_.*\.sql$/.test(f)).sort();
const statusOnly = process.argv.includes('--status');

const ssl = process.env.DATABASE_SSL === 'require' ? { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== 'false' } : undefined;
const client = new pg.Client({ connectionString: url, ssl });
await client.connect();
try {
  await client.query(`CREATE TABLE IF NOT EXISTS public.schema_migrations (
    name text PRIMARY KEY, checksum text NOT NULL, applied_at timestamptz NOT NULL DEFAULT now())`);
  await client.query('SELECT pg_advisory_lock(72617261)');
  const { rows } = await client.query('SELECT name, checksum FROM public.schema_migrations');
  const applied = new Map(rows.map((r) => [r.name, r.checksum]));

  for (const f of files) {
    const sql = fs.readFileSync(path.join(dir, f), 'utf8');
    const sum = crypto.createHash('sha256').update(sql).digest('hex').slice(0, 16);
    if (applied.has(f)) {
      if (applied.get(f) !== sum) console.warn(`! ${f} đã áp dụng nhưng nội dung file đã bị sửa (checksum khác). Hãy tạo migration mới thay vì sửa file cũ.`);
      else console.log(`✓ ${f}`);
      continue;
    }
    if (statusOnly) {
      console.log(`… ${f} (chưa áp dụng)`);
      continue;
    }
    process.stdout.write(`→ ${f} ... `);
    try {
      await client.query('BEGIN');
      await client.query(sql);
      await client.query('SET search_path TO DEFAULT');
      await client.query('INSERT INTO public.schema_migrations (name, checksum) VALUES ($1, $2)', [f, sum]);
      await client.query('COMMIT');
      console.log('xong');
    } catch (e) {
      await client.query('ROLLBACK');
      console.log('LỖI');
      console.error(e.message);
      process.exitCode = 1;
      break;
    }
  }
} finally {
  await client.query('SELECT pg_advisory_unlock(72617261)').catch(() => {});
  await client.end();
}
