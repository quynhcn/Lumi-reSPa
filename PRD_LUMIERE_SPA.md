# TÀI LIỆU YÊU CẦU SẢN PHẨM (PRODUCT REQUIREMENTS DOCUMENT - PRD)

**Dự án:** Nền tảng Đặt lịch Trải nghiệm & Quản trị Vận hành Spa — **Lumière Spa**    
**Phiên bản tài liệu:** v2.0   
**Ngày phát hành:** 26/09/2026  
**Tác giả:** Cao Như Quỳnh
**Trạng thái thẩm định:** Đã phê duyệt (Approved for Implementation & Acceptance)

---

## 1. TỔNG QUAN DỰ ÁN & BÀI TOÁN KINH DOANH (PROJECT OVERVIEW & PROBLEM STATEMENT)

### 1.1. Bối cảnh dự án
**Lumière Spa** định vị là chuỗi spa & trị liệu dưỡng sinh phong cách boutique cao cấp. Lấy cảm hứng từ triết lý "Ánh sáng thuần khiết" (Lumière) kết hợp y học cổ truyền và dược thảo hữu cơ Việt Nam, Lumière Spa mang lại "Một nhịp nghỉ vừa vặn" cho khách hàng hiện đại thông qua các dịch vụ: Massage trị liệu bấm huyệt, Chăm sóc da chuyên sâu, Gội đầu dưỡng sinh thảo dược và Combo phục hồi sức khỏe.

### 1.2. Bài toán kinh doanh cần giải quyết
Trước khi chuẩn hóa nền tảng số, quy trình vận hành gặp các điểm nghẽn nghiêm trọng:
1. **Thất thoát chuyển đổi đặt lịch (High Drop-off Rate)**: Khách hàng phải nhắn tin qua Zalo/Fanpage hoặc gọi điện; thời gian lễ tân phản hồi từ 15–30 phút khiến hơn 35% khách hàng bỏ sang đối thủ.
2. **Xung đột lịch & Lãng phí công suất KTV (Under-utilized Staff Capacity)**: Khi khách hàng chỉ định một KTV cụ thể nhưng KTV đó đã kín lịch, hệ thống cũ không tự động gợi ý KTV khác còn trống cùng khung giờ, làm mất cơ hội phục vụ khách ngay tại thời điểm có nhu cầu cao nhất.
3. **Tỷ lệ khách vắng mặt (No-Show Rate) cao**: Lễ tân gửi tin nhắn nhắc lịch thủ công rải rác từng người, dễ bỏ sót các lịch đặt trước nhiều ngày hoặc gửi muộn, gây trống giường và lãng phí thời gian của kỹ thuật viên.
---

## 2. MỤC TIÊU SẢN PHẨM & CHỈ SỐ THÀNH CÔNG (GOALS & METRICS)

### 2.1. Mục tiêu sản phẩm (Product Goals)
- **Tự phục vụ 100% (Zero-friction Self-Service Booking)**: Cho phép khách hàng tìm kiếm, chọn KTV yêu thích, kiểm tra giờ trống theo thời gian thực và nhận mã đặt lịch trong dưới 2 phút mà không cần nhân viên hỗ trợ.
- **Tối ưu hóa năng lực phục vụ (Staff Utilization Optimization)**: Đạt tỷ lệ lấp đầy ca làm việc của kỹ thuật viên thông qua tính năng gợi ý KTV thay thế thông minh (Alternative Therapist Suggestion).
- **Tự động hóa vận hành nhắc hẹn (Automated Operations)**: Tự động quét hàng đợi và gửi thông báo nhắc lịch hẹn qua Zalo/SMS trước giờ phục vụ.
- **Đồng bộ hóa nhận diện thương hiệu số**: Trải nghiệm thẩm mỹ cao cấp, font chữ **Quicksand** đồng nhất, phân định vai trò rành mạch giữa các trang, tương thích di động hoàn hảo (Mobile-First).

### 2.2. Chỉ số thành công đo lường được (Metrics & KPIs)

