-- ============================================================================
-- peptivaLab — initial schema for self-hosted Postgres
-- Auto-loaded by the supabase/postgres image on first boot
-- (files in /docker-entrypoint-initdb.d run in alpha order).
--
-- This is a snapshot of the public schema from the previous host.
-- If you ALSO need to migrate data, drop a `01-import.sql` next to this file
-- (see ../README.md step 4) — it will run after this one.
-- ============================================================================

-- Required extensions (supabase/postgres image already has these, but keep idempotent)
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ---------------------------------------------------------------------------
-- Function: touch_updated_at  (used by triggers below)
-- ---------------------------------------------------------------------------
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

-- ---------------------------------------------------------------------------
-- chat_channels
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_token text NOT NULL UNIQUE,
  display_name text,
  irc_channel_slug text NOT NULL UNIQUE,
  status text NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_channels_last_message_at_idx
  ON public.chat_channels (last_message_at DESC);

ALTER TABLE public.chat_channels ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- chat_messages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL
    REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender text NOT NULL
    CHECK (sender IN ('visitor', 'admin', 'system')),
  sender_name text,
  body text NOT NULL,
  irc_synced boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_channel_created_idx
  ON public.chat_messages (channel_id, created_at);

ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- site_content
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_content (
  key text PRIMARY KEY,
  value jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS site_content_touch ON public.site_content;
CREATE TRIGGER site_content_touch
  BEFORE UPDATE ON public.site_content
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.site_content ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- site_pages
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.site_pages (
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

CREATE INDEX IF NOT EXISTS site_pages_menu_idx
  ON public.site_pages (in_menu, menu_order) WHERE published = true;

DROP TRIGGER IF EXISTS site_pages_touch ON public.site_pages;
CREATE TRIGGER site_pages_touch
  BEFORE UPDATE ON public.site_pages
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.site_pages ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- orders / order_items / admin_actions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL UNIQUE,
  customer_email text NOT NULL,
  customer_name text NOT NULL,
  customer_phone text,
  shipping_address jsonb NOT NULL DEFAULT '{}'::jsonb,
  subtotal_ore integer NOT NULL,
  shipping_ore integer NOT NULL DEFAULT 0,
  discount_ore integer NOT NULL DEFAULT 0,
  total_ore integer NOT NULL,
  currency text NOT NULL DEFAULT 'SEK',
  payment_method text,
  payment_status text NOT NULL DEFAULT 'pending',
  fulfillment_status text NOT NULL DEFAULT 'new',
  notes text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_created_at_idx ON public.orders (created_at DESC);
CREATE INDEX IF NOT EXISTS orders_email_idx ON public.orders (customer_email);

DROP TRIGGER IF EXISTS orders_touch_updated_at ON public.orders;
CREATE TRIGGER orders_touch_updated_at
  BEFORE UPDATE ON public.orders
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.order_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id text NOT NULL,
  product_name text NOT NULL,
  unit_price_ore integer NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total_ore integer NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS order_items_order_id_idx ON public.order_items (order_id);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  target text,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS admin_actions_created_at_idx ON public.admin_actions (created_at DESC);
CREATE INDEX IF NOT EXISTS admin_actions_action_idx ON public.admin_actions (action);

ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- discount_codes
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.discount_codes (
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

CREATE INDEX IF NOT EXISTS discount_codes_code_idx ON public.discount_codes (lower(code));

DROP TRIGGER IF EXISTS discount_codes_touch_updated_at ON public.discount_codes;
CREATE TRIGGER discount_codes_touch_updated_at
  BEFORE UPDATE ON public.discount_codes
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- diagnostic_events
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.diagnostic_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text NOT NULL CHECK (source IN ('server','client','cli','container','external')),
  severity text NOT NULL CHECK (severity IN ('info','warn','error','critical')),
  kind text NOT NULL,
  message text NOT NULL,
  stack text,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  host text,
  url text,
  user_agent text,
  fingerprint text NOT NULL,
  occurrence_count integer NOT NULL DEFAULT 1,
  resolved boolean NOT NULL DEFAULT false,
  resolved_at timestamptz,
  resolved_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diag_created ON public.diagnostic_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_diag_sev_resolved ON public.diagnostic_events (severity, resolved);
CREATE INDEX IF NOT EXISTS idx_diag_fingerprint ON public.diagnostic_events (fingerprint);

ALTER TABLE public.diagnostic_events ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.record_diagnostic_event(
  p_source text,
  p_severity text,
  p_kind text,
  p_message text,
  p_stack text,
  p_meta jsonb,
  p_host text,
  p_url text,
  p_user_agent text,
  p_fingerprint text
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id uuid;
BEGIN
  SELECT id INTO existing_id
    FROM public.diagnostic_events
   WHERE fingerprint = p_fingerprint
     AND resolved = false
     AND last_seen_at > now() - interval '1 hour'
   ORDER BY last_seen_at DESC
   LIMIT 1;

  IF existing_id IS NOT NULL THEN
    UPDATE public.diagnostic_events
       SET occurrence_count = occurrence_count + 1,
           last_seen_at = now(),
           meta = p_meta
     WHERE id = existing_id;
    RETURN existing_id;
  END IF;

  INSERT INTO public.diagnostic_events
    (source, severity, kind, message, stack, meta, host, url, user_agent, fingerprint)
  VALUES
    (p_source, p_severity, p_kind, p_message, p_stack,
     COALESCE(p_meta, '{}'::jsonb), p_host, p_url, p_user_agent, p_fingerprint)
  RETURNING id INTO existing_id;

  RETURN existing_id;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.record_diagnostic_event(text,text,text,text,text,jsonb,text,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_diagnostic_event(text,text,text,text,text,jsonb,text,text,text,text)
  TO service_role;

GRANT USAGE ON SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- ---------------------------------------------------------------------------
-- Realtime publication (so chat_messages broadcasts via Supabase Realtime)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'chat_channels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;
  END IF;
END $$;
