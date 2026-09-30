/*
# Customers can cancel their own upcoming appointment

RPC cancel_my_appointment(p_id):
- only the customer who owns the appointment (customers.user_id = auth.uid())
- only while status is pending/confirmed
- only up to 2 hours before start (keep in sync with SITE.cancelBeforeHours in lib/site-config.ts)
Errors: NOT_FOUND, NOT_CANCELLABLE, TOO_LATE
*/

CREATE OR REPLACE FUNCTION public.cancel_my_appointment(p_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
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

REVOKE ALL ON FUNCTION public.cancel_my_appointment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_my_appointment(uuid) TO authenticated;