| Phân loại chỉ số | Tên chỉ số | Hiện trạng (Baseline) | Mục tiêu MVP (Target) | Phương pháp đo lường |
| :--- | :--- | :--- | :--- | :--- |
| **Chuyển đổi** | Tỷ lệ hoàn thành đặt lịch (Booking Completion Rate) | ~38% (qua kênh chat) | $\ge 65\%$ lượt bắt đầu đặt lịch | GA4 Funnel tracking bước 1 đến 4 |
| **Tối ưu ca** | Tỷ lệ chọn KTV gợi ý thay thế khi KTV chính kín lịch | 0% (khách thường hủy) | $\ge 30\%$ | Tỷ lệ click vào nút "Chọn [KTV B] cùng giờ" |
| **Vận hành** | Tỷ lệ khách không đến (No-Show Rate) | ~20 - 25% | $\le 8\%$ | Thống kê lịch hẹn có `status = no_show` |
| **Tự động hóa** | Tỷ lệ lịch hẹn được gửi nhắc lịch đúng hạn | ~40% (gửi tay sót) | $100\%$ lịch hẹn trong ngày/ngày mai | Trường `reminded_at` khác rỗng trong DB |
| **Hiệu năng** | Tốc độ tải trang khách hàng (LCP) | ~3.2s | $\le 1.8s$ trên 4G | Google PageSpeed / Lighthouse |

---

## 3. CHÂN DUNG NGƯỜI DÙNG MỤC TIÊU (USER PERSONAS)

| Nhóm người dùng | Đại diện (Persona) | Mục tiêu chính | Nỗi đau hiện tại (Pain Points) |
| :--- | :--- | :--- | :--- |
| **Khách hàng cá nhân (End Customer)** | Chị Lan Chi (32 tuổi, NV văn phòng bận rộn) | Đặt lịch nhanh giờ trưa/cuối tuần, xem giá rõ ràng, chọn đúng KTV quen, có thể tự đổi lịch. | Ngại gọi điện hỏi giá, ghét bị ép mua thẻ/gói, bực mình khi KTV quen kín lịch mà không biết ai làm thay được. |
| **Lễ tân / Quản lý (Front Desk / Manager)** | Bạn Minh Anh (26 tuổi, Lễ tân trưởng) | Bao quát lịch hẹn theo ngày/tuần, quản lý phòng/giường, không bị sót việc nhắc khách, đổi trạng thái nhanh. | Mất nhiều thời gian nhắn tin nhắc lịch từng người; ghi chép sổ sách dễ trùng lịch khi khách gọi dồn dập. |
| **Kỹ thuật viên (Therapist / Staff)** | Bạn Thu Hà (28 tuổi, KTV 5 năm kinh nghiệm) | Xem ca làm việc cá nhân trong ngày, biết khách thích lực mạnh/nhẹ, check-in và hoàn thành buổi làm. | Không biết trước lịch hôm nay có đông không; lịch đổi đột xuất không được cập nhật kịp thời. |
| **Chủ Spa / Quản trị viên (Admin / Owner)** | Anh Hoàng Nam (38 tuổi, Chủ cơ sở) | Nắm doanh thu thực tế vs doanh thu dự kiến, tỷ lệ hoàn thành, cấu hình dịch vụ, ảnh đại diện và ưu đãi. | Báo cáo doanh thu bị sai lệch giữa tiền đã thu và lịch bị hủy; không kiểm soát được chất lượng đánh giá của khách. |

---

## 4. PHẠM VI SẢN PHẨM (SCOPE OF WORK)

### 4.1. Phạm vi trong MVP (In-Scope)
1. **Phân hệ Khách hàng (Storefront & Booking)**:
   - Header đồng bộ với tab "Trang chủ" mặc định có active indicator.
   - Trang chủ (`/`): Thanh cam kết nhanh (Value Bar), Liệu trình hot, Ưu đãi, Quy trình 3 bước, Đánh giá thật, Form tư vấn SĐT.
   - Trang giới thiệu (`/about`): Câu chuyện Lumière, Triết lý Ngũ quan dưỡng sinh (5 giác quan), Cam kết 3 Không, Tiêu chuẩn thảo mộc sạch & vô trùng y tế, Virtual Space Tour.
   - Trang danh mục dịch vụ (`/services`): Tìm kiếm tức thì, lọc chuyên mục, lọc thời lượng (<60p, 60-90p, >90p), sắp xếp giá/thời lượng.
   - Luồng đặt lịch 4 bước (`/booking`): Dịch vụ $\rightarrow$ Kỹ thuật viên (kèm gợi ý KTV khác cùng khung giờ) $\rightarrow$ Ngày & Giờ trống thời gian thực $\rightarrow$ Thông tin & Voucher/Giảm giá 10% khách mới.
   - Trang tài khoản khách (`/account`): Xem lịch hẹn, hủy/đổi lịch, đánh giá sao sau khi hoàn thành, ví voucher.
