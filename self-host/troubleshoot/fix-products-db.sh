#!/usr/bin/env bash
set -u

. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

hdr "1. Postgres connectivity"
if ! run "db container accepts psql" -- docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "select 1"; then
  fail "database is not reachable; run self-host/troubleshoot/diag.sh first"
  exit 1
fi

hdr "2. Products schema check"
missing_table="$(docker compose exec -T db psql -U postgres -d postgres -At <<'SQL'
select case when to_regclass('public.products') is null then 'products' else '' end;
SQL
)"
missing_columns="$(docker compose exec -T db psql -U postgres -d postgres -At <<'SQL'
select string_agg(c.name, ' ' order by c.name)
from unnest(array['id','slug','name','tagline','price_ore','old_price_ore','image','badge','sort_order','description','created_at','updated_at']) as c(name)
where to_regclass('public.products') is null
   or not exists (
     select 1
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'products'
       and column_name = c.name
   );
SQL
)"

if [ -z "$missing_table" ] && [ -z "$missing_columns" ]; then
  ok "products table already has the required columns"
else
  warn "missing products objects: ${missing_table:-}${missing_columns:+ columns: $missing_columns}"
  if run "create/repair products table" -- docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug text NOT NULL UNIQUE,
  name text NOT NULL,
  tagline text NOT NULL DEFAULT '',
  price_ore integer NOT NULL DEFAULT 0,
  old_price_ore integer,
  image text NOT NULL DEFAULT '',
  badge text,
  sort_order integer NOT NULL DEFAULT 0,
  description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.products ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS slug text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS name text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS tagline text NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS price_ore integer NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS old_price_ore integer;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS image text NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS badge text;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.products ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.products ALTER COLUMN tagline SET DEFAULT '';
ALTER TABLE public.products ALTER COLUMN image SET DEFAULT '';
ALTER TABLE public.products ALTER COLUMN sort_order SET DEFAULT 0;
ALTER TABLE public.products ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE public.products ALTER COLUMN updated_at SET DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.products'::regclass AND conname = 'products_pkey'
  ) THEN
    ALTER TABLE public.products ADD PRIMARY KEY (id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conrelid = 'public.products'::regclass AND conname = 'products_slug_key'
  ) THEN
    ALTER TABLE public.products ADD CONSTRAINT products_slug_key UNIQUE (slug);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS products_sort_idx ON public.products (sort_order, created_at);

DROP TRIGGER IF EXISTS products_touch_updated_at ON public.products;
CREATE TRIGGER products_touch_updated_at
  BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Products are viewable by everyone" ON public.products;
CREATE POLICY "Products are viewable by everyone"
  ON public.products FOR SELECT
  USING (true);

GRANT ALL PRIVILEGES ON public.products TO service_role;
SQL
  then
    ok "products schema repaired"
  else
    fail "products schema repair failed; inspect the saved log"
    exit 1
  fi
fi

hdr "3. Product insert smoke test"
if run "temporary product insert rolls back cleanly" -- docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO public.products (slug, name, tagline, price_ore, image, badge)
VALUES ('smoke-product-' || extract(epoch from now())::bigint, 'Smoke Product', 'Smoke test', 12300, '', 'Test');
ROLLBACK;
SQL
then
  ok "database can create products"
else
  fail "product insert smoke test failed"
  exit 1
fi

hdr "4. Refresh running services"
run "restart REST API" -- docker compose restart rest
run "recreate app" -- docker compose up -d --force-recreate app

info "Try adding the product again in /admin/produkter. If it still fails, upload this log file."
