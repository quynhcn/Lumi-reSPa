CREATE TABLE public.promotions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  code text,
  badge text NOT NULL,
  title text NOT NULL,
  discount text NOT NULL,
  subtitle text NOT NULL,
  description text NOT NULL,
  valid_until text NOT NULL,
  image_url text NOT NULL,
  highlights jsonb NOT NULL DEFAULT '[]'::jsonb,
  cta_text text NOT NULL,
  href text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_promotions_updated_at
BEFORE UPDATE ON public.promotions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
