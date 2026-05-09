
CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  type text NOT NULL CHECK (type IN ('percent','fixed')),
  value numeric NOT NULL CHECK (value > 0),
  min_subtotal_ore integer,
  expires_at timestamptz,
  max_uses integer,
  used_count integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX discount_codes_code_idx ON public.discount_codes (lower(code));

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
-- No public policies: all access goes through server functions using supabaseAdmin.

CREATE TRIGGER discount_codes_touch_updated_at
BEFORE UPDATE ON public.discount_codes
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