2. **Phân hệ Quản trị viên (Admin Portal)**:
   - Dashboard tổng quan: Doanh thu thực tế (`realizedRevenue`), Doanh thu dự kiến (`expectedRevenue`), thống kê trạng thái.
   - Bộ công cụ Nhắc lịch tự động (`reminder-queue`): Gửi hàng loạt, chạy ngầm tự động (Auto-pilot 5 phút), cấu hình mẫu tin nhắn Zalo/SMS.
   - Quản lý Dịch vụ: Thêm/sửa/xóa, upload ảnh nén trực tiếp qua canvas, hỗ trợ combo và so sánh giá gạch ngang.
   - Quản lý Kỹ thuật viên & Lịch làm việc (`staff`, `schedules`): Phân ca, ngày nghỉ, chuyên môn.
   - Quản lý Lịch hẹn (`appointments`, `calendar`): Timeline trực quan, máy trạng thái 7 bước.
   - Quản lý Leads, Đánh giá (`reviews`), Ưu đãi (`promotions` - app_settings, gift cards, packages).
3. **Phân hệ Kỹ thuật viên (`/staff`)**:
   - Giao diện mobile-friendly cho KTV xem danh sách lịch được giao trong ngày, bấm "Bắt đầu phục vụ" $\rightarrow$ "Hoàn thành".

### 4.2. Ngoài phạm vi MVP (Out-of-Scope - Dành cho Pha 2)
- Cổng thanh toán trực tuyến qua thẻ quốc tế/ATM/VietQR động (MVP áp dụng thanh toán tại quầy sau khi trải nghiệm).
- Tích hợp tổng đài VoIP tự động gọi điện nhắc lịch (MVP dùng SMS/Zalo).
- Đặt lịch đồng thời cho nhóm đông người (Group Booking > 3 người cùng 1 slot).

---

## 5. YÊU CẦU CHỨC NĂNG THEO MOSCOW (FUNCTIONAL REQUIREMENTS)

