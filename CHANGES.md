# Lumière Spa — Thay đổi sau review (25/09/2026)

## ⚠️ Cần làm khi deploy

1. Chạy 3 migration mới trên Supabase theo thứ tự (SQL Editor → paste → Run, hoặc `supabase db push`):
   `20260925000000_security_and_booking_rpc.sql` → `20260925010000_hide_team_accounts_from_customers.sql` → `20260925020000_customer_self_cancel.sql`.
   Cả ba đều chạy lại được nhiều lần.
   Sửa địa chỉ, SĐT và giờ mở cửa thật trong `lib/site-config.ts`.
2. Deploy code mới **cùng lúc** với migration: code mới cần 2 RPC `get_available_slots` và `book_appointment`,
   và code cũ sẽ không ghi được dữ liệu sau khi RLS được siết.
3. Gán quyền như cũ bằng SQL:
   `update profiles set role = 'admin' where email = '...';`
   `update profiles set role = 'staff', staff_id = '<id>' where email = '...';`

## Bảo mật (P0)

| Vấn đề | Đã sửa |
|---|---|
| User tự đổi `profiles.role` thành admin | Bỏ hết policy INSERT/UPDATE/DELETE trên `profiles`, chỉ còn SELECT |
| Anon có full CRUD mọi bảng | RLS theo role: catalog ai cũng đọc được, chỉ admin ghi; khách chỉ thấy dữ liệu của mình; staff chỉ thấy lịch của mình |
| `/admin`, `/staff` không có kiểm tra quyền | `RoleGate` dùng chung cho `/admin`, `/staff`, `/account`, `/booking` |
| Client tự gửi `price`, khách bị ghi đè theo SĐT, race khi đặt | RPC `book_appointment`: giá lấy từ DB, khách xác định bằng `auth.uid()`, dựa vào exclusion constraint để chống đặt trùng |
| Open redirect `?redirect=//evil.com` | `safeRedirect()` |
| Log trạng thái ghi được từ client | Trigger `SECURITY DEFINER`, `changed_by` = email người thao tác |

## Logic

- Lệch 1 ngày ở UTC+7 (parser, trang Staff, trang Lịch làm việc): thêm `lib/date.ts` (`toDateKey`, `parseDateKey`).
- "Bất kỳ nhân viên": trước đây chỉ kiểm tra người đầu tiên và bỏ qua ca làm/ngày nghỉ. Nay RPC chọn nhân viên rảnh, ưu tiên người ít lịch nhất trong ngày.
- Slot tính trong DB theo giờ Asia/Ho_Chi_Minh; bỏ vòng N+1 (3 query × số nhân viên).
- Parser: so khớp nguyên từ ("mặt" không còn khớp "matxa"; "thứ năm" không bị hiểu là ưu tiên nhân viên nam; "tôi" không bị hiểu là "tối"). Hỗ trợ "3 giờ rưỡi". "chủ nhật" không còn bị map sang thứ 7. Bỏ delay giả 400ms.
- Giờ lấy từ câu nói không còn trống: xoá giờ đã chọn, quay lại bước chọn giờ và gợi ý giờ gần nhất.
- Signup: bỏ insert `customers` từ client, trigger tạo luôn. Mật khẩu tối thiểu thống nhất 8 ký tự; kiểm tra SĐT.
- Admin/lễ tân đặt hộ khách: RPC nhận diện khách theo SĐT (chỉ áp dụng cho role admin/staff).
- Admin không còn xoá cứng lịch hẹn; thay bằng "Hủy lịch hẹn" có hộp xác nhận.
- Màn thành công hiện đúng nhân viên được xếp; bỏ câu "đã gửi thông tin" (thực tế không có email nào được gửi).
- Mobile: bấm "Đăng nhập" trong menu trước đây làm dialog biến mất ngay; đã sửa.
- Tailwind không quét thư mục `lib/`, nên màu trạng thái trong `lib/types.ts` có thể không được sinh CSS; đã thêm vào `content`.

## Hiệu năng & dọn code

