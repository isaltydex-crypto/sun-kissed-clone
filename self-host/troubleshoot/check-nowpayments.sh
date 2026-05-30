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

hdr "NOWPayments .env"
if [ ! -f .env ]; then
  fail "self-host/.env saknas"
  exit 1
fi

if env_present NOWPAYMENTS_API_KEY; then
  ok "NOWPAYMENTS_API_KEY finns i .env"
else
  fail "NOWPAYMENTS_API_KEY saknas i .env — krypto-betalningar inaktiverat"
fi

if env_present NOWPAYMENTS_IPN_SECRET; then
  ok "NOWPAYMENTS_IPN_SECRET finns i .env"
else
  warn "NOWPAYMENTS_IPN_SECRET saknas — webhooks ger 503/401"
fi

hdr "Docker Compose wiring"
if docker compose config 2>/dev/null | grep -q 'NOWPAYMENTS_API_KEY'; then
  ok "docker-compose.yml skickar NOWPayments-variabler till app"
else
  fail "docker-compose.yml skickar inte NOWPayments-variabler — git pull och bygg om"
fi

hdr "App container"
APP_CID="$(docker compose ps -q app 2>/dev/null || true)"
if [ -z "$APP_CID" ]; then
  fail "app-containern kör inte"
  exit 1
fi

if container_env_present NOWPAYMENTS_API_KEY; then
  ok "app-containern har NOWPAYMENTS_API_KEY"
else
  fail "app-containern saknar NOWPAYMENTS_API_KEY — kör: docker compose up -d --build --force-recreate app"
fi

if container_env_present NOWPAYMENTS_IPN_SECRET; then
  ok "app-containern har NOWPAYMENTS_IPN_SECRET"
else
  warn "app-containern saknar NOWPAYMENTS_IPN_SECRET — webhooks valideras inte"
fi

hdr "NOWPayments API smoke test"
API_KEY_VALUE="$(env_value NOWPAYMENTS_API_KEY || true)"
if [ -n "$API_KEY_VALUE" ]; then
  STATUS="$(docker compose exec -T app node -e "
    fetch('https://api.nowpayments.io/v1/status', { headers: { 'x-api-key': '${API_KEY_VALUE}' } })
      .then(r => r.json())
      .then(j => console.log(j.message || JSON.stringify(j)))
      .catch(e => { console.error(e.message); process.exit(1); })
  " 2>&1 || true)"
  echo "NOWPayments /status → $STATUS"
  if echo "$STATUS" | grep -qi 'OK'; then
    ok "NOWPayments API svarar OK"
  else
    warn "NOWPayments API svarade oväntat — kontrollera API-nyckeln i dashboarden"
  fi
fi

hdr "Webhook endpoint"
SITE_DOMAIN_VALUE="$(env_value SITE_DOMAIN || true)"
if [ -n "$SITE_DOMAIN_VALUE" ]; then
  WH_STATUS="$(docker compose exec -T app node -e "
    fetch('https://${SITE_DOMAIN_VALUE}/api/public/nowpayments-webhook', { method: 'POST', body: '{}' })
      .then(r => console.log(r.status))
      .catch(() => process.exit(1))
  " 2>/dev/null || true)"
  if [ "$WH_STATUS" = "401" ] || [ "$WH_STATUS" = "503" ]; then
    ok "webhook-endpoint är nåbar (svar: $WH_STATUS — väntat utan giltig signatur)"
  else
    warn "webhook-endpoint svarade $WH_STATUS — väntade 401/503"
  fi
fi

hdr "Nästa steg"
info "Sätt IPN callback URL i NOWPayments dashboard till:"
info "  https://${SITE_DOMAIN_VALUE:-<din-domän>}/api/public/nowpayments-webhook"
info "Om containern saknar variabler: git pull && docker compose up -d --build --force-recreate app"
