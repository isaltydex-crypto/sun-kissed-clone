#!/usr/bin/env bash
# ============================================================================
# fix-irc-tls.sh — enable TLS on 6697 for external IRC clients.
#
# Wires the inspircd container to Caddy's already-issued cert for $CHAT_DOMAIN:
#   1. Find Caddy's data volume (looks for *_caddy_data).
#   2. Verify Caddy has a cert for $CHAT_DOMAIN (visit https://$CHAT_DOMAIN once
#      if not — Caddy provisions lazily on the first request).
#   3. Sync IRC secrets from self-host/.env into irc-server/.env so the
#      password Revolution IRC uses matches the daemon that owns port 6697.
#   4. Recreate ircd + ws-gateway so the new compose mounts / env apply.
#   5. Verify TLS and perform a full PASS/NICK/USER IRC login simulation.
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
hdr "1. read IRC settings from self-host/.env"
if [ ! -f .env ]; then
  fail "self-host/.env not found"
  exit 1
fi
_envget() { grep -E "^$1=" .env | tail -n1 | sed -E "s/^$1=//; s/^[\"']//; s/[\"']\$//"; }
CHAT_DOMAIN="$(_envget CHAT_DOMAIN)"
IRC_OPER_PASSWORD="$(_envget IRC_OPER_PASSWORD)"
IRC_SERVER_PASSWORD="$(_envget IRC_SERVER_PASSWORD)"
GATEWAY_TOKEN="$(_envget GATEWAY_TOKEN)"
if [ -z "${CHAT_DOMAIN:-}" ]; then
  fail "CHAT_DOMAIN not set in self-host/.env"
  exit 1
fi
ok "CHAT_DOMAIN=$CHAT_DOMAIN"

_check_secret() {
  local name="$1" value="$2"
  if [ -z "$value" ]; then
    fail "$name is empty in self-host/.env"
    exit 1
  fi
  if [ "${value#CHANGEME}" != "$value" ] || [ "${value#change-me}" != "$value" ]; then
    fail "$name is still a placeholder in self-host/.env"
    exit 1
  fi
  ok "$name set (${#value} chars)"
}
_check_secret IRC_OPER_PASSWORD "$IRC_OPER_PASSWORD"
_check_secret IRC_SERVER_PASSWORD "$IRC_SERVER_PASSWORD"
_check_secret GATEWAY_TOKEN "$GATEWAY_TOKEN"

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

_set_env_var IRC_OPER_PASSWORD    "$IRC_OPER_PASSWORD"   "$IRC_ENV"
_set_env_var IRC_SERVER_PASSWORD  "$IRC_SERVER_PASSWORD" "$IRC_ENV"
_set_env_var GATEWAY_TOKEN        "$GATEWAY_TOKEN"       "$IRC_ENV"
_set_env_var CHAT_DOMAIN          "$CHAT_DOMAIN"         "$IRC_ENV"
_set_env_var CADDY_DATA_VOLUME    "$CADDY_VOL"           "$IRC_ENV"
ok "irc-server/.env updated"

# ---------------------------------------------------------------------------
hdr "5. recreate IRC containers"
cd "$IRC_DIR"
echo "+ docker compose stop ws-gateway ircd"
docker compose stop ws-gateway ircd || true
echo "+ docker compose rm -f ws-gateway ircd"
docker compose rm -f ws-gateway ircd || true
echo "+ docker compose up -d --force-recreate ircd ws-gateway"
if docker compose up -d --force-recreate ircd ws-gateway; then
  ok "ircd and ws-gateway recreated"
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

IRCD_CID="$(docker compose ps -q ircd 2>/dev/null || true)"
if [ -n "$IRCD_CID" ] && docker exec "$IRCD_CID" test -r /inspircd/conf/tls/cert.pem \
   && docker exec "$IRCD_CID" test -r /inspircd/conf/tls/key.pem; then
  ok "TLS cert/key are readable inside ircd"
else
  fail "TLS cert/key are not readable inside ircd — see log"
fi

if [ -n "$IRCD_CID" ] && docker exec "$IRCD_CID" sh -c 'grep -R "m_ssl_gnutls\|ssl=\"gnutls\"" /inspircd/conf >/dev/null'; then
  ok "InspIRCd config includes GnuTLS + 6697 TLS bind"
