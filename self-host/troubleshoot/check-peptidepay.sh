#!/usr/bin/env bash
set -u

# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

env_value() {
  local name="$1"
  [ -f .env ] || return 1
  grep -E "^${name}=" .env | tail -n 1 | cut -d= -f2- | sed 's/^"//; s/"$//'
}

env_present() {
  local name="$1" value
  value="$(env_value "$name" || true)"
  [ -n "$value" ] && ! printf '%s' "$value" | grep -q '^CHANGEME'
}

container_env_present() {
  local name="$1"
  docker compose exec -T app sh -c "test -n \"\${$name:-}\"" >/dev/null 2>&1
}

hdr "Peptide-Pay .env"
if [ ! -f .env ]; then
  fail "self-host/.env saknas"
  exit 1
fi

if env_present PEPTIDEPAY_API_KEY; then
  ok "PEPTIDEPAY_API_KEY finns i .env"
elif env_present PEPTIDEPAY_WALLET; then
  ok "PEPTIDEPAY_WALLET finns i .env"
else
  fail "Varken PEPTIDEPAY_API_KEY eller PEPTIDEPAY_WALLET finns i .env"
fi

if env_present PEPTIDEPAY_WEBHOOK_SECRET; then
  ok "PEPTIDEPAY_WEBHOOK_SECRET finns i .env"
else
  warn "PEPTIDEPAY_WEBHOOK_SECRET saknas i .env — webhook-test ger 503/401"
fi

if env_present VITE_PAYMENTS_API_BASE_URL; then
  ok "VITE_PAYMENTS_API_BASE_URL finns i .env"
else
  warn "VITE_PAYMENTS_API_BASE_URL saknas i .env — checkout kan sakna rätt API-bas efter build"
fi

hdr "Docker Compose wiring"
if docker compose config 2>/dev/null | grep -q 'PEPTIDEPAY_API_KEY'; then
  ok "docker-compose.yml skickar Peptide-Pay-variabler till app"
else
  fail "docker-compose.yml skickar inte Peptide-Pay-variabler till app — kör git pull och bygg om"
fi

hdr "App container"
APP_CID="$(docker compose ps -q app 2>/dev/null || true)"
if [ -z "$APP_CID" ]; then
  fail "app-containern kör inte"
  exit 1
fi

if container_env_present PEPTIDEPAY_API_KEY || container_env_present PEPTIDEPAY_WALLET; then
  ok "app-containern har Peptide-Pay API key/wallet"
else
  fail "app-containern saknar PEPTIDEPAY_API_KEY/PEPTIDEPAY_WALLET — kör: docker compose up -d --build --force-recreate app"
fi

if container_env_present PEPTIDEPAY_WEBHOOK_SECRET; then
  ok "app-containern har PEPTIDEPAY_WEBHOOK_SECRET"
else
  warn "app-containern saknar PEPTIDEPAY_WEBHOOK_SECRET — webhooks kommer inte valideras"
fi

hdr "Endpoint smoke test"
SITE_DOMAIN_VALUE="$(env_value SITE_DOMAIN || true)"
if [ -n "$SITE_DOMAIN_VALUE" ]; then
  STATUS="$(docker compose exec -T app node -e "fetch('https://${SITE_DOMAIN_VALUE}/api/public/health').then(r=>console.log(r.status)).catch(()=>process.exit(1))" 2>/dev/null || true)"
  if [ "$STATUS" = "200" ]; then
    ok "public health endpoint svarar 200"
  else
    warn "kunde inte bekräfta public health endpoint via https://${SITE_DOMAIN_VALUE}"
  fi
fi

hdr "Nästa steg"
info "Om containern saknar variabler: kör git pull, sedan docker compose up -d --build --force-recreate app"
info "Webhook URL i Peptide-Pay ska vara: https://<din-domän>/api/public/peptidepay-webhook"