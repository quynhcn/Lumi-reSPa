/*
# Create profiles table for role-based access

1. New Tables
- `profiles`
  - `id` (uuid, primary key, references auth.users)
  - `email` (text, copied from auth.users)
  - `role` (text, NOT NULL, default 'customer' — values: 'admin', 'staff', 'customer')
  - `staff_id` (uuid, nullable, references staff(id) — links a staff profile to an auth account)
  - `created_at` (timestamptz)

2. Security
- RLS enabled on profiles.
- SELECT: TO authenticated — users can read their own profile.
- INSERT: TO authenticated — users can insert their own profile (id = auth.uid()).
- UPDATE: TO authenticated — users can update their own profile.
- DELETE: TO authenticated — users can delete their own profile.

3. Trigger
- `handle_new_user` trigger on auth.users: auto-inserts a profile row with role='customer'
  when a new auth user signs up. This ensures every auth user has a profile.

4. Important Notes
- The trigger auto-creates a 'customer' profile for every new signup.
- Admin can manually change role to 'admin' or 'staff' via SQL or admin UI.
- When role is 'staff', the `staff_id` column links to the staff table record.
- The sign-in flow reads the role and redirects: admin→/admin, staff→/staff, customer→/account.
*/

CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  role text NOT NULL DEFAULT 'customer' CHECK (role IN ('admin', 'staff', 'customer')),
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "select_own_profile" ON profiles;
CREATE POLICY "select_own_profile" ON profiles FOR SELECT
  TO authenticated USING (auth.uid() = id);

DROP POLICY IF EXISTS "insert_own_profile" ON profiles;
CREATE POLICY "insert_own_profile" ON profiles FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "update_own_profile" ON profiles;
CREATE POLICY "update_own_profile" ON profiles FOR UPDATE
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "delete_own_profile" ON profiles;
CREATE POLICY "delete_own_profile" ON profiles FOR DELETE
  TO authenticated USING (auth.uid() = id);

-- Also allow anon to read profiles by id (needed for staff lookup during booking)
-- Actually, we don't want anon to read profiles. Only authenticated.

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'customer')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
