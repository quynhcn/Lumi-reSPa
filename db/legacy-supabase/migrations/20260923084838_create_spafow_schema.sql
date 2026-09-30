/*
# SpaFlow — Core Schema

Creates the full database schema for the SpaFlow spa booking and operations management system.

## Tables
1. `services` — Spa services (name, description, duration, price, category, image, status)
2. `staff` — Staff members (name, phone, email, avatar, status, role)
3. `staff_services` — Junction: which staff can perform which services
4. `staff_schedules` — Recurring weekly working hours per staff (day_of_week, start, end, break_start, break_end)
5. `staff_time_off` — Date-specific time off / leave
6. `customers` — Customer profiles (name, phone, email, notes)
7. `appointments` — Booking records (customer, staff, service, start/end times, status, booking code, price/duration snapshot)
8. `appointment_logs` — Audit trail of appointment status changes

## Enums
- `appointment_status`: pending, confirmed, checked_in, in_service, completed, cancelled, no_show

## Security
- RLS enabled on all tables.
- All tables allow anon + authenticated CRUD (single-tenant, no-auth app — booking is public, admin views are shared).

## Business Rules Encoded
- BR-04: Unique exclusion constraint prevents overlapping active appointments for the same staff member.
- BR-05: Cancelled appointments don't occupy slots (excluded from constraint).
- BR-10: Price and duration are snapshotted on the appointment at booking time.
- BR-11: The exclusion constraint + a unique partial index on booking_code prevent double-booking at the DB level.
*/

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE appointment_status AS ENUM (
    'pending', 'confirmed', 'checked_in', 'in_service', 'completed', 'cancelled', 'no_show'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- SERVICES
-- ============================================================
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  duration_min integer NOT NULL CHECK (duration_min > 0),
  price integer NOT NULL CHECK (price >= 0),
  category text,
  image_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_services" ON services;
CREATE POLICY "anon_select_services" ON services FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_services" ON services;
CREATE POLICY "anon_insert_services" ON services FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_services" ON services;
CREATE POLICY "anon_update_services" ON services FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_services" ON services;
CREATE POLICY "anon_delete_services" ON services FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- STAFF
-- ============================================================
CREATE TABLE IF NOT EXISTS staff (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  email text,
  avatar_url text,
  role text NOT NULL DEFAULT 'therapist',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE staff ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_staff" ON staff;
CREATE POLICY "anon_select_staff" ON staff FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_staff" ON staff;
CREATE POLICY "anon_insert_staff" ON staff FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_staff" ON staff;
CREATE POLICY "anon_update_staff" ON staff FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_staff" ON staff;
CREATE POLICY "anon_delete_staff" ON staff FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- STAFF_SERVICES (junction)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  UNIQUE (staff_id, service_id)
);

ALTER TABLE staff_services ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_staff_services" ON staff_services;
CREATE POLICY "anon_select_staff_services" ON staff_services FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_staff_services" ON staff_services;
CREATE POLICY "anon_insert_staff_services" ON staff_services FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_staff_services" ON staff_services;
CREATE POLICY "anon_update_staff_services" ON staff_services FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_staff_services" ON staff_services;
CREATE POLICY "anon_delete_staff_services" ON staff_services FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- STAFF_SCHEDULES (recurring weekly hours)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  break_start time,
  break_end time,
  CHECK (end_time > start_time),
  CHECK (break_start IS NULL OR (break_end IS NOT NULL AND break_end > break_start))
);

ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_staff_schedules" ON staff_schedules;
CREATE POLICY "anon_select_staff_schedules" ON staff_schedules FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_staff_schedules" ON staff_schedules;
CREATE POLICY "anon_insert_staff_schedules" ON staff_schedules FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_staff_schedules" ON staff_schedules;
CREATE POLICY "anon_update_staff_schedules" ON staff_schedules FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_staff_schedules" ON staff_schedules;
CREATE POLICY "anon_delete_staff_schedules" ON staff_schedules FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- STAFF_TIME_OFF (date-specific leave)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_time_off (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  date date NOT NULL,
  reason text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE staff_time_off ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_staff_time_off" ON staff_time_off;
CREATE POLICY "anon_select_staff_time_off" ON staff_time_off FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_staff_time_off" ON staff_time_off;
CREATE POLICY "anon_insert_staff_time_off" ON staff_time_off FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_staff_time_off" ON staff_time_off;
CREATE POLICY "anon_update_staff_time_off" ON staff_time_off FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_staff_time_off" ON staff_time_off;
CREATE POLICY "anon_delete_staff_time_off" ON staff_time_off FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- CUSTOMERS
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  email text,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_customers" ON customers;
CREATE POLICY "anon_select_customers" ON customers FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_customers" ON customers;
CREATE POLICY "anon_insert_customers" ON customers FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_customers" ON customers;
CREATE POLICY "anon_update_customers" ON customers FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_customers" ON customers;
CREATE POLICY "anon_delete_customers" ON customers FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- APPOINTMENTS
-- ============================================================
CREATE TABLE IF NOT EXISTS appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_code text UNIQUE NOT NULL DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE RESTRICT,
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE RESTRICT,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  status appointment_status NOT NULL DEFAULT 'confirmed',
  price integer NOT NULL,
  duration_min integer NOT NULL,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CHECK (end_time > start_time)
);

ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_appointments" ON appointments;
CREATE POLICY "anon_select_appointments" ON appointments FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_appointments" ON appointments;
CREATE POLICY "anon_insert_appointments" ON appointments FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_appointments" ON appointments;
CREATE POLICY "anon_update_appointments" ON appointments FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_appointments" ON appointments;
CREATE POLICY "anon_delete_appointments" ON appointments FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- APPOINTMENT_LOGS (audit trail)
-- ============================================================
CREATE TABLE IF NOT EXISTS appointment_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES appointments(id) ON DELETE CASCADE,
  old_status appointment_status,
  new_status appointment_status,
  changed_by text,
  changed_at timestamptz DEFAULT now()
);

