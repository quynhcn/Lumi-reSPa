/*
# Conversion logic (vòng 8)

1. Guest booking with phone OTP — handle_new_user supports phone-only accounts and takes over the
   walk-in customer row the front desk created for the same (verified) number.
2. Slot holds — hold_slot() keeps the chosen time for 10 minutes while the guest fills in the form / OTP.
   get_available_slots() ignores the caller's own hold (p_holder) and can ignore one appointment (reschedule).
3. Reschedule — reschedule_appointment(): customer (≥ 2h before, max 2 times) or admin; keeps code, price, card.
4. Return-visit voucher — a completed appointment issues a personal "giảm X% lần sau" code (gift_cards kind 'percent').
5. Review requests — tokenised review link (no login) + review_requests queue for the front desk.
6. No-show guard — customers with ≥ N no-shows get 'pending' (spa confirms by phone) instead of 'confirmed'.
7. Front-desk first-visit discount — optional p_apply_first_visit for bookings made on behalf of a customer.
*/

-- ============================================================
-- SETTINGS
-- ============================================================
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS return_visit_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS return_visit_pct int NOT NULL DEFAULT 10 CHECK (return_visit_pct BETWEEN 1 AND 50);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS return_visit_days int NOT NULL DEFAULT 30 CHECK (return_visit_days BETWEEN 1 AND 365);
ALTER TABLE app_settings ADD COLUMN IF NOT EXISTS no_show_threshold int NOT NULL DEFAULT 2 CHECK (no_show_threshold BETWEEN 0 AND 10); -- 0 = off

-- ============================================================
-- 1. PHONE (OTP) ACCOUNTS
-- ============================================================
/* Supabase stores auth.users.phone as E.164 digits without '+', e.g. 84901234567 → shown as 0901234567. */
CREATE OR REPLACE FUNCTION public._vn_phone(p text) RETURNS text
LANGUAGE sql IMMUTABLE AS $$
  SELECT CASE WHEN public._digits(p) ~ '^84\d{9,10}$' THEN '0' || substr(public._digits(p), 3) ELSE public._digits(p) END
$$;

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_phone text := nullif(public._vn_phone(NEW.phone), '');
  v_claimed uuid;
BEGIN
  INSERT INTO profiles (id, email, role)
  VALUES (NEW.id, NEW.email, 'customer')
  ON CONFLICT (id) DO NOTHING;

  -- Phone account: take over the walk-in customer created by the front desk for this number
  -- (only the owner of the number can ever get a session for this auth user, so history stays private).
  IF v_phone IS NOT NULL THEN
    UPDATE customers SET user_id = NEW.id
    WHERE id = (SELECT id FROM customers
                WHERE user_id IS NULL AND public._vn_phone(phone) = v_phone
                ORDER BY created_at LIMIT 1)
    RETURNING id INTO v_claimed;
    IF v_claimed IS NOT NULL THEN
      RETURN NEW;
    END IF;
  END IF;

  INSERT INTO customers (name, phone, email, user_id)
  VALUES (
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''), NULLIF(split_part(NEW.email, '@', 1), ''), 'Khách'),
    COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''), v_phone, ''),
    NEW.email,
    NEW.id
  )
  ON CONFLICT (user_id) WHERE user_id IS NOT NULL DO NOTHING;

  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. SLOT HOLDS
-- ============================================================
CREATE TABLE IF NOT EXISTS slot_holds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  holder uuid NOT NULL,                 -- random id kept by the browser tab
  staff_id uuid NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  service_id uuid REFERENCES services(id) ON DELETE CASCADE,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  expires_at timestamptz NOT NULL,
  client_ip text,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_slot_holds_staff ON slot_holds (staff_id, start_time);
CREATE INDEX IF NOT EXISTS idx_slot_holds_holder ON slot_holds (holder);
ALTER TABLE slot_holds ENABLE ROW LEVEL SECURITY; -- no policies: RPC access only