| Mã YC | Chức năng chi tiết | Mô tả nghiệp vụ | Mức ưu tiên |
| :--- | :--- | :--- | :--- |
| **FR-01** | **Header & Tab Trang chủ mặc định** | Thanh menu hiển thị: Trang chủ, Giới thiệu, Dịch vụ, Ưu đãi, Liên hệ. Tự động nhận diện `pathname` để làm nổi bật tab đang đứng (active pill). | **Must-Have** |
| **FR-02** | **Trang chủ chuyển đổi nhanh** | Khối Value Bar 4 cam kết nhanh, Liệu trình bán chạy kèm ảnh thật, Box giảm 10% khách mới, Quy trình 3 bước, Form để lại SĐT tư vấn. | **Must-Have** |
| **FR-03** | **Trang giới thiệu thương hiệu** | Bản sắc Lumière, Trải nghiệm Ngũ quan (Khứu, Thính, Thị, Xúc, Vị), Cam kết "3 Không", Tiêu chuẩn vô trùng y tế, Virtual Space Tour. Không trùng lặp với trang chủ. | **Must-Have** |
| **FR-04** | **Trang danh mục dịch vụ** | Bộ lọc đa tiêu chí: Từ khóa search, Category, Khoảng thời lượng (<60p, 60-90p, >90p), Sort giá/thời lượng, nút đặt lịch từng món. | **Must-Have** |
| **FR-05** | **Tính toán khung giờ trống (Slot Engine)** | Tính toán theo thời lượng dịch vụ, ca làm việc KTV, loại trừ lịch đã đặt (`not in cancelled, completed, no_show`) và buffer 15 phút nếu là ngày hôm nay. | **Must-Have** |
| **FR-06** | **Gợi ý KTV khác cùng khung giờ** | Khi khách chọn 1 KTV cụ thể, nếu giờ đó KTV kín lịch nhưng có KTV khác rảnh, hiển thị badge gợi ý và cho phép chuyển đổi 1-click. | **Must-Have** |
| **FR-07** | **Bộ công cụ nhắc lịch tự động** | Tự động quét các lịch hẹn `confirmed` hoặc `pending` trong ngày/ngày mai chưa có `reminded_at`. Hỗ trợ gửi hàng loạt và auto-pilot runner. | **Must-Have** |
| **FR-08** | **Upload ảnh dịch vụ nén Canvas** | Admin upload ảnh định dạng JPG/PNG/WebP, tự động nén phía client qua canvas HTML5 ($\le 1200px$, quality 0.82) trước khi lưu trữ, có xem trước thẻ card. | **Must-Have** |
| **FR-09** | **Cơ chế tính giá & Ưu đãi** | Giảm 10% cho khách mới đặt lần đầu (cấu hình trong `app_settings`), hỗ trợ mã Gift Card, Voucher nhiều buổi, so sánh giá gạch ngang combo. | **Must-Have** |
| **FR-10** | **Quản lý máy trạng thái lịch hẹn** | Chuyển đổi trạng thái chặt chẽ: `pending` $\rightarrow$ `confirmed` $\rightarrow$ `checked_in` $\rightarrow$ `in_service` $\rightarrow$ `completed` (hoặc `cancelled` / `no_show`). | **Must-Have** |
| **FR-11** | **Trang kỹ thuật viên cá nhân** | KTV đăng nhập xem lịch trong ngày của chính mình, cập nhật trạng thái làm việc mà không xem được dữ liệu tài chính của spa. | **Should-Have** |
| **FR-12** | **Đánh giá & Duyệt Review** | Khách đã hoàn thành lịch mới được viết review; Admin có quyền kiểm duyệt (`is_published`) trước khi xuất hiện trên trang chủ. | **Should-Have** |
| **FR-13** | **Quản lý Lead & Gọi lại** | Thu thập SĐT từ trang chủ/giới thiệu/dịch vụ, quản lý trạng thái: Mới $\rightarrow$ Đã gọi $\rightarrow$ Đã đặt $\rightarrow$ Đóng. | **Should-Have** |
| **FR-14** | **Timeline Calendar kéo thả** | Hiển thị dạng lịch lưới trực quan theo ngày/tuần giúp lễ tân dễ quan sát giường trống. | **Could-Have** |
| **FR-15** | **Đăng nhập OTP qua điện thoại** | Xác thực số điện thoại nhanh bằng mã OTP 6 số để tạo tài khoản không cần mật khẩu. | **Could-Have** |

---

## 6. LUỒNG NGƯỜI DÙNG CHI TIẾT (USER FLOWS)

### 6.1. Luồng Đặt lịch Khách hàng (Customer Booking Flow)

```
[Khách truy cập] 
       │
       ▼
[Bước 1: Chọn Liệu Trình] ──► Xem ảnh, thời lượng, giá niêm yết / combo
       │
       ▼
[Bước 2: Chọn Kỹ Thuật Viên]
       ├─► Chọn "Bất kỳ nhân viên" (Hệ thống tự ghép ai rảnh)
       └─► Chọn đích danh 1 KTV (Kèm avatar, số năm KN, chuyên môn)
       │
       ▼
[Bước 3: Chọn Ngày & Giờ]
       ├─► KTV đã chọn còn trống ──► Bấm chọn khung giờ
       └─► KTV đã chọn kín lịch ───► Hiển thị: "KTV khác cùng giờ: [KTV B]" ──► Click chuyển KTV
       │
       ▼
[Bước 4: Nhập Thông Tin & Ưu Đãi]
       ├─► Tự động áp dụng Giảm 10% khách mới (nếu đủ điều kiện)
       ├─► Nhập mã Gift Card / Voucher (nếu có)
       └─► Nhập Họ tên, SĐT, Ghi chú thể trạng
       │
       ▼
[Xác nhận Đặt lịch] ──► Tạo `booking_code` (VD: LM-8492) ──► Điều hướng trang thành công + Gửi thông báo
```

