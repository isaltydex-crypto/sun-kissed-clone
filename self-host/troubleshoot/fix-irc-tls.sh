#!/usr/bin/env bash
# ============================================================================
# fix-irc-tls.sh — enable TLS on 6697 for external IRC clients.
#
# Wires the inspircd container to Caddy's already-issued cert for $CHAT_DOMAIN:
#   1. Find Caddy's data volume (looks for *_caddy_data).
#   2. Verify Caddy has a cert for $CHAT_DOMAIN (visit https://$CHAT_DOMAIN once
#      if not — Caddy provisions lazily on the first request).
#   3. Write CHAT_DOMAIN + CADDY_DATA_VOLUME into irc-server/.env.
#   4. Recreate the ircd container so the new compose mounts / entrypoint apply.
#   5. Tail the logs and confirm the GnuTLS module loaded and 6697 is bound.
#
# Run from anywhere on the VPS:
#   bash self-host/troubleshoot/fix-irc-tls.sh
# ============================================================================
set -u

# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

# _lib.sh cd'd us into self-host/. The irc-server compose lives next to it.
IRC_DIR="$(cd ../irc-server 2>/dev/null && pwd || true)"
if [ -z "$IRC_DIR" ] || [ ! -f "$IRC_DIR/docker-compose.yml" ]; then
  fail "irc-server/ not found next to self-host/ (looked at ../irc-server)"
  exit 1
fi
info "irc-server dir: $IRC_DIR"

# ---------------------------------------------------------------------------
hdr "1. read CHAT_DOMAIN from self-host/.env"
if [ ! -f .env ]; then
  fail "self-host/.env not found"
  exit 1
fi
CHAT_DOMAIN="$(grep -E '^CHAT_DOMAIN=' .env | tail -n1 | sed -E 's/^CHAT_DOMAIN=//; s/^[\"'\'']//; s/[\"'\'']$//')"
if [ -z "${CHAT_DOMAIN:-}" ]; then
  fail "CHAT_DOMAIN not set in self-host/.env"
  exit 1
fi
ok "CHAT_DOMAIN=$CHAT_DOMAIN"

# ---------------------------------------------------------------------------
hdr "2. locate Caddy data volume"
echo "--- docker volume ls ---"
docker volume ls
CADDY_VOL="$(docker volume ls --format '{{.Name}}' | grep -E '_caddy_data$|^caddy_data$' | head -n1)"
if [ -z "$CADDY_VOL" ]; then
  fail "no *_caddy_data volume found — is the self-host stack running?"
  exit 1
fi
ok "caddy volume: $CADDY_VOL"

# ---------------------------------------------------------------------------
hdr "3. verify Caddy has issued a cert for $CHAT_DOMAIN"
CERT_REL="caddy/certificates/acme-v02.api.letsencrypt.org-directory/${CHAT_DOMAIN}/${CHAT_DOMAIN}.crt"
echo "+ probing $CADDY_VOL:/data/$CERT_REL"
if docker run --rm -v "$CADDY_VOL:/d:ro" busybox:1.36 \
     test -f "/d/$CERT_REL"; then
  ok "cert found in Caddy volume"
else
  fail "cert NOT found at /data/$CERT_REL"
  info "Caddy provisions certs lazily. Visit https://$CHAT_DOMAIN once from a"
  info "browser (or run: curl -I https://$CHAT_DOMAIN) and re-run this script."
  exit 1
fi

# ---------------------------------------------------------------------------
hdr "4. update irc-server/.env"
IRC_ENV="$IRC_DIR/.env"
if [ ! -f "$IRC_ENV" ]; then
  fail "$IRC_ENV not found — create it from .env.example first"
  exit 1
fi

_set_env_var() {  # $1=key  $2=value  $3=file
  local k="$1" v="$2" f="$3"
  if grep -qE "^${k}=" "$f"; then
    # in-place replace, preserving everything else
    awk -v k="$k" -v v="$v" 'BEGIN{FS=OFS="="} $1==k{print k"="v; next} {print}' "$f" > "$f.tmp"
    mv "$f.tmp" "$f"
    echo "+ updated $k in $f"
  else
    printf '\n%s=%s\n' "$k" "$v" >> "$f"
    echo "+ appended $k to $f"
  fi
}

_set_env_var CHAT_DOMAIN          "$CHAT_DOMAIN" "$IRC_ENV"
_set_env_var CADDY_DATA_VOLUME    "$CADDY_VOL"   "$IRC_ENV"
ok "irc-server/.env updated"

# ---------------------------------------------------------------------------
hdr "5. recreate ircd container"
cd "$IRC_DIR"
echo "+ docker compose down ircd"
docker compose down ircd || true
echo "+ docker compose up -d --force-recreate ircd"
if docker compose up -d --force-recreate ircd; then
  ok "ircd recreated"
else
  fail "docker compose up failed — see log"
  exit 1
fi

# ---------------------------------------------------------------------------
hdr "6. verify ircd is healthy and 6697 is bound"
# Give inspircd a couple seconds to start up.
for i in 1 2 3 4 5 6 7 8 9 10; do
  sleep 1
  state="$(docker inspect "$(docker compose ps -q ircd)" --format '{{.State.Status}}' 2>/dev/null || echo missing)"
  [ "$state" = "running" ] && break
done

echo "--- last 60 lines of ircd logs ---"
docker compose logs --tail=60 ircd

if docker compose logs --tail=200 ircd 2>&1 | grep -q 'entrypoint-tls.*cert installed'; then
  ok "entrypoint copied TLS cert into place"
else
  warn "entrypoint-tls did not report 'cert installed' — check log"
fi

if docker compose logs --tail=200 ircd 2>&1 | grep -qiE 'm_ssl_gnutls\.so|Loading module:.*ssl_gnutls'; then
  ok "GnuTLS module loaded"
else
  fail "GnuTLS module did not load — see log"
fi

if docker compose logs --tail=200 ircd 2>&1 | grep -qE 'Bound to.*:6697|listening on.*6697'; then
  ok "ircd is bound to :6697"
else
  warn "no explicit 'bound to 6697' line — inspircd doesn't always log it"
fi

# ---------------------------------------------------------------------------
hdr "7. external TLS handshake"
# openssl s_client is the cleanest probe for an IRC TLS port.
if command -v openssl >/dev/null 2>&1; then
  echo "+ openssl s_client -connect ${CHAT_DOMAIN}:6697 -servername ${CHAT_DOMAIN}"
  if echo "QUIT" | timeout 8 openssl s_client \
       -connect "${CHAT_DOMAIN}:6697" \
       -servername "${CHAT_DOMAIN}" 2>&1 | grep -qE 'Verify return code: 0|CONNECTED'; then
    ok "TLS handshake on :6697 succeeded"
  else
    fail "TLS handshake on :6697 failed — see log"
    info "If this is the only failure, check that port 6697 is open in your"
    info "firewall (ufw allow 6697/tcp) and that nothing else binds :6697."
  fi
else
  warn "openssl not installed — skipping external TLS probe"
fi

hdr "DONE"
info "Connect from RevolutionIRC / HexChat / mIRC:"
info "  server:   $CHAT_DOMAIN"
info "  port:     6697   (TLS / SSL: ON)"
info "  password: value of IRC_SERVER_PASSWORD"
