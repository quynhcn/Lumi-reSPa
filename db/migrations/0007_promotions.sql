CREATE TABLE public.promotions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text,
  badge text NOT NULL,
  title text NOT NULL,
  discount text NOT NULL,
  subtitle text NOT NULL,
  description text NOT NULL,
  valid_until text NOT NULL,
  image_url text NOT NULL,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_text text NOT NULL,
  href text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT promotions_sort_order_check CHECK (sort_order >= 0)
);

CREATE UNIQUE INDEX promotions_code_unique
  ON public.promotions (code)
  WHERE code IS NOT NULL;

CREATE INDEX promotions_active_sort
  ON public.promotions (is_active, sort_order);

CREATE TRIGGER trg_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- The approved mockup content is the initial production catalogue. Stable codes make
-- this seed idempotent and let administrators edit the records after deployment.
INSERT INTO public.promotions
  (code, badge, title, discount, subtitle, description, valid_until, image_url, highlights, cta_text, href, sort_order)
VALUES
  ('FIRST_VISIT', 'DÀNH CHO KHÁCH HÀNG MỚI', 'Ưu Đãi Trải Nghiệm Lần Đầu', 'GIẢM 10%',
   'Áp dụng cho mọi liệu trình đơn lẻ hoặc combo tại Lumière Spa',
   'Lần đầu ghé thăm Lumière Spa, bạn được giảm trực tiếp 10% trên hóa đơn dịch vụ cùng set trà thảo mộc và ngâm chân muối khoáng chào đón.',
   'Áp dụng theo chính sách ưu đãi hiện hành', '/offer-first-visit.jpg',
   '["Áp dụng cho tất cả dịch vụ trong thực đơn", "Tặng 15 phút ngâm chân thảo mộc và thưởng trà", "Được chọn kỹ thuật viên theo yêu cầu", "Không phụ thu cuối tuần hay ngày lễ"]'::jsonb,
   'Đặt lịch nhận ưu đãi ngay', '/booking', 0),
  ('VIP_MEMBER', 'GÓI HỘI VIÊN TIẾT KIỆM', 'Thẻ Hội Viên VIP Thư Thái', 'TIẾT KIỆM 25%',
   'Gói 10 buổi trị liệu chuyên sâu, chủ động thời gian sử dụng',
   'Dành cho khách hàng duy trì thói quen chăm sóc sức khỏe và làn da định kỳ, với quyền lợi phòng VIP và mức giá ưu đãi.',
   'Số lượng phát hành có hạn', '/offer-member-card.jpg',
   '["Tiết kiệm đến 25% so với giá dịch vụ lẻ", "Sử dụng phòng đôi VIP riêng tư", "Tặng tinh dầu trị liệu", "Có thể chia sẻ số buổi cho người thân"]'::jsonb,
   'Đăng ký thẻ hội viên', '/booking', 1),
  ('GIFT_CARD', 'MÓN QUÀ TINH TẾ', 'Thẻ Quà Tặng Thư Giãn', 'TẶNG THIỆP & HỘP',
   'Trao gửi bình yên và sự chăm sóc ân cần đến người bạn yêu thương',
   'Thẻ quà tặng dùng cho các dịp sinh nhật, kỷ niệm hoặc tri ân, kèm hộp quà và thiệp viết tay theo yêu cầu.',
   'Thời hạn sử dụng 06 tháng', '/offer-gift-card.jpg',
   '["Mệnh giá linh hoạt từ 500.000đ đến 3.000.000đ", "Hộp quà cao cấp miễn phí", "Hỗ trợ gửi thiệp tận nơi", "Áp dụng cho mọi liệu trình và combo"]'::jsonb,
   'Tư vấn đặt thẻ quà tặng', '#lead-form-section', 2),
  ('COUPLE_RELAX', 'GẮN KẾT YÊU THƯƠNG', 'Combo Cặp Đôi & Mẹ Con', 'GIẢM 20%',
   'Không gian riêng tư 90 phút cho hai người',
   'Liệu trình kết hợp massage body tinh dầu ấm và gội đầu dưỡng sinh trong không gian phòng đôi riêng tư.',
   'Cần đặt trước tối thiểu 2 giờ', '/about-space-3.jpg',
   '["Phòng đôi VIP riêng tư", "Liệu trình Body và Gội đầu thảo mộc 90 phút", "Thưởng trà dưỡng nhan sau liệu trình", "Giảm 20% khi đặt lịch cùng nhau"]'::jsonb,
   'Đặt lịch phòng đôi', '/booking', 3)
ON CONFLICT (code) WHERE code IS NOT NULL DO UPDATE SET
  badge = EXCLUDED.badge,
  title = EXCLUDED.title,
  discount = EXCLUDED.discount,
  subtitle = EXCLUDED.subtitle,
  description = EXCLUDED.description,
  valid_until = EXCLUDED.valid_until,
  image_url = EXCLUDED.image_url,
  highlights = EXCLUDED.highlights,
  cta_text = EXCLUDED.cta_text,
  href = EXCLUDED.href,
  sort_order = EXCLUDED.sort_order,
  updated_at = now();
