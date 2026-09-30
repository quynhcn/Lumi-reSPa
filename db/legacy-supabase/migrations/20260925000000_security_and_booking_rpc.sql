/*
# Security hardening + server-side booking

1. Role helpers: app_role(), app_staff_id(), is_admin() (SECURITY DEFINER, no RLS recursion).
2. Profiles: users can only READ their own row (no self role escalation). Admin can read all.
3. RLS rewritten by role (replaces every "anon_*" full-CRUD policy):
   - Catalog (services, staff, staff_services, staff_schedules, staff_time_off): public read, admin write.
   - customers: owner (user_id = auth.uid()) or admin/staff read; owner/admin update; admin insert/delete.
   - appointments: owner / assigned staff / admin read; staff (own) + admin update; admin insert/delete.
     Customers create appointments ONLY through book_appointment().
   - appointment_logs: admin read; written only by trigger.
4. handle_new_user also creates the linked customers row from signup metadata.
5. RPC get_available_slots(service, staff|null, date): slot list computed in DB (spa time zone),
   no customer PII exposed, one round-trip.
6. RPC book_appointment(...): price/duration from DB, customer resolved by auth.uid(),
   staff auto-assigned if null, relies on exclusion constraint for race safety.

Spa time zone: Asia/Ho_Chi_Minh (UTC+7).
*/

-- ============================================================
-- 1. ROLE HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.app_role()
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    ELSE COALESCE((SELECT role FROM profiles WHERE id = auth.uid()), 'customer')
  END;
$$;

CREATE OR REPLACE FUNCTION public.app_staff_id()
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT staff_id FROM profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(public.app_role() = 'admin', false);
$$;

-- ============================================================
-- 2. DROP OLD OPEN POLICIES
-- ============================================================
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname = 'public'
      AND (policyname LIKE 'anon\_%' OR tablename = 'profiles'
           OR policyname LIKE 'catalog\_%' OR policyname LIKE 'customers\_%'
           OR policyname LIKE 'appointments\_%' OR policyname LIKE 'logs\_%')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ============================================================
-- 3. PROFILES — read-only for the owner, admin sees all
-- ============================================================
CREATE POLICY "profiles_select" ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());
-- No INSERT/UPDATE/DELETE policies: rows are created by trigger, roles changed via SQL/admin only.

-- ============================================================
-- 4. CATALOG TABLES — public read, admin write
-- ============================================================
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['services','staff','staff_services','staff_schedules','staff_time_off'] LOOP
    EXECUTE format('CREATE POLICY "catalog_select_%1$s" ON %1$I FOR SELECT TO anon, authenticated USING (true)', t);
    EXECUTE format('CREATE POLICY "catalog_admin_write_%1$s" ON %1$I FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin())', t);
  END LOOP;
END $$;

-- ============================================================
-- 5. CUSTOMERS
-- ============================================================
CREATE POLICY "customers_select" ON customers FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.app_role() IN ('admin', 'staff'));
CREATE POLICY "customers_update" ON customers FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid() OR public.is_admin());
CREATE POLICY "customers_insert" ON customers FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "customers_delete" ON customers FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 6. APPOINTMENTS
-- ============================================================
CREATE POLICY "appointments_select" ON appointments FOR SELECT TO authenticated
  USING (
    public.is_admin()
    OR (public.app_role() = 'staff' AND staff_id = public.app_staff_id())
    OR customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid())
  );
CREATE POLICY "appointments_update" ON appointments FOR UPDATE TO authenticated
  USING (public.is_admin() OR (public.app_role() = 'staff' AND staff_id = public.app_staff_id()))
  WITH CHECK (public.is_admin() OR (public.app_role() = 'staff' AND staff_id = public.app_staff_id()));
CREATE POLICY "appointments_insert" ON appointments FOR INSERT TO authenticated
  WITH CHECK (public.is_admin());
CREATE POLICY "appointments_delete" ON appointments FOR DELETE TO authenticated
  USING (public.is_admin());

