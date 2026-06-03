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

hdr "PayGate.to .env"
if [ ! -f .env ]; then
  fail "self-host/.env saknas"
  exit 1
fi

if env_present PAYGATE_WALLET; then
  ok "PAYGATE_WALLET finns i .env"
else
  fail "PAYGATE_WALLET saknas — PayGate-alternativet inaktiverat i checkout"
fi

if env_present PAYGATE_CALLBACK_SECRET; then
  ok "PAYGATE_CALLBACK_SECRET finns i .env"
else
  fail "PAYGATE_CALLBACK_SECRET saknas — IPN-callback kommer att avvisas (401)"
fi

if env_present PAYGATE_PROVIDER; then
  info "PAYGATE_PROVIDER satt — låst till en provider"
else
  info "PAYGATE_PROVIDER tom — multi-provider hostad sida används (rekommenderat)"
fi

hdr "Wallet-format"
WALLET_VALUE="$(env_value PAYGATE_WALLET || true)"
if printf '%s' "$WALLET_VALUE" | grep -Eq '^0x[a-fA-F0-9]{40}$'; then
  ok "PAYGATE_WALLET ser ut som en giltig EVM-adress"
else
  warn "PAYGATE_WALLET ser inte ut som en giltig 0x…(40 hex)-adress — dubbelkolla"
fi

hdr "Docker Compose wiring"
if docker compose config 2>/dev/null | grep -q 'PAYGATE_WALLET'; then
  ok "docker-compose.yml skickar PayGate-variabler till app"
else
  fail "docker-compose.yml skickar inte PayGate-variabler — kör git pull och bygg om"
fi

hdr "App container"
APP_CID="$(docker compose ps -q app 2>/dev/null || true)"
if [ -z "$APP_CID" ]; then
  fail "app-containern kör inte"
  exit 1
fi

if container_env_present PAYGATE_WALLET; then
  ok "app-containern har PAYGATE_WALLET"
else
  fail "app-containern saknar PAYGATE_WALLET — kör: docker compose up -d --build --force-recreate app"
fi

if container_env_present PAYGATE_CALLBACK_SECRET; then
  ok "app-containern har PAYGATE_CALLBACK_SECRET"
else
  fail "app-containern saknar PAYGATE_CALLBACK_SECRET"
fi

hdr "PayGate API smoke test (wallet.php)"
SITE_DOMAIN_VALUE="$(env_value SITE_DOMAIN || true)"
ADDRESS_IN=""
if [ -n "$WALLET_VALUE" ] && [ -n "$SITE_DOMAIN_VALUE" ]; then
  CB_TEST="https://${SITE_DOMAIN_VALUE}/api/public/paygate-callback?order=TROUBLESHOOT-$(date +%s)"
  RESPONSE="$(docker compose exec -T app node -e "
    const u = new URL('https://api.paygate.to/control/wallet.php');
    u.searchParams.set('address', '${WALLET_VALUE}');
    u.searchParams.set('callback', '${CB_TEST}');
    fetch(u.toString())
      .then(async r => { console.log(r.status); console.log(await r.text()); })
      .catch(e => { console.error(e.message); process.exit(1); })
  " 2>&1 || true)"
  echo "PayGate wallet.php → ${RESPONSE}"
  if printf '%s' "$RESPONSE" | grep -q 'address_in'; then
    ok "PayGate API returnerade en encrypted address_in"
    ADDRESS_IN="$(printf '%s' "$RESPONSE" | sed -n '2,$p' | docker compose exec -T app node -e "let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>{try{console.log(JSON.parse(s).address_in||'')}catch{}})")"
  else
    warn "PayGate API svarade oväntat — kontrollera wallet-adress + nätverk"
  fi
fi

hdr "PayGate checkout-länk"
if [ -n "$ADDRESS_IN" ]; then
  CHECKOUT_URL="$(docker compose exec -T app node -e "
    const addressIn = decodeURIComponent(process.argv[1]);
    const provider = process.env.PAYGATE_PROVIDER || 'moonpay';
    const u = new URL('https://checkout.paygate.to/process-payment.php');
    u.searchParams.set('address', addressIn);
    u.searchParams.set('amount', '20.00');
    u.searchParams.set('currency', 'USD');
    u.searchParams.set('email', 'test@example.com');
    u.searchParams.set('provider', provider);
    console.log(u.toString());
  " "$ADDRESS_IN" 2>/dev/null || true)"
  echo "PayGate checkout URL → $CHECKOUT_URL"
  if printf '%s' "$CHECKOUT_URL" | grep -Eq '%25(2F|2B|3D)'; then
    fail "checkout-länken dubbelkodar address_in — appen kör gammal kod eller fel build"
  else
    ok "checkout-länken dubbelkodar inte address_in"
  fi

  CHECKOUT_STATUS="$(docker compose exec -T app node -e "
    fetch(process.argv[1], { redirect: 'manual' })
      .then(async r => { console.log(r.status); console.log(await r.text()); })
      .catch(e => { console.error(e.message); process.exit(1); })
  " "$CHECKOUT_URL" 2>&1 || true)"
  echo "PayGate process-payment.php → ${CHECKOUT_STATUS}"
  if printf '%s' "$CHECKOUT_STATUS" | head -n 1 | grep -Eq '^(301|302|303|307|308)$'; then
    ok "PayGate accepterar checkout-länken och redirectar till provider"
  elif printf '%s' "$CHECKOUT_STATUS" | grep -qi 'Provided wallet address is not allowed'; then
    fail "PayGate avvisar länken som ogiltig wallet — oftast dubbelkodad/stale build"
  else
    warn "PayGate checkout svarade oväntat — se loggen för exakt svar"
  fi
else
  warn "Hoppar över checkout-test eftersom address_in saknas"
fi

hdr "Callback endpoint"
if [ -n "$SITE_DOMAIN_VALUE" ]; then
  CB_STATUS="$(docker compose exec -T app node -e "
    fetch('https://${SITE_DOMAIN_VALUE}/api/public/paygate-callback?order=test&t=wrong')
      .then(r => console.log(r.status))
      .catch(() => process.exit(1))
  " 2>/dev/null || true)"
  if [ "$CB_STATUS" = "401" ]; then
    ok "callback-endpoint är nåbar och avvisar fel token (401 som väntat)"
  elif [ "$CB_STATUS" = "503" ]; then
    warn "callback-endpoint svarar 503 — PAYGATE_CALLBACK_SECRET saknas i körande container"
  else
    warn "callback-endpoint svarade $CB_STATUS — väntade 401"
  fi
fi

hdr "Nästa steg"
info "PayGate skickar callback automatiskt till URL:en vi anger när wallet skapas."
info "Ingen manuell webhook-konfiguration behövs i PayGate."
info "Spåra payouts: https://paygate.to/instant-payment-gateway/#track"
info "Om containern saknar variabler: git pull && docker compose up -d --build --force-recreate app"