- Trang chủ chuyển sang Server Component (tốt cho SEO, không còn chớp khi tải), revalidate 5 phút.
- Ảnh hero: 1.7 MB → 92 KB.
- `recharts` được lazy-load, chỉ tải ở dashboard.
- Danh sách lịch hẹn admin: lọc theo khoảng thời gian, giới hạn 500 bản ghi.
- Xoá 39 file `components/ui` không dùng, `hooks/use-toast.ts` và 32 package không dùng.
- Bật lại ESLint khi build; thêm security headers; báo lỗi rõ khi thiếu biến môi trường; thêm `.env.example`.
- `app/booking/page.tsx`: 1131 → 502 dòng. Tách `AiQuickBook` và `BookingSummary`.

## Giao diện thống nhất

Component dùng chung: `Logo`, `SiteHeader`, `AuthCard` + `LoginForm` (dùng chung cho trang sign-in và dialog), `IconInput`, `RoleGate`, `PageLoader`, `StatusBadge`.

- Toàn bộ app theo ngôn ngữ thiết kế của trang chủ: nền cream, tiêu đề Quicksand (`.page-title`), eyebrow màu vàng, logo `Flower2` trong vòng tròn viền.
- `.btn-primary`/`.btn-outline`/`.btn-cream` trùng khớp với `<Button size="lg">` (một độ bo, cao 48px). Variant `outline`/`ghost` không còn hover màu vàng.
- Booking: stepper bấm được + **tóm tắt dạng sticky** bên phải (trên mobile nằm dưới form). Bỏ bước "Xác nhận" riêng. "Đặt nhanh bằng câu nói" thu gọn mặc định.
- `checked_in` có màu riêng (tím nhạt), không còn trùng `confirmed`.
- Sidebar admin dùng logo chung, thêm nút Đăng xuất, sửa `h-4.5` (class không tồn tại).

## Vòng kiểm thử 2 — E2E 42 kịch bản (`tests/e2e/`)

Chạy trên Postgres thật (RLS) + PostgREST, kết quả **42/42 PASS**. Các lỗi tìm ra và đã sửa:

- Bấm dịch vụ khi chưa đăng nhập: sau khi đăng nhập bị mất `?service=`. `RoleGate` chuyển sang dùng `useSearchParams`.
- Lịch tuần: 2 lịch cùng giờ (khác nhân viên) bị vẽ đè nên chỉ thấy 1; lịch đã hủy đè lên lịch mới ở cùng khung giờ. Nay lịch trùng giờ hiển thị cạnh nhau và lịch đã hủy bị ẩn.
- Tài khoản admin/staff xuất hiện trong danh sách Khách hàng. Migration mới tự dọn khi đổi role.
- Lịch làm việc: nhập giờ sai sẽ lưu thẳng xuống DB rồi báo lỗi chung chung. Nay kiểm tra trước khi lưu và báo rõ lý do.
- Xóa dịch vụ/nhân viên đã có lịch hẹn: nay báo rõ nguyên nhân và gợi ý cách ẩn. Form thêm/sửa không còn tự đóng khi lưu lỗi.
- Mobile: tràn ngang ở trang Lịch làm việc (522px), Chi tiết khách (406px) và Staff (392px). Nay 0 trang bị tràn ở 390px.

## Vòng 3 — Chỉnh UI/UX theo đề xuất (E2E: **49/49 PASS**, 0 trang tràn ngang ở 390px)

**Ưu tiên 1**
- Doanh thu tách **Đã thu** (chỉ tính lịch hoàn thành) và **Dự kiến**, áp dụng ở dashboard, trang nhân viên và khách hàng. Biểu đồ dạng cột chồng; trục ghi "1,5 tr".
- Nút trạng thái dùng động từ (Xác nhận / Check-in / Bắt đầu phục vụ / Hoàn thành). Hủy và "Khách không đến" phải qua hộp xác nhận. "Khách không đến" chỉ hiện sau giờ hẹn. Component dùng chung `StatusActions`.
- Danh mục dịch vụ: danh sách cố định với nhãn tiếng Việt; dữ liệu cũ (`skin`, `Skincare`, `massage`…) được tự quy đổi.
- Dịch vụ và nhân viên có công tắc **Ẩn/Hiện** (Đang nhận lịch) ngay trên thẻ.
- Trang chủ: bỏ ghi chú nội bộ, sửa câu "chờ xác nhận" cho đúng thực tế. Thông tin liên hệ chuyển vào `lib/site-config.ts`.

