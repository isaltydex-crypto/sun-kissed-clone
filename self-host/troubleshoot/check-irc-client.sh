#!/usr/bin/env bash
# ============================================================================
# check-irc-client.sh — simulate a Revolution IRC client and report the
# EXACT error returned by the server.
#
# This connects to the IRC server the same way Revolution IRC does:
#   - TLS to chat.<domain>:6697
#   - sends PASS <IRC_SERVER_PASSWORD>
#   - sends NICK / USER
#   - reads server lines until 001 (welcome), an ERROR, a 464 (bad password),
#     a 432/433 (bad nick / nick in use), or a TLS/connection failure.
#
# Run on the VPS:
#   bash self-host/troubleshoot/check-irc-client.sh
# Optional overrides:
#   HOST=chat.example.com PORT=6697 NICK=tester bash .../check-irc-client.sh
# ============================================================================
set -u

# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

# ---------------------------------------------------------------------------
hdr "1. config"
if [ ! -f .env ]; then
  fail ".env not found in $(pwd)"; exit 1
fi
# NB: do NOT `source .env` — values may contain $(...), <>, &, spaces, etc.
# that bash would interpret. Read the keys we need with grep instead.
_envget() { grep -E "^$1=" .env | tail -n1 | sed -E "s/^$1=//; s/^[\"']//; s/[\"']\$//"; }
CHAT_DOMAIN="${CHAT_DOMAIN:-$(_envget CHAT_DOMAIN)}"
IRC_SERVER_PASSWORD="${IRC_SERVER_PASSWORD:-$(_envget IRC_SERVER_PASSWORD)}"

HOST="${HOST:-${CHAT_DOMAIN:-}}"
PORT="${PORT:-6697}"
NICK="${NICK:-revtest$$}"
PASS="${PASS:-${IRC_SERVER_PASSWORD:-}}"

if [ -z "$HOST" ]; then fail "HOST/CHAT_DOMAIN not set"; exit 1; fi
if [ -z "$PASS" ]; then fail "PASS/IRC_SERVER_PASSWORD not set in .env"; exit 1; fi

info "host: $HOST:$PORT"
info "nick: $NICK"
info "pass: ${#PASS} chars (first 2: ${PASS:0:2}…)"

# ---------------------------------------------------------------------------
hdr "2. DNS"
echo "--- getent hosts $HOST ---"
getent hosts "$HOST" || fail "DNS lookup failed for $HOST"

# ---------------------------------------------------------------------------
hdr "3. TCP reachability (plain socket on $PORT)"
if timeout 5 bash -c ">/dev/tcp/$HOST/$PORT" 2>/dev/null; then
  ok "TCP $HOST:$PORT is reachable"
else
  fail "Cannot open TCP to $HOST:$PORT — firewall, wrong host, or container down"
  exit 1
fi

# ---------------------------------------------------------------------------
hdr "4. TLS handshake (what Revolution IRC does first)"
echo "--- openssl s_client -connect $HOST:$PORT -servername $HOST ---"
TLS_OUT="$(echo "" | timeout 8 openssl s_client \
  -connect "$HOST:$PORT" -servername "$HOST" \
  -verify_return_error 2>&1)"
echo "$TLS_OUT"

if echo "$TLS_OUT" | grep -q 'Verify return code: 0 (ok)'; then
  ok "TLS handshake OK, certificate valid"
elif echo "$TLS_OUT" | grep -q 'Verify return code:'; then
  CERTERR="$(echo "$TLS_OUT" | grep 'Verify return code:' | head -1)"
  fail "TLS handshake completed but cert invalid: $CERTERR"
else
  fail "TLS handshake failed — see log for openssl output"
fi

# ---------------------------------------------------------------------------
hdr "5. Full IRC client simulation"
info "sending: PASS, NICK $NICK, USER $NICK 0 * :revolution-test"
info "waiting up to 10s for server response…"

# Build the IRC handshake. Use printf with explicit CRLF (IRC requires \r\n).
IRC_CMDS="$(printf 'PASS %s\r\nNICK %s\r\nUSER %s 0 * :revolution-test\r\nQUIT :bye\r\n' \
  "$PASS" "$NICK" "$NICK")"

# Pipe handshake into openssl s_client and capture every line the server sends.
echo "--- raw server response ---"
SERVER_OUT="$(printf '%s' "$IRC_CMDS" | timeout 10 openssl s_client \
  -quiet -connect "$HOST:$PORT" -servername "$HOST" 2>&1 || true)"
echo "$SERVER_OUT"
echo "--- end raw server response ---"

# ---------------------------------------------------------------------------
hdr "6. interpretation"
if echo "$SERVER_OUT" | grep -q ' 001 '; then
  ok "Server sent 001 — login SUCCESSFUL. Revolution IRC should connect fine."
  WELCOME="$(echo "$SERVER_OUT" | grep ' 001 ' | head -1)"
  info "welcome line: $WELCOME"
elif echo "$SERVER_OUT" | grep -qi 'ERROR :Closing link.*Bad password\| 464 \|password mismatch\|password incorrect'; then
  fail "REVOLUTION IRC ERROR CAUSE: bad server password (PASS rejected)"
  info "fix: make sure the password in Revolution IRC's 'Server password' field"
  info "     exactly matches IRC_SERVER_PASSWORD in self-host/.env (no quotes, no spaces)"
  echo "$SERVER_OUT" | grep -iE 'ERROR|464|password' | head -5
elif echo "$SERVER_OUT" | grep -q ' 432 '; then
  fail "REVOLUTION IRC ERROR CAUSE: erroneous nickname ($NICK rejected)"
  echo "$SERVER_OUT" | grep ' 432 ' | head -1
elif echo "$SERVER_OUT" | grep -q ' 433 '; then
  warn "Nickname already in use ($NICK). Pick a different one in Revolution IRC."
elif echo "$SERVER_OUT" | grep -qi 'throttle\|too many\|G:line\|K:line\|banned'; then
  fail "REVOLUTION IRC ERROR CAUSE: connection throttled / banned by server"
  echo "$SERVER_OUT" | grep -iE 'throttle|too many|line|banned' | head -5
elif echo "$SERVER_OUT" | grep -qi 'ERROR'; then
  fail "Server sent an ERROR before welcome. Exact line:"
  echo "$SERVER_OUT" | grep -i 'ERROR' | head -3
elif [ -z "$SERVER_OUT" ]; then
  fail "Server accepted TLS but sent ZERO bytes — likely InspIRCd crashed or TLS port mismatch"
else
  warn "No 001 welcome and no recognised error. Last lines from server:"
  echo "$SERVER_OUT" | tail -10
fi

hdr "DONE"
info "Send the saved log file (path printed below) to continue debugging."
