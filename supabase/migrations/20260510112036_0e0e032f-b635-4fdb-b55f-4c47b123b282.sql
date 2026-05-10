CREATE TABLE public.diagnostic_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source TEXT NOT NULL CHECK (source IN ('server','client','cli','container','external')),
  severity TEXT NOT NULL CHECK (severity IN ('info','warn','error','critical')),
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  stack TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  host TEXT,
  url TEXT,
  user_agent TEXT,
  fingerprint TEXT NOT NULL,
  occurrence_count INTEGER NOT NULL DEFAULT 1,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMPTZ,
  resolved_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_diag_created ON public.diagnostic_events (created_at DESC);
CREATE INDEX idx_diag_sev_resolved ON public.diagnostic_events (severity, resolved);
CREATE INDEX idx_diag_fingerprint ON public.diagnostic_events (fingerprint);

ALTER TABLE public.diagnostic_events ENABLE ROW LEVEL SECURITY;

-- No public policies: only the service role (server-side) can access.
-- Admin UI reads/writes through server functions guarded by adminAuthMiddleware.

-- Upsert helper that dedupes by fingerprint within a 1-hour window:
--   * if a matching unresolved event exists in the last hour → bump occurrence_count + last_seen_at
--   * otherwise insert a new row
CREATE OR REPLACE FUNCTION public.record_diagnostic_event(
  p_source TEXT,
  p_severity TEXT,
  p_kind TEXT,
  p_message TEXT,
  p_stack TEXT,
  p_meta JSONB,
  p_host TEXT,
  p_url TEXT,
  p_user_agent TEXT,
  p_fingerprint TEXT
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing_id UUID;
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