**Ưu tiên 2 (mobile)**
- Một component dòng lịch hẹn chung (`AppointmentRow`): trên mobile tên dịch vụ không còn bị cắt, trạng thái và giá xuống dòng riêng.
- Lịch: mobile mặc định mở chế độ Ngày; tuần bắt đầu từ Thứ 2; lịch ngắn hiện 1 dòng "10:00 · Tên khách".
- Admin mobile có thanh điều hướng dưới đáy và nút "Đặt lịch" trên header.
- Trang Lịch hẹn: bộ lọc trạng thái chuyển thành dropdown.
- Trang chủ mobile: thẻ dịch vụ vuốt ngang.
- Đặt lịch: hiện "Bước x/4 · tên bước" và gợi ý lý do khi nút Tiếp tục bị khóa.

**Ưu tiên 3**
- Tiêu đề khối dùng chung `.block-title` (serif); một kiểu card thống kê `StatCard`; bo góc thống nhất `rounded-2xl`.
- Dashboard bỏ khối "Tổng quan hệ thống", thay bằng một dòng dưới tiêu đề.
- Chi tiết lịch hẹn: nút Gọi / Email khách, link sang hồ sơ khách, lịch sử ghi người thao tác.
- Lịch làm việc: chọn giờ 24h bước 30 phút, nút "Áp dụng cả tuần", có phản hồi "Đã lưu", tự điền giờ kết thúc nghỉ trưa.
- Trang Tài khoản: bỏ SĐT hiển thị trùng; lịch sắp tới xếp từ gần đến xa; **khách tự hủy lịch** trước 2 tiếng (RPC `cancel_my_appointment`).
- Trạng thái "Đang phục vụ" đổi sang xanh ngọc, dễ đọc hơn. Thêm `aria-label` cho các nút chỉ có icon.
- Danh sách khách hàng: "Tổng chi tiêu" và "Lần cuối" chỉ tính lượt đã hoàn thành.

## Vòng 4 — Header trang chủ (E2E **50/50 PASS**)

Trước đây, khi đã đăng nhập, header hiện 3–4 link rời ("Quản trị", "Tài khoản", "Đăng xuất") chen giữa menu và nút CTA. Header bị dài ra, đè lên mục "Liên hệ", và nhảy layout khi trạng thái đăng nhập vừa tải xong.

- Bố cục giữ nguyên cho mọi trạng thái; chỉ ô bên phải thay đổi:
  - Khách: `[Đăng nhập]  [Đặt lịch ngay →]`
  - Đã đăng nhập: `[avatar + tên ▾]  [Đặt lịch ngay →]`. Bấm avatar mở menu gồm tên, email, nhãn vai trò; "Trang quản trị" (admin) hoặc "Lịch làm việc của tôi" (nhân viên); "Lịch hẹn & tài khoản"; và "Đăng xuất" tách riêng, màu đỏ. Menu đóng khi bấm ra ngoài hoặc nhấn Esc.
- Trong lúc đang tải trạng thái đăng nhập, ô bên phải hiện khung giữ chỗ nên header không bị nhảy.
- Mobile: nút "Đặt lịch" luôn hiện trên header. Menu mở ra toàn màn hình, gồm các mục điều hướng, khối tài khoản (hoặc Đăng nhập / Đăng ký) và nút CTA. Menu tự đóng khi chuyển trang.
- Sửa lỗi menu mobile bị ép chỉ còn cao bằng header (do `backdrop-blur` của header).

## Vòng 5 — Bảng màu Đất nung & kem (E2E **50/50 PASS**)

| Vai trò | Màu | Token |
|---|---|---|
| Chính (nút, link, tiêu đề nhấn) | `#9A4F38` đất nung | `--brand` / `--primary` |
| Hover | `#B0634A` | `--brand-light` |
| Nền tối (khối nổi bật, footer) | `#3E2620` / `#35211C` nâu espresso | `--deep`, `--deep-footer` |
| Nhấn (eyebrow, số thứ tự) | `#C49A62` vàng cát | `--gold` |
| Nền trang / header | `#F8F2EA` / `#FFFBF6` kem | `--cream`, `--cream-soft` |
| Nút kem trên nền tối | `#F6E3CF` | `--cream-strong` |
| Chữ / chữ phụ | `#33241F` / `#7A675F` | `--ink`, `--muted-ink` |

