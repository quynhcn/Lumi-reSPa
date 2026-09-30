import 'server-only';

/**
 * Quyền truy cập dữ liệu — thay cho RLS của Supabase.
 * Mọi truy vấn từ trình duyệt đi qua /api/db và /api/rpc/*, và CHỈ được phép những gì khai báo ở đây.
 * Bảng / cột / hàm không có trong danh sách = bị từ chối.
 *
 * Chuyển đổi 1-1 từ các policy trong supabase/migrations (20260925000000 … 20260928000000), với 3 điểm siết thêm:
 *   - staff.phone / staff.email chỉ admin đọc được (trước đây public — P1-11)
 *   - nhân viên (staff) chỉ được sửa cột status của lịch của mình (trước đây sửa được mọi cột — P1-1)
 *   - không ai xoá cứng appointments qua API (trước đây admin xoá được — P1-1)
 */

export type AppRole = 'anon' | 'customer' | 'staff' | 'admin';

export interface Actor {
  userId: string | null;
  role: AppRole;
  staffId: string | null;
}

/** bind(value) → "$n" (tham số hoá, không bao giờ nối chuỗi giá trị vào SQL) */
export type Bind = (value: unknown) => string;
/** Điều kiện dòng: nhận alias bảng, trả về đoạn SQL (hoặc null = không giới hạn) */
export type RowRule = (alias: string, bind: Bind) => string | null;

export interface ReadRule {
  where?: RowRule;
  /** '*' = mọi cột; mảng = chỉ các cột này */
  columns: '*' | string[];
}
export interface WriteRule {
  where?: RowRule;
  columns: '*' | string[];
}

export interface TablePolicy {
  select?: (a: Actor) => ReadRule | null;
  insert?: (a: Actor) => WriteRule | null;
  update?: (a: Actor) => WriteRule | null;
  delete?: (a: Actor) => WriteRule | null;
}

const isAdmin = (a: Actor) => a.role === 'admin';
const publicRead = (): ReadRule => ({ columns: '*' });
const adminOnly = (a: Actor): WriteRule | null => (isAdmin(a) ? { columns: '*' } : null);
const adminRead = (a: Actor): ReadRule | null => (isAdmin(a) ? { columns: '*' } : null);

/** Khách hàng đang đăng nhập sở hữu customer_id này */
const ownCustomer = (a: Actor): RowRule => (alias, bind) =>
  `${alias}.customer_id IN (SELECT c.id FROM public.customers c WHERE c.user_id = ${bind(a.userId)})`;

const catalog: TablePolicy = { select: publicRead, insert: adminOnly, update: adminOnly, delete: adminOnly };

const STAFF_PUBLIC_COLUMNS = [
  'id', 'name', 'avatar_url', 'role', 'is_active', 'bio', 'specialties', 'years_experience', 'created_at', 'updated_at',
];

const STAFF_APPOINTMENT_COLUMNS = [
  'id', 'booking_code', 'customer_id', 'staff_id', 'service_id', 'start_time', 'end_time',
  'status', 'duration_min', 'notes', 'source', 'reminded_at', 'created_at', 'updated_at',
];

export const TABLE_POLICIES: Record<string, TablePolicy> = {
  services: catalog,
  staff_services: catalog,
  service_packages: catalog,

  staff_schedules: {
    select: (a) => {
      if (isAdmin(a)) return { columns: '*' };
      if (a.role !== 'staff' || !a.staffId) return null;
      return { columns: '*', where: (t, bind) => `${t}.staff_id = ${bind(a.staffId)}` };
    },
    insert: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },
  staff_time_off: {
    select: adminRead,
    insert: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },

  staff: {
    select: (a) => (isAdmin(a) ? { columns: '*' } : { columns: STAFF_PUBLIC_COLUMNS }),
    insert: adminOnly,
    update: adminOnly,
    delete: adminOnly,
  },

  app_settings: {
    select: publicRead,
    update: adminOnly,
  },

  profiles: {
    select: (a) => {
      if (isAdmin(a)) return { columns: '*' };
      if (!a.userId) return null;
      return { columns: '*', where: (t, bind) => `${t}.id = ${bind(a.userId)}` };
    },
  },

  customers: {
    select: (a) => {
      if (a.role === 'admin' || a.role === 'staff') return { columns: '*' };
      if (!a.userId) return null;
      return { columns: '*', where: (t, bind) => `${t}.user_id = ${bind(a.userId)}` };
    },
    update: (a) => {
      if (isAdmin(a)) return { columns: '*' };
      if (!a.userId) return null;
      // Phone is an identity key used for history, discounts and vouchers; changing it requires a verified flow.
      return { columns: ['name', 'email', 'notes'], where: (t, bind) => `${t}.user_id = ${bind(a.userId)}` };
    },
    insert: adminOnly,
    delete: adminOnly,
  },

  appointments: {
    select: (a) => {
      if (isAdmin(a)) return { columns: '*' };
      if (a.role === 'staff') {
        if (!a.staffId) return null;
        return { columns: STAFF_APPOINTMENT_COLUMNS, where: (t, bind) => `${t}.staff_id = ${bind(a.staffId)}` };
      }
      if (!a.userId) return null;
      return { columns: '*', where: ownCustomer(a) };
    },
    update: (a) => {
      // Status changes must go through transition_appointment so the state machine is enforced in PostgreSQL.
      if (isAdmin(a)) return { columns: ['notes', 'reminded_at'] };
      return null;
    },
    // Tạo lịch chỉ qua RPC book_appointment (giá, ưu đãi, chống trùng tính trong DB)
    insert: () => null,
    delete: () => null,
  },

  appointment_logs: { select: adminRead },

  reviews: {
    select: (a) => {
      if (isAdmin(a)) return { columns: '*' };
      if (!a.userId) return null;
      return { columns: '*', where: ownCustomer(a) };
    },
    update: adminOnly,
    delete: adminOnly,
  },

  gift_cards: { select: adminRead, insert: adminOnly, update: adminOnly, delete: adminOnly },
  leads: { select: adminRead, insert: adminOnly, update: adminOnly, delete: adminOnly },
  review_requests: { select: adminRead, insert: adminOnly, update: adminOnly, delete: adminOnly },
  // slot_holds: không khai báo → chỉ truy cập qua RPC hold_slot / release_hold
};