ALTER TABLE appointment_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_appointment_logs" ON appointment_logs;
CREATE POLICY "anon_select_appointment_logs" ON appointment_logs FOR SELECT
  TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "anon_insert_appointment_logs" ON appointment_logs;
CREATE POLICY "anon_insert_appointment_logs" ON appointment_logs FOR INSERT
  TO anon, authenticated WITH CHECK (true);
DROP POLICY IF EXISTS "anon_update_appointment_logs" ON appointment_logs;
CREATE POLICY "anon_update_appointment_logs" ON appointment_logs FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_delete_appointment_logs" ON appointment_logs;
CREATE POLICY "anon_delete_appointment_logs" ON appointment_logs FOR DELETE
  TO anon, authenticated USING (true);

-- ============================================================
-- INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_appointments_staff_time ON appointments (staff_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appointments_customer ON appointments (customer_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (status);
CREATE INDEX IF NOT EXISTS idx_appointments_start_time ON appointments (start_time);
CREATE INDEX IF NOT EXISTS idx_staff_services_staff ON staff_services (staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_services_service ON staff_services (service_id);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_staff ON staff_schedules (staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_time_off_staff_date ON staff_time_off (staff_id, date);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers (phone);

-- ============================================================
-- EXCLUSION CONSTRAINT (BR-04: no overlapping active appointments)
-- Prevents double-booking at the database level.
-- Only applies to non-cancelled, non-completed, non-no_show appointments.
-- ============================================================
DO $$ BEGIN
  CREATE EXTENSION IF NOT EXISTS btree_gist;
EXCEPTION WHEN others THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE appointments
  ADD CONSTRAINT no_overlapping_appointments
  EXCLUDE USING gist (
    staff_id WITH =,
    tstzrange(start_time, end_time) WITH &&
  ) WHERE (status NOT IN ('cancelled', 'completed', 'no_show'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- TRIGGER: auto-update updated_at
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_services_updated ON services;
CREATE TRIGGER trg_services_updated BEFORE UPDATE ON services
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_staff_updated ON staff;
CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON staff
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_customers_updated ON customers;
CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_appointments_updated ON appointments;
CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TRIGGER: auto-log appointment status changes
-- ============================================================
CREATE OR REPLACE FUNCTION log_appointment_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO appointment_logs (appointment_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status, current_setting('app.current_user', true));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appointments_log ON appointments;
CREATE TRIGGER trg_appointments_log AFTER UPDATE ON appointments
  FOR EACH ROW EXECUTE FUNCTION log_appointment_change();