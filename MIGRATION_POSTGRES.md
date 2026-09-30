# Chuyển SpaFlow từ Supabase sang PostgreSQL thuần

Tài liệu cho dev và người vận hành: kiến trúc mới, cách dựng môi trường, các bước chuyển dữ liệu, cutover và rollback.

## 1. Kiến trúc mới

```
Trình duyệt ──► Next.js (Node server)
                 ├─ /api/auth/*     đăng ký, đăng nhập email, SMS OTP, phiên (cookie httpOnly)
                 ├─ /api/db         truy vấn dữ liệu — kiểm quyền theo lib/server/policies.ts
                 ├─ /api/rpc/<fn>   gọi hàm nghiệp vụ trong DB (đặt lịch, slot, giá, đổi giờ...)
                 ├─ /api/settings, /api/reminders/send, /api/cron/cleanup
                 └─ Server Component (trang chủ) đọc DB trực tiếp
                         │
                         ▼
                 PostgreSQL (schema public + schema auth tự quản)
```

| Trước (Supabase) | Sau |
|---|---|
| supabase-js gọi thẳng PostgREST | `lib/supabase.ts` giữ nguyên cú pháp `supabase.from(...)`, `supabase.rpc(...)`, `supabase.auth.*` nhưng gọi API của chính web app |
| RLS policy trong DB | `lib/server/policies.ts`: allowlist bảng, cột, điều kiện dòng theo vai trò, danh sách RPC được phép |
| GoTrue (auth) | `lib/server/auth.ts` + `app/api/auth/*`; bảng `auth.users` giữ cấu trúc chính của Supabase |
| JWT → `auth.uid()` | Server đặt `app.user_id` cho mỗi transaction, `auth.uid()` đọc giá trị này |
| Edge Function nhắc lịch | `/api/reminders/send` gọi bằng cron |

Không đổi: toàn bộ bảng, ràng buộc (kể cả chống đặt trùng), trigger và 17 hàm nghiệp vụ trong DB.

## 2. Yêu cầu hạ tầng

- **Ứng dụng:** Node.js 18+ chạy `next start` (hoặc nền tảng hỗ trợ Next.js server). Không deploy dạng static được nữa vì có API route.
- **PostgreSQL 13+**, có extension `btree_gist` (là extension "trusted" nên user thường tạo được).
- **User DB** là chủ database, hoặc có quyền `CREATE` trên database. Cần quyền này để tạo schema `auth` và extension trong lần migrate đầu. Đã thử với user **không phải superuser**: chạy được.
- **Kết nối TLS** nếu nhà cung cấp yêu cầu: đặt `DATABASE_SSL=require`.
- **Reverse proxy** (nginx, Caddy, load balancer của nhà cung cấp) phải ghi `X-Forwarded-For`, để rate-limit theo IP thật. Đặt `TRUST_PROXY` bằng số proxy đứng trước app.

## 3. Cấu hình

Xem `.env.example`. Tối thiểu cần:
- `DATABASE_URL` và `DATABASE_SSL`
- `CRON_SECRET`
- `OTP_PEPPER`
- `SMS_PROVIDER` và các biến `SMS_*` đi kèm, nếu muốn bật đặt lịch bằng SMS OTP và nhắc lịch.

**Về SMS:** `SMS_PROVIDER=webhook` gửi `POST {to, text, from}` kèm `Authorization: Bearer SMS_API_KEY`. Với eSMS hoặc SpeedSMS, có hai cách:
- đặt một endpoint trung gian nhận định dạng trên, hoặc
- sửa hàm `sendViaWebhook()` trong `lib/server/sms.ts` theo đúng tài liệu API của nhà cung cấp.

## 4. Các bước chuyển đổi

### Bước A — Dựng DB mới (không ảnh hưởng hệ thống đang chạy)

```bash
npm ci
export DATABASE_URL=postgres://...          # DB mới
npm run db:migrate                          # tạo schema auth + public (các file trong db/migrations)
npm run db:status                           # kiểm tra: tất cả ✓
```

### Bước B — Diễn tập chuyển dữ liệu

