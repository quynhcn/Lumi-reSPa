-- Phone numbers remain customer contact data, but are no longer an auth channel.
DROP TABLE IF EXISTS auth.otp_codes;

DROP INDEX IF EXISTS public.idx_appointments_reminder_queue;
ALTER TABLE public.appointments
  DROP COLUMN IF EXISTS reminder_claimed_at,
  DROP COLUMN IF EXISTS reminder_claim_token,
  DROP COLUMN IF EXISTS reminder_attempts;

CREATE OR REPLACE FUNCTION auth.cleanup() RETURNS void LANGUAGE sql AS $$
  DELETE FROM auth.sessions WHERE expires_at < now();
  DELETE FROM auth.rate_events WHERE created_at < now() - interval '1 day';
  DELETE FROM public.slot_holds WHERE expires_at < now() - interval '1 hour';
$$;