/**
 * Quan hệ dùng trong select lồng nhau, ví dụ: appointments.select('*, customers (name, phone)').
 * many-to-one → trả object (hoặc null); one-to-many → trả mảng. Giống cách PostgREST trả dữ liệu.
 */
export interface Relation {
  table: string;
  kind: 'many-to-one' | 'one-to-many';
  /** many-to-one: cột FK ở bảng cha; one-to-many: cột FK ở bảng con trỏ về cha */
  fk: string;
}

export const RELATIONS: Record<string, Record<string, Relation>> = {
  appointments: {
    customers: { table: 'customers', kind: 'many-to-one', fk: 'customer_id' },
    staff: { table: 'staff', kind: 'many-to-one', fk: 'staff_id' },
    services: { table: 'services', kind: 'many-to-one', fk: 'service_id' },
    reviews: { table: 'reviews', kind: 'one-to-many', fk: 'appointment_id' },
    review_requests: { table: 'review_requests', kind: 'one-to-many', fk: 'appointment_id' },
    'gift_cards!source_appointment_id': { table: 'gift_cards', kind: 'one-to-many', fk: 'source_appointment_id' },
  },
  service_packages: {
    services: { table: 'services', kind: 'many-to-one', fk: 'service_id' },
  },
  gift_cards: {
    services: { table: 'services', kind: 'many-to-one', fk: 'service_id' },
  },
  reviews: {
    customers: { table: 'customers', kind: 'many-to-one', fk: 'customer_id' },
    services: { table: 'services', kind: 'many-to-one', fk: 'service_id' },
    staff: { table: 'staff', kind: 'many-to-one', fk: 'staff_id' },
  },
};

/**
 * Hàm DB được phép gọi từ client. Tham số khai báo đúng tên để chặn gọi với tham số lạ.
 * auth: 'any' = cả khách vãng lai; 'user' = phải đăng nhập.
 * returns: 'table' → mảng dòng; 'scalar' → 1 giá trị; 'void' → null.
 * Giữ đúng các GRANT EXECUTE trong migrations cũ.
 */
export interface RpcPolicy {
  auth: 'any' | 'user';
  params: string[];
  returns: 'table' | 'scalar' | 'void';
  /** Giới hạn theo IP: tối đa `max` lần gọi trong `windowSec` giây */
  rateLimit?: { max: number; windowSec: number };
}

export const RPC_POLICIES: Record<string, RpcPolicy> = {
  get_available_slots: { auth: 'any', params: ['p_service_id', 'p_staff_id', 'p_date', 'p_holder', 'p_ignore_appointment'], returns: 'table' },
  hold_slot: { auth: 'any', params: ['p_service_id', 'p_staff_id', 'p_date', 'p_time', 'p_holder'], returns: 'table', rateLimit: { max: 30, windowSec: 600 } },
  release_hold: { auth: 'any', params: ['p_holder'], returns: 'void' },
  // Có thể dùng để dò mã quà tặng → giới hạn theo IP
  booking_quote: { auth: 'any', params: ['p_service_id', 'p_phone', 'p_gift_code', 'p_apply_first_visit'], returns: 'table', rateLimit: { max: 60, windowSec: 600 } },
  get_public_reviews: { auth: 'any', params: ['p_limit'], returns: 'table' },
  get_review_summary: { auth: 'any', params: [], returns: 'table' },
  create_lead: { auth: 'any', params: ['p_name', 'p_phone', 'p_interest', 'p_note'], returns: 'scalar', rateLimit: { max: 5, windowSec: 600 } },
  get_review_invite: { auth: 'any', params: ['p_token'], returns: 'table', rateLimit: { max: 30, windowSec: 600 } },
  submit_review_by_token: { auth: 'any', params: ['p_token', 'p_rating', 'p_comment'], returns: 'void', rateLimit: { max: 10, windowSec: 600 } },

  book_appointment: {
    auth: 'user',
    params: ['p_service_id', 'p_staff_id', 'p_date', 'p_time', 'p_name', 'p_phone', 'p_email', 'p_notes', 'p_gift_code', 'p_holder', 'p_apply_first_visit'],
    returns: 'table',
  },
  cancel_my_appointment: { auth: 'user', params: ['p_id'], returns: 'void' },
  submit_review: { auth: 'user', params: ['p_appointment_id', 'p_rating', 'p_comment'], returns: 'void' },
  reschedule_appointment: { auth: 'user', params: ['p_id', 'p_date', 'p_time', 'p_staff_id'], returns: 'table' },
  transition_appointment: { auth: 'user', params: ['p_id', 'p_status'], returns: 'table' },
  review_request_token: { auth: 'user', params: ['p_appointment_id'], returns: 'scalar' },
  my_vouchers: { auth: 'user', params: [], returns: 'table' },
};