### 6.2. Luồng Vận hành & Nhắc lịch của Lễ tân (Front Desk & Reminder Flow)

```
[Lễ tân vào Admin Dashboard] ──► Kiểm tra danh sách "Nhắc lịch tự động"
       │
       ├─► Chế độ Auto-Pilot: Hệ thống tự quét mỗi 5 phút và gửi Zalo/SMS cho lịch hẹn sắp tới
       └─► Chế độ Thủ công: Bấm "Gửi tất cả (X lịch)" hoặc bấm nút gửi từng khách
       │
       ▼
[Cập nhật trường `reminded_at` = NOW()] ──► Đổi icon sang trạng thái "Đã nhắc lúc HH:mm"
       │
       ▼
[Khách đến spa] ──► Lễ tân bấm "Check-in" ──► KTV bấm "Bắt đầu phục vụ" ──► "Hoàn thành"
```

---

## 7. QUY TẮC NGHIỆP VỤ (BUSINESS RULES)

### BR-01: Giờ vận hành & Chia khung giờ (Slots Engine)
- Giờ mở cửa: **09:00**, Giờ đóng cửa: **20:00** hàng ngày.
- Bước nhảy khung giờ (Slot interval): **30 phút** (09:00, 09:30, 10:00...).
- Điều kiện slot khả dụng: `slot_start + service.duration_min <= 20:00`.
- Buffer đặt lịch trong ngày (Same-day booking buffer): Khung giờ phải cách thời điểm hiện tại ít nhất **15 phút**. Ví dụ: Lúc 10:20 chỉ được đặt từ 10:45 hoặc 11:00 trở đi.
- Giới hạn đặt trước: Tối đa **30 ngày** tính từ ngày hiện tại.

### BR-02: Quy tắc Xung đột lịch (Conflict Prevention)
Một KTV $S$ được coi là bận tại khung giờ $[T_{start}, T_{end}]$ nếu tồn tại bất kỳ lịch hẹn nào của KTV $S$ thỏa mãn:
$$\max(T_{start}, Apt_{start}) < \min(T_{end}, Apt_{end})$$
với trạng thái lịch hẹn thuộc nhóm đang mở: `pending`, `confirmed`, `checked_in`, `in_service`. Các lịch có trạng thái `cancelled`, `completed`, `no_show` được giải phóng hoàn toàn.

### BR-03: Quy tắc Gợi ý KTV khác cùng khung giờ (Alternative Staff Recommendation)
- **Điều kiện kích hoạt**: Khi khách hàng chọn 1 KTV cụ thể (khác `any`), tại khung giờ $T$, KTV đã chọn bị vướng lịch nhưng tồn tại ít nhất một KTV khác đủ điều kiện làm dịch vụ đó và đang hoàn toàn trống lịch tại khung giờ $T$.
- **Hành vi**: Hiển thị thẻ thông báo trực quan: *"Kỹ thuật viên [Tên KTV gợi ý] đang trống khung giờ này"* kèm nút *"Đổi sang [Tên KTV]"*. Khi bấm, hệ thống tự động gán `staff_id` mới và giữ nguyên khung giờ đang chọn.

### BR-04: Quy tắc Ưu đãi lần đầu (First-Visit Discount)
- Điều kiện áp dụng: Số điện thoại của khách hàng chưa từng có lịch hẹn nào mang trạng thái `completed` trong bảng `appointments`.
- Giá trị giảm giá: Lấy từ cấu hình `app_settings.first_visit_discount_pct` (mặc định 10%). Nếu bảng `app_settings` chưa được khởi tạo, hệ thống sử dụng fallback mặc định là bật giảm giá 10%.
- Giá cuối cùng = `Math.round(service.price * (1 - pct / 100))`.

### BR-05: Quy tắc Vận chuyển & Chuyển đổi trạng thái (State Machine)
- Trạng thái chỉ được di chuyển xuôi chiều theo ma trận:
  - `pending` $\rightarrow$ `confirmed`, `cancelled`, `no_show`
  - `confirmed` $\rightarrow$ `checked_in`, `cancelled`, `no_show`
  - `checked_in` $\rightarrow$ `in_service`, `cancelled`, `no_show`
  - `in_service` $\rightarrow$ `completed`
