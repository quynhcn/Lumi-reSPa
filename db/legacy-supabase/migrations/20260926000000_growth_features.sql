/*
# Growth features

1. app_settings            — first-visit discount (%) switch, editable by admin, readable by everyone
2. services.includes / compare_at_price — combos ("Massage + gội 90'") with crossed-out price
3. staff.bio / specialties / years_experience — therapist profiles on the landing page
4. service_packages        — multi-session packages (e.g. 5 buổi) shown on the landing page
5. gift_cards              — admin-issued codes: value cards (trừ tiền) or session cards (trừ buổi)
6. appointments            — list_price, discount_amount, gift_card_id, gift_amount, source, reminded_at
7. reviews                 — 1 review per completed appointment, submitted by its owner
8. leads                   — "để lại SĐT, spa gọi tư vấn" (anon insert via RPC, admin handles)
9. RPCs                    — booking_quote, book_appointment (now with discount + gift code),
                             submit_review, get_public_reviews, get_review_summary, create_lead
10. Trigger                — cancelling an appointment refunds the gift card balance / session

Revenue semantics: appointments.price = amount charged for the service AFTER the first-visit discount
(gift_amount is the part of it paid with a prepaid card). Existing revenue code keeps working.
*/

-- ============================================================
-- 1. SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS app_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  first_visit_enabled boolean NOT NULL DEFAULT true,
  first_visit_discount_pct int NOT NULL DEFAULT 10 CHECK (first_visit_discount_pct BETWEEN 0 AND 50),
  updated_at timestamptz DEFAULT now()
);
INSERT INTO app_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "settings_select" ON app_settings;
CREATE POLICY "settings_select" ON app_settings FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "settings_admin_update" ON app_settings;
CREATE POLICY "settings_admin_update" ON app_settings FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 2-3. SERVICES & STAFF EXTRA COLUMNS
-- ============================================================
ALTER TABLE services ADD COLUMN IF NOT EXISTS includes text[] NOT NULL DEFAULT '{}';
ALTER TABLE services ADD COLUMN IF NOT EXISTS compare_at_price integer CHECK (compare_at_price IS NULL OR compare_at_price >= 0);

ALTER TABLE staff ADD COLUMN IF NOT EXISTS bio text;
ALTER TABLE staff ADD COLUMN IF NOT EXISTS specialties text[] NOT NULL DEFAULT '{}';
ALTER TABLE staff ADD COLUMN IF NOT EXISTS years_experience integer CHECK (years_experience IS NULL OR years_experience >= 0);

-- ============================================================
-- 4. PACKAGES
-- ============================================================
CREATE TABLE IF NOT EXISTS service_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  service_id uuid NOT NULL REFERENCES services(id) ON DELETE RESTRICT,
  sessions integer NOT NULL CHECK (sessions >= 2),
  price integer NOT NULL CHECK (price >= 0),
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE service_packages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "packages_select" ON service_packages;
CREATE POLICY "packages_select" ON service_packages FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "packages_admin_write" ON service_packages;
CREATE POLICY "packages_admin_write" ON service_packages FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 5. GIFT CARDS (value or sessions)
-- ============================================================
CREATE OR REPLACE FUNCTION public.current_email() RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT email FROM profiles WHERE id = auth.uid();
$$;

CREATE TABLE IF NOT EXISTS gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL DEFAULT ('SF' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 8))),
  kind text NOT NULL CHECK (kind IN ('value', 'sessions')),
  initial_value integer CHECK (initial_value IS NULL OR initial_value > 0),
  balance integer CHECK (balance IS NULL OR balance >= 0),
  service_id uuid REFERENCES services(id) ON DELETE RESTRICT,
  package_id uuid REFERENCES service_packages(id) ON DELETE SET NULL,
  sessions_total integer CHECK (sessions_total IS NULL OR sessions_total > 0),
  sessions_left integer CHECK (sessions_left IS NULL OR sessions_left >= 0),
  buyer_name text,
  recipient_name text,
  recipient_phone text,
  note text,
  expires_at date,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now(),
  created_by text DEFAULT public.current_email(),
  CHECK (
    (kind = 'value' AND initial_value IS NOT NULL AND balance IS NOT NULL)
    OR (kind = 'sessions' AND service_id IS NOT NULL AND sessions_total IS NOT NULL AND sessions_left IS NOT NULL)
  )
);
ALTER TABLE gift_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "gift_admin_all" ON gift_cards;
CREATE POLICY "gift_admin_all" ON gift_cards FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 6. APPOINTMENT COLUMNS
-- ============================================================
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS list_price integer;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS discount_amount integer NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS gift_card_id uuid REFERENCES gift_cards(id) ON DELETE SET NULL;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS gift_amount integer NOT NULL DEFAULT 0;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS source text NOT NULL DEFAULT 'online';
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reminded_at timestamptz;
UPDATE appointments SET list_price = price + discount_amount WHERE list_price IS NULL;

