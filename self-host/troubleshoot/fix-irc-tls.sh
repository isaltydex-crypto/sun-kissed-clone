#!/usr/bin/env bash
# ============================================================================
# fix-irc-tls.sh — repair the self-host IRC daemon on :6697.
#
# Fixes the common self-host failure where `docker compose up -d app` fails with:
#   Bind for 0.0.0.0:6697 failed: port is already allocated
#
# Cause: the old standalone irc-server compose stack (pvl-ircd / pvl-ws-gateway)
# is still running while the integrated self-host stack also starts ircd.
# This script stops the stale standalone containers, recreates the integrated
# self-host ircd/ws-gateway, and verifies TLS + IRC login on CHAT_DOMAIN:6697.
#
# Run from anywhere on the VPS:
#   bash self-host/troubleshoot/fix-irc-tls.sh
# ============================================================================
set -u

# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

_envget() { grep -E "^$1=" .env | tail -n1 | sed -E "s/^$1=//; s/^[\"']//; s/[\"']\$//"; }
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

# ---------------------------------------------------------------------------
hdr "1. read IRC settings from self-host/.env"
if [ ! -f .env ]; then
  fail "self-host/.env not found"
  exit 1
fi

CHAT_DOMAIN="$(_envget CHAT_DOMAIN)"
IRC_OPER_PASSWORD="$(_envget IRC_OPER_PASSWORD)"
IRC_SERVER_PASSWORD="$(_envget IRC_SERVER_PASSWORD)"
GATEWAY_TOKEN="$(_envget GATEWAY_TOKEN)"

if [ -z "${CHAT_DOMAIN:-}" ]; then
  fail "CHAT_DOMAIN not set in self-host/.env"
  exit 1
fi
ok "CHAT_DOMAIN=$CHAT_DOMAIN"
_check_secret IRC_OPER_PASSWORD "$IRC_OPER_PASSWORD"
_check_secret IRC_SERVER_PASSWORD "$IRC_SERVER_PASSWORD"
_check_secret GATEWAY_TOKEN "$GATEWAY_TOKEN"

# ---------------------------------------------------------------------------
hdr "2. remove stale standalone IRC containers that conflict with :6697"
if docker ps -a --format '{{.Names}}' | grep -qx 'pvl-ircd'; then
  run "stop old standalone pvl-ircd" -- docker stop pvl-ircd || true
  run "remove old standalone pvl-ircd" -- docker rm pvl-ircd || true
else
  ok "old standalone pvl-ircd is not present"
fi

if docker ps -a --format '{{.Names}}' | grep -qx 'pvl-ws-gateway'; then
  run "stop old standalone pvl-ws-gateway" -- docker stop pvl-ws-gateway || true
  run "remove old standalone pvl-ws-gateway" -- docker rm pvl-ws-gateway || true
else
  ok "old standalone pvl-ws-gateway is not present"
fi

PORT_OWNERS="$(docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' | grep -E '0\.0\.0\.0:6697->|:::6697->|:6697->' || true)"
if [ -n "$PORT_OWNERS" ]; then
  echo "--- remaining containers publishing 6697 ---"
  echo "$PORT_OWNERS"
  if echo "$PORT_OWNERS" | grep -q 'peptivalab-ircd-1'; then
    ok "integrated self-host ircd owns :6697"
  else
    fail "another container still owns :6697; stop it before starting self-host ircd"
    info "run: docker ps --format '{{.Names}} {{.Ports}}' | grep 6697"
    exit 1
  fi
else
  ok "port 6697 is free for the integrated self-host ircd"
fi

# ---------------------------------------------------------------------------
hdr "3. locate Caddy data volume and certificate"
CADDY_VOL="$(docker volume ls --format '{{.Name}}' | grep -E '^peptivalab_caddy_data$|_caddy_data$|^caddy_data$' | head -n1 || true)"
if [ -z "$CADDY_VOL" ]; then
  fail "no *_caddy_data volume found — is the self-host stack running?"
  exit 1
fi
ok "caddy volume: $CADDY_VOL"

CERT_REL="caddy/certificates/acme-v02.api.letsencrypt.org-directory/${CHAT_DOMAIN}/${CHAT_DOMAIN}.crt"
echo "+ probing $CADDY_VOL:/data/$CERT_REL"
if docker run --rm -v "$CADDY_VOL:/d:ro" busybox:1.36 test -f "/d/$CERT_REL"; then
  ok "cert found in Caddy volume"
else
  fail "cert NOT found at /data/$CERT_REL"
  info "Caddy provisions certs lazily. Visit https://$CHAT_DOMAIN once, then rerun this script."
  exit 1
fi

# ---------------------------------------------------------------------------
hdr "4. recreate integrated self-host IRC services"
run "recreate ircd + ws-gateway" -- docker compose up -d --force-recreate ircd ws-gateway || exit 1
run "ensure app and caddy are up" -- docker compose up -d app caddy || exit 1

