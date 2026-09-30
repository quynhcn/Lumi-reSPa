-- Nối xác thực với dữ liệu ứng dụng: tạo profiles + customers khi có tài khoản mới (như trigger của Supabase).
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Dọn phiên / OTP / nhật ký rate-limit đã hết hạn (gọi định kỳ từ /api/cron/cleanup hoặc pg_cron nếu có)
CREATE OR REPLACE FUNCTION auth.cleanup() RETURNS void LANGUAGE sql AS $$
  DELETE FROM auth.sessions WHERE expires_at < now();
  DELETE FROM auth.otp_codes WHERE created_at < now() - interval '1 day';
  DELETE FROM auth.rate_events WHERE created_at < now() - interval '1 day';
  DELETE FROM public.slot_holds WHERE expires_at < now() - interval '1 hour';
$$;
