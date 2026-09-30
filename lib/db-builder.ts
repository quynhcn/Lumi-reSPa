/**
 * Query builder có cùng "bề mặt" với supabase-js (from().select().eq()...), để code giao diện
 * cũ chạy tiếp mà không phải sửa từng trang. Builder chỉ MÔ TẢ truy vấn (QuerySpec, dạng JSON);
 * việc thực thi do Executor đảm nhận:
 *   - trình duyệt: gửi QuerySpec tới /api/db (lib/supabase.ts)
 *   - server component: gọi thẳng query engine (lib/server/server-client.ts)
 * Quyền truy cập luôn được kiểm tra ở server (lib/server/policies.ts), không tin client.
 *
 * File này không được import gì từ server (pg, next/headers) vì nó chạy cả ở trình duyệt.
 */

export type FilterOp = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'is' | 'like' | 'ilike';
export type Filter = { column: string; op: FilterOp; value: unknown; negate?: boolean };
export type OrderSpec = { column: string; ascending: boolean; nullsFirst?: boolean };

export interface QuerySpec {
  table: string;
  action: 'select' | 'insert' | 'update' | 'delete';
  select?: string;
  /** insert/update/delete: trả về các dòng bị ảnh hưởng (khi gọi .select() sau đó) */
  returning?: boolean;
  count?: 'exact';
  head?: boolean;
  filters: Filter[];
  order: OrderSpec[];
  limit?: number;
  values?: Record<string, unknown> | Record<string, unknown>[];
  single?: 'single' | 'maybe';
}

export interface DbError {
  message: string;
  code?: string;
  details?: string | null;
  hint?: string | null;
}

export interface DbResult<T = any> {
  data: T | null;
  error: DbError | null;
  count: number | null;
  status: number;
}

export type Executor = {
  query: (spec: QuerySpec) => Promise<DbResult>;
  rpc: (fn: string, args: Record<string, unknown>) => Promise<DbResult>;
};

/** Chuỗi danh sách kiểu PostgREST: '("a","b",c)' → ['a','b','c'] */
function parseList(v: unknown): unknown[] {
  if (Array.isArray(v)) return v;
  const s = String(v).trim().replace(/^\(/, '').replace(/\)$/, '');
  if (!s) return [];
  return s.split(',').map((x) => x.trim().replace(/^"(.*)"$/, '$1'));
}

export class QueryBuilder<Row = any, T = Row[]> implements PromiseLike<DbResult<T>> {
  private spec: QuerySpec;

  constructor(private exec: Executor, table: string) {
    this.spec = { table, action: 'select', filters: [], order: [] };
  }

  // ── actions ──
  select(columns = '*', opts?: { count?: 'exact'; head?: boolean }) {
    if (this.spec.action === 'select') {
      this.spec.select = columns;
      if (opts?.count) this.spec.count = opts.count;
      if (opts?.head) this.spec.head = true;
    } else {
      this.spec.returning = true;
      this.spec.select = columns;
    }
    return this;
  }
  insert(values: Record<string, unknown> | Record<string, unknown>[]) {
    this.spec.action = 'insert';
    this.spec.values = values;
    return this;
  }
  update(values: Record<string, unknown>) {
    this.spec.action = 'update';
    this.spec.values = values;
    return this;
  }
  delete() {
    this.spec.action = 'delete';
    return this;
  }
  upsert(): never {
    throw new Error('upsert không được hỗ trợ ở client. Dùng insert/update hoặc một API route riêng.');
  }

  // ── filters ──
  private f(column: string, op: FilterOp, value: unknown, negate = false) {
    this.spec.filters.push({ column, op, value, negate });
    return this;
  }
  eq(c: string, v: unknown) { return this.f(c, 'eq', v); }
  neq(c: string, v: unknown) { return this.f(c, 'neq', v); }
  gt(c: string, v: unknown) { return this.f(c, 'gt', v); }
  gte(c: string, v: unknown) { return this.f(c, 'gte', v); }
  lt(c: string, v: unknown) { return this.f(c, 'lt', v); }
  lte(c: string, v: unknown) { return this.f(c, 'lte', v); }
  like(c: string, v: string) { return this.f(c, 'like', v); }
  ilike(c: string, v: string) { return this.f(c, 'ilike', v); }
  in(c: string, v: unknown[]) { return this.f(c, 'in', v); }
  is(c: string, v: null | boolean) { return this.f(c, 'is', v); }
  not(c: string, op: FilterOp, v: unknown) {
    return this.f(c, op, op === 'in' ? parseList(v) : v, true);
  }
  match(obj: Record<string, unknown>) {
    Object.entries(obj).forEach(([k, v]) => this.f(k, 'eq', v));
    return this;
  }

  // ── modifiers ──
  order(column: string, opts?: { ascending?: boolean; nullsFirst?: boolean }) {
    this.spec.order.push({ column, ascending: opts?.ascending ?? true, nullsFirst: opts?.nullsFirst });
    return this;
  }
  limit(n: number) {
    this.spec.limit = n;
    return this;
  }
  single(): QueryBuilder<Row, Row> {
    this.spec.single = 'single';
    return this as unknown as QueryBuilder<Row, Row>;
  }
  maybeSingle(): QueryBuilder<Row, Row | null> {
    this.spec.single = 'maybe';
    return this as unknown as QueryBuilder<Row, Row | null>;
  }

  then<R1 = DbResult<T>, R2 = never>(
    onfulfilled?: ((value: DbResult<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null
  ): PromiseLike<R1 | R2> {
    return this.exec.query(this.spec).then(onfulfilled as never, onrejected);
  }
}

export function createDbClient(exec: Executor) {
  return {
    from<Row = any>(table: string) {
      return new QueryBuilder<Row>(exec, table);
    },
    rpc<T = any>(fn: string, args: Record<string, unknown> = {}): PromiseLike<DbResult<T>> {
      return exec.rpc(fn, args) as Promise<DbResult<T>>;
    },
  };
}
