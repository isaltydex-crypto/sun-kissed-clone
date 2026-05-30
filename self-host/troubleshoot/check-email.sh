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

hdr "Email .env"
if [ ! -f .env ]; then
  fail "self-host/.env saknas"
  exit 1
fi

for name in SMTP_HOST SMTP_USER SMTP_PASS NOTIFY_EMAIL_FROM; do
  if env_present "$name"; then
    ok "$name finns i .env"
  else
    fail "$name saknas/är tom i .env"
  fi
done

if env_present NOWPAYMENTS_NOTIFY_TO; then
  ok "NOWPAYMENTS_NOTIFY_TO finns i .env"
elif env_present NOTIFY_EMAIL_TO; then
  ok "NOTIFY_EMAIL_TO finns i .env (fallback för NOWPayments)"
else
  fail "NOWPAYMENTS_NOTIFY_TO/NOTIFY_EMAIL_TO saknas — ingen mottagare finns"
fi

hdr "Docker Compose wiring"
for name in SMTP_HOST SMTP_USER SMTP_PASS NOTIFY_EMAIL_FROM NOTIFY_EMAIL_TO NOWPAYMENTS_NOTIFY_TO; do
  if docker compose config 2>/dev/null | grep -q "$name"; then
    ok "docker-compose.yml skickar $name till app"
  else
    fail "docker-compose.yml skickar inte $name till app — git pull och bygg om"
  fi
done

hdr "App container"
APP_CID="$(docker compose ps -q app 2>/dev/null || true)"
if [ -z "$APP_CID" ]; then
  fail "app-containern kör inte"
  exit 1
fi

for name in SMTP_HOST SMTP_USER SMTP_PASS NOTIFY_EMAIL_FROM; do
  if container_env_present "$name"; then
    ok "app-containern har $name"
  else
    fail "app-containern saknar $name — kör: docker compose up -d --build --force-recreate app"
  fi
done

if container_env_present NOWPAYMENTS_NOTIFY_TO || container_env_present NOTIFY_EMAIL_TO; then
  ok "app-containern har mottagare för notifieringar"
else
  fail "app-containern saknar NOWPAYMENTS_NOTIFY_TO/NOTIFY_EMAIL_TO — kör: docker compose up -d --build --force-recreate app"
fi

hdr "Publik Brevo-DNS"
DNS_RESULT="$(docker compose exec -T app node - <<'NODE' 2>&1 || true
const checks = [
  ['TXT', 'peptivalabgroup.com', 'brevo-code:'],
  ['TXT', '_dmarc.peptivalabgroup.com', 'v=DMARC1'],
  ['CNAME', 'brevo1._domainkey.peptivalabgroup.com', 'dkim.brevo.com'],
  ['CNAME', 'brevo2._domainkey.peptivalabgroup.com', 'dkim.brevo.com'],
];
async function lookup(type, name) {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${type}`;
  const res = await fetch(url);
  const data = await res.json();
  return (data.Answer || []).map((a) => String(a.data || '').replace(/^"|"$/g, ''));
}
(async () => {
  for (const [type, name, needle] of checks) {
    const rows = await lookup(type, name);
    const ok = rows.some((row) => row.includes(needle));
    console.log(`${ok ? 'OK' : 'MISS'} ${type} ${name}`);
    for (const row of rows) console.log(`  ${row}`);
  }
})().catch((err) => { console.error(err.message); process.exit(2); });
NODE
)"
echo "$DNS_RESULT"
if printf '%s\n' "$DNS_RESULT" | grep -q '^MISS '; then
  warn "Brevo-DNS är inte helt synlig publikt ännu — Brevo-verifiering kan fortsätta misslyckas"
else
  ok "Brevo-DNS ser komplett ut publikt"
fi

hdr "SMTP-login"
VERIFY_RESULT="$(docker compose exec -T app node - <<'NODE' 2>&1 || true
const nodemailer = require('nodemailer');
const port = Number(process.env.SMTP_PORT || 587);
const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
const required = ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`MISSING ${missing.join(',')}`);
  process.exit(3);
}
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
transport.verify().then(() => console.log('SMTP_VERIFY_OK')).catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
NODE
)"
echo "$VERIFY_RESULT"
if printf '%s\n' "$VERIFY_RESULT" | grep -q 'SMTP_VERIFY_OK'; then
  ok "SMTP-login fungerar från app-containern"
else
  fail "SMTP-login misslyckades — se loggen för Brevos exakta svar"
fi

hdr "Testmail"
SEND_RESULT="$(docker compose exec -T app node - <<'NODE' 2>&1 || true
const nodemailer = require('nodemailer');
const to = process.env.NOWPAYMENTS_NOTIFY_TO || process.env.NOTIFY_EMAIL_TO;
if (!to) {
  console.error('MISSING_RECIPIENT');
  process.exit(3);
}
const port = Number(process.env.SMTP_PORT || 587);
const secure = process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465;
const transport = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port,
  secure,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});
transport.sendMail({
  from: process.env.NOTIFY_EMAIL_FROM || process.env.SMTP_USER,
  to,
  subject: `PeptivaLab email test ${new Date().toISOString()}`,
  text: 'Detta är ett testmail från app-containern. Om du får detta fungerar SMTP-vägen.',
}).then((info) => console.log(`SEND_OK ${info.messageId || ''}`)).catch((err) => {
  console.error(err && err.message ? err.message : String(err));
  process.exit(1);
});
NODE
)"
echo "$SEND_RESULT"
if printf '%s\n' "$SEND_RESULT" | grep -q 'SEND_OK'; then
  ok "testmail skickades från app-containern"
else
  fail "testmail kunde inte skickas — se loggen för Brevos exakta svar"
fi

hdr "Nästa steg"
info "Om app-containern saknar variabler: docker compose up -d --build --force-recreate app"
info "Om SMTP-login fungerar men Brevo-DNS missar: korrigera DNS och vänta på propagation"
info "Om testmail skickades men saknas i inbox: kontrollera spam och Brevo activity/loggar"