- Trạng thái `cancelled` và `no_show` là trạng thái kết thúc (Destructive States), bắt buộc hiển thị hộp thoại xác nhận (Confirmation Dialog) trước khi thực hiện.

### BR-06: Quy tắc Nhắc lịch tự động (Automated Reminder Criteria)
Một lịch hẹn được đưa vào hàng đợi nhắc lịch khi thỏa mãn đủ 4 điều kiện:
1. `status` thuộc danh sách `['confirmed', 'pending']`.
2. Ngày hẹn là **Hôm nay** hoặc **Ngày mai** (theo múi giờ GMT+7).
3. `reminded_at` là `null` (chưa từng được gửi nhắc lịch thành công).
4. Khách hàng có số điện thoại hợp lệ ($\ge 10$ số).

---

## 8. MÔ HÌNH DỮ LIỆU CỐT LÕI (CORE DATA SCHEMA)

```
┌──────────────────┐       ┌────────────────────────┐       ┌───────────────────┐
│     SERVICES     │       │      APPOINTMENTS      │       │       STAFF       │
├──────────────────┤       ├────────────────────────┤       ├───────────────────┤
│ id (UUID, PK)    │◄──────┤ service_id (FK)        │──────►│ id (UUID, PK)     │
│ name (VARCHAR)   │       │ staff_id (FK)          │       │ name (VARCHAR)    │
│ price (INT)      │       │ customer_id (FK)       │       │ role (VARCHAR)    │
│ duration_min(INT)│       │ booking_code (VARCHAR) │       │ avatar_url (TEXT) │
│ image_url (TEXT) │       │ start_time (TIMESTAMP) │       │ is_active (BOOL)  │
│ is_active (BOOL) │       │ end_time (TIMESTAMP)   │       │ specialties (ARR) │
└──────────────────┘       │ status (ENUM)          │       └───────────────────┘
                           │ price (INT)            │                 ▲
┌──────────────────┐       │ reminded_at (TIMESTAMP)│                 │
│    CUSTOMERS     │       └────────────────────────┘                 │
├──────────────────┤                   │                     ┌─────────────────┐
│ id (UUID, PK)    │◄──────────────────┘                     │ STAFF_SCHEDULES │
│ name (VARCHAR)   │                                         ├─────────────────┤
│ phone (VARCHAR)  │                                         │ staff_id (FK)   │
│ email (VARCHAR)  │                                         │ day_of_week(INT)│
└──────────────────┘                                         │ start_time/end  │
                                                             └─────────────────┘
```

### Danh mục bảng dữ liệu chính

| Tên bảng | Mục đích | Các trường quan trọng |
| :--- | :--- | :--- |
| `services` | Danh mục dịch vụ spa | `id`, `name`, `price`, `duration_min`, `category`, `image_url`, `includes`, `compare_at_price`, `is_active` |
| `staff` | Hồ sơ nhân viên & KTV | `id`, `name`, `phone`, `role`, `avatar_url`, `specialties`, `years_experience`, `is_active` |
| `staff_schedules` | Lịch phân ca theo thứ trong tuần | `staff_id`, `day_of_week` (0=CN..6=T7), `start_time`, `end_time`, `break_start`, `break_end` |
| `appointments` | Giao dịch đặt lịch spa | `id`, `booking_code`, `customer_id`, `staff_id`, `service_id`, `start_time`, `end_time`, `status`, `price`, `discount_amount`, `reminded_at` |
| `customers` | Hồ sơ khách hàng | `id`, `name`, `phone`, `email`, `notes` |
| `leads` | Yêu cầu tư vấn gửi từ web | `id`, `name`, `phone`, `interest`, `status` (`new`, `contacted`, `booked`, `closed`) |
| `reviews` | Đánh giá dịch vụ của khách | `id`, `appointment_id`, `rating` (1-5), `comment`, `is_published` |
| `app_settings` | Cấu hình tham số hệ thống | `id`, `first_visit_enabled`, `first_visit_discount_pct`, `return_visit_pct` |

---

## 9. YÊU CẦU PHI CHỨC NĂNG (NON-FUNCTIONAL REQUIREMENTS)