DROP FUNCTION IF EXISTS public.get_available_slots(uuid, uuid, date);
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_service_id uuid,
  p_staff_id uuid,
  p_date date,
  p_holder uuid DEFAULT NULL,             -- the caller's own hold does not block them
  p_ignore_appointment uuid DEFAULT NULL  -- rescheduling: the appointment being moved does not block itself
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
        AND a.id IS DISTINCT FROM p_ignore_appointment
        AND a.start_time < (c.local_end AT TIME ZONE 'Asia/Ho_Chi_Minh')
        AND a.end_time > (c.local_start AT TIME ZONE 'Asia/Ho_Chi_Minh')
    )
    AND NOT EXISTS (
      SELECT 1 FROM slot_holds h
      WHERE h.staff_id = c.staff_id
        AND h.expires_at > now()
        AND h.holder IS DISTINCT FROM p_holder
        AND h.start_time < (c.local_end AT TIME ZONE 'Asia/Ho_Chi_Minh')
        AND h.end_time > (c.local_start AT TIME ZONE 'Asia/Ho_Chi_Minh')
    )
  GROUP BY 1
  ORDER BY 1;
$$;
GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, uuid, date, uuid, uuid) TO anon, authenticated;

/*
  Hold a slot for 10 minutes (best effort — the UI ignores errors).
  Abuse guard: max 3 active holds per client IP, 200 overall.
*/
CREATE OR REPLACE FUNCTION public.hold_slot(p_service_id uuid, p_staff_id uuid, p_date date, p_time text, p_holder uuid)
RETURNS TABLE (staff_id uuid, expires_at timestamptz)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_ip text := nullif(trim(split_part(coalesce(current_setting('request.headers', true)::json ->> 'x-forwarded-for', ''), ',', 1)), '');
  v_dur int;
  v_start timestamptz;
  v_staff uuid;
  v_exp timestamptz := now() + interval '10 minutes';
