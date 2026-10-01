-- Preserve staff capabilities when the approved catalogue introduces a more
-- specific display service alongside its legacy equivalent.
INSERT INTO public.staff_services (staff_id, service_id)
SELECT source.staff_id, target.id
FROM public.services target
JOIN public.services legacy ON legacy.name = 'Chăm Sóc Da Mặt (Facial)'
JOIN public.staff_services source ON source.service_id = legacy.id
WHERE target.name = 'Chăm Sóc Da Mặt Chuyên Sâu'
ON CONFLICT DO NOTHING;

INSERT INTO public.staff_services (staff_id, service_id)
SELECT source.staff_id, target.id
FROM public.services target
JOIN public.services legacy ON legacy.name = 'Massage Body Toàn Thân'
JOIN public.staff_services source ON source.service_id = legacy.id
WHERE target.name = 'Massage Body Thư Giãn'
ON CONFLICT DO NOTHING;

-- A combo can only be assigned to staff qualified for every component service.
INSERT INTO public.staff_services (staff_id, service_id)
SELECT qualified.staff_id, combo.id
FROM public.services combo
CROSS JOIN LATERAL (
  SELECT ss.staff_id
  FROM public.staff_services ss
  JOIN public.services service ON service.id = ss.service_id
  WHERE service.name IN ('Gội Đầu Dưỡng Sinh', 'Massage Body Toàn Thân', 'Chăm Sóc Da Mặt (Facial)')
  GROUP BY ss.staff_id
  HAVING count(DISTINCT service.name) = 3
) qualified
WHERE combo.name = 'Combo Thư Giãn Toàn Diện'
ON CONFLICT DO NOTHING;
