import 'server-only';
import type { PoolClient } from 'pg';
import type { DbError, DbResult, Filter, QuerySpec } from '@/lib/db-builder';
import { RELATIONS, RPC_POLICIES, TABLE_POLICIES, type Actor, type Bind, type ReadRule } from '@/lib/server/policies';

/**
 * "PostgREST thu nhỏ": dịch QuerySpec (từ lib/db-builder) thành SQL tham số hoá.
 * - Tên bảng/cột/quan hệ phải nằm trong allowlist (policies.ts + cột thật đọc từ information_schema).
 * - Giá trị luôn đi qua $n, không nối chuỗi.
 * - Kết quả được Postgres tự chuyển sang JSON (json_agg) để định dạng ngày giờ giống hệt Supabase.
 */

const IDENT = /^[a-z_][a-z0-9_]*$/;
const MAX_ROWS = 1000;

export class QueryError extends Error {
  constructor(message: string, public code = 'SF400', public status = 400) {
    super(message);
  }
}

// ── Cột của từng bảng (đọc 1 lần từ DB) ──────────────────────────────────
let columnCache: Map<string, Set<string>> | null = null;
async function tableColumns(client: PoolClient, table: string): Promise<Set<string>> {
  if (!columnCache) {
    const { rows } = await client.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public'`
    );
    columnCache = new Map();
    for (const r of rows) {
      if (!columnCache.has(r.table_name)) columnCache.set(r.table_name, new Set());
      columnCache.get(r.table_name)!.add(r.column_name);
    }
  }
  const cols = columnCache.get(table);
  if (!cols) throw new QueryError(`Unknown table: ${table}`, 'SF404', 404);
  return cols;
}

// ── Phân tích chuỗi select: "*, customers (name, phone), vouchers:gift_cards!source_appointment_id (code)" ──
interface SelectItem {
  kind: 'star' | 'column' | 'relation';
  name: string; // cột hoặc tên quan hệ (kể cả !hint)
  alias?: string;
  inner?: boolean;
  children?: SelectItem[];
}

function splitTop(s: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur);
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur);
  if (depth !== 0) throw new QueryError('Invalid select: unbalanced parentheses');
  return out.map((x) => x.trim()).filter(Boolean);
}

export function parseSelect(s: string | undefined): SelectItem[] {
  const src = (s ?? '*').replace(/\s+/g, ' ').trim() || '*';
  return splitTop(src).map((part) => {
    if (part === '*') return { kind: 'star', name: '*' };
    const m = part.match(/^(?:([a-z_][a-z0-9_]*)\s*:\s*)?([a-z_][a-z0-9_]*)(?:!([a-z_][a-z0-9_]*))?\s*(?:\((.*)\))?$/s);
    if (!m) throw new QueryError(`Invalid select item: ${part}`);
    const [, alias, name, hint, inner] = m;
    if (inner === undefined) {
      if (hint) throw new QueryError(`Invalid select item: ${part}`);
      return { kind: 'column', name, alias };
    }
    const isInner = hint === 'inner';
    return {
      kind: 'relation',
      name: hint && !isInner ? `${name}!${hint}` : name,
      alias: alias ?? name,
      inner: isInner,
      children: parseSelect(inner),
    };
  });
}

// ── SQL builder ─────────────────────────────────────────────────────────
class Sql {
  params: unknown[] = [];
  bind: Bind = (v) => {
    this.params.push(v);
    return `$${this.params.length}`;
  };
}

const q = (id: string) => {
  if (!IDENT.test(id)) throw new QueryError(`Invalid identifier: ${id}`);
  return `"${id}"`;
};

function readRule(actor: Actor, table: string): ReadRule {
  const policy = TABLE_POLICIES[table];
  const rule = policy?.select?.(actor);
  if (!rule) throw new QueryError(`Permission denied for table ${table}`, '42501', 403);
  return rule;
}

async function allowedColumns(client: PoolClient, table: string, rule: { columns: '*' | string[] }) {
  const all = await tableColumns(client, table);
  return rule.columns === '*' ? Array.from(all) : rule.columns.filter((c) => all.has(c));
}