-- ============================================================
-- 7. REVIEWS
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
  customer_id uuid NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE SET NULL,
  staff_id uuid REFERENCES staff(id) ON DELETE SET NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text CHECK (comment IS NULL OR length(comment) <= 1000),
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "reviews_select" ON reviews;
CREATE POLICY "reviews_select" ON reviews FOR SELECT TO authenticated
  USING (public.is_admin() OR customer_id IN (SELECT id FROM customers WHERE user_id = auth.uid()));
DROP POLICY IF EXISTS "reviews_admin_update" ON reviews;
CREATE POLICY "reviews_admin_update" ON reviews FOR UPDATE TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());
DROP POLICY IF EXISTS "reviews_admin_delete" ON reviews;
CREATE POLICY "reviews_admin_delete" ON reviews FOR DELETE TO authenticated USING (public.is_admin());

-- ============================================================
-- 8. LEADS
-- ============================================================
CREATE TABLE IF NOT EXISTS leads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text NOT NULL,
  interest text,
  note text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'booked', 'closed')),
  created_at timestamptz DEFAULT now(),
  handled_at timestamptz,
  handled_by text
);
CREATE INDEX IF NOT EXISTS idx_leads_status ON leads (status, created_at DESC);
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "leads_admin_all" ON leads;
CREATE POLICY "leads_admin_all" ON leads FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ============================================================
-- 9. PRICING (shared by quote + booking)
-- ============================================================
CREATE OR REPLACE FUNCTION public._digits(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') $$;

/*
  Computes the price of one booking.
  p_first_visit_ok: only true for customers booking online for themselves.
  p_lock: lock the gift card row (FOR UPDATE) when called from book_appointment.
  gift_error: NULL when the code is fine / absent, otherwise a machine code.
*/
CREATE OR REPLACE FUNCTION public._price_booking(
  p_service_id uuid, p_customer_id uuid, p_phone text, p_gift_code text, p_first_visit_ok boolean, p_lock boolean
)
RETURNS TABLE (list_price int, discount_amount int, discount_pct int, gift_card_id uuid, gift_amount int, gift_kind text, gift_error text, total int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_price int;
  v_set app_settings%ROWTYPE;
  v_disc int := 0;
  v_pct int := 0;
  v_card gift_cards%ROWTYPE;
  v_gift int := 0;
  v_err text := NULL;
  v_phone text := public._digits(p_phone);
BEGIN
  SELECT price INTO v_price FROM services WHERE id = p_service_id AND is_active;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND';
  END IF;

  -- First online visit: no earlier non-cancelled appointment for this customer or this phone number
  SELECT * INTO v_set FROM app_settings WHERE id = 1;
  IF p_first_visit_ok AND v_set.first_visit_enabled AND v_set.first_visit_discount_pct > 0
     AND NOT EXISTS (
       SELECT 1 FROM appointments a JOIN customers c ON c.id = a.customer_id
       WHERE a.status <> 'cancelled'
         AND (c.id = p_customer_id OR (length(v_phone) >= 9 AND public._digits(c.phone) = v_phone))
     ) THEN
    v_pct := v_set.first_visit_discount_pct;
    v_disc := round(v_price * v_pct / 100.0 / 1000) * 1000; -- round to 1.000 ₫
  END IF;

  IF nullif(trim(p_gift_code), '') IS NOT NULL THEN
    IF p_lock THEN
      SELECT * INTO v_card FROM gift_cards WHERE code = upper(trim(p_gift_code)) FOR UPDATE;
    ELSE
      SELECT * INTO v_card FROM gift_cards WHERE code = upper(trim(p_gift_code));
    END IF;

    IF v_card.id IS NULL THEN
      v_err := 'GIFT_NOT_FOUND';
    ELSIF NOT v_card.is_active THEN
      v_err := 'GIFT_INACTIVE';
    ELSIF v_card.expires_at IS NOT NULL AND v_card.expires_at < (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date THEN
      v_err := 'GIFT_EXPIRED';
    ELSIF v_card.kind = 'value' AND v_card.balance <= 0 THEN
      v_err := 'GIFT_EMPTY';
    ELSIF v_card.kind = 'sessions' AND v_card.sessions_left <= 0 THEN
      v_err := 'GIFT_EMPTY';
    ELSIF v_card.kind = 'sessions' AND v_card.service_id <> p_service_id THEN
      v_err := 'GIFT_WRONG_SERVICE';
    ELSIF v_card.kind = 'sessions' THEN
      -- A session card pays the whole service; the first-visit discount does not stack with it
      v_disc := 0; v_pct := 0;
      v_gift := v_price;
    ELSE
      v_gift := least(v_card.balance, v_price - v_disc);
    END IF;
  END IF;

  RETURN QUERY SELECT v_price, v_disc, v_pct,
    CASE WHEN v_err IS NULL AND v_gift > 0 THEN v_card.id END,
    CASE WHEN v_err IS NULL THEN v_gift ELSE 0 END,
    CASE WHEN v_err IS NULL THEN v_card.kind END,
    v_err,
    v_price - v_disc - CASE WHEN v_err IS NULL THEN v_gift ELSE 0 END;
END;
$$;
REVOKE ALL ON FUNCTION public._price_booking(uuid, uuid, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;

-- Quote shown in the booking summary before confirming
CREATE OR REPLACE FUNCTION public.booking_quote(p_service_id uuid, p_phone text, p_gift_code text DEFAULT NULL)
RETURNS TABLE (list_price int, discount_amount int, discount_pct int, gift_amount int, gift_kind text, gift_error text, total int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_front boolean := public.app_role() IN ('admin', 'staff');
  v_customer uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'AUTH_REQUIRED'; END IF;
  IF NOT v_front THEN
    SELECT id INTO v_customer FROM customers WHERE user_id = auth.uid();
  END IF;
  RETURN QUERY
    SELECT q.list_price, q.discount_amount, q.discount_pct, q.gift_amount, q.gift_kind, q.gift_error, q.total
    FROM public._price_booking(p_service_id, v_customer, CASE WHEN v_front THEN NULL ELSE p_phone END, p_gift_code, NOT v_front, false) q;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_quote(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_quote(uuid, text, text) TO authenticated;

-- ============================================================
-- 10. BOOK APPOINTMENT (replaces the version without discount / gift code)
-- ============================================================
DROP FUNCTION IF EXISTS public.book_appointment(uuid, uuid, date, text, text, text, text, text);

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_service_id uuid,
  p_staff_id uuid,
  p_date date,
  p_time text,
  p_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_gift_code text DEFAULT NULL
)
RETURNS TABLE (booking_code text, staff_id uuid, staff_name text, start_time timestamptz,
               list_price int, discount_amount int, gift_amount int, total int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_front boolean := public.app_role() IN ('admin', 'staff');
  v_svc services%ROWTYPE;
  v_customer uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_staff record;
  v_code text;
  v_q record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'AUTH_REQUIRED';
  END IF;
  IF coalesce(trim(p_name), '') = '' OR length(public._digits(p_phone)) < 9 THEN
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

  IF v_front THEN
    -- Front desk booking on behalf of a walk-in / phone customer: match by phone, else create.
    SELECT id INTO v_customer FROM customers
    WHERE public._digits(phone) = public._digits(p_phone)
    ORDER BY (user_id IS NULL), created_at
    LIMIT 1;
    IF v_customer IS NULL THEN
      INSERT INTO customers (name, phone, email)
      VALUES (trim(p_name), trim(p_phone), nullif(trim(p_email), ''))
      RETURNING id INTO v_customer;
    END IF;
  ELSE
    SELECT id INTO v_customer FROM customers WHERE user_id = v_uid;
  END IF;

  -- Price before creating / updating the customer row so "first visit" is evaluated correctly
  SELECT * INTO v_q FROM public._price_booking(p_service_id, v_customer, p_phone, p_gift_code, NOT v_front, true);
  IF v_q.gift_error IS NOT NULL THEN
    RAISE EXCEPTION '%', v_q.gift_error;
  END IF;

  IF NOT v_front THEN
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
      INSERT INTO appointments (customer_id, staff_id, service_id, start_time, end_time, status,
                                price, list_price, discount_amount, gift_card_id, gift_amount,
                                duration_min, notes, source)
      VALUES (v_customer, v_staff.id, p_service_id, v_start, v_end, 'confirmed',
              v_q.list_price - v_q.discount_amount, v_q.list_price, v_q.discount_amount, v_q.gift_card_id, v_q.gift_amount,
              v_svc.duration_min, nullif(trim(p_notes), ''), CASE WHEN v_front THEN 'front_desk' ELSE 'online' END)
      RETURNING appointments.booking_code INTO v_code;

      IF v_q.gift_card_id IS NOT NULL THEN
        UPDATE gift_cards
        SET balance = CASE WHEN kind = 'value' THEN balance - v_q.gift_amount ELSE balance END,
            sessions_left = CASE WHEN kind = 'sessions' THEN sessions_left - 1 ELSE sessions_left END
        WHERE id = v_q.gift_card_id;
      END IF;

      RETURN QUERY SELECT v_code, v_staff.id, v_staff.name, v_start,
                          v_q.list_price, v_q.discount_amount, v_q.gift_amount, v_q.total;
      RETURN;
    EXCEPTION WHEN exclusion_violation THEN
      NULL; -- taken concurrently: try the next eligible staff member
    END;
  END LOOP;

  RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;
REVOKE ALL ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text, text) TO authenticated;

-- Refund the gift card when a paid-by-card appointment is cancelled
CREATE OR REPLACE FUNCTION public.refund_gift_on_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND NEW.gift_card_id IS NOT NULL AND NEW.gift_amount > 0 THEN
    UPDATE gift_cards
    SET balance = CASE WHEN kind = 'value' THEN balance + NEW.gift_amount ELSE balance END,
        sessions_left = CASE WHEN kind = 'sessions' THEN least(sessions_left + 1, sessions_total) ELSE sessions_left END
    WHERE id = NEW.gift_card_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_appointments_gift_refund ON appointments;
CREATE TRIGGER trg_appointments_gift_refund AFTER UPDATE OF status ON appointments
  FOR EACH ROW EXECUTE FUNCTION public.refund_gift_on_cancel();

-- ============================================================
-- 11. REVIEWS RPCs
-- ============================================================
CREATE OR REPLACE FUNCTION public.submit_review(p_appointment_id uuid, p_rating int, p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_apt record;
BEGIN
  SELECT a.id, a.status, a.customer_id, a.service_id, a.staff_id INTO v_apt
  FROM appointments a JOIN customers c ON c.id = a.customer_id
  WHERE a.id = p_appointment_id AND c.user_id = auth.uid();
  IF v_apt.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_apt.status <> 'completed' THEN RAISE EXCEPTION 'NOT_COMPLETED'; END IF;
  IF p_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'INVALID_RATING'; END IF;
  INSERT INTO reviews (appointment_id, customer_id, service_id, staff_id, rating, comment)
  VALUES (v_apt.id, v_apt.customer_id, v_apt.service_id, v_apt.staff_id, p_rating, nullif(left(trim(p_comment), 1000), ''))
  ON CONFLICT (appointment_id) DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'ALREADY_REVIEWED'; END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.submit_review(uuid, int, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, int, text) TO authenticated;

-- Public: only first name (given name = last word in Vietnamese) + service; never phone / full name
CREATE OR REPLACE FUNCTION public.get_public_reviews(p_limit int DEFAULT 6)
RETURNS TABLE (id uuid, rating int, comment text, author text, service_name text, created_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.rating, r.comment,
         regexp_replace(trim(c.name), '^.*\s', ''),
         s.name, r.created_at
  FROM reviews r
  JOIN customers c ON c.id = r.customer_id
  LEFT JOIN services s ON s.id = r.service_id
  WHERE r.is_published AND r.comment IS NOT NULL
  ORDER BY r.rating DESC, r.created_at DESC
  LIMIT least(greatest(p_limit, 1), 20);
$$;

CREATE OR REPLACE FUNCTION public.get_review_summary()
RETURNS TABLE (average numeric, total int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT round(avg(rating)::numeric, 1), count(*)::int FROM reviews WHERE is_published;
$$;
GRANT EXECUTE ON FUNCTION public.get_public_reviews(int) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_review_summary() TO anon, authenticated;

-- ============================================================
-- 12. LEADS RPC (public form)
-- ============================================================
CREATE OR REPLACE FUNCTION public.create_lead(p_name text, p_phone text, p_interest text DEFAULT NULL, p_note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_id uuid;
  v_phone text := public._digits(p_phone);
BEGIN
  IF coalesce(trim(p_name), '') = '' OR v_phone !~ '^(0|84)\d{8,10}$' THEN
    RAISE EXCEPTION 'INVALID_LEAD';
  END IF;
  -- Basic abuse guard for a public form
  IF (SELECT count(*) FROM leads WHERE created_at > now() - interval '10 minutes') >= 30 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;
  -- Same phone asked again within a day: update the open request instead of duplicating it
  SELECT id INTO v_id FROM leads
  WHERE public._digits(phone) = v_phone AND status = 'new' AND created_at > now() - interval '1 day'
  ORDER BY created_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE leads SET interest = coalesce(nullif(trim(p_interest), ''), interest),
                     note = coalesce(nullif(left(trim(p_note), 500), ''), note)
    WHERE id = v_id;
    RETURN v_id;
  END IF;
  INSERT INTO leads (name, phone, interest, note)
  VALUES (left(trim(p_name), 100), trim(p_phone), nullif(left(trim(p_interest), 100), ''), nullif(left(trim(p_note), 500), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.create_lead(text, text, text, text) TO anon, authenticated;
