#!/usr/bin/env bash
set -u

. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

REQUIRED_RELATIONS="orders order_items admin_actions discount_codes diagnostic_events"
REQUIRED_FUNCTION="record_diagnostic_event"

hdr "1. Postgres connectivity"
if ! run "db container accepts psql" -- docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 -c "select 1"; then
  fail "database is not reachable; run self-host/troubleshoot/diag.sh first"
  exit 1
fi

hdr "2. Checkout schema check"
missing_tables="$(docker compose exec -T db psql -U postgres -d postgres -At <<SQL
select string_agg(name, ' ' order by name)
from unnest(string_to_array('$REQUIRED_RELATIONS', ' ')) as r(name)
where to_regclass('public.' || name) is null;
SQL
)"
missing_function="$(docker compose exec -T db psql -U postgres -d postgres -At <<SQL
select case when to_regprocedure('public.$REQUIRED_FUNCTION(text,text,text,text,text,jsonb,text,text,text,text)') is null then '$REQUIRED_FUNCTION' else '' end;
SQL
)"

if [ -z "$missing_tables" ] && [ -z "$missing_function" ]; then
  ok "checkout tables and diagnostic function already exist"
else
  warn "missing database objects: ${missing_tables:-}${missing_tables:+ }${missing_function:-}"
  hdr "3. Applying app schema"
  if run "apply idempotent schema" -- sh -c 'docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 < initdb/zz-app-schema.sql'; then
    ok "schema applied"
  else
    fail "schema apply failed; inspect the saved log"
    exit 1
  fi
fi

hdr "4. Refresh API schema cache"
run "restart REST API" -- docker compose restart rest

hdr "5. Insert smoke test"
if run "temporary order insert rolls back cleanly" -- docker compose exec -T db psql -U postgres -d postgres -v ON_ERROR_STOP=1 <<'SQL'
BEGIN;
INSERT INTO public.orders (
  order_number, customer_email, customer_name, customer_phone,
  shipping_address, subtotal_ore, shipping_ore, discount_ore,
  total_ore, currency, payment_method, payment_status, metadata
) VALUES (
  'SMOKE-' || extract(epoch from now())::bigint,
  'smoke@example.invalid', 'Smoke Test', null,
  '{}'::jsonb, 100, 0, 0, 100, 'SEK', 'crypto', 'pending', '{}'::jsonb
) RETURNING id \gset
INSERT INTO public.order_items (
  order_id, product_id, product_name, unit_price_ore, quantity, line_total_ore
) VALUES (:'id', 'smoke', 'Smoke Test', 100, 1, 100);
ROLLBACK;
SQL
then
  ok "checkout database can create orders"
else
  fail "checkout database smoke test failed"
  exit 1
fi

hdr "6. Paymento config"
if docker compose exec -T app sh -c 'test -n "${PAYMENTO_API_KEY:-}"'; then
  ok "PAYMENTO_API_KEY is present in app container"
else
  warn "PAYMENTO_API_KEY is missing in app container; checkout will still fail until it is set and the app is recreated"
fi

info "If you changed .env, run: docker compose up -d --force-recreate app"