function filterSql(f: Filter, alias: string, cols: Set<string>, sql: Sql): string {
  if (f.op === 'or') {
    const subs = f.value as Filter[];
    if (!subs.length) return 'false';
    const exprs = subs.map((sub) => filterSql(sub, alias, cols, sql));
    return `(${exprs.join(' OR ')})`;
  }
  if (!cols.has(f.column)) throw new QueryError(`Unknown or forbidden column: ${f.column}`);
  const col = `${alias}.${q(f.column)}`;
  let expr: string;
  switch (f.op) {
    case 'eq': expr = `${col} = ${sql.bind(f.value)}`; break;
    case 'neq': expr = `${col} <> ${sql.bind(f.value)}`; break;
    case 'gt': expr = `${col} > ${sql.bind(f.value)}`; break;
    case 'gte': expr = `${col} >= ${sql.bind(f.value)}`; break;
    case 'lt': expr = `${col} < ${sql.bind(f.value)}`; break;
    case 'lte': expr = `${col} <= ${sql.bind(f.value)}`; break;
    case 'like': expr = `${col}::text LIKE ${sql.bind(f.value)}`; break;
    case 'ilike': expr = `${col}::text ILIKE ${sql.bind(f.value)}`; break;
    case 'in': {
      if (!Array.isArray(f.value)) throw new QueryError('in() expects an array');
      expr = f.value.length === 0 ? 'false' : `${col} = ANY(${sql.bind(f.value)})`;
      break;
    }
    case 'is': {
      if (f.value === null) expr = `${col} IS NULL`;
      else if (f.value === true) expr = `${col} IS TRUE`;
      else if (f.value === false) expr = `${col} IS FALSE`;
      else throw new QueryError('is() expects null/true/false');
      break;
    }
    default:
      throw new QueryError(`Unsupported filter: ${String(f.op)}`);
  }
  return f.negate ? `NOT (${expr})` : expr;
}

let aliasSeq = 0;
const nextAlias = () => `t${++aliasSeq % 1_000_000}`;

/**
 * Tạo biểu thức JSON cho 1 dòng của `table` (alias) theo danh sách select,
 * kèm các quan hệ lồng nhau (mỗi quan hệ áp policy của bảng đích).
 */
async function rowJson(
  client: PoolClient,
  actor: Actor,
  table: string,
  alias: string,
  items: SelectItem[],
  sql: Sql,
  relFilters: Map<string, Filter[]>,
  innerJoins: string[]
): Promise<string> {
  const rule = readRule(actor, table);
  const cols = await allowedColumns(client, table, rule);
  const colSet = new Set(cols);
  const pairs: string[] = [];

  for (const it of items) {
    if (it.kind === 'star') {
      cols.forEach((c) => pairs.push(`'${c}', ${alias}.${q(c)}`));
    } else if (it.kind === 'column') {
      if (colSet.has(it.name)) pairs.push(`'${it.alias ?? it.name}', ${alias}.${q(it.name)}`);
      else if ((await tableColumns(client, table)).has(it.name)) pairs.push(`'${it.alias ?? it.name}', NULL`); // cột có thật nhưng vai trò này không được xem
      else throw new QueryError(`Unknown column: ${table}.${it.name}`);
    } else {
      const rel = RELATIONS[table]?.[it.name];
      if (!rel) throw new QueryError(`Unknown relation: ${table}.${it.name}`);
      const sub = await relationExpr(client, actor, table, alias, rel, it, sql, relFilters.get(it.alias!) ?? []);
      pairs.push(`'${it.alias}', ${sub}`);
      if (it.inner) innerJoins.push(`(${sub}) IS NOT NULL`);
    }
  }
  // json_build_object nhận tối đa 100 đối số → ghép theo cụm 40 cặp
  const chunks: string[] = [];
  for (let i = 0; i < pairs.length; i += 40) chunks.push(`jsonb_build_object(${pairs.slice(i, i + 40).join(', ')})`);
  return chunks.length ? chunks.join(' || ') : `'{}'::jsonb`;
}

