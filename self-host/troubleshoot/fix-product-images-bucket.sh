#!/usr/bin/env bash
set -u

. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

hdr "1. Postgres connectivity"
if ! run "db container accepts psql" -- docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "select 1"; then
  fail "database is not reachable; run self-host/troubleshoot/diag.sh first"
  exit 1
fi

hdr "2. Ensure product-images bucket exists"
if run "create/repair storage bucket + RLS" -- docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
DO $$
BEGIN
  IF to_regclass('storage.buckets') IS NULL THEN
    RAISE EXCEPTION 'storage.buckets does not exist — storage service not initialised';
  END IF;
END $$;

INSERT INTO storage.buckets (id, name, public)
VALUES ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
      AND policyname = 'Public read product-images'
  ) THEN
    CREATE POLICY "Public read product-images"
      ON storage.objects FOR SELECT
      USING (bucket_id = 'product-images');
  END IF;
END $$;

SELECT id, name, public FROM storage.buckets WHERE id = 'product-images';
SQL
then
  ok "product-images bucket is ready"
else
  fail "could not create the bucket; inspect the saved log"
  exit 1
fi

hdr "3. Restart storage service so it sees the new bucket"
run "restart storage" -- docker compose restart storage
run "restart rest"    -- docker compose restart rest

info "Try uploading the product image again in /admin/produkter."