- Đổi tên biến `--green` thành `--brand` cho đúng nghĩa. Mọi màu đều lấy từ token, không còn mã màu viết cứng (trừ favicon SVG, đã đổi sang đất nung).
- Chỉnh màu trạng thái cho hợp tông đất và không lẫn với màu thương hiệu: Hoàn thành xanh ô liu, Chờ xác nhận hổ phách, Đã xác nhận xanh đá; Đang phục vụ giữ xanh ngọc.
- Độ tương phản đạt WCAG AA: chữ trắng trên nút 6.0:1, chữ phụ 5.2:1, badge "Chờ xác nhận" 5.2:1.
- Dark mode đổi sang tông nâu cho đồng bộ.
- Sửa kèm: vòng sáng quanh bước đang chọn ở trang đặt lịch hiện màu xanh dương mặc định, do `ring-primary/15` không có trong Tailwind 3.3. Đã đổi sang `/20`.

## Vòng 6 — Tăng trưởng: 9 tính năng thu hút khách (E2E **61/61 PASS**, 0 trang tràn ngang ở 390px)

**Việc cần làm khi deploy**
1. Chạy migration `supabase/migrations/20260926000000_growth_features.sql`.
2. Đặt biến môi trường `NEXT_PUBLIC_GA_ID` (G-XXXX) và `NEXT_PUBLIC_SITE_URL` (domain thật). Xem `.env.example`.
3. Sửa số điện thoại, link Zalo, địa chỉ, giờ mở cửa và mẫu tin nhắc lịch trong `lib/site-config.ts`.
4. (Tùy chọn) Nhắc lịch tự động qua ZNS/SMS: deploy `supabase/functions/send-reminders`, đặt secrets `REMINDER_PROVIDER`, `ZNS_ACCESS_TOKEN`/`ZNS_TEMPLATE_ID` hoặc `SMS_API_URL`/`SMS_API_KEY`/`SMS_BRANDNAME`, rồi hẹn lịch chạy mỗi 15 phút.

| # | Tính năng | Khách thấy | Admin quản lý |
|---|---|---|---|
| 1 | Ưu đãi lần đầu | Dải ưu đãi trên header (tắt được), dòng ưu đãi ở hero, giá giảm trong tóm tắt đặt lịch | `/admin/promotions`: bật/tắt, đặt % (0–50). DB tự áp dụng khi tài khoản và SĐT chưa từng đặt; lễ tân đặt hộ không được giảm |
| 2 | Đánh giá thật | Mục "Khách hàng nói gì" + điểm sao ở hero, chỉ hiện khi đã có đánh giá; chỉ hiện tên, không hiện họ | Khách đánh giá ở `/account` sau khi lịch "Hoàn thành". `/admin/reviews`: lọc ≤ 3 sao, ẩn/hiện |
| 3 | Đội ngũ | Thẻ kỹ thuật viên (năm KN, thế mạnh, giới thiệu) + nút "Đặt lịch với …" chọn sẵn người | `/admin/staff`: thêm các trường hồ sơ |
| 4 | Combo / gói | Dịch vụ combo có danh sách "Bao gồm" và giá gạch; thẻ gói nhiều buổi hiện % tiết kiệm | `/admin/services` (bao gồm, giá gốc); `/admin/promotions` (gói) |
| 5 | Thẻ quà tặng | Nhập mã ở bước "Thông tin" → trừ tiền hoặc buổi; hủy lịch thì hoàn lại vào thẻ | `/admin/promotions`: phát hành thẻ mệnh giá hoặc thẻ theo buổi, sao chép mã, khóa thẻ |
| 6 | Để lại SĐT | Form ở mục Liên hệ và popup "Chưa biết chọn gì?" / gói / quà tặng (không cần đăng nhập, có chống spam) | `/admin/leads`: badge số yêu cầu mới trên menu, Gọi / Zalo / "Đặt lịch hộ" điền sẵn thông tin |
| 7 | Nhắc lịch | — | Dashboard có hàng đợi "Cần nhắc lịch" (hôm nay và ngày mai): Zalo (tự sao chép tin), SMS, Gọi, "Đã nhắc". Trang chi tiết lịch có nút "Nhắc lịch qua Zalo" |
| 8 | SEO địa phương | JSON-LD `DaySpa` (địa chỉ, giờ, bảng giá, điểm đánh giá), metadata/OG, `robots.txt`, `sitemap.xml`, trạng thái "Đang mở cửa", thanh Gọi / Zalo / Đặt lịch cố định trên mobile | — |
| 9 | Đo lường phễu | GA4 (chỉ nạp khi có `NEXT_PUBLIC_GA_ID`). Sự kiện: `view_services → select_service → select_staff → select_slot → begin_checkout → booking_complete`, cùng `lead_submit`, `click_call`, `click_zalo`, `review_submit`, `sign_up`, `login` | Xem trong GA4 → Explore → Funnel |

