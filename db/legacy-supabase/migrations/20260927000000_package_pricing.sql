/*
# Package pricing for session cards + discount reason

A session card sold from a package (e.g. 5 buổi massage body = 1.900.000 ₫) used to book each session at the
full list price (450.000 ₫), overstating revenue. Now:
- gift_cards.session_value = package price / sessions, filled automatically when a card is issued from a package
- booking with that card records the saving as a discount with discount_reason = 'package', so
  appointments.price = 380.000 ₫ (the real revenue), all of it prepaid by the card (customer pays 0 at the spa)
- appointments.discount_reason = 'first_visit' | 'package' so the UI labels discounts correctly
*/

ALTER TABLE gift_cards ADD COLUMN IF NOT EXISTS session_value integer CHECK (session_value IS NULL OR session_value >= 0);
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS discount_reason text CHECK (discount_reason IS NULL OR discount_reason IN ('first_visit', 'package'));
UPDATE appointments SET discount_reason = 'first_visit' WHERE discount_amount > 0 AND discount_reason IS NULL;

CREATE OR REPLACE FUNCTION public.gift_card_session_value()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.kind = 'sessions' AND NEW.session_value IS NULL AND NEW.package_id IS NOT NULL THEN
    SELECT round(price::numeric / sessions) INTO NEW.session_value FROM service_packages WHERE id = NEW.package_id;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS trg_gift_cards_session_value ON gift_cards;
CREATE TRIGGER trg_gift_cards_session_value BEFORE INSERT OR UPDATE OF package_id ON gift_cards
  FOR EACH ROW EXECUTE FUNCTION public.gift_card_session_value();
UPDATE gift_cards g SET session_value = round(p.price::numeric / p.sessions)
FROM service_packages p WHERE p.id = g.package_id AND g.kind = 'sessions' AND g.session_value IS NULL;

-- Return types change → drop and recreate
DROP FUNCTION IF EXISTS public.booking_quote(uuid, text, text);
DROP FUNCTION IF EXISTS public.book_appointment(uuid, uuid, date, text, text, text, text, text, text);
DROP FUNCTION IF EXISTS public._price_booking(uuid, uuid, text, text, boolean, boolean);


CREATE OR REPLACE FUNCTION public._price_booking(
  p_service_id uuid, p_customer_id uuid, p_phone text, p_gift_code text, p_first_visit_ok boolean, p_lock boolean
)
RETURNS TABLE (list_price int, discount_amount int, discount_pct int, discount_reason text, gift_card_id uuid, gift_amount int, gift_kind text, gift_error text, total int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
#variable_conflict use_column
DECLARE
  v_price int;
  v_set app_settings%ROWTYPE;
  v_disc int := 0;
  v_pct int := 0;
  v_reason text := NULL;
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
    ELSIF v_card.kind = 'sessions' AND v_card.sessions_left <= 0 THEN
      v_err := 'GIFT_EMPTY';
    ELSIF v_card.kind = 'sessions' AND v_card.service_id <> p_service_id THEN
      v_err := 'GIFT_WRONG_SERVICE';
    ELSIF v_card.kind = 'sessions' THEN
      -- A session card pays the whole service; the first-visit discount does not stack with it.
      -- Sold as a package (cheaper per session): the saving is recorded as a package discount so
      -- appointments.price = what the customer actually paid for this session (correct revenue).
      v_pct := 0;
      IF v_card.session_value IS NOT NULL AND v_card.session_value < v_price THEN
        v_disc := v_price - v_card.session_value; v_reason := 'package';
      ELSE
        v_disc := 0; v_reason := NULL;
      END IF;
      v_gift := v_price - v_disc;
    ELSE
      v_gift := least(v_card.balance, v_price - v_disc);
    END IF;
  END IF;

  RETURN QUERY SELECT v_price, v_disc, v_pct, CASE WHEN v_disc > 0 THEN v_reason END,
    CASE WHEN v_err IS NULL AND v_gift > 0 THEN v_card.id END,
    CASE WHEN v_err IS NULL THEN v_gift ELSE 0 END,
    CASE WHEN v_err IS NULL THEN v_card.kind END,
    v_err,
    v_price - v_disc - CASE WHEN v_err IS NULL THEN v_gift ELSE 0 END;
END;
$$;
REVOKE ALL ON FUNCTION public._price_booking(uuid, uuid, text, text, boolean, boolean) FROM PUBLIC, anon, authenticated;


CREATE OR REPLACE FUNCTION public.booking_quote(p_service_id uuid, p_phone text, p_gift_code text DEFAULT NULL)
RETURNS TABLE (list_price int, discount_amount int, discount_pct int, discount_reason text, gift_amount int, gift_kind text, gift_error text, total int)
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
    SELECT q.list_price, q.discount_amount, q.discount_pct, q.discount_reason, q.gift_amount, q.gift_kind, q.gift_error, q.total
    FROM public._price_booking(p_service_id, v_customer, CASE WHEN v_front THEN NULL ELSE p_phone END, p_gift_code, NOT v_front, false) q;
END;
$$;
REVOKE ALL ON FUNCTION public.booking_quote(uuid, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.booking_quote(uuid, text, text) TO authenticated;


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
               list_price int, discount_amount int, discount_reason text, gift_amount int, total int)
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
                                price, list_price, discount_amount, discount_reason, gift_card_id, gift_amount,
                                duration_min, notes, source)
      VALUES (v_customer, v_staff.id, p_service_id, v_start, v_end, 'confirmed',
              v_q.list_price - v_q.discount_amount, v_q.list_price, v_q.discount_amount, v_q.discount_reason, v_q.gift_card_id, v_q.gift_amount,
              v_svc.duration_min, nullif(trim(p_notes), ''), CASE WHEN v_front THEN 'front_desk' ELSE 'online' END)
      RETURNING appointments.booking_code INTO v_code;

      IF v_q.gift_card_id IS NOT NULL THEN
        UPDATE gift_cards
        SET balance = CASE WHEN kind = 'value' THEN balance - v_q.gift_amount ELSE balance END,
            sessions_left = CASE WHEN kind = 'sessions' THEN sessions_left - 1 ELSE sessions_left END
        WHERE id = v_q.gift_card_id;
      END IF;

      RETURN QUERY SELECT v_code, v_staff.id, v_staff.name, v_start,
                          v_q.list_price, v_q.discount_amount, v_q.discount_reason, v_q.gift_amount, v_q.total;
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

