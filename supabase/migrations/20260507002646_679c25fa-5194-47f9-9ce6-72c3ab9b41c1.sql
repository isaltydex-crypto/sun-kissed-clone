CREATE TABLE public.site_content (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;
-- Access goes exclusively through trusted server functions (service role).

CREATE TABLE public.site_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  in_menu boolean NOT NULL DEFAULT false,
  menu_label text,
  menu_order integer NOT NULL DEFAULT 100,
  published boolean NOT NULL DEFAULT true,
  meta_description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX site_pages_menu_idx ON public.site_pages (in_menu, menu_order) WHERE published = true;

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;
-- Access goes exclusively through trusted server functions (service role).

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER site_content_touch
BEFORE UPDATE ON public.site_content
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TRIGGER site_pages_touch
BEFORE UPDATE ON public.site_pages
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();