-- ============================================================
-- 7. APPOINTMENT LOGS — admin read, trigger write
-- ============================================================
CREATE POLICY "logs_select" ON appointment_logs FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION log_appointment_change()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO appointment_logs (appointment_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status,
            COALESCE((SELECT email FROM profiles WHERE id = auth.uid()), auth.uid()::text));
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 8. SIGNUP TRIGGER — profile + linked customer row
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'customer')
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO customers (name, phone, email, user_id)
  VALUES (
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), split_part(NEW.email, '@', 1)),
    COALESCE(trim(NEW.raw_user_meta_data->>'phone'), ''),
    NEW.email,
    NEW.id
  )
  ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 9. RPC: available slots (30-minute grid, spa local time)
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_service_id uuid,
  p_staff_id uuid,
  p_date date
)
RETURNS TABLE (slot_time text, staff_count int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH svc AS (
    SELECT make_interval(mins => duration_min) AS dur
    FROM services WHERE id = p_service_id AND is_active
  ),
  eligible AS (
    SELECT s.id
    FROM staff s
    JOIN staff_services ss ON ss.staff_id = s.id AND ss.service_id = p_service_id
    WHERE s.is_active
      AND (p_staff_id IS NULL OR s.id = p_staff_id)
      AND NOT EXISTS (SELECT 1 FROM staff_time_off t WHERE t.staff_id = s.id AND t.date = p_date)
  ),
  candidates AS (
    SELECT e.id AS staff_id, gs AS local_start, gs + svc.dur AS local_end,
           sc.break_start, sc.break_end
    FROM eligible e
    JOIN staff_schedules sc ON sc.staff_id = e.id AND sc.day_of_week = extract(dow FROM p_date)::int
    CROSS JOIN svc
    CROSS JOIN LATERAL generate_series(
      p_date + sc.start_time,
      p_date + sc.end_time - svc.dur,
      interval '30 minutes'
    ) AS gs
  )
  SELECT to_char(c.local_start, 'HH24:MI') AS slot_time,
         count(DISTINCT c.staff_id)::int AS staff_count
  FROM candidates c
  WHERE (c.local_start AT TIME ZONE 'Asia/Ho_Chi_Minh') > now()
    AND (c.break_start IS NULL
         OR NOT (c.local_start::time < c.break_end AND c.local_end::time > c.break_start))
    AND NOT EXISTS (
      SELECT 1 FROM appointments a
      WHERE a.staff_id = c.staff_id
        AND a.status NOT IN ('cancelled', 'completed', 'no_show')
        AND a.start_time < (c.local_end AT TIME ZONE 'Asia/Ho_Chi_Minh')
        AND a.end_time > (c.local_start AT TIME ZONE 'Asia/Ho_Chi_Minh')
    )
  GROUP BY 1
  ORDER BY 1;
$$;

-- ============================================================
-- 10. RPC: book appointment
-- ============================================================
CREATE OR REPLACE FUNCTION public.book_appointment(
  p_service_id uuid,
  p_staff_id uuid,          -- NULL = any staff
  p_date date,              -- spa local date
  p_time text,              -- 'HH:MM' spa local time
  p_name text,
  p_phone text,
  p_email text,
  p_notes text
)
RETURNS TABLE (booking_code text, staff_id uuid, staff_name text, start_time timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_svc services%ROWTYPE;
  v_customer uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_staff record;
  v_code text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF coalesce(trim(p_name), '') = '' OR length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) < 9 THEN
    RAISE EXCEPTION 'INVALID_CUSTOMER';
  END IF;
  IF p_date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 60 THEN
    RAISE EXCEPTION 'DATE_TOO_FAR';
  END IF;

  SELECT * INTO v_svc FROM services WHERE id = p_service_id AND is_active;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND';
  END IF;

  v_start := (p_date + p_time::time) AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_end := v_start + make_interval(mins => v_svc.duration_min);

  IF public.app_role() IN ('admin', 'staff') THEN
    -- Front desk booking on behalf of a (walk-in / phone) customer: match by phone, else create.
    SELECT id INTO v_customer FROM customers
    WHERE phone = trim(p_phone)
    ORDER BY (user_id IS NULL), created_at
    LIMIT 1;
    IF v_customer IS NULL THEN
      INSERT INTO customers (name, phone, email)
      VALUES (trim(p_name), trim(p_phone), nullif(trim(p_email), ''))
      RETURNING id INTO v_customer;
    END IF;
  -- Customer booking: always the caller's own profile (never matched by phone)
  ELSE
    SELECT id INTO v_customer FROM customers WHERE user_id = v_uid;
    IF v_customer IS NULL THEN
      INSERT INTO customers (name, phone, email, user_id)
      VALUES (trim(p_name), trim(p_phone), nullif(trim(p_email), ''), v_uid)
      RETURNING id INTO v_customer;
    ELSE
      UPDATE customers
      SET name = trim(p_name), phone = trim(p_phone), email = nullif(trim(p_email), '')
      WHERE id = v_customer;
    END IF;
  END IF;

  FOR v_staff IN
    SELECT s.id, s.name
    FROM staff s
    WHERE (p_staff_id IS NULL OR s.id = p_staff_id)
      AND EXISTS (
        SELECT 1 FROM public.get_available_slots(p_service_id, s.id, p_date) g
        WHERE g.slot_time = to_char(p_time::time, 'HH24:MI')
      )
    ORDER BY (
      SELECT count(*) FROM appointments a
      WHERE a.staff_id = s.id
        AND a.status NOT IN ('cancelled', 'no_show')
        AND (a.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = p_date
    ), s.name
  LOOP
    BEGIN
      INSERT INTO appointments (customer_id, staff_id, service_id, start_time, end_time,
                                status, price, duration_min, notes)
      VALUES (v_customer, v_staff.id, p_service_id, v_start, v_end,
              'confirmed', v_svc.price, v_svc.duration_min, nullif(trim(p_notes), ''))
      RETURNING appointments.booking_code INTO v_code;

      RETURN QUERY SELECT v_code, v_staff.id, v_staff.name, v_start;
      RETURN;
    EXCEPTION WHEN exclusion_violation THEN
      -- Taken concurrently: try next eligible staff
      NULL;
    END;
  END LOOP;

  RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;

REVOKE ALL ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, date) TO anon, authenticated;
