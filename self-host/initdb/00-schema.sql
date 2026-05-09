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
-- Realtime publication (so chat_messages broadcasts via Supabase Realtime)
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;
END $$;

ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_channels;