Doanh thu: `price` = giá sau ưu đãi lần đầu; `gift_amount` = phần đã trả trước bằng thẻ hoặc gói (khách trả tại quầy `price − gift_amount`).

## Vòng 7 — Soát lại toàn bộ luồng sau khi thêm tính năng tăng trưởng (E2E **64/64 PASS**, 0 trang tràn ngang)

**Deploy:** chạy thêm migration `supabase/migrations/20260927000000_package_pricing.sql` (sau migration 20260926000000).

| Mức | Vấn đề tìm thấy | Đã sửa |
|---|---|---|
| Cao | Khách dùng thẻ gói (5 buổi = 1,9 tr) thì mỗi buổi vẫn ghi doanh thu theo giá lẻ 450k, nên báo cáo **thổi phồng doanh thu** 70k mỗi buổi | Thẻ bán từ gói tự lưu `session_value` = giá gói / số buổi. Lịch hẹn ghi `price` = 380k, phần chênh ghi là "Giá gói liệu trình" (`discount_reason = 'package'`), khách trả 0đ tại quầy |
| Cao | Khi dùng thẻ gói, màn đặt lịch hiện "Bạn được giảm 0% cho lần đặt online đầu tiên" | Nhãn giảm giá tách theo lý do: "Ưu đãi lần đầu (−10%)" hoặc "Giá gói liệu trình"; dòng thẻ ghi "Trừ 1 buổi trong thẻ" |
| TB | Trang Tài khoản và trang Nhân viên hiện giá dịch vụ, không trừ phần đã trả bằng thẻ, nên khách hoặc kỹ thuật viên hiểu nhầm số tiền phải thu | Hiện **số tiền còn phải trả tại spa** (`price − gift_amount`). Trang admin vẫn hiện doanh thu |
| TB | Khách cũ đăng nhập vẫn thấy dải "Giảm 10% lần đầu" nhưng không được giảm | Dải ưu đãi ẩn với khách đã có lịch và với tài khoản admin/nhân viên |
| TB | Lễ tân đặt hộ từ yêu cầu tư vấn: màn thành công ghi "Cảm ơn bạn!" như gửi cho khách | Ghi "Đã giữ chỗ cho {tên khách}…" và có nút "Về yêu cầu tư vấn" |
| TB | Admin trên điện thoại không thấy có yêu cầu tư vấn mới (số đếm nằm trong menu "Thêm") | Chấm đỏ trên nút "Thêm"; số đếm tự làm mới mỗi phút |
| Thấp | Gói liệu trình của dịch vụ đã ẩn vẫn hiện trên trang chủ | Chỉ hiện gói có dịch vụ đang bật |
| Thấp | Vào từ "Đặt lịch với Lan" nhưng chọn dịch vụ Lan không làm thì không có thông báo | Thẻ dịch vụ ghi rõ "Lan không làm dịch vụ này — spa sẽ xếp người khác" |
| Thấp | Sự kiện GA4 `booking_complete` gửi số tiền trả tại quầy (0đ khi dùng thẻ) | `value` = doanh thu buổi đó; thêm `pay_at_spa` |

Test mới: A22 (bán gói → đặt bằng thẻ → doanh thu 380k → hủy thì hoàn buổi), A23 (yêu cầu tư vấn → đặt lịch hộ), C20 (khách cũ không thấy dải ưu đãi).

## Vòng 8 — 7 thay đổi logic để tăng khách đặt lịch (E2E **72/72 PASS**, 0 trang tràn ngang ở 390px)

**Deploy**
1. Chạy migration `supabase/migrations/20260928000000_conversion_logic.sql` (sau 20260927000000).
2. **Bật đăng nhập bằng SĐT:** Supabase Dashboard → Authentication → Providers → **Phone** → Enable. Chọn nhà cung cấp SMS: Twilio / MessageBird / Vonage, hoặc nhà cung cấp Việt Nam (eSMS, SpeedSMS…) qua **Auth Hooks → Send SMS hook**. Nên đăng ký brandname để tin OTP không bị chặn. Có thể khai báo "Test phone numbers" để thử mà không tốn SMS.
3. (Tùy chọn) `NEXT_PUBLIC_GOOGLE_REVIEW_URL` = link "Viết đánh giá" trên Google Business Profile, để trang cảm ơn mời khách đánh giá trên Google Maps.
4. Sửa mẫu tin xin đánh giá trong `lib/site-config.ts` (`reviewTemplate`, `reviewGiftTemplate`).