Lấy chuỗi kết nối Supabase: Dashboard → **Connect** → **Session pooler**. Mật khẩu là *Database password*.

```bash
export SUPABASE_DB_URL='postgresql://postgres.<ref>:<pass>@aws-0-<region>.pooler.supabase.com:5432/postgres'
npm run db:import-supabase -- --dry-run     # kiểm tra cấu trúc 2 DB + số dòng, không ghi
npm run db:import-supabase                  # chép + đối chiếu checksum từng bảng → "✓ Dữ liệu khớp hoàn toàn"
```

Script làm những việc sau:
- Chép `auth.users`, giữ id và mật khẩu bcrypt. Khách đăng nhập bằng mật khẩu cũ.
- Chép 15 bảng public theo thứ tự khoá ngoại, trong **một transaction**. Lỗi giữa chừng thì không ghi gì.
- Không chép phiên đăng nhập (mọi người đăng nhập lại một lần) và `slot_holds` (giữ chỗ tạm 10 phút).
- Nếu Supabase có cột chưa có trong `db/migrations` (ví dụ ai đó từng sửa tay trên Dashboard), script dừng và báo tên cột.

Sau đó dựng một bản web **staging** trỏ vào DB mới và kiểm tra theo checklist ở mục 6.

### Bước C — Cutover (nên làm ngoài giờ mở cửa, khoảng 30 phút)

1. Báo lễ tân tạm ghi lịch ra giấy. Đặt trang web cũ ở chế độ bảo trì, hoặc tạm tắt trang `/booking`.
2. Chạy `npm run db:import-supabase -- --force` để chép lại bản mới nhất. Chỉ tiếp tục khi thấy "✓ Dữ liệu khớp hoàn toàn".
3. Deploy bản web mới với `DATABASE_URL` trỏ DB mới, rồi chuyển domain sang bản mới.
4. Kiểm tra nhanh: trang chủ hiện dịch vụ, admin đăng nhập được, đặt thử một lịch rồi huỷ.
5. Nhập lại các lịch đã ghi giấy trong lúc bảo trì.

### Bước D — Sau cutover

Đặt 2 cron job (cron của máy chủ hoặc của nền tảng hosting):

```bash
# Nhắc lịch: mỗi 15 phút, nhắc các lịch bắt đầu trong 24 giờ tới chưa được nhắc
*/15 * * * *  curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" "https://spaflow.vn/api/reminders/send?hours=24"
# Dọn phiên / OTP / giữ chỗ hết hạn: mỗi giờ
0 * * * *     curl -fsS -H "Authorization: Bearer $CRON_SECRET" "https://spaflow.vn/api/cron/cleanup"
```

Giữ project Supabase ở chế độ chỉ đọc khoảng 2 tuần rồi mới xoá.

### Rollback

Nếu gặp sự cố trong ngày đầu, chuyển domain về bản web cũ (Supabase). Mọi lịch phát sinh trên hệ thống mới cần nhập lại tay, vì script chỉ chép theo một chiều. Đây là lý do nên cutover ngoài giờ và kiểm tra kỹ ở Bước B.

## 5. Thay đổi hành vi cần biết

- **Đăng nhập lại:** mọi người phải đăng nhập lại một lần sau cutover. Mật khẩu vẫn giữ nguyên.
- **Tài khoản demo bị gỡ:** tài khoản seed và các nút "Tài khoản demo" đã bị xoá. Cấp quyền bằng SQL:
  ```sql
  update profiles set role = 'admin' where email = '...';
  update profiles set role = 'staff', staff_id = '<id nhân viên>' where email = '...';
  ```
- **Siết quyền so với RLS cũ:**
  - KTV chỉ đổi được `status` lịch của mình.
  - Admin qua API chỉ sửa được `status`, `notes` và `reminded_at` của lịch hẹn. Đổi giờ vẫn đi qua RPC đổi giờ.
  - Không ai xoá cứng lịch hẹn.
  - SĐT và email của KTV chỉ admin xem được.