# ---------------------------------------------------------------------------
hdr "5. verify ircd is healthy and 6697 is bound"
for _ in 1 2 3 4 5 6 7 8 9 10; do
  state="$(docker inspect "$(docker compose ps -q ircd)" --format '{{.State.Status}}' 2>/dev/null || echo missing)"
  [ "$state" = "running" ] && break
  sleep 1
done

IRCD_CID="$(docker compose ps -q ircd 2>/dev/null || true)"
if [ -n "$IRCD_CID" ] && [ "$(docker inspect "$IRCD_CID" --format '{{.State.Status}}' 2>/dev/null)" = "running" ]; then
  ok "integrated ircd container is running"
else
  fail "integrated ircd container is not running — see log"
  docker compose logs --tail=120 ircd
  exit 1
fi

docker compose logs --tail=80 ircd

if docker compose logs --tail=200 ircd 2>&1 | grep -q 'entrypoint-tls.*cert installed'; then
  ok "entrypoint copied TLS cert into place"
else
  warn "entrypoint-tls did not report 'cert installed' — check log"
fi

if docker exec "$IRCD_CID" test -r /inspircd/conf/tls/cert.pem && docker exec "$IRCD_CID" test -r /inspircd/conf/tls/key.pem; then
  ok "TLS cert/key are readable inside ircd"
else
  fail "TLS cert/key are not readable inside ircd — see log"
  exit 1
fi

if docker exec "$IRCD_CID" sh -c 'grep -R "module name=\"ssl_gnutls\"\|sslprofile=\"gnutls\"" /inspircd/conf >/dev/null'; then
  ok "InspIRCd config includes GnuTLS profile + 6697 TLS bind"
else
  fail "InspIRCd config does not include the 6697 TLS bind — see log"
  exit 1
fi

PORT_OWNERS="$(docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' | grep -E '0\.0\.0\.0:6697->|:::6697->|:6697->' || true)"
echo "--- containers publishing 6697 ---"
echo "$PORT_OWNERS"
if echo "$PORT_OWNERS" | grep -q 'peptivalab-ircd-1'; then
  ok "host port 6697 is published by the integrated ircd"
else
  fail "integrated ircd is not publishing host port 6697"
  exit 1
fi

# ---------------------------------------------------------------------------
hdr "6. external TLS handshake"
if command -v openssl >/dev/null 2>&1; then
  TLS_OUT="$(echo "QUIT" | timeout 8 openssl s_client -connect "${CHAT_DOMAIN}:6697" -servername "${CHAT_DOMAIN}" -verify_return_error 2>&1 || true)"
  echo "$TLS_OUT"
  if echo "$TLS_OUT" | grep -q 'Verify return code: 0 (ok)'; then
    ok "TLS handshake on :6697 succeeded with a valid cert"
  elif echo "$TLS_OUT" | grep -q 'CONNECTED'; then
    fail "TLS connected but certificate validation failed — IRC clients may reject it"
    echo "$TLS_OUT" | grep -E 'verify error|Verify return code|subject=|issuer=' || true
  else
    fail "TLS handshake on :6697 failed — see log"
    info "Check UFW/provider firewall: sudo ufw allow 6697/tcp"
  fi
else
  warn "openssl not installed — skipping external TLS probe"
fi

# ---------------------------------------------------------------------------
hdr "7. full IRC login simulation"
if command -v openssl >/dev/null 2>&1; then
  NICK="revfix$$"
  IRC_CMDS="$(printf 'PASS %s\r\nNICK %s\r\nUSER %s 0 * :revolution-fix\r\nQUIT :bye\r\n' "$IRC_SERVER_PASSWORD" "$NICK" "$NICK")"
  SERVER_OUT="$(printf '%s' "$IRC_CMDS" | timeout 12 openssl s_client -quiet -connect "${CHAT_DOMAIN}:6697" -servername "${CHAT_DOMAIN}" 2>&1 || true)"
  echo "--- raw server response ---"
  echo "$SERVER_OUT"
  echo "--- end raw server response ---"

  if echo "$SERVER_OUT" | grep -q ' 001 '; then
    ok "IRC PASS/NICK/USER login succeeded — server side is accepting clients"
    info "HexChat server entry: ${CHAT_DOMAIN}/+6697"
    info "TLS/SSL: ON"
    info "Server password: exact IRC_SERVER_PASSWORD from self-host/.env"
  elif echo "$SERVER_OUT" | grep -qi 'ERROR :Closing link.*Bad password\| 464 \|password mismatch\|password incorrect'; then
    fail "IRC login failed: bad server password"
    info "Type the exact IRC_SERVER_PASSWORD from self-host/.env into the IRC client's Server password field."
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
info "If the script passed, reload the site and connect with HexChat as: ${CHAT_DOMAIN}/+6697"
