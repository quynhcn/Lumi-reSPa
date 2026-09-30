-- SpaFlow — schema ứng dụng cho PostgreSQL thuần (không Supabase)
-- Sinh từ supabase/migrations/2026092* (9 file) bằng pg_dump --schema-only -n public, sau đó:
--   * bỏ toàn bộ RLS policy + "ENABLE ROW LEVEL SECURITY" (quyền truy cập nay kiểm soát ở tầng API: lib/server/policies.ts)
--   * giữ nguyên bảng, ràng buộc, index, trigger và toàn bộ hàm nghiệp vụ (book_appointment, get_available_slots, ...)
-- auth.uid() được định nghĩa ở 0001_auth.sql, đọc từ current_setting('app.user_id') do server đặt cho mỗi transaction.
-- Thay đổi schema sau này: thêm file mới 0004_*.sql, KHÔNG sửa file này.

CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: appointment_status; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.appointment_status AS ENUM (
    'pending',
    'confirmed',
    'checked_in',
    'in_service',
    'completed',
    'cancelled',
    'no_show'
);

--
-- Name: _digits(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._digits(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$ SELECT regexp_replace(coalesce(p, ''), '\D', '', 'g') $$;

--
-- Name: _price_booking(uuid, uuid, text, text, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._price_booking(p_service_id uuid, p_customer_id uuid, p_phone text, p_gift_code text, p_first_visit_ok boolean, p_lock boolean) RETURNS TABLE(list_price integer, discount_amount integer, discount_pct integer, discount_reason text, gift_card_id uuid, gift_amount integer, gift_kind text, gift_error text, total integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: _vn_phone(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._vn_phone(p text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $_$
  SELECT CASE WHEN public._digits(p) ~ '^84\d{9,10}$' THEN '0' || substr(public._digits(p), 3) ELSE public._digits(p) END
$_$;

--
-- Name: app_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_role() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN NULL
    ELSE COALESCE((SELECT role FROM profiles WHERE id = auth.uid()), 'customer')
  END;
$$;

--
-- Name: app_staff_id(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.app_staff_id() RETURNS uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT staff_id FROM profiles WHERE id = auth.uid();
$$;

--
-- Name: book_appointment(uuid, uuid, date, text, text, text, text, text, text, uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.book_appointment(p_service_id uuid, p_staff_id uuid, p_date date, p_time text, p_name text, p_phone text, p_email text, p_notes text, p_gift_code text DEFAULT NULL::text, p_holder uuid DEFAULT NULL::uuid, p_apply_first_visit boolean DEFAULT false) RETURNS TABLE(booking_code text, staff_id uuid, staff_name text, start_time timestamp with time zone, status text, list_price integer, discount_amount integer, discount_reason text, gift_amount integer, total integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: booking_quote(uuid, text, text, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.booking_quote(p_service_id uuid, p_phone text, p_gift_code text DEFAULT NULL::text, p_apply_first_visit boolean DEFAULT false) RETURNS TABLE(list_price integer, discount_amount integer, discount_pct integer, discount_reason text, gift_amount integer, gift_kind text, gift_error text, total integer)
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: cancel_my_appointment(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_my_appointment(p_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_status appointment_status;
  v_start timestamptz;
BEGIN
  SELECT a.status, a.start_time INTO v_status, v_start
  FROM appointments a
  JOIN customers c ON c.id = a.customer_id
  WHERE a.id = p_id AND c.user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;
  IF v_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'NOT_CANCELLABLE';
  END IF;
  IF v_start < now() + interval '2 hours' THEN
    RAISE EXCEPTION 'TOO_LATE';
  END IF;

  UPDATE appointments SET status = 'cancelled' WHERE id = p_id;
END;
$$;

--
-- Name: cleanup_team_customer(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_team_customer() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.role IN ('admin', 'staff') AND OLD.role IS DISTINCT FROM NEW.role THEN
    DELETE FROM customers c
    WHERE c.user_id = NEW.id
      AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.customer_id = c.id);
  END IF;
  RETURN NEW;
END;
$$;

--
-- Name: create_lead(text, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_lead(p_name text, p_phone text, p_interest text DEFAULT NULL::text, p_note text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
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
$_$;

--
-- Name: current_email(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.current_email() RETURNS text
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT email FROM profiles WHERE id = auth.uid();
$$;

--
-- Name: get_available_slots(uuid, uuid, date, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_available_slots(p_service_id uuid, p_staff_id uuid, p_date date, p_holder uuid DEFAULT NULL::uuid, p_ignore_appointment uuid DEFAULT NULL::uuid) RETURNS TABLE(slot_time text, staff_count integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: get_public_reviews(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_public_reviews(p_limit integer DEFAULT 6) RETURNS TABLE(id uuid, rating integer, comment text, author text, service_name text, created_at timestamp with time zone)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: get_review_invite(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_review_invite(p_token uuid) RETURNS TABLE(given_name text, service_name text, staff_name text, visit_date date, can_review boolean, reviewed boolean, voucher_code text, voucher_pct integer, voucher_expires date)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: get_review_summary(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_review_summary() RETURNS TABLE(average numeric, total integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT round(avg(rating)::numeric, 1), count(*)::int FROM reviews WHERE is_published;
$$;

--
-- Name: gift_card_session_value(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gift_card_session_value() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.kind = 'sessions' AND NEW.session_value IS NULL AND NEW.package_id IS NOT NULL THEN
    SELECT round(price::numeric / sessions) INTO NEW.session_value FROM service_packages WHERE id = NEW.package_id;
  END IF;
  RETURN NEW;
END;
$$;

--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: hold_slot(uuid, uuid, date, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.hold_slot(p_service_id uuid, p_staff_id uuid, p_date date, p_time text, p_holder uuid) RETURNS TABLE(staff_id uuid, expires_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(public.app_role() = 'admin', false);
$$;

--
-- Name: issue_return_voucher(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.issue_return_voucher() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: log_appointment_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.log_appointment_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO appointment_logs (appointment_id, old_status, new_status, changed_by)
    VALUES (NEW.id, OLD.status, NEW.status,
            COALESCE((SELECT email FROM profiles WHERE id = auth.uid()), auth.uid()::text));
  END IF;
  RETURN NEW;
END;
$$;

--
-- Name: my_vouchers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.my_vouchers() RETURNS TABLE(code text, kind text, percent_off integer, balance integer, sessions_left integer, service_name text, expires_at date)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: refund_gift_on_cancel(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refund_gift_on_cancel() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: release_hold(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.release_hold(p_holder uuid) RETURNS void
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  DELETE FROM slot_holds WHERE holder = p_holder;
$$;

--
-- Name: reschedule_appointment(uuid, date, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.reschedule_appointment(p_id uuid, p_date date, p_time text, p_staff_id uuid DEFAULT NULL::uuid) RETURNS TABLE(start_time timestamp with time zone, staff_id uuid, staff_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: review_request_token(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.review_request_token(p_appointment_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_token uuid;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'FORBIDDEN'; END IF;
  INSERT INTO review_requests (appointment_id) VALUES (p_appointment_id) ON CONFLICT (appointment_id) DO NOTHING;
  SELECT token INTO v_token FROM review_requests WHERE appointment_id = p_appointment_id;
  RETURN v_token;
END;
$$;

--
-- Name: submit_review(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_review(p_appointment_id uuid, p_rating integer, p_comment text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: submit_review_by_token(uuid, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_review_by_token(p_token uuid, p_rating integer, p_comment text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
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

--
-- Name: update_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: app_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_settings (
    id integer DEFAULT 1 NOT NULL,
    first_visit_enabled boolean DEFAULT true NOT NULL,
    first_visit_discount_pct integer DEFAULT 10 NOT NULL,
    updated_at timestamp with time zone DEFAULT now(),
    return_visit_enabled boolean DEFAULT true NOT NULL,
    return_visit_pct integer DEFAULT 10 NOT NULL,
    return_visit_days integer DEFAULT 30 NOT NULL,
    no_show_threshold integer DEFAULT 2 NOT NULL,
    CONSTRAINT app_settings_first_visit_discount_pct_check CHECK (((first_visit_discount_pct >= 0) AND (first_visit_discount_pct <= 50))),
    CONSTRAINT app_settings_id_check CHECK ((id = 1)),
    CONSTRAINT app_settings_no_show_threshold_check CHECK (((no_show_threshold >= 0) AND (no_show_threshold <= 10))),
    CONSTRAINT app_settings_return_visit_days_check CHECK (((return_visit_days >= 1) AND (return_visit_days <= 365))),
    CONSTRAINT app_settings_return_visit_pct_check CHECK (((return_visit_pct >= 1) AND (return_visit_pct <= 50)))
);

--
-- Name: appointment_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointment_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid NOT NULL,
    old_status public.appointment_status,
    new_status public.appointment_status,
    changed_by text,
    changed_at timestamp with time zone DEFAULT now(),
    note text
);

--
-- Name: appointments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.appointments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    booking_code text DEFAULT upper(substr(replace((gen_random_uuid())::text, '-'::text, ''::text), 1, 8)) NOT NULL,
    customer_id uuid NOT NULL,
    staff_id uuid NOT NULL,
    service_id uuid NOT NULL,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    status public.appointment_status DEFAULT 'confirmed'::public.appointment_status NOT NULL,
    price integer NOT NULL,
    duration_min integer NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    list_price integer,
    discount_amount integer DEFAULT 0 NOT NULL,
    gift_card_id uuid,
    gift_amount integer DEFAULT 0 NOT NULL,
    source text DEFAULT 'online'::text NOT NULL,
    reminded_at timestamp with time zone,
    discount_reason text,
    reschedule_count integer DEFAULT 0 NOT NULL,
    CONSTRAINT appointments_check CHECK ((end_time > start_time)),
    CONSTRAINT appointments_discount_reason_check CHECK (((discount_reason IS NULL) OR (discount_reason = ANY (ARRAY['first_visit'::text, 'package'::text, 'return_visit'::text]))))
);

--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    email text,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    user_id uuid
);

--
-- Name: gift_cards; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.gift_cards (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text DEFAULT ('SF'::text || upper(substr(md5(((random())::text || (clock_timestamp())::text)), 1, 8))) NOT NULL,
    kind text NOT NULL,
    initial_value integer,
    balance integer,
    service_id uuid,
    package_id uuid,
    sessions_total integer,
    sessions_left integer,
    buyer_name text,
    recipient_name text,
    recipient_phone text,
    note text,
    expires_at date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    created_by text DEFAULT public.current_email(),
    session_value integer,
    percent_off integer,
    customer_id uuid,
    source_appointment_id uuid,
    CONSTRAINT gift_cards_balance_check CHECK (((balance IS NULL) OR (balance >= 0))),
    CONSTRAINT gift_cards_check CHECK ((((kind = 'value'::text) AND (initial_value IS NOT NULL) AND (balance IS NOT NULL)) OR ((kind = 'sessions'::text) AND (service_id IS NOT NULL) AND (sessions_total IS NOT NULL) AND (sessions_left IS NOT NULL)) OR ((kind = 'percent'::text) AND (percent_off IS NOT NULL) AND (sessions_total IS NOT NULL) AND (sessions_left IS NOT NULL)))),
    CONSTRAINT gift_cards_initial_value_check CHECK (((initial_value IS NULL) OR (initial_value > 0))),
    CONSTRAINT gift_cards_kind_check CHECK ((kind = ANY (ARRAY['value'::text, 'sessions'::text, 'percent'::text]))),
    CONSTRAINT gift_cards_percent_off_check CHECK (((percent_off IS NULL) OR ((percent_off >= 1) AND (percent_off <= 100)))),
    CONSTRAINT gift_cards_session_value_check CHECK (((session_value IS NULL) OR (session_value >= 0))),
    CONSTRAINT gift_cards_sessions_left_check CHECK (((sessions_left IS NULL) OR (sessions_left >= 0))),
    CONSTRAINT gift_cards_sessions_total_check CHECK (((sessions_total IS NULL) OR (sessions_total > 0)))
);

--
-- Name: leads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text NOT NULL,
    interest text,
    note text,
    status text DEFAULT 'new'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    handled_at timestamp with time zone,
    handled_by text,
    CONSTRAINT leads_status_check CHECK ((status = ANY (ARRAY['new'::text, 'contacted'::text, 'booked'::text, 'closed'::text])))
);

--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    email text,
    role text DEFAULT 'customer'::text NOT NULL,
    staff_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT profiles_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'staff'::text, 'customer'::text])))
);

--
-- Name: review_requests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.review_requests (
    appointment_id uuid NOT NULL,
    token uuid DEFAULT gen_random_uuid() NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    sent_at timestamp with time zone
);

--
-- Name: reviews; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reviews (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    appointment_id uuid NOT NULL,
    customer_id uuid NOT NULL,
    service_id uuid,
    staff_id uuid,
    rating integer NOT NULL,
    comment text,
    is_published boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT reviews_comment_check CHECK (((comment IS NULL) OR (length(comment) <= 1000))),
    CONSTRAINT reviews_rating_check CHECK (((rating >= 1) AND (rating <= 5)))
);

--
-- Name: service_packages; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.service_packages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    service_id uuid NOT NULL,
    sessions integer NOT NULL,
    price integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT service_packages_price_check CHECK ((price >= 0)),
    CONSTRAINT service_packages_sessions_check CHECK ((sessions >= 2))
);

--
-- Name: services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    duration_min integer NOT NULL,
    price integer NOT NULL,
    category text,
    image_url text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    includes text[] DEFAULT '{}'::text[] NOT NULL,
    compare_at_price integer,
    CONSTRAINT services_compare_at_price_check CHECK (((compare_at_price IS NULL) OR (compare_at_price >= 0))),
    CONSTRAINT services_duration_min_check CHECK ((duration_min > 0)),
    CONSTRAINT services_price_check CHECK ((price >= 0))
);

--
-- Name: slot_holds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.slot_holds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    holder uuid NOT NULL,
    staff_id uuid NOT NULL,
    service_id uuid,
    start_time timestamp with time zone NOT NULL,
    end_time timestamp with time zone NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    client_ip text,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: staff; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    phone text,
    email text,
    avatar_url text,
    role text DEFAULT 'therapist'::text NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    bio text,
    specialties text[] DEFAULT '{}'::text[] NOT NULL,
    years_experience integer,
    CONSTRAINT staff_years_experience_check CHECK (((years_experience IS NULL) OR (years_experience >= 0)))
);

--
-- Name: staff_schedules; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    day_of_week integer NOT NULL,
    start_time time without time zone NOT NULL,
    end_time time without time zone NOT NULL,
    break_start time without time zone,
    break_end time without time zone,
    CONSTRAINT staff_schedules_check CHECK ((end_time > start_time)),
    CONSTRAINT staff_schedules_check1 CHECK (((break_start IS NULL) OR ((break_end IS NOT NULL) AND (break_end > break_start)))),
    CONSTRAINT staff_schedules_day_of_week_check CHECK (((day_of_week >= 0) AND (day_of_week <= 6)))
);

--
-- Name: staff_services; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_services (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    service_id uuid NOT NULL
);

--
-- Name: staff_time_off; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staff_time_off (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    staff_id uuid NOT NULL,
    date date NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now()
);

--
-- Name: app_settings app_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_settings
    ADD CONSTRAINT app_settings_pkey PRIMARY KEY (id);

--
-- Name: appointment_logs appointment_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_logs
    ADD CONSTRAINT appointment_logs_pkey PRIMARY KEY (id);

--
-- Name: appointments appointments_booking_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_booking_code_key UNIQUE (booking_code);

--
-- Name: appointments appointments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_pkey PRIMARY KEY (id);

--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);

--
-- Name: gift_cards gift_cards_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_code_key UNIQUE (code);

--
-- Name: gift_cards gift_cards_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_pkey PRIMARY KEY (id);

--
-- Name: leads leads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leads
    ADD CONSTRAINT leads_pkey PRIMARY KEY (id);

--
-- Name: appointments no_overlapping_appointments; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT no_overlapping_appointments EXCLUDE USING gist (staff_id WITH =, tstzrange(start_time, end_time) WITH &&) WHERE ((status <> ALL (ARRAY['cancelled'::public.appointment_status, 'completed'::public.appointment_status, 'no_show'::public.appointment_status])));

--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);

--
-- Name: review_requests review_requests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_requests
    ADD CONSTRAINT review_requests_pkey PRIMARY KEY (appointment_id);

--
-- Name: review_requests review_requests_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_requests
    ADD CONSTRAINT review_requests_token_key UNIQUE (token);

--
-- Name: reviews reviews_appointment_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_appointment_id_key UNIQUE (appointment_id);

--
-- Name: reviews reviews_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_pkey PRIMARY KEY (id);

--
-- Name: service_packages service_packages_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_packages
    ADD CONSTRAINT service_packages_pkey PRIMARY KEY (id);

--
-- Name: services services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.services
    ADD CONSTRAINT services_pkey PRIMARY KEY (id);

--
-- Name: slot_holds slot_holds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_holds
    ADD CONSTRAINT slot_holds_pkey PRIMARY KEY (id);

--
-- Name: staff staff_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff
    ADD CONSTRAINT staff_pkey PRIMARY KEY (id);

--
-- Name: staff_schedules staff_schedules_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_pkey PRIMARY KEY (id);

--
-- Name: staff_services staff_services_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_services
    ADD CONSTRAINT staff_services_pkey PRIMARY KEY (id);

--
-- Name: staff_services staff_services_staff_id_service_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_services
    ADD CONSTRAINT staff_services_staff_id_service_id_key UNIQUE (staff_id, service_id);

--
-- Name: staff_time_off staff_time_off_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_time_off
    ADD CONSTRAINT staff_time_off_pkey PRIMARY KEY (id);

--
-- Name: idx_appointments_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_customer ON public.appointments USING btree (customer_id);

--
-- Name: idx_appointments_staff_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_staff_time ON public.appointments USING btree (staff_id, start_time, end_time);

--
-- Name: idx_appointments_start_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_start_time ON public.appointments USING btree (start_time);

--
-- Name: idx_appointments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_appointments_status ON public.appointments USING btree (status);

--
-- Name: idx_customers_phone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_phone ON public.customers USING btree (phone);

--
-- Name: idx_customers_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_customers_user_id ON public.customers USING btree (user_id) WHERE (user_id IS NOT NULL);

--
-- Name: idx_gift_cards_customer; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_gift_cards_customer ON public.gift_cards USING btree (customer_id) WHERE (customer_id IS NOT NULL);

--
-- Name: idx_leads_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leads_status ON public.leads USING btree (status, created_at DESC);

--
-- Name: idx_slot_holds_holder; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_holds_holder ON public.slot_holds USING btree (holder);

--
-- Name: idx_slot_holds_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_slot_holds_staff ON public.slot_holds USING btree (staff_id, start_time);

--
-- Name: idx_staff_schedules_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_schedules_staff ON public.staff_schedules USING btree (staff_id);

--
-- Name: idx_staff_services_service; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_services_service ON public.staff_services USING btree (service_id);

--
-- Name: idx_staff_services_staff; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_services_staff ON public.staff_services USING btree (staff_id);

--
-- Name: idx_staff_time_off_staff_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_staff_time_off_staff_date ON public.staff_time_off USING btree (staff_id, date);

--
-- Name: appointments trg_appointments_gift_refund; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_appointments_gift_refund AFTER UPDATE OF status ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.refund_gift_on_cancel();

--
-- Name: appointments trg_appointments_log; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_appointments_log AFTER UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.log_appointment_change();

--
-- Name: appointments trg_appointments_return_voucher; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_appointments_return_voucher AFTER UPDATE OF status ON public.appointments FOR EACH ROW WHEN (((new.status = 'completed'::public.appointment_status) AND (old.status IS DISTINCT FROM 'completed'::public.appointment_status))) EXECUTE FUNCTION public.issue_return_voucher();

--
-- Name: appointments trg_appointments_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_appointments_updated BEFORE UPDATE ON public.appointments FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

--
-- Name: customers trg_customers_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_customers_updated BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

--
-- Name: gift_cards trg_gift_cards_session_value; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_gift_cards_session_value BEFORE INSERT OR UPDATE OF package_id ON public.gift_cards FOR EACH ROW EXECUTE FUNCTION public.gift_card_session_value();

--
-- Name: profiles trg_profiles_role_changed; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_profiles_role_changed AFTER UPDATE OF role ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.cleanup_team_customer();

--
-- Name: services trg_services_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_services_updated BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

--
-- Name: staff trg_staff_updated; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_staff_updated BEFORE UPDATE ON public.staff FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

--
-- Name: appointment_logs appointment_logs_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointment_logs
    ADD CONSTRAINT appointment_logs_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;

--
-- Name: appointments appointments_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE RESTRICT;

--
-- Name: appointments appointments_gift_card_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_gift_card_id_fkey FOREIGN KEY (gift_card_id) REFERENCES public.gift_cards(id) ON DELETE SET NULL;

--
-- Name: appointments appointments_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;

--
-- Name: appointments appointments_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.appointments
    ADD CONSTRAINT appointments_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE RESTRICT;

--
-- Name: customers customers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

--
-- Name: gift_cards gift_cards_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

--
-- Name: gift_cards gift_cards_package_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_package_id_fkey FOREIGN KEY (package_id) REFERENCES public.service_packages(id) ON DELETE SET NULL;

--
-- Name: gift_cards gift_cards_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;

--
-- Name: gift_cards gift_cards_source_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.gift_cards
    ADD CONSTRAINT gift_cards_source_appointment_id_fkey FOREIGN KEY (source_appointment_id) REFERENCES public.appointments(id) ON DELETE SET NULL;

--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

--
-- Name: profiles profiles_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;

--
-- Name: review_requests review_requests_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.review_requests
    ADD CONSTRAINT review_requests_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;

--
-- Name: reviews reviews_appointment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_appointment_id_fkey FOREIGN KEY (appointment_id) REFERENCES public.appointments(id) ON DELETE CASCADE;

--
-- Name: reviews reviews_customer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_customer_id_fkey FOREIGN KEY (customer_id) REFERENCES public.customers(id) ON DELETE CASCADE;

--
-- Name: reviews reviews_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE SET NULL;

--
-- Name: reviews reviews_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reviews
    ADD CONSTRAINT reviews_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE SET NULL;

--
-- Name: service_packages service_packages_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.service_packages
    ADD CONSTRAINT service_packages_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE RESTRICT;

--
-- Name: slot_holds slot_holds_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_holds
    ADD CONSTRAINT slot_holds_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;

--
-- Name: slot_holds slot_holds_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.slot_holds
    ADD CONSTRAINT slot_holds_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;

--
-- Name: staff_schedules staff_schedules_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_schedules
    ADD CONSTRAINT staff_schedules_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;

--
-- Name: staff_services staff_services_service_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_services
    ADD CONSTRAINT staff_services_service_id_fkey FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE;

--
-- Name: staff_services staff_services_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_services
    ADD CONSTRAINT staff_services_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;

--
-- Name: staff_time_off staff_time_off_staff_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.staff_time_off
    ADD CONSTRAINT staff_time_off_staff_id_fkey FOREIGN KEY (staff_id) REFERENCES public.staff(id) ON DELETE CASCADE;

--
-- PostgreSQL database dump complete
--