async function relationExpr(
  client: PoolClient,
  actor: Actor,
  parentTable: string,
  parentAlias: string,
  rel: { table: string; kind: 'many-to-one' | 'one-to-many'; fk: string },
  it: SelectItem,
  sql: Sql,
  filters: Filter[]
): Promise<string> {
  const a = nextAlias();
  const rule = TABLE_POLICIES[rel.table]?.select?.(actor); // quyền trên bảng đích
  if (!rule) return rel.kind === 'many-to-one' ? 'NULL::jsonb' : `'[]'::jsonb`; // không được xem → rỗng (như RLS)
  const targetCols = await tableColumns(client, rel.table);
  const obj = await rowJson(client, actor, rel.table, a, it.children ?? [{ kind: 'star', name: '*' }], sql, new Map(), []);
  const where: string[] = [];
  if (rel.kind === 'many-to-one') where.push(`${a}."id" = ${parentAlias}.${q(rel.fk)}`);
  else where.push(`${a}.${q(rel.fk)} = ${parentAlias}."id"`);
  const w = rule.where?.(a, sql.bind);
  if (w) where.push(w);
  filters.forEach((f) => where.push(filterSql(f, a, targetCols, sql)));
  if (rel.kind === 'many-to-one') {
    return `(SELECT ${obj} FROM public.${q(rel.table)} ${a} WHERE ${where.join(' AND ')} LIMIT 1)`;
  }
  return `(SELECT coalesce(jsonb_agg(${obj}), '[]'::jsonb) FROM public.${q(rel.table)} ${a} WHERE ${where.join(' AND ')})`;
}

function err(e: unknown): DbError {
  const pe = e as { message?: string; code?: string };
  const message = pe.message || '';
  const isBusinessError = pe.code === 'P0001' || pe.code === '23514';
  if (isBusinessError && /^[A-Z][A-Z0-9_:-]*(?:[a-z_]+->?[a-z_]+)?$/.test(message)) {
    return { message, code: pe.code };
  }
  if (pe.code === '23505') return { message: 'DUPLICATE_VALUE', code: pe.code };
  if (pe.code === '23P01') return { message: 'SLOT_UNAVAILABLE', code: pe.code };
  console.error('[query-engine]', { code: pe.code, message });
  return { message: 'Database operation failed', code: pe.code || 'SF500' };
}

function finish(rows: unknown[], spec: QuerySpec, count: number | null): DbResult {
  if (spec.single) {
    if (rows.length > 1) return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, count, status: 406 };
    if (rows.length === 0) {
      if (spec.single === 'single') return { data: null, error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }, count, status: 406 };
      return { data: null, error: null, count, status: 200 };
    }
    return { data: rows[0], error: null, count, status: 200 };
  }
  return { data: rows, error: null, count, status: 200 };
}

// ── SELECT ────────────────────────────────────────────────────────────
async function runSelect(client: PoolClient, actor: Actor, spec: QuerySpec): Promise<DbResult> {
  const table = spec.table;
  const rule = readRule(actor, table);
  const cols = new Set(await allowedColumns(client, table, rule));
  const sql = new Sql();
  const t = 'r0';

  // Bộ lọc trên quan hệ lồng nhau: "services.is_active" → áp vào subquery của quan hệ services
  const topFilters: Filter[] = [];
  const relFilters = new Map<string, Filter[]>();
  for (const f of spec.filters) {
    const dot = f.column.indexOf('.');
    if (dot > 0) {
      const rel = f.column.slice(0, dot);
      relFilters.set(rel, [...(relFilters.get(rel) ?? []), { ...f, column: f.column.slice(dot + 1) }]);
    } else topFilters.push(f);
  }

  const where: string[] = [];
  const w = rule.where?.(t, sql.bind);
  if (w) where.push(w);
  topFilters.forEach((f) => where.push(filterSql(f, t, cols, sql)));

  if (spec.head) {
    const { rows } = await client.query(
      `SELECT count(*)::int AS n FROM public.${q(table)} ${t} ${where.length ? 'WHERE ' + where.join(' AND ') : ''}`,
      sql.params
    );
    return { data: null, error: null, count: rows[0].n, status: 200 };
  }

  const innerJoins: string[] = [];
  const obj = await rowJson(client, actor, table, t, parseSelect(spec.select), sql, relFilters, innerJoins);
  where.push(...innerJoins);

  const order = spec.order.map((o) => {
    if (!cols.has(o.column)) throw new QueryError(`Unknown or forbidden column: ${o.column}`);
    const nulls = o.nullsFirst === undefined ? '' : o.nullsFirst ? ' NULLS FIRST' : ' NULLS LAST';
    return `${t}.${q(o.column)} ${o.ascending ? 'ASC' : 'DESC'}${nulls}`;
  });
  const limit = spec.limit !== undefined ? Math.min(Math.max(1, Math.floor(spec.limit)), MAX_ROWS) : MAX_ROWS;
  const offset = spec.offset ? Math.max(0, Math.floor(spec.offset)) : 0;
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  const text = `SELECT coalesce(jsonb_agg(x.j ORDER BY x.n), '[]'::jsonb) AS rows FROM (
      SELECT ${obj} AS j, row_number() OVER (${order.length ? 'ORDER BY ' + order.join(', ') : ''}) AS n
      FROM public.${q(table)} ${t} ${whereSql}
      ${order.length ? 'ORDER BY ' + order.join(', ') : ''}
      LIMIT ${limit} OFFSET ${offset}
    ) x`;
  const { rows } = await client.query(text, sql.params);

  let count: number | null = null;
  if (spec.count === 'exact') {
    const c = new Sql();
    const cw: string[] = [];
    const rw = rule.where?.(t, c.bind);
    if (rw) cw.push(rw);
    topFilters.forEach((f) => cw.push(filterSql(f, t, cols, c)));
    const r = await client.query(`SELECT count(*)::int AS n FROM public.${q(table)} ${t} ${cw.length ? 'WHERE ' + cw.join(' AND ') : ''}`, c.params);
    count = r.rows[0].n;
  }
  return finish(rows[0].rows as unknown[], spec, count);
}