else
  fail "InspIRCd config does not include the 6697 TLS bind — see log"
fi

if ss -ltn 2>/dev/null | grep -q ':6697 '; then
  ok "host port 6697 is listening"
else
  warn "host port 6697 not visible via ss; external TLS probe below is authoritative"
fi

# ---------------------------------------------------------------------------
hdr "7. external TLS handshake"
# openssl s_client is the cleanest probe for an IRC TLS port.
if command -v openssl >/dev/null 2>&1; then
  echo "+ openssl s_client -connect ${CHAT_DOMAIN}:6697 -servername ${CHAT_DOMAIN}"
  TLS_OUT="$(echo "QUIT" | timeout 8 openssl s_client \
       -connect "${CHAT_DOMAIN}:6697" \
       -servername "${CHAT_DOMAIN}" \
       -verify_return_error 2>&1 || true)"
  echo "$TLS_OUT"
  if echo "$TLS_OUT" | grep -q 'Verify return code: 0 (ok)'; then
    ok "TLS handshake on :6697 succeeded with a valid cert"
  elif echo "$TLS_OUT" | grep -q 'CONNECTED'; then
    fail "TLS connected but certificate validation failed — Revolution IRC may reject it"
    echo "$TLS_OUT" | grep -E 'verify error|Verify return code|subject=|issuer=' || true
  else
    fail "TLS handshake on :6697 failed — see log"
    info "If this is the only failure, check that port 6697 is open in your"
    info "firewall (ufw allow 6697/tcp) and that nothing else binds :6697."
  fi
else
  warn "openssl not installed — skipping external TLS probe"
fi

# ---------------------------------------------------------------------------
hdr "8. full IRC login simulation"
if command -v openssl >/dev/null 2>&1; then
  NICK="revfix$$"
  IRC_CMDS="$(printf 'PASS %s\r\nNICK %s\r\nUSER %s 0 * :revolution-fix\r\nQUIT :bye\r\n' \
    "$IRC_SERVER_PASSWORD" "$NICK" "$NICK")"
  echo "--- raw server response ---"
  SERVER_OUT="$(printf '%s' "$IRC_CMDS" | timeout 12 openssl s_client \
    -quiet -connect "${CHAT_DOMAIN}:6697" -servername "${CHAT_DOMAIN}" 2>&1 || true)"
  echo "$SERVER_OUT"
  echo "--- end raw server response ---"

  if echo "$SERVER_OUT" | grep -q ' 001 '; then
    ok "IRC PASS/NICK/USER login succeeded — server side is accepting clients"
    info "If HexChat still says 'connection aborted', edit the HexChat server to use SSL/TLS:"
    info "  Server entry: ${CHAT_DOMAIN}/+6697  (the + means SSL in HexChat)"
    info "  Or check: Use SSL for all the servers on this network"
    info "  Server password: exact IRC_SERVER_PASSWORD from self-host/.env"
  elif echo "$SERVER_OUT" | grep -qi 'ERROR :Closing link.*Bad password\| 464 \|password mismatch\|password incorrect'; then
    fail "IRC login failed: bad server password"
    info "Type the exact IRC_SERVER_PASSWORD from self-host/.env into HexChat/Revolution IRC's Server password field."
  elif echo "$SERVER_OUT" | grep -q ' 432 '; then
    fail "IRC login failed: nickname rejected"
  elif echo "$SERVER_OUT" | grep -q ' 433 '; then
    warn "IRC login reached the server, but nickname is already in use"
  elif echo "$SERVER_OUT" | grep -qi 'ERROR'; then
    fail "IRC login failed with server ERROR — see raw response in log"
  else
    fail "TLS works, but IRC login did not reach welcome 001 — see raw response in log"
  fi
else
  warn "openssl not installed — skipping IRC login simulation"
fi

hdr "DONE"
info "Connect from RevolutionIRC / HexChat / mIRC:"
info "  server:   $CHAT_DOMAIN"
info "  HexChat:  ${CHAT_DOMAIN}/+6697   (or enable 'Use SSL' for the network)"
info "  port:     6697   (TLS / SSL: ON)"
info "  password: value of IRC_SERVER_PASSWORD"
