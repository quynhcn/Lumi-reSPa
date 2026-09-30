-- Dòng cấu hình duy nhất (id = 1). Trong migrations Supabase, dòng này được INSERT ở 20260926000000_growth_features.sql;
-- pg_dump --schema-only không mang theo dữ liệu nên cần tạo lại ở đây. Thiếu dòng này thì:
--   * ưu đãi lần đầu không bao giờ được áp dụng
--   * chuyển lịch sang "Hoàn thành" bị lỗi (trigger phát voucher đọc app_settings)
INSERT INTO public.app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
