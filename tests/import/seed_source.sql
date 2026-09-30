INSERT INTO services (id, name, description, duration_min, price, category) VALUES
 ('11111111-0000-0000-0000-000000000001','Massage body thư giãn','Liệu trình toàn thân với tinh dầu ấm, giúp thả lỏng cơ và ngủ ngon hơn.',60,450000,'massage'),
 ('11111111-0000-0000-0000-000000000002','Massage cổ vai gáy','Giải tỏa căng cơ vùng cổ vai gáy cho dân văn phòng.',30,250000,'massage'),
 ('11111111-0000-0000-0000-000000000003','Chăm sóc da mặt (Facial)','Làm sạch sâu, tẩy tế bào chết và cấp ẩm.',60,550000,'skin'),
 ('11111111-0000-0000-0000-000000000004','Gội đầu dưỡng sinh','Gội thảo dược kết hợp massage đầu và vai.',45,200000,'hair');
INSERT INTO staff (id, name, phone, email) VALUES
 ('22222222-0000-0000-0000-000000000001','Nguyễn Thu Lan','0911000001','lan@spa.vn'),
 ('22222222-0000-0000-0000-000000000002','Trần Ngọc Mai','0911000002','mai@spa.vn'),
 ('22222222-0000-0000-0000-000000000003','Lê Minh Hòa','0911000003','hoa@spa.vn');
-- Lan & Mai: all services; Hòa: massage only
INSERT INTO staff_services (staff_id, service_id)
 SELECT s.id, v.id FROM staff s, services v
 WHERE s.name <> 'Lê Minh Hòa' OR v.category = 'massage';
-- Everyone 09:00-18:00, lunch 12-13, every day; Hòa off on Sundays
INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, break_start, break_end)
 SELECT s.id, d, '09:00', '18:00', '12:00', '13:00' FROM staff s, generate_series(0,6) d
 WHERE NOT (s.name = 'Lê Minh Hòa' AND d = 0);
;
UPDATE staff SET years_experience = 6, specialties = '{Cổ vai gáy,Đá nóng}', bio = 'Nhẹ tay, tỉ mỉ.' WHERE name = 'Nguyễn Thu Lan';
INSERT INTO service_packages (name, service_id, sessions, price) VALUES ('Gói 5 buổi massage body', '11111111-0000-0000-0000-000000000001', 5, 1900000);

-- Accounts (as GoTrue would store them; bcrypt passwords)
INSERT INTO auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, last_sign_in_at)
VALUES
 ('aaaaaaaa-0000-0000-0000-000000000001', 'authenticated', 'authenticated', 'admin@spa.vn', crypt('matkhau123', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Quản lý"}', now() - interval '90 days', now(), now()),
 ('aaaaaaaa-0000-0000-0000-000000000002', 'authenticated', 'authenticated', 'khacha@test.vn', crypt('matkhau123', gen_salt('bf')), now(), '{"provider":"email"}', '{"name":"Nguyễn Thị A","phone":"0901111112"}', now() - interval '30 days', now(), now());
INSERT INTO auth.users (id, aud, role, phone, phone_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, is_anonymous)
VALUES ('aaaaaaaa-0000-0000-0000-000000000003', 'authenticated', 'authenticated', '84933000111', now(), '{"provider":"phone"}', '{"name":"Trần Văn Bình"}', now() - interval '3 days', now(), false);
INSERT INTO auth.identities (provider_id, user_id, identity_data, provider, created_at, updated_at)
SELECT id::text, id, jsonb_build_object('sub', id::text, 'email', email, 'phone', phone), CASE WHEN email IS NULL THEN 'phone' ELSE 'email' END, created_at, updated_at
FROM auth.users;
INSERT INTO auth.sessions (id, user_id, created_at) VALUES (gen_random_uuid(), 'aaaaaaaa-0000-0000-0000-000000000002', now());
UPDATE profiles SET role = 'admin' WHERE id = 'aaaaaaaa-0000-0000-0000-000000000001';

-- Bookings made through the real RPCs
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT booking_code FROM book_appointment('11111111-0000-0000-0000-000000000002', NULL, current_date + 1, '10:00', 'Nguyễn Thị A', '0901111112', 'khacha@test.vn', 'Thích nhẹ tay');
SELECT booking_code FROM book_appointment('11111111-0000-0000-0000-000000000001', NULL, current_date + 2, '14:00', 'Nguyễn Thị A', '0901111112', '', '');
SELECT * FROM reschedule_appointment((SELECT id FROM appointments WHERE start_time::date >= current_date + 2 LIMIT 1), current_date + 3, '15:00');
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000003","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT booking_code FROM book_appointment('11111111-0000-0000-0000-000000000004', NULL, current_date + 1, '11:00', 'Trần Văn Bình', '0933000111', '', '');
RESET ROLE;
-- Admin: complete A's first visit (→ return voucher), walk-in customer with a no-show
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', false);
UPDATE appointments SET status = 'completed' WHERE id = (SELECT a.id FROM appointments a JOIN customers c ON c.id = a.customer_id WHERE c.phone = '0901111112' ORDER BY a.start_time LIMIT 1);
INSERT INTO customers (name, phone) VALUES ('Khách vãng lai', '0988 777 666');
INSERT INTO appointments (customer_id, staff_id, service_id, start_time, end_time, status, price, list_price, duration_min, source)
SELECT id, '22222222-0000-0000-0000-000000000002', '11111111-0000-0000-0000-000000000003', now() - interval '5 days', now() - interval '5 days' + interval '60 min', 'no_show', 550000, 550000, 60, 'front_desk'
FROM customers WHERE phone = '0988 777 666';
SET ROLE authenticated;
SELECT review_request_token((SELECT id FROM appointments WHERE status = 'completed' LIMIT 1)) IS NOT NULL AS token_ok;
RESET ROLE;
SELECT set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000002","role":"authenticated"}', false);
SET ROLE authenticated;
SELECT submit_review((SELECT id FROM appointments WHERE status = 'completed' LIMIT 1), 5, 'Rất thư giãn, sẽ quay lại!');
RESET ROLE;
SET ROLE anon;
SELECT create_lead('Lê Hoa', '0977 123 456', 'Gói liệu trình nhiều buổi', 'Gọi sau 18h') IS NOT NULL AS lead_ok;
SELECT * FROM hold_slot('11111111-0000-0000-0000-000000000002', NULL, current_date + 5, '10:00', gen_random_uuid());
RESET ROLE;
INSERT INTO gift_cards (code, kind, initial_value, balance, recipient_name, recipient_phone, created_by) VALUES ('SFGIFT500', 'value', 500000, 500000, 'Mẹ Hoa', '0912 000 111', 'admin@spa.vn');