BEGIN
  IF p_holder IS NULL THEN RAISE EXCEPTION 'INVALID_HOLDER'; END IF;
  DELETE FROM slot_holds WHERE holder = p_holder OR slot_holds.expires_at < now() - interval '1 hour';

  IF (SELECT count(*) FROM slot_holds h WHERE h.expires_at > now()) >= 200
     OR (v_ip IS NOT NULL AND (SELECT count(*) FROM slot_holds h WHERE h.client_ip = v_ip AND h.expires_at > now()) >= 3) THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;

  SELECT duration_min INTO v_dur FROM services WHERE id = p_service_id AND is_active;
  IF v_dur IS NULL THEN RAISE EXCEPTION 'SERVICE_NOT_FOUND'; END IF;
  v_start := (p_date + p_time::time) AT TIME ZONE 'Asia/Ho_Chi_Minh';

  SELECT s.id INTO v_staff
  FROM staff s
  WHERE (p_staff_id IS NULL OR s.id = p_staff_id)
    AND EXISTS (SELECT 1 FROM public.get_available_slots(p_service_id, s.id, p_date, p_holder) g
                WHERE g.slot_time = to_char(p_time::time, 'HH24:MI'))
  ORDER BY (SELECT count(*) FROM appointments a
            WHERE a.staff_id = s.id AND a.status NOT IN ('cancelled', 'no_show')
              AND (a.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = p_date), s.name
  LIMIT 1;
  IF v_staff IS NULL THEN RAISE EXCEPTION 'SLOT_UNAVAILABLE'; END IF;

  INSERT INTO slot_holds (holder, staff_id, service_id, start_time, end_time, expires_at, client_ip)
  VALUES (p_holder, v_staff, p_service_id, v_start, v_start + make_interval(mins => v_dur), v_exp, v_ip);
  RETURN QUERY SELECT v_staff, v_exp;
END;
$$;
GRANT EXECUTE ON FUNCTION public.hold_slot(uuid, uuid, date, text, uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.release_hold(p_holder uuid) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  DELETE FROM slot_holds WHERE holder = p_holder;
$$;
GRANT EXECUTE ON FUNCTION public.release_hold(uuid) TO anon, authenticated;

-- ============================================================
-- 3. RESCHEDULE
-- ============================================================
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS reschedule_count int NOT NULL DEFAULT 0;
ALTER TABLE appointment_logs ADD COLUMN IF NOT EXISTS note text;

CREATE OR REPLACE FUNCTION public.reschedule_appointment(p_id uuid, p_date date, p_time text, p_staff_id uuid DEFAULT NULL)
RETURNS TABLE (start_time timestamptz, staff_id uuid, staff_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_admin boolean := public.is_admin();
  v_apt appointments%ROWTYPE;
  v_owner uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_staff record;
BEGIN
  SELECT a.* INTO v_apt FROM appointments a WHERE a.id = p_id;
  SELECT c.user_id INTO v_owner FROM customers c WHERE c.id = v_apt.customer_id;
  IF v_apt.id IS NULL OR NOT (v_admin OR (auth.uid() IS NOT NULL AND v_owner = auth.uid())) THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF v_apt.status NOT IN ('pending', 'confirmed') THEN RAISE EXCEPTION 'NOT_RESCHEDULABLE'; END IF;
  IF NOT v_admin THEN
    IF v_apt.start_time < now() + interval '2 hours' THEN RAISE EXCEPTION 'TOO_LATE'; END IF;
    IF v_apt.reschedule_count >= 2 THEN RAISE EXCEPTION 'RESCHEDULE_LIMIT'; END IF;
  END IF;
  IF p_date > (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date + 60 THEN RAISE EXCEPTION 'DATE_TOO_FAR'; END IF;

  v_start := (p_date + p_time::time) AT TIME ZONE 'Asia/Ho_Chi_Minh';
  v_end := v_start + make_interval(mins => v_apt.duration_min);

  FOR v_staff IN
    SELECT s.id, s.name FROM staff s
    WHERE (p_staff_id IS NULL OR s.id = p_staff_id)
      AND EXISTS (SELECT 1 FROM public.get_available_slots(v_apt.service_id, s.id, p_date, NULL, p_id) g
                  WHERE g.slot_time = to_char(p_time::time, 'HH24:MI'))
    ORDER BY (s.id = v_apt.staff_id) DESC, s.name  -- keep the same therapist when possible
  LOOP
    BEGIN
      UPDATE appointments
      SET start_time = v_start, end_time = v_end, staff_id = v_staff.id,
          reminded_at = NULL, reschedule_count = reschedule_count + 1
      WHERE id = p_id;
      INSERT INTO appointment_logs (appointment_id, old_status, new_status, changed_by, note)
      VALUES (p_id, v_apt.status, v_apt.status,
              COALESCE((SELECT email FROM profiles WHERE id = auth.uid()), auth.uid()::text),
              'Đổi giờ: ' || to_char(v_apt.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM')
                || ' → ' || to_char(v_start AT TIME ZONE 'Asia/Ho_Chi_Minh', 'HH24:MI DD/MM')
                || CASE WHEN v_staff.id <> v_apt.staff_id THEN ' (' || v_staff.name || ')' ELSE '' END);
      RETURN QUERY SELECT v_start, v_staff.id, v_staff.name;
      RETURN;
    EXCEPTION WHEN exclusion_violation THEN
      NULL;
    END;
  END LOOP;
  RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;
REVOKE ALL ON FUNCTION public.reschedule_appointment(uuid, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_appointment(uuid, date, text, uuid) TO authenticated;

-- ============================================================
-- 4. RETURN-VISIT VOUCHERS (gift_cards kind 'percent')
-- ============================================================
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS percent_off int CHECK (percent_off IS NULL OR percent_off BETWEEN 1 AND 100);
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS customer_id uuid REFERENCES customers(id) ON DELETE CASCADE;
ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS source_appointment_id uuid REFERENCES appointments(id) ON DELETE SET NULL;
ALTER TABLE gift_cards DROP CONSTRAINT IF EXISTS gift_cards_kind_check;
ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_kind_check CHECK (kind IN ('value', 'sessions', 'percent'));
ALTER TABLE gift_cards DROP CONSTRAINT IF EXISTS gift_cards_check;
ALTER TABLE gift_cards ADD CONSTRAINT gift_cards_check CHECK (
  (kind = 'value' AND initial_value IS NOT NULL AND balance IS NOT NULL)
  OR (kind = 'sessions' AND service_id IS NOT NULL AND sessions_total IS NOT NULL AND sessions_left IS NOT NULL)
  OR (kind = 'percent' AND percent_off IS NOT NULL AND sessions_total IS NOT NULL AND sessions_left IS NOT NULL)
);
CREATE INDEX IF NOT EXISTS idx_gift_cards_customer ON gift_cards (customer_id) WHERE customer_id IS NOT NULL;

ALTER TABLE appointments DROP CONSTRAINT IF EXISTS appointments_discount_reason_check;
ALTER TABLE appointments ADD CONSTRAINT appointments_discount_reason_check
  CHECK (discount_reason IS NULL OR discount_reason IN ('first_visit', 'package', 'return_visit'));

CREATE OR REPLACE FUNCTION public.issue_return_voucher()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_set app_settings%ROWTYPE;
  v_c customers%ROWTYPE;
  v_today date := (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;
BEGIN
  SELECT * INTO v_set FROM app_settings WHERE id = 1;
  IF NOT v_set.return_visit_enabled THEN RETURN NEW; END IF;
  -- one open voucher per customer at a time
  IF EXISTS (SELECT 1 FROM gift_cards g WHERE g.customer_id = NEW.customer_id AND g.kind = 'percent'
             AND g.is_active AND g.sessions_left > 0 AND (g.expires_at IS NULL OR g.expires_at >= v_today)) THEN
    RETURN NEW;
  END IF;
  SELECT * INTO v_c FROM customers WHERE id = NEW.customer_id;
  INSERT INTO gift_cards (kind, percent_off, sessions_total, sessions_left, customer_id, recipient_name, recipient_phone,
                          expires_at, note, source_appointment_id, created_by)
  VALUES ('percent', v_set.return_visit_pct, 1, 1, NEW.customer_id, v_c.name, v_c.phone,
          v_today + v_set.return_visit_days, 'Quà cảm ơn sau buổi hẹn — tự động', NEW.id, 'Tự động');
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_appointments_return_voucher ON appointments;
CREATE TRIGGER trg_appointments_return_voucher AFTER UPDATE OF status ON appointments
  FOR EACH ROW WHEN (NEW.status = 'completed' AND OLD.status IS DISTINCT FROM 'completed')
  EXECUTE FUNCTION public.issue_return_voucher();

-- Refund on cancel: value → balance back; sessions / percent → one use back
CREATE OR REPLACE FUNCTION public.refund_gift_on_cancel()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'cancelled' AND OLD.status <> 'cancelled' AND NEW.gift_card_id IS NOT NULL THEN
    UPDATE gift_cards
    SET balance = CASE WHEN kind = 'value' THEN balance + NEW.gift_amount ELSE balance END,
        sessions_left = CASE WHEN kind IN ('sessions', 'percent') THEN least(sessions_left + 1, sessions_total) ELSE sessions_left END
    WHERE id = NEW.gift_card_id;
  END IF;
  RETURN NEW;
END;
$$;

/* The signed-in customer's own active cards and vouchers (issued to them, or to their verified phone number). */
CREATE OR REPLACE FUNCTION public.my_vouchers()
RETURNS TABLE (code text, kind text, percent_off int, balance int, sessions_left int, service_name text, expires_at date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH me AS (
    SELECT c.id AS customer_id,
           (SELECT public._vn_phone(u.phone) FROM auth.users u WHERE u.id = auth.uid() AND u.phone_confirmed_at IS NOT NULL) AS phone
    FROM customers c WHERE c.user_id = auth.uid()
  )
  SELECT g.code, g.kind, g.percent_off, g.balance, g.sessions_left, s.name, g.expires_at
  FROM gift_cards g
  CROSS JOIN me
  LEFT JOIN services s ON s.id = g.service_id
  WHERE g.is_active
    AND (g.expires_at IS NULL OR g.expires_at >= (now() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)
    AND ((g.kind = 'value' AND g.balance > 0) OR (g.kind <> 'value' AND g.sessions_left > 0))
    AND (g.customer_id = me.customer_id OR (me.phone IS NOT NULL AND public._vn_phone(g.recipient_phone) = me.phone))
  ORDER BY g.expires_at NULLS LAST;
$$;
REVOKE ALL ON FUNCTION public.my_vouchers() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_vouchers() TO authenticated;

-- ============================================================
-- PRICING + BOOKING (percent vouchers, front-desk first visit, holds, no-show guard)
-- ============================================================
DROP FUNCTION IF EXISTS public.booking_quote(uuid, text, text);
DROP FUNCTION IF EXISTS public.book_appointment(uuid, uuid, date, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public._price_booking(uuid, uuid, text, text, boolean, boolean);

CREATE OR REPLACE FUNCTION public._price_booking(
  p_service_id uuid, p_customer_id uuid, p_phone text, p_gift_code text, p_first_visit_ok boolean, p_lock boolean
)
RETURNS TABLE (list_price int, discount_amount int, discount_pct int, discount_reason text, gift_card_id uuid,
               gift_amount int, gift_kind text, gift_error text, total int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_price int;
  v_set app_settings%ROWTYPE;
  v_disc int := 0;
  v_pct int := 0;
  v_reason text := NULL;
  v_card gift_cards%ROWTYPE;
  v_use_card boolean := false;
  v_gift int := 0;
  v_err text := NULL;
  v_tmp int;
  v_phone text := public._vn_phone(p_phone);
BEGIN
  SELECT price INTO v_price FROM services WHERE id = p_service_id AND is_active;
  IF v_price IS NULL THEN
    RAISE EXCEPTION 'SERVICE_NOT_FOUND';
  END IF;

  -- First visit: no earlier non-cancelled appointment for this customer or this phone number
  SELECT * INTO v_set FROM app_settings WHERE id = 1;
  IF p_first_visit_ok AND v_set.first_visit_enabled AND v_set.first_visit_discount_pct > 0
     AND NOT EXISTS (
       SELECT 1 FROM appointments a JOIN customers c ON c.id = a.customer_id
       WHERE a.status <> 'cancelled'
         AND (c.id = p_customer_id OR (length(v_phone) >= 9 AND public._vn_phone(c.phone) = v_phone))
     ) THEN
    v_pct := v_set.first_visit_discount_pct;
    v_disc := round(v_price * v_pct / 100.0 / 1000) * 1000; -- round to 1.000 ₫
    v_reason := 'first_visit';
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
    ELSIF v_card.kind IN ('sessions', 'percent') AND v_card.sessions_left <= 0 THEN
      v_err := 'GIFT_EMPTY';
    ELSIF v_card.kind = 'sessions' AND v_card.service_id <> p_service_id THEN
      v_err := 'GIFT_WRONG_SERVICE';
    ELSIF v_card.kind = 'percent' AND v_card.customer_id IS NOT NULL
          AND v_card.customer_id IS DISTINCT FROM p_customer_id
          AND public._vn_phone(v_card.recipient_phone) IS DISTINCT FROM v_phone THEN
      v_err := 'GIFT_NOT_YOURS'; -- personal voucher
    ELSIF v_card.kind = 'sessions' THEN
      -- A session card pays the whole service; the first-visit discount does not stack with it.
      -- Sold as a package: the saving is a package discount so price = what was actually paid.
      v_pct := 0;
      IF v_card.session_value IS NOT NULL AND v_card.session_value < v_price THEN
        v_disc := v_price - v_card.session_value; v_reason := 'package';
      ELSE
        v_disc := 0; v_reason := NULL;
      END IF;
      v_gift := v_price - v_disc;
      v_use_card := true;
    ELSIF v_card.kind = 'percent' THEN
      -- Does not stack with the first-visit discount: the bigger one wins (the voucher stays unused otherwise)
      v_tmp := round(v_price * v_card.percent_off / 100.0 / 1000) * 1000;
      IF v_tmp > v_disc THEN
        v_disc := v_tmp; v_pct := v_card.percent_off; v_reason := 'return_visit'; v_use_card := true;
      END IF;
    ELSE
      v_gift := least(v_card.balance, v_price - v_disc);
      v_use_card := v_gift > 0;
    END IF;
  END IF;

  RETURN QUERY SELECT v_price, v_disc, v_pct, CASE WHEN v_disc > 0 THEN v_reason END,
    CASE WHEN v_err IS NULL AND v_use_card THEN v_card.id END,
    CASE WHEN v_err IS NULL THEN v_gift ELSE 0 END,
    CASE WHEN v_err IS NULL THEN v_card.kind END,
    v_err,
    v_price - v_disc - CASE WHEN v_err IS NULL THEN v_gift ELSE 0 END;
END;
$$;
REVOKE ALL ON FUNCTION public._price_booking(uuid, uuid, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.booking_quote(
  p_service_id uuid, p_phone text, p_gift_code text DEFAULT NULL, p_apply_first_visit boolean DEFAULT false
)
RETURNS TABLE (list_price int, discount_amount int, discount_pct int, discount_reason text, gift_amount int,
               gift_kind text, gift_error text, total int)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_front boolean := public.app_role() IN ('admin', 'staff');
  v_customer uuid;
BEGIN
  -- Guests (not verified yet) get the list price + gift code check; the first-visit discount is
  -- decided at booking time, after the phone number is verified (no probing of who is a customer).
  IF auth.uid() IS NULL THEN
    RETURN QUERY
      SELECT q.list_price, q.discount_amount, q.discount_pct, q.discount_reason, q.gift_amount, q.gift_kind, q.gift_error, q.total
      FROM public._price_booking(p_service_id, NULL, p_phone, p_gift_code, false, false) q;
    RETURN;
  END IF;
  IF v_front THEN
    SELECT id INTO v_customer FROM customers WHERE public._vn_phone(phone) = public._vn_phone(p_phone)
    ORDER BY (user_id IS NULL), created_at LIMIT 1;
  ELSE
    SELECT id INTO v_customer FROM customers WHERE user_id = auth.uid();
  END IF;
  RETURN QUERY
    SELECT q.list_price, q.discount_amount, q.discount_pct, q.discount_reason, q.gift_amount, q.gift_kind, q.gift_error, q.total
    FROM public._price_booking(p_service_id, v_customer, p_phone, p_gift_code, NOT v_front OR p_apply_first_visit, false) q;
END;
$$;
GRANT EXECUTE ON FUNCTION public.booking_quote(uuid, text, text, boolean) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.book_appointment(
  p_service_id uuid,
  p_staff_id uuid,
  p_date date,
  p_time text,
  p_name text,
  p_phone text,
  p_email text,
  p_notes text,
  p_gift_code text DEFAULT NULL,
  p_holder uuid DEFAULT NULL,
  p_apply_first_visit boolean DEFAULT false
)
RETURNS TABLE (booking_code text, staff_id uuid, staff_name text, start_time timestamptz, status text,
               list_price int, discount_amount int, discount_reason text, gift_amount int, total int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_uid uuid := auth.uid();
  v_front boolean := public.app_role() IN ('admin', 'staff');
  v_svc services%ROWTYPE;
  v_set app_settings%ROWTYPE;
  v_customer uuid;
  v_start timestamptz;
  v_end timestamptz;
  v_staff record;
  v_code text;
  v_q record;
  v_status appointment_status := 'confirmed';
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
    WHERE public._vn_phone(phone) = public._vn_phone(p_phone)
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
  SELECT * INTO v_q FROM public._price_booking(p_service_id, v_customer, p_phone, p_gift_code, NOT v_front OR p_apply_first_visit, true);
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
      SET name = trim(p_name), phone = trim(p_phone), email = coalesce(nullif(trim(p_email), ''), email)
      WHERE id = v_customer;
    END IF;

    -- No-show guard: repeat no-shows book as 'pending' — the spa confirms by phone first
    SELECT * INTO v_set FROM app_settings WHERE id = 1;
    IF v_set.no_show_threshold > 0 AND (
      SELECT count(*) FROM appointments a JOIN customers c ON c.id = a.customer_id
      WHERE a.status = 'no_show'
        AND (c.id = v_customer OR public._vn_phone(c.phone) = public._vn_phone(p_phone))
    ) >= v_set.no_show_threshold THEN
      v_status := 'pending';
    END IF;
  END IF;

  FOR v_staff IN
    SELECT s.id, s.name
    FROM staff s
    WHERE (p_staff_id IS NULL OR s.id = p_staff_id)
      AND EXISTS (
        SELECT 1 FROM public.get_available_slots(p_service_id, s.id, p_date, p_holder) g
        WHERE g.slot_time = to_char(p_time::time, 'HH24:MI')
      )
    ORDER BY
      -- the therapist held for this browser tab first
      EXISTS (SELECT 1 FROM slot_holds h WHERE h.holder = p_holder AND h.staff_id = s.id
              AND h.start_time = v_start AND h.expires_at > now()) DESC,
      (SELECT count(*) FROM appointments a
       WHERE a.staff_id = s.id
         AND a.status NOT IN ('cancelled', 'no_show')
         AND (a.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = p_date),
      s.name
  LOOP
    BEGIN
      INSERT INTO appointments (customer_id, staff_id, service_id, start_time, end_time, status,
                                price, list_price, discount_amount, discount_reason, gift_card_id, gift_amount,
                                duration_min, notes, source)
      VALUES (v_customer, v_staff.id, p_service_id, v_start, v_end, v_status,
              v_q.list_price - v_q.discount_amount, v_q.list_price, v_q.discount_amount, v_q.discount_reason,
              v_q.gift_card_id, v_q.gift_amount,
              v_svc.duration_min, nullif(trim(p_notes), ''), CASE WHEN v_front THEN 'front_desk' ELSE 'online' END)
      RETURNING appointments.booking_code INTO v_code;

      IF v_q.gift_card_id IS NOT NULL THEN
        UPDATE gift_cards
        SET balance = CASE WHEN kind = 'value' THEN balance - v_q.gift_amount ELSE balance END,
            sessions_left = CASE WHEN kind IN ('sessions', 'percent') THEN sessions_left - 1 ELSE sessions_left END
        WHERE id = v_q.gift_card_id;
      END IF;
      IF p_holder IS NOT NULL THEN
        DELETE FROM slot_holds WHERE holder = p_holder;
      END IF;

      RETURN QUERY SELECT v_code, v_staff.id, v_staff.name, v_start, v_status::text,
                          v_q.list_price, v_q.discount_amount, v_q.discount_reason, v_q.gift_amount, v_q.total;
      RETURN;
    EXCEPTION WHEN exclusion_violation THEN
      NULL; -- taken concurrently: try the next eligible staff member
    END;
  END LOOP;

  RAISE EXCEPTION 'SLOT_UNAVAILABLE';
END;
$$;
REVOKE ALL ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text, text, uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.book_appointment(uuid, uuid, date, text, text, text, text, text, text, uuid, boolean) TO authenticated;

-- ============================================================
-- 5. REVIEW REQUESTS (link without login)
-- ============================================================
CREATE TABLE IF NOT EXISTS review_requests (
  appointment_id uuid PRIMARY KEY REFERENCES appointments(id) ON DELETE CASCADE,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);
ALTER TABLE review_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "review_requests_admin_all" ON review_requests;
CREATE POLICY "review_requests_admin_all" ON review_requests FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

/* Admin: get (or create) the review link token for a completed appointment. */
CREATE OR REPLACE FUNCTION public.review_request_token(p_appointment_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_token uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  INSERT INTO review_requests (appointment_id) VALUES (p_appointment_id) ON CONFLICT (appointment_id) DO NOTHING;
  SELECT token INTO v_token FROM review_requests WHERE appointment_id = p_appointment_id;
  RETURN v_token;
END;
$$;
REVOKE ALL ON FUNCTION public.review_request_token(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.review_request_token(uuid) TO authenticated;

/* Public (token): what the review page shows — given name only, plus the thank-you voucher. */
CREATE OR REPLACE FUNCTION public.get_review_invite(p_token uuid)
RETURNS TABLE (given_name text, service_name text, staff_name text, visit_date date, can_review boolean,
               reviewed boolean, voucher_code text, voucher_pct int, voucher_expires date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT regexp_replace(trim(c.name), '^.*\s', ''), s.name, st.name,
         (a.start_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date,
         a.status = 'completed' AND a.start_time > now() - interval '30 days',
         EXISTS (SELECT 1 FROM reviews r WHERE r.appointment_id = a.id),
         g.code, g.percent_off, g.expires_at
  FROM review_requests rr
  JOIN appointments a ON a.id = rr.appointment_id
  JOIN customers c ON c.id = a.customer_id
  LEFT JOIN services s ON s.id = a.service_id
  LEFT JOIN staff st ON st.id = a.staff_id
  LEFT JOIN LATERAL (
    SELECT g.code, g.percent_off, g.expires_at FROM gift_cards g
    WHERE g.source_appointment_id = a.id AND g.kind = 'percent' AND g.is_active AND g.sessions_left > 0
    LIMIT 1
  ) g ON true
  WHERE rr.token = p_token;
$$;
GRANT EXECUTE ON FUNCTION public.get_review_invite(uuid) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.submit_review_by_token(p_token uuid, p_rating int, p_comment text)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_apt record;
BEGIN
  SELECT a.id, a.status, a.customer_id, a.service_id, a.staff_id, a.start_time INTO v_apt
  FROM review_requests rr JOIN appointments a ON a.id = rr.appointment_id
  WHERE rr.token = p_token;
  IF v_apt.id IS NULL THEN RAISE EXCEPTION 'NOT_FOUND'; END IF;
  IF v_apt.status <> 'completed' THEN RAISE EXCEPTION 'NOT_COMPLETED'; END IF;
  IF v_apt.start_time < now() - interval '30 days' THEN RAISE EXCEPTION 'EXPIRED'; END IF;
  IF p_rating NOT BETWEEN 1 AND 5 THEN RAISE EXCEPTION 'INVALID_RATING'; END IF;
  INSERT INTO reviews (appointment_id, customer_id, service_id, staff_id, rating, comment)
  VALUES (v_apt.id, v_apt.customer_id, v_apt.service_id, v_apt.staff_id, p_rating, nullif(left(trim(p_comment), 1000), ''))
  ON CONFLICT (appointment_id) DO NOTHING;
  IF NOT FOUND THEN RAISE EXCEPTION 'ALREADY_REVIEWED'; END IF;
END;
$$;
GRANT EXECUTE ON FUNCTION public.submit_review_by_token(uuid, int, text) TO anon, authenticated;
