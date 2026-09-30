-- Security/workflow hardening. All business state changes remain enforced when called
-- outside the web application (admin SQL, future workers, or another API).

CREATE OR REPLACE FUNCTION public.enforce_appointment_transition() RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RETURN NEW;
  END IF;

  IF NOT (CASE OLD.status
    WHEN 'pending' THEN NEW.status IN ('confirmed', 'cancelled', 'no_show')
    WHEN 'confirmed' THEN NEW.status IN ('checked_in', 'cancelled', 'no_show')
    WHEN 'checked_in' THEN NEW.status IN ('in_service', 'cancelled', 'no_show')
    WHEN 'in_service' THEN NEW.status = 'completed'
    ELSE false
  END) THEN
    RAISE EXCEPTION 'INVALID_STATUS_TRANSITION:%->%', OLD.status, NEW.status
      USING ERRCODE = '23514';
  END IF;

  IF NEW.status = 'no_show' AND NEW.start_time > now() THEN
    RAISE EXCEPTION 'NO_SHOW_BEFORE_START' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_appointments_transition ON public.appointments;
CREATE TRIGGER trg_appointments_transition
BEFORE UPDATE OF status ON public.appointments
FOR EACH ROW EXECUTE FUNCTION public.enforce_appointment_transition();

CREATE OR REPLACE FUNCTION public.transition_appointment(
  p_id uuid,
  p_status public.appointment_status
) RETURNS TABLE(id uuid, status text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
#variable_conflict use_column
DECLARE
  v_role text := public.app_role();
  v_staff_id uuid := public.app_staff_id();
  v_appointment public.appointments%ROWTYPE;
BEGIN
  IF coalesce(v_role, '') NOT IN ('admin', 'staff') THEN
    RAISE EXCEPTION 'FORBIDDEN';
  END IF;

  SELECT a.* INTO v_appointment
  FROM public.appointments a
  WHERE a.id = p_id
  FOR UPDATE;

  IF v_appointment.id IS NULL
     OR (v_role = 'staff' AND (v_staff_id IS NULL OR v_appointment.staff_id <> v_staff_id)) THEN
    RAISE EXCEPTION 'NOT_FOUND';
  END IF;

  UPDATE public.appointments a SET status = p_status WHERE a.id = p_id;
  RETURN QUERY SELECT p_id, p_status::text;
END;
$$;

-- Claim metadata lets concurrent cron/admin runs reserve a reminder before making
-- the external SMS request. A crashed worker's claim becomes retryable after 10 minutes.
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS reminder_claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS reminder_claim_token uuid,
  ADD COLUMN IF NOT EXISTS reminder_attempts integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_appointments_reminder_queue
  ON public.appointments (start_time)
  WHERE status IN ('pending', 'confirmed') AND reminded_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_appointment_logs_appointment_changed
  ON public.appointment_logs (appointment_id, changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_customer_created
  ON public.reviews (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_appointment
  ON public.reviews (appointment_id);
CREATE INDEX IF NOT EXISTS idx_gift_cards_source_appointment
  ON public.gift_cards (source_appointment_id)
  WHERE source_appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_customers_phone_normalized
  ON public.customers (public._vn_phone(phone));

-- Use the same canonical VN phone form for validation, deduplication, and storage.
CREATE OR REPLACE FUNCTION public.create_lead(
  p_name text,
  p_phone text,
  p_interest text DEFAULT NULL::text,
  p_note text DEFAULT NULL::text
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_id uuid;
  v_phone text := public._vn_phone(p_phone);
BEGIN
  IF coalesce(trim(p_name), '') = '' OR v_phone !~ '^0\d{9,10}$' THEN
    RAISE EXCEPTION 'INVALID_LEAD';
  END IF;
  IF (SELECT count(*) FROM leads WHERE created_at > now() - interval '10 minutes') >= 30 THEN
    RAISE EXCEPTION 'RATE_LIMITED';
  END IF;
  SELECT l.id INTO v_id FROM leads l
  WHERE public._vn_phone(l.phone) = v_phone
    AND l.status = 'new' AND l.created_at > now() - interval '1 day'
  ORDER BY l.created_at DESC LIMIT 1;
  IF v_id IS NOT NULL THEN
    UPDATE leads SET interest = coalesce(nullif(trim(p_interest), ''), interest),
                     note = coalesce(nullif(left(trim(p_note), 500), ''), note)
    WHERE leads.id = v_id;
    RETURN v_id;
  END IF;
  INSERT INTO leads (name, phone, interest, note)
  VALUES (left(trim(p_name), 100), v_phone, nullif(left(trim(p_interest), 100), ''), nullif(left(trim(p_note), 500), ''))
  RETURNING leads.id INTO v_id;
  RETURN v_id;
END;
$$;

-- Prevent two simultaneous hold requests from both observing the same slot as free.
CREATE OR REPLACE FUNCTION public.hold_slot(p_service_id uuid, p_staff_id uuid, p_date date, p_time text, p_holder uuid)
RETURNS TABLE(staff_id uuid, expires_at timestamp with time zone)
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

  -- A day-wide key also serializes overlapping requests with different services/durations.
  PERFORM pg_advisory_xact_lock(hashtextextended('slot-hold:' || p_date::text, 0));

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
