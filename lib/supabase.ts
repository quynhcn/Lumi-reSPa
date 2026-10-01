/**
 * Client dữ liệu + xác thực cho trình duyệt — thay cho supabase-js.
 * Giữ nguyên tên export `supabase` và các hàm đang dùng (from/rpc/auth.*) để các trang cũ chạy không đổi.
 * Mọi truy vấn gửi về API của chính web app (/api/db, /api/rpc/*, /api/auth/*); phiên đăng nhập nằm trong
 * cookie httpOnly nên JavaScript không đọc được token.
 */
import { createDbClient, type DbResult, type QuerySpec } from '@/lib/db-builder';

export interface User {
  id: string;
  email?: string;
  phone?: string;
  user_metadata: Record<string, any>;
  app_metadata: { role?: 'admin' | 'staff' | 'customer'; staff_id?: string | null };
  created_at: string;
}
export interface Session {
  user: User;
}
export type AuthChangeEvent = 'INITIAL_SESSION' | 'SIGNED_IN' | 'SIGNED_OUT';
type AuthError = { message: string; code?: string };

async function post<T>(url: string, body: unknown): Promise<{ ok: boolean; status: number; body: T }> {
  const res = await fetch(url, {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  let json: T;
  try {
    json = (await res.json()) as T;
  } catch {
    json = {} as T;
  }
  return { ok: res.ok, status: res.status, body: json };
}

const networkError = (e: unknown): DbResult => ({
  data: null,
  error: { message: e instanceof Error ? e.message : 'Network error', code: 'NETWORK' },
  count: null,
  status: 0,
});

// ── Dữ liệu ───────────────────────────────────────────────────────────────
const db = createDbClient({
  query: (spec: QuerySpec) =>
    post<DbResult>('/api/db', spec).then(
      (r) => ({ data: r.body.data ?? null, error: r.body.error ?? null, count: r.body.count ?? null, status: r.status }),
      networkError
    ),
  rpc: (fn, args) =>
    post<DbResult>(`/api/rpc/${encodeURIComponent(fn)}`, args).then(
      (r) => ({ data: r.body.data ?? null, error: r.body.error ?? null, count: null, status: r.status }),
      networkError
    ),
});

// ── Xác thực ──────────────────────────────────────────────────────────────
type Listener = (event: AuthChangeEvent, session: Session | null) => void;
const listeners = new Set<Listener>();
let loaded: Promise<Session | null> | null = null;

function emit(event: AuthChangeEvent, session: Session | null) {
  loaded = Promise.resolve(session);
  listeners.forEach((l) => {
    try {
      l(event, session);
    } catch (e) {
      console.error(e);
    }
  });
}

async function fetchSession(): Promise<Session | null> {
  try {
    const res = await fetch('/api/auth/session', { credentials: 'same-origin', cache: 'no-store' });
    const body = (await res.json()) as { session: Session | null };
    return body.session ?? null;
  } catch {
    return null;
  }
}

type AuthResult = { data: { session: Session | null; user: User | null }; error: AuthError | null };

async function authCall(url: string, body: unknown, signIn = true): Promise<AuthResult> {
  try {
    const r = await post<{ session?: Session | null; user?: User | null; error?: AuthError }>(url, body);
    if (!r.ok || r.body.error) {
      return { data: { session: null, user: null }, error: r.body.error ?? { message: `HTTP ${r.status}` } };
    }
    const session = r.body.session ?? null;
    if (signIn && session) emit('SIGNED_IN', session);
    return { data: { session, user: session?.user ?? null }, error: null };
  } catch (e) {
    return { data: { session: null, user: null }, error: { message: e instanceof Error ? e.message : 'Network error' } };
  }
}

const auth = {
  async getSession(): Promise<{ data: { session: Session | null }; error: null }> {
    loaded ??= fetchSession();
    return { data: { session: await loaded }, error: null };
  },
  /** Tải lại phiên từ server (ví dụ sau khi quyền của tài khoản thay đổi). */
  async refreshSession() {
    const s = await fetchSession();
    emit(s ? 'SIGNED_IN' : 'SIGNED_OUT', s);
    return { data: { session: s }, error: null };
  },
  onAuthStateChange(cb: Listener) {
    listeners.add(cb);
    return { data: { subscription: { unsubscribe: () => listeners.delete(cb) } } };
  },
  signInWithPassword({ email, password }: { email: string; password: string }) {
    return authCall('/api/auth/login', { email, password });
  },
  signUp({ email, password, options }: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
    return authCall('/api/auth/signup', { email, password, data: options?.data ?? {} });
  },
  async signOut() {
    try {
      await post('/api/auth/logout', {});
    } catch {
      /* vẫn xoá phiên phía client */
    }
    emit('SIGNED_OUT', null);
    return { error: null };
  },
};

export const supabase = { ...db, auth };
