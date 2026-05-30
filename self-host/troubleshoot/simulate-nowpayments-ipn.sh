#!/usr/bin/env bash
set -u

# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

# ─────────────────────────────────────────────────────────────
# simulate-nowpayments-ipn.sh
#
# Skickar en signerad fake-IPN till webhook-endpointen så du kan testa
# end-to-end (signaturvalidering → order-update → discount-counter) utan
# att vänta på en riktig betalning.
#
# Använder NOWPAYMENTS_IPN_SECRET från self-host/.env för att signera med
# HMAC-SHA512 över sorterad JSON (samma algoritm som NOWPayments).
#
# Usage:
#   ./simulate-nowpayments-ipn.sh <order_number> [status]
#
# Exempel:
#   ./simulate-nowpayments-ipn.sh PL-MGZ8K4    finished     # paid
#   ./simulate-nowpayments-ipn.sh PL-MGZ8K4    waiting      # pending
#   ./simulate-nowpayments-ipn.sh PL-MGZ8K4    failed       # failed
#
# NOWPayments-status: waiting, confirming, confirmed, sending,
# partially_paid, finished, failed, refunded, expired.
# ─────────────────────────────────────────────────────────────

ORDER_NUMBER="${1:-}"
STATUS="${2:-finished}"

if [ -z "$ORDER_NUMBER" ]; then
  fail "Usage: $0 <order_number> [status]"
  exit 1
fi

env_value() {
  local name="$1"
  [ -f .env ] || return 1
  grep -E "^${name}=" .env | tail -n 1 | cut -d= -f2- | sed 's/^"//; s/"$//'
}

hdr "Förbereder payload"
IPN_SECRET="$(env_value NOWPAYMENTS_IPN_SECRET || true)"
SITE_DOMAIN="$(env_value SITE_DOMAIN || true)"

if [ -z "$IPN_SECRET" ] || printf '%s' "$IPN_SECRET" | grep -q '^CHANGEME'; then
  fail "NOWPAYMENTS_IPN_SECRET saknas/är default i self-host/.env"
  exit 1
fi
if [ -z "$SITE_DOMAIN" ]; then
  fail "SITE_DOMAIN saknas i self-host/.env"
  exit 1
fi

# Välj endpoint — overrida med WEBHOOK_PATH=... vid behov.
WEBHOOK_PATH="${WEBHOOK_PATH:-/api/public/nowpayments/webhook}"
URL="https://${SITE_DOMAIN}${WEBHOOK_PATH}"
info "order_number = ${ORDER_NUMBER}"
info "payment_status = ${STATUS}"
info "POST ${URL}"

# Signera + posta inuti app-containern så vi har Node + nätaccess.
# Skickar IPN_SECRET via env för att hålla det borta från ps/argv.
hdr "Signerar och postar IPN"
RESULT="$(
  IPN_SECRET="$IPN_SECRET" \
  docker compose exec -T -e IPN_SECRET="$IPN_SECRET" app node -e "
    const crypto = require('crypto');
    const payload = {
      payment_id: 'sim-' + Date.now(),
      payment_status: '${STATUS}',
      pay_address: 'TSimulatedAddress',
      price_amount: 100,
      price_currency: 'sek',
      pay_amount: 9.5,
      actually_paid: 9.5,
      pay_currency: 'usdttrc20',
      order_id: '${ORDER_NUMBER}',
      order_description: 'Simulated IPN',
      purchase_id: 'sim-purchase-1',
      outcome_amount: 9.4,
      outcome_currency: 'usdt',
    };
    const sortedStringify = (v) => {
      if (v === null || typeof v !== 'object') return JSON.stringify(v);
      if (Array.isArray(v)) return '[' + v.map(sortedStringify).join(',') + ']';
      const keys = Object.keys(v).sort();
      return '{' + keys.map(k => JSON.stringify(k) + ':' + sortedStringify(v[k])).join(',') + '}';
    };
    const body = sortedStringify(payload);
    const sig = crypto.createHmac('sha512', process.env.IPN_SECRET).update(body).digest('hex');
    fetch('${URL}', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-nowpayments-sig': sig },
      body,
    }).then(async r => {
      console.log('HTTP ' + r.status);
      console.log(await r.text());
    }).catch(e => { console.error(e.message); process.exit(1); });
  " 2>&1 || true
)"
echo "$RESULT"

HTTP_LINE="$(printf '%s\n' "$RESULT" | grep -E '^HTTP ' | tail -1)"
case "$HTTP_LINE" in
  "HTTP 200") ok "webhook accepterade IPN ($HTTP_LINE)";;
  "HTTP 401") fail "signaturvalidering misslyckades — IPN_SECRET matchar inte server-sidan";;
  "HTTP 503") fail "NOWPAYMENTS_IPN_SECRET saknas i app-containern (env_file/restart?)";;
  "HTTP 400") warn "webhook accepterade signaturen men avvisade payloaden";;
  "HTTP 404") fail "endpoint hittades inte — prova WEBHOOK_PATH=/api/public/nowpayments-webhook";;
  *)          warn "oväntat svar: $HTTP_LINE";;
esac

hdr "Verifierar order-status i DB"
docker compose exec -T db psql -U "${POSTGRES_USER:-postgres}" -d "${POSTGRES_DB:-postgres}" -c \
  "select order_number, payment_status, updated_at, metadata->'last_ipn' as last_ipn
     from public.orders
    where order_number = '${ORDER_NUMBER}';" 2>&1 || warn "kunde inte läsa orders-tabellen"
