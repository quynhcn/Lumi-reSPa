/**
 * Kiểm thử API end-to-end trên PostgreSQL thật (không Supabase).
 * Chạy qua tests/api/run.sh (tự dựng DB tạm, chạy migration, seed, build + start Next.js).
 * Có thể chạy riêng: BASE_URL=http://localhost:3100 DATABASE_URL=... node --test tests/api/api.test.mjs
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';

const BASE = process.env.BASE_URL || 'http://localhost:3100';
const db = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const SVC_BODY = '10000000-0000-0000-0000-000000000001';
const SVC_FACIAL = '10000000-0000-0000-0000-000000000002';
const LAN = '20000000-0000-0000-0000-000000000001';
const HA = '20000000-0000-0000-0000-000000000002';

const vnDate = (offsetDays) =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' }).format(Date.now() + offsetDays * 86400_000);
const D1 = vnDate(1);
const D2 = vnDate(2);

let ipSeq = 10;
class Client {
  constructor() {
    this.cookie = '';
    this.ip = `10.0.0.${ipSeq++}`;
  }
  async req(path, body, { method = 'POST', headers = {} } = {}) {
    const res = await fetch(BASE + path, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Forwarded-For': this.ip,
        ...(this.cookie ? { cookie: this.cookie } : {}),
        ...headers,
      },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
    });
    const sc = res.headers.get('set-cookie');
    if (sc) {
      const m = sc.match(/sf_session=([^;]*)/);
      if (m) this.cookie = m[1] ? `sf_session=${m[1]}` : '';
    }
    let json = null;
    try {
      json = await res.json();
    } catch {}
    return { status: res.status, body: json };
  }
  select(table, extra = {}) {
    return this.req('/api/db', { table, action: 'select', select: '*', filters: [], order: [], ...extra });
  }
  write(table, action, extra = {}) {
    return this.req('/api/db', { table, action, filters: [], order: [], ...extra });
  }
  rpc(fn, args = {}) {
    return this.req(`/api/rpc/${fn}`, args);
  }
  signup(email, name, phone) {
    return this.req('/api/auth/signup', { email, password: 'Matkhau@123', data: { name, phone } });
  }
  login(email, password = 'Matkhau@123') {
    return this.req('/api/auth/login', { email, password });
  }
}

const anon = new Client();
const cust = new Client();
const cust2 = new Client();
const staff = new Client();
const admin = new Client();
const state = {};

before(async () => {
  let r = await admin.signup('admin@test.vn', 'Quản Trị', '0900000001');
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await staff.signup('lan@test.vn', 'Lan', '0900000002');
  assert.equal(r.status, 200);
  await db.query(`UPDATE profiles SET role = 'admin' WHERE email = 'admin@test.vn'`);
  await db.query(`UPDATE profiles SET role = 'staff', staff_id = $1 WHERE email = 'lan@test.vn'`, [LAN]);
});

after(() => db.end());

// ── Xác thực ─────────────────────────────────────────────────────────────
test('đăng ký → có phiên, vai trò customer, tự tạo hồ sơ khách', async () => {
  const r = await cust.signup('khach1@test.vn', 'Nguyễn Văn An', '0987654321');
  assert.equal(r.status, 200);
  assert.equal(r.body.session.user.app_metadata.role, 'customer');
  const s = await cust.req('/api/auth/session', null, { method: 'GET' });
  assert.equal(s.body.session.user.email, 'khach1@test.vn');
  const c = await cust.select('customers');
  assert.equal(c.body.data.length, 1);
  assert.equal(c.body.data[0].phone, '0987654321');
});

test('đăng ký trùng email → "User already registered"', async () => {
  const r = await new Client().signup('khach1@test.vn', 'X', '0987654321');
  assert.equal(r.status, 400);
  assert.equal(r.body.error.message, 'User already registered');
});

test('sai mật khẩu → "Invalid login credentials"; quá 10 lần → bị khoá tạm', async () => {
  await new Client().signup('brute@test.vn', 'B', '0987000999');
  const c = new Client();
  for (let i = 0; i < 10; i++) {
    const r = await c.login('brute@test.vn', 'sai-mat-khau');
    assert.equal(r.body.error.message, 'Invalid login credentials');
  }
  const r = await c.login('brute@test.vn');
  assert.equal(r.status, 429);
});

test('vai trò admin/staff lấy từ bảng profiles', async () => {
  await admin.login('admin@test.vn');
  await staff.login('lan@test.vn');
  const a = await admin.req('/api/auth/session', null, { method: 'GET' });
  const s = await staff.req('/api/auth/session', null, { method: 'GET' });
  assert.equal(a.body.session.user.app_metadata.role, 'admin');
  assert.equal(s.body.session.user.app_metadata.role, 'staff');
  assert.equal(s.body.session.user.app_metadata.staff_id, LAN);
});

test('đăng xuất → phiên bị huỷ ở server', async () => {
  const c = new Client();
  await c.signup('logout@test.vn', 'L', '0987000888');
  const saved = c.cookie;
  await c.req('/api/auth/logout', {});
  const again = new Client();
  again.cookie = saved;
  const s = await again.req('/api/auth/session', null, { method: 'GET' });
  assert.equal(s.body.session, null);
});

// ── Quyền đọc dữ liệu ────────────────────────────────────────────────────
test('khách vãng lai: đọc được danh mục, không đọc được dữ liệu cá nhân', async () => {
  assert.equal((await anon.select('services', { filters: [{ column: 'is_active', op: 'eq', value: true }] })).body.data.length, 2);
  const st = await anon.select('staff');
  assert.ok(st.body.data.every((x) => !('phone' in x) && !('email' in x)), 'staff.phone/email bị ẩn');
  for (const t of ['customers', 'appointments', 'profiles', 'leads', 'gift_cards', 'slot_holds', 'pg_user']) {
    const r = await anon.select(t);
    assert.equal(r.status, 403, t);
  }
});

test('chống SQL injection: tên cột / select lạ bị từ chối, giá trị luôn tham số hoá', async () => {
  let r = await anon.select('services', { select: 'id; drop table services' });
  assert.equal(r.status, 400);
  r = await anon.select('services', { filters: [{ column: 'id or 1=1', op: 'eq', value: 1 }] });
  assert.equal(r.status, 400);
  r = await anon.select('services', { filters: [{ column: 'name', op: 'eq', value: "' OR 1=1 --" }] });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.length, 0);
  r = await anon.rpc('_price_booking', {});
  assert.equal(r.status, 404);
});

test('CSRF: request ghi từ origin lạ bị chặn', async () => {
  const r = await cust.req('/api/db', { table: 'services', action: 'select', filters: [], order: [] }, { headers: { Origin: 'http://evil.test' } });
  assert.equal(r.status, 403);
});

test('select lồng nhau !inner + count head', async () => {
  const r = await anon.select('service_packages', {
    select: '*, services!inner (name, is_active)',
    filters: [
      { column: 'is_active', op: 'eq', value: true },
      { column: 'services.is_active', op: 'eq', value: true },
    ],
  });
  assert.equal(r.body.data.length, 1);
  assert.equal(r.body.data[0].services.name, 'Massage Body');
  const c = await admin.select('services', { select: 'id', count: 'exact', head: true });
  assert.equal(c.body.count, 3);
});

// ── Đặt lịch ────────────────────────────────────────────────────────────
test('slot engine + báo giá (vãng lai) + đặt lịch (khách) có ưu đãi lần đầu', async () => {
  const slots = await anon.rpc('get_available_slots', { p_service_id: SVC_BODY, p_staff_id: null, p_date: D1 });
  assert.equal(slots.status, 200);
  assert.ok(slots.body.data.some((s) => s.slot_time === '10:00'));
  assert.ok(!slots.body.data.some((s) => s.slot_time === '12:00'), 'giờ nghỉ trưa bị loại');

  const q = await anon.rpc('booking_quote', { p_service_id: SVC_BODY, p_phone: null });
  assert.equal(q.body.data[0].total, 450000);

  const b = await cust.rpc('book_appointment', {
    p_service_id: SVC_BODY, p_staff_id: LAN, p_date: D1, p_time: '10:00',
    p_name: 'Nguyễn Văn An', p_phone: '0987654321', p_email: 'khach1@test.vn', p_notes: '',
  });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const row = b.body.data[0];
  assert.equal(row.status, 'confirmed');
  assert.equal(row.discount_reason, 'first_visit');
  assert.equal(row.total, 405000);
  state.apt1 = row.booking_code;
});

test('đặt trùng giờ cùng KTV → SLOT_UNAVAILABLE', async () => {
  const b = await cust2.signup('khach2@test.vn', 'Lê Thị Bình', '0977777777').then(() =>
    cust2.rpc('book_appointment', {
      p_service_id: SVC_BODY, p_staff_id: LAN, p_date: D1, p_time: '10:00',
      p_name: 'Lê Thị Bình', p_phone: '0977777777', p_email: '', p_notes: '',
    })
  );
  assert.equal(b.status, 400);
  assert.match(b.body.error.message, /SLOT_UNAVAILABLE/);
});

test('khách chỉ thấy lịch của mình; SĐT KTV bị ẩn trong dữ liệu lồng nhau', async () => {
  const mine = await cust.select('appointments', { select: '*, customers (name, phone), staff (name, phone), services (name)' });
  assert.equal(mine.body.data.length, 1);
  assert.equal(mine.body.data[0].customers.name, 'Nguyễn Văn An');
  assert.equal(mine.body.data[0].staff.name, 'Nguyễn Thị Lan');
  assert.equal(mine.body.data[0].staff.phone, null);
  assert.match(mine.body.data[0].start_time, /^\d{4}-\d{2}-\d{2}T03:00:00\+00:00$/, '10:00 giờ VN = 03:00 UTC, định dạng ISO như Supabase');
  state.apt1Id = mine.body.data[0].id;
  const other = await cust2.select('appointments');
  assert.equal(other.body.data.length, 0);
});

test('khách không tự tạo / sửa / xoá lịch qua /api/db', async () => {
  let r = await cust.write('appointments', 'insert', { values: { status: 'confirmed' } });
  assert.equal(r.status, 403);
  r = await cust.write('appointments', 'update', { values: { price: 1 }, filters: [{ column: 'id', op: 'eq', value: state.apt1Id }] });
  assert.equal(r.status, 403);
  r = await admin.write('appointments', 'delete', { filters: [{ column: 'id', op: 'eq', value: state.apt1Id }] });
  assert.equal(r.status, 403, 'không ai xoá cứng lịch hẹn');
});

test('khách sửa được hồ sơ của mình, không sửa được hồ sơ người khác', async () => {
  const mine = (await cust.select('customers')).body.data[0];
  let r = await cust.write('customers', 'update', { values: { name: 'Nguyễn Văn Anh' }, filters: [{ column: 'id', op: 'eq', value: mine.id }] });
  assert.equal(r.status, 200);
  const theirs = (await cust2.select('customers')).body.data[0];
  r = await cust.write('customers', 'update', { values: { name: 'hack' }, filters: [{ column: 'id', op: 'eq', value: theirs.id }] });
  const check = await db.query('SELECT name FROM customers WHERE id = $1', [theirs.id]);
  assert.equal(check.rows[0].name, 'Lê Thị Bình');
  r = await cust.write('customers', 'update', { values: { user_id: null }, filters: [{ column: 'id', op: 'eq', value: mine.id }] });
  assert.equal(r.status, 403);
});

test('KTV: chỉ thấy lịch của mình, chỉ đổi được trạng thái', async () => {
  const list = await staff.select('appointments', { select: '*, customers (name, phone)' });
  assert.equal(list.body.data.length, 1);
  assert.equal(list.body.data[0].customers.phone, '0987654321');
  let r = await staff.write('appointments', 'update', { values: { price: 1 }, filters: [{ column: 'id', op: 'eq', value: state.apt1Id }] });
  assert.equal(r.status, 403);
  r = await staff.write('appointments', 'update', { values: { status: 'checked_in' }, filters: [{ column: 'id', op: 'eq', value: state.apt1Id }], returning: true, select: 'id, status', single: 'single' });
  assert.equal(r.status, 200);
  assert.equal(r.body.data.status, 'checked_in');
  const logs = await admin.select('appointment_logs', { filters: [{ column: 'appointment_id', op: 'eq', value: state.apt1Id }] });
  assert.equal(logs.body.data[0].changed_by, 'lan@test.vn', 'log ghi đúng người thao tác qua auth.uid()');
});

test('đổi giờ (khách) và huỷ lịch (khách)', async () => {
  const b = await cust2.rpc('book_appointment', {
    p_service_id: SVC_FACIAL, p_staff_id: null, p_date: D2, p_time: '14:00',
    p_name: 'Lê Thị Bình', p_phone: '0977777777', p_email: '', p_notes: '',
  });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const apt = (await cust2.select('appointments')).body.data[0];
  let r = await cust2.rpc('reschedule_appointment', { p_id: apt.id, p_date: D2, p_time: '15:00', p_staff_id: null });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await cust.rpc('cancel_my_appointment', { p_id: apt.id });
  assert.match(r.body.error.message, /NOT_FOUND/, 'không huỷ được lịch của người khác');
  r = await cust2.rpc('cancel_my_appointment', { p_id: apt.id });
  assert.equal(r.status, 200);
  const after = (await cust2.select('appointments')).body.data[0];
  assert.equal(after.status, 'cancelled');
  assert.equal(after.reschedule_count, 1);
});

// ── Admin ───────────────────────────────────────────────────────────────
test('admin: hoàn thành lịch → phát voucher, link đánh giá không cần đăng nhập', async () => {
  for (const s of ['in_service', 'completed']) {
    const r = await admin.write('appointments', 'update', { values: { status: s }, filters: [{ column: 'id', op: 'eq', value: state.apt1Id }] });
    assert.equal(r.status, 200);
  }
  const token = await admin.rpc('review_request_token', { p_appointment_id: state.apt1Id });
  assert.match(token.body.data, /^[0-9a-f-]{36}$/);
  const inv = await anon.rpc('get_review_invite', { p_token: token.body.data });
  assert.equal(inv.body.data[0].can_review, true);
  assert.equal(inv.body.data[0].given_name, 'Anh', 'chỉ lộ tên, không lộ họ');
  const sub = await anon.rpc('submit_review_by_token', { p_token: token.body.data, p_rating: 5, p_comment: 'Rất thư giãn' });
  assert.equal(sub.status, 200, JSON.stringify(sub.body));
  const dup = await anon.rpc('submit_review_by_token', { p_token: token.body.data, p_rating: 4, p_comment: 'x' });
  assert.match(dup.body.error.message, /ALREADY_REVIEWED/);
  const q = await admin.select('appointments', {
    select: 'id, reviews (id), review_requests (sent_at), vouchers:gift_cards!source_appointment_id (code, percent_off)',
    filters: [{ column: 'id', op: 'eq', value: state.apt1Id }],
    single: 'single',
  });
  assert.equal(q.body.data.reviews.length, 1);
  assert.equal(q.body.data.review_requests.length, 1);
  assert.equal(q.body.data.vouchers[0].percent_off, 10);
  const mv = await cust.rpc('my_vouchers');
  assert.equal(mv.body.data.length, 1);
});

test('admin: phát thẻ quà (insert … select().single()), khách không đọc được gift_cards', async () => {
  const r = await admin.write('gift_cards', 'insert', {
    values: { kind: 'value', initial_value: 500000, balance: 500000, recipient_name: 'Test' },
    returning: true, select: '*', single: 'single',
  });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.match(r.body.data.code, /^SF[0-9A-F]{8}$/);
  assert.equal((await cust.select('gift_cards')).status, 403);
  const q = await cust.rpc('booking_quote', { p_service_id: SVC_FACIAL, p_phone: '0987654321', p_gift_code: r.body.data.code });
  assert.equal(q.body.data[0].gift_amount, 300000);
});

test('cài đặt ưu đãi: chỉ admin lưu được, lưu thật vào DB, chặn giá trị sai', async () => {
  let r = await cust.req('/api/settings', { first_visit_discount_pct: 50 });
  assert.equal(r.status, 403);
  r = await admin.req('/api/settings', { first_visit_discount_pct: 99 });
  assert.equal(r.status, 400);
  r = await admin.req('/api/settings', { first_visit_discount_pct: 15, no_show_threshold: 3 });
  assert.equal(r.status, 200);
  const g = await anon.req('/api/settings', null, { method: 'GET' });
  assert.equal(g.body.first_visit_discount_pct, 15);
  assert.equal(g.body.no_show_threshold, 3);
});

test('nhắc lịch: chỉ admin/cron; gửi xong mới đánh dấu reminded_at', async () => {
  let r = await anon.req('/api/reminders/send?hours=48', {});
  assert.equal(r.status, 403);
  // lịch còn mở duy nhất của khách 2 đã huỷ; tạo thêm 1 lịch để nhắc
  await cust2.rpc('book_appointment', {
    p_service_id: SVC_FACIAL, p_staff_id: HA, p_date: D1, p_time: '16:00',
    p_name: 'Lê Thị Bình', p_phone: '0977777777', p_email: '', p_notes: '',
  });
  r = await admin.req('/api/reminders/send?hours=48', {});
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.count, 1);
  const again = await admin.req('/api/reminders/send?hours=48', {});
  assert.equal(again.body.count, 0, 'không nhắc trùng');
});

// ── SMS OTP ─────────────────────────────────────────────────────────────
test('OTP: lễ tân đặt hộ → khách xác minh SĐT → nhận lại lịch sử', async () => {
  const b = await admin.rpc('book_appointment', {
    p_service_id: SVC_BODY, p_staff_id: HA, p_date: D2, p_time: '09:00',
    p_name: 'Phạm Walkin', p_phone: '0901234567', p_email: '', p_notes: '',
  });
  assert.equal(b.status, 200, JSON.stringify(b.body));
  const g = new Client();
  let r = await g.req('/api/auth/otp/send', { phone: '0901234567' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  r = await g.req('/api/auth/otp/send', { phone: '0901234567' });
  assert.equal(r.status, 429, 'gửi lại trong 60s bị chặn');
  r = await g.req('/api/auth/otp/verify', { phone: '0901234567', token: '000000' });
  assert.equal(r.status, 400);
  r = await g.req('/api/auth/otp/verify', { phone: '+84 901 234 567', token: '123456', name: 'Phạm Walkin' });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  assert.equal(r.body.session.user.phone, '84901234567');
  const mine = await g.select('appointments');
  assert.equal(mine.body.data.length, 1);
});

test('OTP: sai 5 lần thì mã bị vô hiệu dù sau đó nhập đúng', async () => {
  const g = new Client();
  await g.req('/api/auth/otp/send', { phone: '0902000002' });
  for (let i = 0; i < 5; i++) await g.req('/api/auth/otp/verify', { phone: '0902000002', token: '111111' });
  const r = await g.req('/api/auth/otp/verify', { phone: '0902000002', token: '654321' });
  assert.equal(r.status, 400);
});

test('OTP: SMS chưa cấu hình cho số thường → báo "provider disabled"', async () => {
  const r = await new Client().req('/api/auth/otp/send', { phone: '0903999999' });
  if (process.env.EXPECT_SMS_DISABLED === '1') assert.match(r.body.error.message, /provider disabled/);
  else assert.ok([200, 400].includes(r.status));
});

// ── Form để lại SĐT ─────────────────────────────────────────────────────
test('form lead: giới hạn 5 lần / 10 phút theo IP, IP khác không bị ảnh hưởng', async () => {
  const spammer = new Client();
  for (let i = 0; i < 5; i++) {
    const r = await spammer.rpc('create_lead', { p_name: 'Spam', p_phone: `09110000${10 + i}`, p_interest: null, p_note: null });
    assert.equal(r.status, 200, JSON.stringify(r.body));
  }
  const blocked = await spammer.rpc('create_lead', { p_name: 'Spam', p_phone: '0911000099', p_interest: null, p_note: null });
  assert.equal(blocked.status, 429);
  const real = await new Client().rpc('create_lead', { p_name: 'Khách thật', p_phone: '0933333333', p_interest: 'Massage', p_note: null });
  assert.equal(real.status, 200);
  const leads = await admin.select('leads', { select: 'id', count: 'exact', head: true });
  assert.equal(leads.body.count, 6);
});

test('trang chủ (server component) render được dữ liệu từ Postgres', async () => {
  const html = await (await fetch(BASE + '/')).text();
  assert.ok(html.includes('Massage Body'));
});
