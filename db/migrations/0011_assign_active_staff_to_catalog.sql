-- Existing staff predate the canonical catalogue, so they otherwise disappear
-- from the booking staff step even though they remain active therapists.
INSERT INTO public.staff_services (staff_id, service_id)
SELECT staff.id, services.id
FROM public.staff
CROSS JOIN public.services
WHERE staff.is_active = true
  AND services.is_active = true
  AND services.id IN (
    '10000000-0000-4000-8000-000000000001',
    '10000000-0000-4000-8000-000000000002',
    '10000000-0000-4000-8000-000000000003',
    '10000000-0000-4000-8000-000000000004',
    '10000000-0000-4000-8000-000000000005',
    '10000000-0000-4000-8000-000000000006'
  )
ON CONFLICT DO NOTHING;