- **Không còn giả thành công:** cài đặt ưu đãi lưu thật vào DB và báo lỗi thật. Nhắc lịch chỉ đánh dấu "đã nhắc" khi SMS gửi thành công. Form để lại SĐT báo lỗi kèm hotline thay vì giả thành công. Trang đặt lịch không tự sinh "slot giả".
- **Chống spam:** giới hạn theo IP cho form để lại SĐT (5 lần / 10 phút), báo giá hoặc dò mã quà (60 lần / 10 phút), đăng nhập (10 lần sai / 15 phút mỗi email), OTP (60 giây giữa hai lần gửi, 5 lần / giờ mỗi số, sai 5 lần thì mã bị huỷ).
- **Chưa có email:** app chưa gửi email xác nhận hay quên mật khẩu (bản Supabase cũ cũng đang bật tự xác nhận). Cần thêm SMTP nếu muốn làm.

## 6. Kiểm thử

```bash
# API end-to-end trên Postgres thật: 25 kịch bản (xác thực, phân quyền, đặt / đổi / huỷ lịch, OTP, voucher,
# đánh giá, cài đặt, nhắc lịch, rate-limit, chống SQL injection, CSRF)
ADMIN_DATABASE_URL=postgres://postgres@localhost:5432/postgres APP_DB_USER=<user thường> tests/api/run.sh

# Script chuyển dữ liệu: dựng DB giả lập Supabase → chuyển → đối chiếu checksum
ADMIN_DATABASE_URL=postgres://postgres@localhost:5432/postgres tests/import/run.sh
```

Bộ E2E trình duyệt cũ (`tests/e2e`, 72 kịch bản) chạy trên PostgREST nên đã được gỡ. Cần viết lại bằng Playwright trên stack mới; hiện bộ `tests/api` thay thế ở tầng API.

**Checklist thủ công trên staging:**
- Trang chủ, Dịch vụ, Ưu đãi hiện đúng dữ liệu.
- Đăng ký, đăng nhập, đăng xuất bằng email.
- Đăng nhập bằng mật khẩu **cũ** của một khách thật.
- Đặt lịch khi đã đăng nhập, và đặt lịch khách vãng lai qua OTP (cần SMS thật hoặc `SMS_TEST_OTP`).
- Đổi giờ và huỷ lịch ở trang Tài khoản.
- Admin: chuyển trạng thái lịch, phát thẻ quà, gói liệu trình, cài đặt ưu đãi, yêu cầu tư vấn, nhắc lịch, lịch làm việc.
- KTV: xem lịch hôm nay, Check-in → Hoàn thành.

## 7. Phát triển tiếp

- **Thêm cột hoặc bảng:** tạo `db/migrations/0006_*.sql`. Không sửa file cũ, vì script kiểm tra checksum. Sau đó khai báo quyền trong `lib/server/policies.ts`.
- **Hàm DB mới gọi từ client:** thêm vào `RPC_POLICIES` (tham số, yêu cầu đăng nhập, rate limit).
- **Hướng dài hạn:** thay dần các lời gọi `supabase.from(...)` ở client bằng API theo nghiệp vụ, ví dụ `/api/appointments/:id/status`. Làm vậy thì quy tắc nghiệp vụ nằm hết ở server và cổng `/api/db` thu hẹp dần.

## 8. Các vấn đề từ review chưa xử lý trong đợt này

Đợt chuyển đổi này không đổi quy tắc nghiệp vụ. Các mục sau vẫn còn và cần BA chốt trước khi sửa:
- **P0-2:** khách vẫn tự đổi được SĐT chưa xác minh, và lễ tân đặt hộ vẫn ưu tiên tài khoản đã đăng ký khi khớp SĐT.
- **P1-2:** chưa có vai trò Lễ tân.
- **P1-3:** trường `customers.notes` vẫn dùng chung cho khách và admin.
- **P1-5:** quy tắc ưu đãi lần đầu và voucher quay lại chưa đổi.
- **P1-6:** SĐT chưa được chuẩn hoá thống nhất.
- **P1-7:** doanh thu và thanh toán chưa đổi.
- **P2:** giới hạn đặt trước (UI cho 30 ngày, DB cho 60 ngày) và buffer 15 phút chưa được đồng bộ.