| # | Logic | Cách hoạt động |
|---|---|---|
| 1 | **Đặt lịch không cần tài khoản** | Khách vãng lai chọn dịch vụ, người làm và giờ. Ở bước "Thông tin", nhập tên + SĐT → "Gửi mã xác minh SMS" → nhập mã 6 số → lịch được tạo ngay, tài khoản tự tạo. Khách từng được lễ tân đặt hộ bằng SĐT này sẽ **nhận lại lịch sử** sau khi xác minh. Trang đăng nhập có tab "Số điện thoại". Ưu đãi lần đầu chỉ tính **sau** khi xác minh, nên không ai dò được SĐT nào là khách cũ. |
| 2 | **Giữ chỗ 10 phút** | Khi sang bước "Thông tin", giờ đã chọn được giữ riêng cho tab đó ("Đang giữ chỗ cho bạn đến 16:42"); người khác không thấy giờ này. Mỗi IP giữ tối đa 3 chỗ, toàn hệ thống 200 chỗ. Đặt xong thì tự nhả. |
| 3 | **Tự đổi giờ** | Tài khoản → "Đổi giờ": chọn ngày/giờ mới, giữ người làm hoặc "Bất kỳ". Giữ nguyên mã, giá, ưu đãi và thẻ. Khách được đổi trước giờ hẹn 2 tiếng, tối đa 2 lần. Admin đổi được không giới hạn ở trang chi tiết lịch. Lịch sử ghi "Đổi giờ: 10:00 25/09 → 14:00 26/09". |
| 4 | **Quà cho lần quay lại** | Lịch chuyển "Hoàn thành" thì khách tự nhận mã **giảm 10%, hạn 30 ngày** (chỉnh được trong Ưu đãi & quà tặng → Giữ chân khách). Mã gắn với từng khách, mỗi khách giữ tối đa 1 mã chưa dùng. Nếu cùng áp dụng được ưu đãi lần đầu thì chỉ tính mức lớn hơn. Mã hiện ở Tài khoản ("Đặt lịch dùng mã"), có nút gợi ý ngay ở bước "Thông tin", và được gửi kèm tin xin đánh giá. Hủy lịch thì mã được hoàn lại. |
| 5 | **Xin đánh giá tự động** | Dashboard có hàng đợi "Xin đánh giá & gửi quà" cho các lịch đã hoàn thành trong 3 ngày qua. Bấm Zalo/SMS để gửi tin có **link đánh giá không cần đăng nhập** (`/review/<mã>`) kèm mã quà. Trang cảm ơn mời **mọi khách** chia sẻ trên Google Maps; không lọc theo số sao vì Google cấm. |
| 6 | **Khách hay bỏ hẹn** | Khách đã "Không đến" từ 2 lần trở lên (chỉnh được) tự đặt online thì lịch vào trạng thái "Chờ xác nhận"; màn hình báo "Spa sẽ gọi cho bạn". Admin thấy cảnh báo "Khách này đã bỏ hẹn N lần" ở chi tiết lịch và nhãn "Bỏ hẹn N lần" ở hồ sơ khách. |
| 7 | **Ưu đãi lần đầu khi lễ tân đặt hộ** | Ô "Áp dụng ưu đãi lần đầu" ở bước Thông tin; hệ thống vẫn tự kiểm tra SĐT chưa từng đặt. |

Test mới: G9 (khách vãng lai đặt + OTP), G10 (giữ chỗ), G11 (đăng nhập bằng SĐT), C21 (đổi giờ), C22 (mã quay lại), C23 (bỏ hẹn → chờ xác nhận), A24 (xin đánh giá qua link), A25 (ưu đãi lần đầu cho lễ tân).

## Vòng 9 — Chuyển từ Supabase Cloud sang PostgreSQL tự host (`deploy/self-host/`)