### 9.1. Trải nghiệm người dùng & Thẩm mỹ thương hiệu (Branding & Design System)
- **Kiểu chữ duy nhất**: Bắt buộc sử dụng 100% font chữ **Quicksand** từ Google Fonts trên toàn bộ website và trang quản trị; loại bỏ hoàn toàn các font serif rườm rà không đồng bộ.
- **Tên thương hiệu**: Thống nhất tuyệt đối là **Lumière Spa** (không viết dính liền, không dùng logo cũ SPAFlow).
- **Độ tương phản**: Văn bản chính phải đạt tỷ lệ tương phản WCAG 2.1 AA (màu chữ tối `#141414` trên nền kem sáng `#FAF8F5`).

### 9.2. Hiệu năng & Tối ưu hóa tải trang (Performance)
- **Client-side Image Compression**: Ảnh dịch vụ tải lên từ Admin phải được nén tự động trên trình duyệt qua canvas trước khi gửi lên server (kích thước tối đa 1200px, dung lượng file sau nén $\le 250KB$).
- **Thời gian phản hồi API**: Toàn bộ các truy vấn tính toán khung giờ trống (`slots`) phải hoàn tất trong vòng $\le 300ms$.

### 9.3. Bảo mật & Toàn vẹn dữ liệu (Security & Privacy)
- **Ẩn thông tin nhạy cảm của KTV**: API công khai phục vụ trang đặt lịch chỉ trả về `id`, `name`, `avatar_url`, `specialties`, `years_experience`; tuyệt đối không để lộ `phone` và `email` cá nhân của KTV.
- **Bảo vệ khách hàng**: Khách hàng chỉ có thể xem lịch sử đặt hẹn và viết đánh giá cho chính các lịch hẹn gắn với số điện thoại/tài khoản của mình.

---

## 10. TIÊU CHÍ NGHIỆM THU KIỂM THỬ (TESTABLE ACCEPTANCE CRITERIA)

### AC-01: Kiểm tra Tab "Trang chủ" mặc định trên thanh điều hướng
- **Given** người dùng truy cập vào trang chủ tại URL `/`.
- **When** trang tải xong.
- **Then** thanh menu hiển thị tab đầu tiên là "Trang chủ", có trạng thái Active (chữ đậm màu chủ đạo và gạch chân chỉ thị `after:h-[2.5px]`).
- **And** khi bấm vào "Giới thiệu" (`/about`), tab "Giới thiệu" sáng lên và tab "Trang chủ" trở về trạng thái thường.

### AC-02: Kiểm tra Phân định nội dung Trang chủ và Trang giới thiệu
- **Given** người dùng so sánh nội dung giữa `/` và `/about`.
- **When** kiểm tra các thành phần giao diện.
- **Then** Trang chủ (`/`) hiển thị thanh cam kết nhanh (Value Bar), danh sách dịch vụ nổi bật kèm giá và form nhận SĐT gọi lại.
- **And** Trang giới thiệu (`/about`) hiển thị chi tiết "Hành trình Ngũ quan dưỡng sinh" (5 thẻ giác quan), triết lý tên gọi Lumière, và bảng tiêu chuẩn vô trùng y tế; không sử dụng ảnh trùng lặp với trang chủ.

### AC-03: Kiểm tra Gợi ý KTV khác cùng khung giờ (Alternative Staff Suggestion)
- **Given** khách hàng chọn dịch vụ "Massage body 60 phút" và chọn KTV "Lan Hương".
- **And** lúc 14:00 ngày mai, KTV "Lan Hương" đã có lịch hẹn `confirmed`.
- **And** KTV "Thu Hà" cùng làm được dịch vụ này và đang hoàn toàn trống lịch từ 14:00 đến 15:00.
- **When** khách hàng xem lưới giờ lúc 14:00.
- **Then** hệ thống hiển thị badge gợi ý: *"KTV Thu Hà đang trống giờ này"*.
- **And** khi khách bấm vào badge, nhân viên được đổi ngay sang "Thu Hà", khung giờ 14:00 được chọn thành công.

