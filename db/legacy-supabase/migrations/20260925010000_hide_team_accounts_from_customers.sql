/*
# Team accounts are not customers

handle_new_user creates a customers row for every signup (role is only assigned afterwards).
When an account becomes admin/staff, remove that auto-created customer row
(only if it has no appointments), so team members do not appear in the admin "Khách hàng" list.
*/

CREATE OR REPLACE FUNCTION public.cleanup_team_customer()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.role IN ('admin', 'staff') AND OLD.role IS DISTINCT FROM NEW.role THEN
    DELETE FROM customers c
    WHERE c.user_id = NEW.id
      AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.customer_id = c.id);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profiles_role_changed ON profiles;
CREATE TRIGGER trg_profiles_role_changed
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW EXECUTE FUNCTION public.cleanup_team_customer();

-- One-time cleanup for accounts that are already admin/staff
DELETE FROM customers c
USING profiles p
WHERE p.id = c.user_id
  AND p.role IN ('admin', 'staff')
  AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.customer_id = c.id);
