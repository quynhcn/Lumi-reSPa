-- Promote the approved UI mockup catalogue to canonical PostgreSQL data.
-- Stable UUIDs keep booking links and future data migrations deterministic.

INSERT INTO public.services
  (id, name, description, duration_min, price, compare_at_price, category, image_url, includes, is_active)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'Body Scrub Tẩy Tế Bào Chết',
   'Tẩy tế bào chết toàn thân, làm sáng và mềm da, cho làn da khỏe mạnh, rạng rỡ.',
   45, 280000, NULL, 'Body Care', '/service-body.jpg', '{}', true),
  ('10000000-0000-4000-8000-000000000002', 'Gội Đầu Dưỡng Sinh',
   'Gội đầu kết hợp massage da đầu và cổ, giúp giảm căng thẳng, thư giãn tinh thần.',
   30, 150000, NULL, 'Hair Care', '/service-headspa.jpg', '{}', true),
  ('10000000-0000-4000-8000-000000000003', 'Massage Cổ Vai Gáy',
   'Giảm đau mỏi cổ vai gáy, phù hợp người làm việc văn phòng, cải thiện tuần hoàn máu.',
   30, 180000, NULL, 'Massage', '/service-neck.jpg', '{}', true),
  ('10000000-0000-4000-8000-000000000004', 'Chăm Sóc Da Mặt Chuyên Sâu',
   'Làm sạch sâu, cấp ẩm và nuôi dưỡng làn da, cho da sáng khỏe, mịn màng.',
   60, 350000, NULL, 'Skincare', '/service-facial.jpg', '{}', true),
  ('10000000-0000-4000-8000-000000000005', 'Massage Body Thư Giãn',
   'Massage toàn thân với tinh dầu thiên nhiên, giúp thư giãn sâu và giảm căng thẳng.',
   60, 320000, NULL, 'Massage', '/about-hero-stone.jpg', '{}', true),
  ('10000000-0000-4000-8000-000000000006', 'Combo Thư Giãn Toàn Diện',
   'Kết hợp gội đầu dưỡng sinh, massage body và chăm sóc da mặt trong một trải nghiệm trọn vẹn.',
   90, 550000, 650000, 'Combo', '/service-special.jpg',
   ARRAY['Gội đầu dưỡng sinh', 'Massage body tinh dầu', 'Chăm sóc da mặt chuyên sâu'], true)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  duration_min = EXCLUDED.duration_min,
  price = EXCLUDED.price,
  compare_at_price = EXCLUDED.compare_at_price,
  category = EXCLUDED.category,
  image_url = EXCLUDED.image_url,
  includes = EXCLUDED.includes,
  is_active = EXCLUDED.is_active,
  updated_at = now();

-- These rows are semantically unique even when requests race.
CREATE UNIQUE INDEX IF NOT EXISTS staff_schedules_staff_day_unique
  ON public.staff_schedules (staff_id, day_of_week);

CREATE UNIQUE INDEX IF NOT EXISTS staff_time_off_staff_date_unique
  ON public.staff_time_off (staff_id, date);

ALTER TABLE public.appointments
  ADD CONSTRAINT appointments_price_nonnegative CHECK (price >= 0),
  ADD CONSTRAINT appointments_list_price_nonnegative CHECK (list_price IS NULL OR list_price >= 0),
  ADD CONSTRAINT appointments_discount_nonnegative CHECK (discount_amount >= 0),
  ADD CONSTRAINT appointments_gift_amount_nonnegative CHECK (gift_amount >= 0),
  ADD CONSTRAINT appointments_reschedule_count_nonnegative CHECK (reschedule_count >= 0);