### AC-04: Kiểm tra Hàng đợi nhắc lịch tự động (Automated Reminder Queue)
- **Given** có 3 lịch hẹn ngày hôm nay ở trạng thái `confirmed` có số điện thoại hợp lệ và `reminded_at = null`.
- **When** Lễ tân bấm nút "Gửi tất cả (3 lịch)" trong Dashboard.
- **Then** hệ thống gọi API `/api/reminders/send` để phát tin nhắn qua Zalo/SMS.
- **And** cả 3 lịch hẹn đều được cập nhật `reminded_at` bằng thời gian hiện tại, hiển thị thông báo toast thành công và icon chuyển sang tick xanh đã gửi.

### AC-05: Kiểm tra Upload ảnh dịch vụ trong Admin
- **Given** Quản trị viên mở trang Admin Dịch vụ (`/admin/services`) và bấm "Thêm dịch vụ mới".
- **When** kéo thả 1 file ảnh có dung lượng 4MB (kích thước 4000x3000px).
- **Then** trình duyệt nén ảnh tự động qua canvas xuống dưới 250KB.
- **And** khung xem trước (Card Preview) hiển thị ảnh thật ngay lập tức.
- **And** sau khi lưu, ảnh dịch vụ hiển thị chuẩn xác tại trang danh mục `/services` và trang đặt lịch `/booking`.

---

## 11. MA TRẬN RỦI RO, PHỤ THUỘC & CÂU HỎI MỞ (RISKS & DEPENDENCIES)

### 11.1. Ma trận Rủi ro & Giải pháp giảm thiểu (Risks & Mitigation)

| Rủi ro tiềm ẩn | Mức độ | Khả năng xảy ra | Giải pháp kiểm soát (Mitigation Plan) |
| :--- | :--- | :--- | :--- |
| **Xung đột đặt lịch đồng thời (Race Condition)**: Hai khách cùng bấm xác nhận 1 khung giờ cuối cùng tại cùng 1 giây. | Cao | Trung bình | Cơ chế tạm khóa slot (Slot Hold qua `tabHolderId`) trong 5 phút khi khách bắt đầu bước nhập thông tin. Kiểm tra lại tính khả dụng ngay trước khi INSERT vào DB. |
| **Lỗi kết nối Zalo/SMS Gateway**: API nhà mạng bị nghẽn làm gián đoạn gửi tin nhắc hẹn. | Trung bình | Thấp | Bổ sung hàng đợi retry; hiển thị cờ cảnh báo màu đỏ trên giao diện Admin để lễ tân kịp thời bấm gọi điện thủ công. |
| **Khách hàng nhập sai định dạng SĐT**: Dẫn đến không thể gửi tin nhắn xác nhận. | Cao | Cao | Kiểm tra biểu thức chính quy (Regex: `^(\+84\|0)[3\|5\|7\|8\|9][0-9]{8}$`) ngay tại ô nhập liệu bước 4. |

### 11.2. Các thành phần phụ thuộc kỹ thuật (Technical Dependencies)
1. **Supabase Database & Storage**: Quản lý quan hệ dữ liệu PostgreSQL, Auth session và lưu trữ ảnh dịch vụ.
2. **Next.js App Router (v14/v15)**: Server-side Rendering cho trang chủ (revalidate 300s) đảm bảo SEO Google DaySpa Schema và Client-side interactivity cho luồng booking.
3. **Zalo ZNS / SMS Brandname Provider**: Cổng gửi tin nhắn chăm sóc khách hàng tự động theo mẫu thông báo đã đăng ký.

### 11.3. Các câu hỏi mở cần Doanh nghiệp xác nhận thêm (Open Items for Confirmation)
- `[Chưa đủ căn cứ]` **Mẫu thông báo Zalo ZNS chính thức**: Spa đã hoàn tất đăng ký Template ZNS với Zalo Cloud Account chưa, hay tạm thời sử dụng kênh tin nhắn văn bản SMS Brandname?
- `[Chưa đủ căn cứ]` **Chính sách đặt cọc vào khung giờ cao điểm (Peak Hours)**: Spa có dự kiến áp dụng yêu cầu chuyển khoản cọc đối với các khung giờ vàng tối Thứ 7 và Chủ Nhật (sau 17:00) hay duy trì 100% không cần đặt cọc trước?

---

*Tài liệu này là căn cứ kỹ thuật và nghiệp vụ chính thức để các bộ phận Product, UI/UX Designer, Frontend/Backend Engineer và QA/Tester đối chiếu nghiệm thu sản phẩm.*