Hướng làm: chạy Supabase tự host bản tối giản (Postgres 17 + GoTrue + PostgREST + nginx). Web app không sửa code, chỉ đổi `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Hướng dẫn từng bước ở `deploy/self-host/README.md`.

- `docker-compose.yml`, `nginx/default.conf.template`: 4 container; cổng `/auth/v1`, `/rest/v1` tương thích supabase-js; CORS chỉ mở cho `SITE_URL`.
- `scripts/gen-keys.mjs`: sinh `JWT_SECRET`, `ANON_KEY`, `SERVICE_ROLE_KEY` và mật khẩu DB.
- `migrate/migrate.sh`:
  - `check`: so cấu trúc 2 DB, báo thay đổi làm tay trên Dashboard chưa có trong migration.
  - `backup`: pg_dump bản sao lưu.
  - `schema`: chạy `supabase/migrations`.
  - `data`: chép `auth.users`, `auth.identities` và mọi bảng public; tạm tắt trigger/khóa ngoại để không sinh dữ liệu phụ; tự bỏ qua cột khác nhau giữa 2 phiên bản GoTrue; đặt lại sequence. Chạy lại bao nhiêu lần cũng được.
  - `verify`: so số dòng và checksum nội dung từng bảng.
- `tests/migration/run_test.sh`: chuyển thử giữa 2 DB mô phỏng rồi gọi API qua PostgREST và nginx. Tất cả đều khớp; RLS, đặt lịch và trigger tạo khách vẫn chạy trên DB mới.

## Chưa làm (đề xuất tiếp)

- Cột `staff.phone/email` đang public để trang booking đọc tên nhân viên. Nên tách view `staff_public`.
- Trang Khách hàng (admin) vẫn tải toàn bộ lịch hẹn để tính thống kê. Khi dữ liệu lớn, nên chuyển sang view/RPC tổng hợp.
- Chặn chuyển trạng thái sai luồng (STATUS_FLOW) ở DB (UI đã chặn).
- Đặt cọc online cho khách hay bỏ hẹn (hiện tại: chuyển sang "Chờ xác nhận" để lễ tân gọi). Cần cổng thanh toán.
- Thanh toán online khi mua thẻ quà tặng (VNPay/MoMo). Hiện tại admin phát hành mã sau khi khách trả tiền tại quầy.
- Mã quà tặng 8 ký tự (khoảng 4 tỷ tổ hợp), chưa giới hạn số lần nhập sai. Nếu phát hành nhiều thẻ giá trị cao, nên thêm giới hạn này.
- Gửi thông báo yêu cầu tư vấn mới qua Zalo OA / Telegram cho quản lý (hiện tại: badge trong admin).

## Vòng 10 — Bỏ Supabase, chạy trên PostgreSQL thuần + backend Next.js (30/09/2026)

Hướng dẫn đầy đủ (hạ tầng, chuyển dữ liệu, cutover, rollback): **`MIGRATION_POSTGRES.md`**.

- DB: `db/migrations/` (auth tự quản + schema ứng dụng sinh từ 9 migration Supabase, bỏ RLS), chạy bằng `npm run db:migrate`. Đã thử với user DB không phải superuser.
- Quyền truy cập chuyển từ RLS lên API (`lib/server/policies.ts`); `lib/supabase.ts` giữ nguyên cú pháp cũ nên các trang không phải sửa.
- Xác thực tự quản: email + mật khẩu (giữ mật khẩu cũ khi chuyển), SMS OTP, phiên bằng cookie httpOnly, rate-limit, chặn CSRF theo Origin.
- `npm run db:import-supabase`: chép auth.users + 15 bảng trong 1 transaction, đối chiếu checksum từng bảng.
- Sửa kèm các lỗi P0 nằm trên đường chuyển đổi: gỡ tài khoản seed/nút demo; `/api/settings` và `/api/reminders/send` kiểm quyền và không còn báo thành công giả; bỏ slot giả + insert trực tiếp ở trang đặt lịch; bỏ fallback localStorage của form để lại SĐT; chống spam form lead theo IP (migration 0004).
- Gỡ: `supabase/functions`, `deploy/self-host`, `tests/e2e` (PostgREST), file dump dữ liệu, `cookies.txt`. Migration Supabase cũ lưu ở `db/legacy-supabase/` để tham khảo.
- Test mới: `tests/api/run.sh` (25 kịch bản API, **25/25 PASS**), `tests/import/run.sh` (chuyển dữ liệu, checksum khớp 16/16 bảng).
