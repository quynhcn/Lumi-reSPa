-- Mô phỏng phần nền của một DB Supabase (roles + schema auth như GoTrue tạo ra) để thử script chuyển dữ liệu.
-- :dst_variant = 1 → giả lập GoTrue phiên bản khác: thêm 1 cột mới, thiếu cột is_anonymous.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE TABLE auth.users (
  instance_id uuid, id uuid PRIMARY KEY, aud varchar(255), role varchar(255), email varchar(255),
  encrypted_password varchar(255), email_confirmed_at timestamptz, invited_at timestamptz,
  confirmation_token varchar(255), confirmation_sent_at timestamptz, recovery_token varchar(255), recovery_sent_at timestamptz,
  email_change_token_new varchar(255), email_change varchar(255), email_change_sent_at timestamptz, last_sign_in_at timestamptz,
  raw_app_meta_data jsonb, raw_user_meta_data jsonb, is_super_admin boolean, created_at timestamptz, updated_at timestamptz,
  phone text UNIQUE DEFAULT NULL, phone_confirmed_at timestamptz, phone_change text DEFAULT '', phone_change_token varchar(255) DEFAULT '',
  phone_change_sent_at timestamptz,
  confirmed_at timestamptz GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED,
  email_change_token_current varchar(255) DEFAULT '', email_change_confirm_status smallint DEFAULT 0, banned_until timestamptz,
  reauthentication_token varchar(255) DEFAULT '', reauthentication_sent_at timestamptz, is_sso_user boolean NOT NULL DEFAULT false,
  deleted_at timestamptz
);
\if :dst_variant
ALTER TABLE auth.users ADD COLUMN future_flag boolean NOT NULL DEFAULT false;
\else
ALTER TABLE auth.users ADD COLUMN is_anonymous boolean NOT NULL DEFAULT false;
\endif
CREATE TABLE auth.identities (
  provider_id text NOT NULL, user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, identity_data jsonb NOT NULL,
  provider text NOT NULL, last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz,
  email text GENERATED ALWAYS AS (lower(identity_data->>'email')) STORED, id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  UNIQUE (provider_id, provider)
);
CREATE TABLE auth.sessions (id uuid PRIMARY KEY, user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE, created_at timestamptz);
CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$
  SELECT nullif(coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''),
                         (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')), '')::uuid $$;
GRANT USAGE ON SCHEMA auth TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION auth.uid() TO anon, authenticated, service_role;
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT EXECUTE ON FUNCTIONS TO anon, authenticated, service_role;
