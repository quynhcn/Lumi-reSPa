-- SpaFlow — xác thực tự quản (thay GoTrue / Supabase Auth)
-- Giữ tên schema "auth" và các cột chính của auth.users giống Supabase để:
--   * các hàm nghiệp vụ đang dùng auth.uid() / auth.users (my_vouchers, handle_new_user) chạy không đổi
--   * dữ liệu chuyển từ Supabase sang giữ nguyên id người dùng và mật khẩu (bcrypt $2a$, tương thích bcryptjs)

CREATE SCHEMA IF NOT EXISTS auth;

CREATE TABLE IF NOT EXISTS auth.users (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email               text UNIQUE,                 -- luôn lưu chữ thường
  phone               text UNIQUE,                 -- E.164 bỏ dấu '+', ví dụ 84901234567 (giống Supabase)
  encrypted_password  text,                        -- bcrypt; NULL với tài khoản chỉ dùng SMS OTP
  email_confirmed_at  timestamptz,
  phone_confirmed_at  timestamptz,
  raw_user_meta_data  jsonb NOT NULL DEFAULT '{}'::jsonb,
  banned_until        timestamptz,
  last_sign_in_at     timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CHECK (email IS NOT NULL OR phone IS NOT NULL),
  CHECK (email IS NULL OR email = lower(email))
);

-- Phiên đăng nhập: cookie httpOnly chứa token ngẫu nhiên, DB chỉ lưu SHA-256 của token
CREATE TABLE IF NOT EXISTS auth.sessions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash   text NOT NULL UNIQUE,
  created_at   timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  expires_at   timestamptz NOT NULL,
  ip           text,
  user_agent   text
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth.sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_expires ON auth.sessions (expires_at);

-- Mã OTP qua SMS (lưu hash, tối đa 5 lần nhập sai)
CREATE TABLE IF NOT EXISTS auth.otp_codes (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone       text NOT NULL,
  code_hash   text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  expires_at  timestamptz NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  ip          text
);
CREATE INDEX IF NOT EXISTS idx_auth_otp_phone ON auth.otp_codes (phone, created_at DESC);

-- Nhật ký để giới hạn tần suất (đăng nhập sai, gửi OTP theo IP, ...)
CREATE TABLE IF NOT EXISTS auth.rate_events (
  key        text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_rate_events ON auth.rate_events (key, created_at DESC);

-- Người dùng hiện tại của transaction. Server đặt bằng: SELECT set_config('app.user_id', '<uuid>', true)
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid
LANGUAGE sql STABLE AS $$
  SELECT nullif(current_setting('app.user_id', true), '')::uuid
$$;

CREATE OR REPLACE FUNCTION auth.touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS trg_auth_users_updated ON auth.users;
CREATE TRIGGER trg_auth_users_updated BEFORE UPDATE ON auth.users
  FOR EACH ROW EXECUTE FUNCTION auth.touch_updated_at();
