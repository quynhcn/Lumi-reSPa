-- Chống spam form "Để lại SĐT" chuyển sang giới hạn theo IP ở tầng API (IP thật do reverse proxy ghi).
-- Giới hạn cũ 30 yêu cầu / 10 phút cho TOÀN HỆ THỐNG khiến 1 script có thể chặn mọi khách thật (review P0-6);
-- nâng lên 300 để chỉ còn là chốt an toàn.
CREATE OR REPLACE FUNCTION public.create_lead(p_name text, p_phone text, p_interest text DEFAULT NULL::text, p_note text DEFAULT NULL::text) RETURNS uuid
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
  -- Chặn chính theo IP nằm ở API (/api/rpc/create_lead: 5 lần / 10 phút / IP). Đây chỉ là chốt an toàn toàn hệ thống.
  IF (SELECT count(*) FROM leads WHERE created_at > now() - interval '10 minutes') >= 300 THEN
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