// ── INSERT / UPDATE / DELETE ──────────────────────────────────────────
async function returningRows(client: PoolClient, actor: Actor, spec: QuerySpec, ids: string[]): Promise<DbResult> {
  if (!spec.returning) return { data: null, error: null, count: null, status: 201 };
  // Đọc lại qua đường SELECT để cùng áp policy đọc + chọn cột
  return runSelect(client, actor, { ...spec, action: 'select', filters: [{ column: 'id', op: 'in', value: ids }], order: [], limit: undefined, count: undefined, head: false });
}

function writableColumns(rule: { columns: '*' | string[] }, all: Set<string>, keys: string[]) {
  for (const k of keys) {
    if (!IDENT.test(k) || !all.has(k)) throw new QueryError(`Unknown column: ${k}`);
    if (rule.columns !== '*' && !rule.columns.includes(k)) throw new QueryError(`Permission denied for column ${k}`, '42501', 403);
  }
}

async function runInsert(client: PoolClient, actor: Actor, spec: QuerySpec): Promise<DbResult> {
  const rule = TABLE_POLICIES[spec.table]?.insert?.(actor);
  if (!rule) throw new QueryError(`Permission denied for table ${spec.table}`, '42501', 403);
  const all = await tableColumns(client, spec.table);
  const rows = Array.isArray(spec.values) ? spec.values : spec.values ? [spec.values] : [];
  if (rows.length === 0) throw new QueryError('Nothing to insert');
  const keys = Array.from(new Set(rows.flatMap((r) => Object.keys(r))));
  writableColumns(rule, all, keys);
  const colList = keys.map(q).join(', ');
  const { rows: out } = await client.query(
    `INSERT INTO public.${q(spec.table)} (${colList})
     SELECT ${colList} FROM jsonb_populate_recordset(NULL::public.${q(spec.table)}, $1::jsonb)
     RETURNING id`,
    [JSON.stringify(rows)]
  );
  return returningRows(client, actor, spec, out.map((r) => r.id));
}

