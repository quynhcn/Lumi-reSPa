/*
# Add user_id to customers for auth integration

1. Modified Tables
- `customers`: add `user_id` (uuid, nullable, references auth.users ON DELETE SET NULL)
  - This links a customer profile to a Supabase auth user account.
  - Nullable because existing demo customers have no auth account, and the public booking flow may create customers before they register.
  - Added a unique constraint on (user_id) so each auth user maps to exactly one customer profile.

2. Security Changes
- RLS already enabled on customers (anon + authenticated CRUD).
- No policy changes needed — the existing `TO anon, authenticated` policies still apply.
- The booking flow will now check for an authenticated session before creating appointments.
- When a signed-in user books, the system will find/create their customer profile by phone and link user_id.

3. Important Notes
- The `user_id` column is nullable to avoid breaking existing demo data.
- Future inserts from authenticated users will set user_id via the app code.
- The unique index on user_id prevents duplicate customer profiles per auth account.
*/

ALTER TABLE customers ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customers_user_id ON customers (user_id) WHERE user_id IS NOT NULL;
