-- Dữ liệu mẫu tối thiểu cho bộ test API (KHÔNG dùng cho production)
INSERT INTO services (id, name, duration_min, price, category, is_active) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Massage Body', 60, 450000, 'body', true),
  ('10000000-0000-0000-0000-000000000002', 'Chăm sóc da mặt', 45, 300000, 'facial', true),
  ('10000000-0000-0000-0000-000000000003', 'Dịch vụ đã ẩn', 30, 100000, 'body', false);
INSERT INTO staff (id, name, phone, email, role, is_active) VALUES
  ('20000000-0000-0000-0000-000000000001', 'Nguyễn Thị Lan', '0911111111', 'lan@staff.test', 'therapist', true),
  ('20000000-0000-0000-0000-000000000002', 'Trần Thu Hà', '0922222222', 'ha@staff.test', 'therapist', true);
INSERT INTO staff_services (staff_id, service_id) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000002');
INSERT INTO staff_schedules (staff_id, day_of_week, start_time, end_time, break_start, break_end)
SELECT s.id, d, '09:00', '20:00', '12:00', '13:00'
FROM staff s CROSS JOIN generate_series(0, 6) d;
INSERT INTO service_packages (name, service_id, sessions, price) VALUES
  ('5 buổi Massage Body', '10000000-0000-0000-0000-000000000001', 5, 1900000),
  ('Gói dịch vụ ẩn', '10000000-0000-0000-0000-000000000003', 3, 250000);