async function runUpdateDelete(client: PoolClient, actor: Actor, spec: QuerySpec): Promise<DbResult> {
  const isUpdate = spec.action === 'update';
  const policy = TABLE_POLICIES[spec.table];
  const rule = isUpdate ? policy?.update?.(actor) : policy?.delete?.(actor);
  if (!rule) throw new QueryError(`Permission denied for table ${spec.table}`, '42501', 403);
  if (spec.filters.length === 0) throw new QueryError(`${spec.action} requires a filter`, '21000');
  const all = await tableColumns(client, spec.table);
  const sql = new Sql();
  const t = 'r0';
  const where: string[] = [];
  const w = rule.where?.(t, sql.bind);
  if (w) where.push(w);
  spec.filters.forEach((f) => {
    if (f.column.includes('.')) throw new QueryError('Filters on relations are not allowed here');
    where.push(filterSql(f, t, all, sql));
  });

  let text: string;
  if (isUpdate) {
    const values = (spec.values ?? {}) as Record<string, unknown>;
    const keys = Object.keys(values);
    if (keys.length === 0) throw new QueryError('Nothing to update');
    writableColumns(rule, all, keys);
    const v = sql.bind(JSON.stringify(values));
    const sets = keys.map((k) => `${q(k)} = v.${q(k)}`).join(', ');
    text = `UPDATE public.${q(spec.table)} ${t} SET ${sets}
            FROM jsonb_populate_record(NULL::public.${q(spec.table)}, ${v}::jsonb) v
            WHERE ${where.join(' AND ')} RETURNING ${t}.id`;
  } else {
    text = `DELETE FROM public.${q(spec.table)} ${t} WHERE ${where.join(' AND ')} RETURNING ${t}.id`;
  }
  // DELETE ... RETURNING rồi SELECT lại sẽ không thấy dòng → với delete chỉ trả null
  const { rows } = await client.query(text, sql.params);
  if (!isUpdate) return { data: null, error: null, count: rows.length, status: 204 };
  return returningRows(client, actor, spec, rows.map((r) => r.id));
}

export async function executeQuery(client: PoolClient, actor: Actor, spec: QuerySpec): Promise<DbResult> {
  if (!spec || typeof spec.table !== 'string' || !IDENT.test(spec.table) || !TABLE_POLICIES[spec.table]) {
    return { data: null, error: { message: `Permission denied for table ${spec?.table}`, code: '42501' }, count: null, status: 403 };
  }
  spec.filters = Array.isArray(spec.filters) ? spec.filters : [];
  spec.order = Array.isArray(spec.order) ? spec.order : [];
  try {
    await client.query('SAVEPOINT q');
    let res: DbResult;
    if (spec.action === 'select') res = await runSelect(client, actor, spec);
    else if (spec.action === 'insert') res = await runInsert(client, actor, spec);
    else if (spec.action === 'update' || spec.action === 'delete') res = await runUpdateDelete(client, actor, spec);
    else throw new QueryError('Unsupported action');
    await client.query('RELEASE SAVEPOINT q');
    return res;
  } catch (e) {
    await client.query('ROLLBACK TO SAVEPOINT q').catch(() => {});
    if (e instanceof QueryError) return { data: null, error: { message: e.message, code: e.code }, count: null, status: e.status };
    return { data: null, error: err(e), count: null, status: 400 };
  }
}

// ── RPC ───────────────────────────────────────────────────────────────
export async function executeRpc(client: PoolClient, actor: Actor, fn: string, args: Record<string, unknown>): Promise<DbResult> {
  const p = RPC_POLICIES[fn];
  if (!p || !IDENT.test(fn)) return { data: null, error: { message: `Could not find the function public.${fn}`, code: 'PGRST202' }, count: null, status: 404 };
  if (p.auth === 'user' && !actor.userId) return { data: null, error: { message: 'AUTH_REQUIRED', code: 'P0001' }, count: null, status: 401 };

  const sql = new Sql();
  const named: string[] = [];
  for (const [k, v] of Object.entries(args ?? {})) {
    if (!p.params.includes(k)) {
      return { data: null, error: { message: `Unknown parameter ${k} for ${fn}`, code: 'PGRST202' }, count: null, status: 400 };
    }
    if (v === undefined) continue;
    named.push(`${q(k)} => ${sql.bind(v)}`);
  }
  const call = `public.${q(fn)}(${named.join(', ')})`;
  try {
    await client.query('SAVEPOINT r');
    let data: unknown = null;
    if (p.returns === 'table') {
      const { rows } = await client.query(`SELECT coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) AS v FROM ${call} x`, sql.params);
      data = rows[0].v;
    } else if (p.returns === 'scalar') {
      const { rows } = await client.query(`SELECT to_jsonb(${call}) AS v`, sql.params);
      data = rows[0].v;
    } else {
      await client.query(`SELECT ${call}`, sql.params);
    }
    await client.query('RELEASE SAVEPOINT r');
    return { data, error: null, count: null, status: 200 };
  } catch (e) {
    await client.query('ROLLBACK TO SAVEPOINT r').catch(() => {});
    return { data: null, error: err(e), count: null, status: 400 };
  }
}
