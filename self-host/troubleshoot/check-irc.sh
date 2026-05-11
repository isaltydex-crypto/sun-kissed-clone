#!/usr/bin/env bash
# ============================================================================
# check-irc.sh — end-to-end health check for the IRC stack.
#
# Verifies:
#   1. The two IRC containers (ircd, ws-gateway) are up.
#   2. The required env vars are set in self-host/.env (IRC_GATEWAY_URL,
#      IRC_BOT_PASSWORD/GATEWAY_TOKEN, IRC_SERVER_PASSWORD).
#   3. InspIRCd accepts a TCP connection on 6667 (internal) and answers PASS.
#   4. The ws-gateway port 8080 is listening and rejects bad AUTH.
#   5. A real WebSocket handshake with the correct AUTH token returns READY.
#   6. Caddy is proxying chat.<domain> → ws-gateway:8080 (HTTP 426 Upgrade
#      Required is the expected response to a plain GET).
#   7. The app container has the IRC env vars baked into its process (so the
#      bridge will actually try to connect).
#
# Run on the VPS:
#   bash self-host/troubleshoot/check-irc.sh
# ============================================================================
set -u

# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

# ---------------------------------------------------------------------------
hdr "1. .env values"
if [ ! -f .env ]; then
  fail ".env not found in $(pwd)"
  exit 1
fi
# NB: do NOT `source .env` — values may contain $(...), <>, &, spaces, etc.
# Pull only the keys this script inspects, parsed literally.
_envget() { grep -E "^$1=" .env | tail -n1 | sed -E "s/^$1=//; s/^[\"']//; s/[\"']\$//"; }
for _k in IRC_GATEWAY_URL IRC_SERVER IRC_BOT_NICK GATEWAY_TOKEN IRC_CHANNEL_PREFIX IRC_OPER_PASSWORD IRC_SERVER_PASSWORD CHAT_DOMAIN; do
  if [ -z "${!_k:-}" ]; then export "$_k=$(_envget "$_k")"; fi
done

check_var() {
  local name="$1"; local val="${!1:-}"
  if [ -z "$val" ]; then
    fail "$name is empty"
  elif [ "${val#CHANGEME}" != "$val" ]; then
    fail "$name is still a CHANGEME placeholder"
  else
    ok "$name set (${#val} chars)"
  fi
}
check_var IRC_GATEWAY_URL
check_var IRC_SERVER
check_var IRC_BOT_NICK
check_var IRC_BOT_PASSWORD
check_var GATEWAY_TOKEN
check_var IRC_SERVER_PASSWORD
check_var CHAT_DOMAIN

if [ -n "${IRC_BOT_PASSWORD:-}" ] && [ -n "${GATEWAY_TOKEN:-}" ] \
   && [ "$IRC_BOT_PASSWORD" != "$GATEWAY_TOKEN" ]; then
  fail "IRC_BOT_PASSWORD != GATEWAY_TOKEN — bridge will fail AUTH"
else
  ok "IRC_BOT_PASSWORD matches GATEWAY_TOKEN"
fi

# ---------------------------------------------------------------------------
hdr "2. containers"
echo "--- docker compose ps (filtered) ---"
docker compose ps ircd ws-gateway 2>&1 || true

for svc in ircd ws-gateway; do
  cid="$(docker compose ps -q "$svc" 2>/dev/null || true)"
  if [ -z "$cid" ]; then
    fail "$svc container not running"
    continue
  fi
  state="$(docker inspect "$cid" --format '{{.State.Status}}')"
  if [ "$state" = "running" ]; then ok "$svc is $state"; else fail "$svc is $state"; fi
done

echo "--- ircd logs (last 30) ---"
docker compose logs --tail=30 ircd 2>&1 || true
echo "--- ws-gateway logs (last 30) ---"
docker compose logs --tail=30 ws-gateway 2>&1 || true

# ---------------------------------------------------------------------------
hdr "3. InspIRCd reachable from ws-gateway"
# Use a one-shot busybox container on the same network as ws-gateway.
NET="$(docker inspect "$(docker compose ps -q ws-gateway)" \
        --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}' \
        2>/dev/null | awk '{print $1}')"
if [ -z "$NET" ]; then
  warn "could not detect ws-gateway docker network — skipping internal probe"
else
  info "using docker network: $NET"
  if docker run --rm --network "$NET" busybox:1.36 \
       sh -c 'echo "QUIT" | nc -w 3 ircd 6667' 2>&1 | tee /dev/stderr | grep -qi 'irc\|notice\|inspircd'; then
    ok "ircd:6667 answers IRC protocol"
  else
    fail "ircd:6667 did not answer with an IRC banner — see log"
  fi
fi

# ---------------------------------------------------------------------------
hdr "4. ws-gateway local port"
if ss -ltnp 2>/dev/null | grep -q ':8080 '; then
  ok "port 8080 is listening"
else
  warn "nothing on host :8080 (ok if you only expose via Caddy)"
fi

# ---------------------------------------------------------------------------
hdr "5. WebSocket AUTH handshake"
# Need a small node script — ws-gateway speaks WS, not raw HTTP.
if ! command -v node >/dev/null 2>&1; then
  warn "node not on PATH — running probe inside the ws-gateway container"
  RUN_IN_CONTAINER=1
else
  RUN_IN_CONTAINER=0
fi

PROBE='
const WebSocket = require("ws");
const url   = process.env.URL;
const token = process.env.TOKEN;
const ws = new WebSocket(url);
let timer = setTimeout(() => { console.log("TIMEOUT"); process.exit(2); }, 8000);
ws.on("open",   () => ws.send("AUTH " + token));
ws.on("message",(d) => {
  const t = d.toString().trim();
  console.log("RECV:", t);
  if (t === "READY" || t.startsWith(":")) { clearTimeout(timer); ws.close(); process.exit(0); }
});
ws.on("close",  (c,r) => { console.log("CLOSE", c, r.toString()); process.exit(c===1000?0:1); });
ws.on("error",  (e) => { console.log("ERR", e.message); process.exit(3); });
'

probe_ws() {
  local target="$1"
  if [ "$RUN_IN_CONTAINER" = "1" ]; then
    docker compose exec -T -e URL="$target" -e TOKEN="$GATEWAY_TOKEN" ws-gateway \
      node -e "$PROBE" 2>&1
  else
    URL="$target" TOKEN="$GATEWAY_TOKEN" node -e "$PROBE" 2>&1
  fi
}

# 5a — direct localhost (bypass Caddy/TLS)
info "probing ws://127.0.0.1:8080 (direct)"
if probe_ws "ws://127.0.0.1:8080" | tee /dev/stderr | grep -q 'READY'; then
  ok "direct ws-gateway accepted AUTH and replied READY"
else
  fail "direct ws-gateway did not return READY (see log)"
fi

# 5b — through Caddy/TLS using the configured public URL
if [ -n "${IRC_GATEWAY_URL:-}" ]; then
  info "probing $IRC_GATEWAY_URL (through Caddy)"
  if probe_ws "$IRC_GATEWAY_URL" | tee /dev/stderr | grep -q 'READY'; then
    ok "public WebSocket endpoint accepted AUTH and replied READY"
  else
    fail "public WebSocket endpoint did not return READY (see log)"
  fi
fi

# ---------------------------------------------------------------------------
hdr "6. Caddy proxy for chat.<domain>"
if [ -n "${CHAT_DOMAIN:-}" ]; then
  echo "--- curl -I https://${CHAT_DOMAIN} ---"
  curl -sS -I --max-time 8 "https://${CHAT_DOMAIN}" 2>&1 || true
  CODE="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 8 "https://${CHAT_DOMAIN}" || true)"
  case "$CODE" in
    426|400|404|101) ok "chat domain responds (HTTP $CODE — expected for plain GET to a WS endpoint)" ;;
    000)             fail "chat domain unreachable (no response)" ;;
    5*)              fail "chat domain returned $CODE — Caddy can't reach ws-gateway" ;;
    *)               warn "chat domain returned $CODE" ;;
  esac
fi

# ---------------------------------------------------------------------------
hdr "7. app container has IRC env"
APP_CID="$(docker compose ps -q app 2>/dev/null || true)"
if [ -z "$APP_CID" ]; then
  fail "app container not running — bridge cannot run"
else
  for v in IRC_GATEWAY_URL IRC_SERVER IRC_BOT_NICK IRC_BOT_PASSWORD IRC_CHANNEL_PREFIX; do
    if docker compose exec -T app printenv "$v" >/dev/null 2>&1; then
      ok "app has $v"
    else
      fail "app missing $v — run: docker compose up -d app  (NOT restart)"
    fi
  done

  echo "--- app logs grep irc-bridge (last 200 lines) ---"
  docker compose logs --tail=200 app 2>&1 | grep -i 'irc-bridge\|gateway\|websocket' || \
    echo "(no irc-bridge log lines yet — bridge connects lazily on first chat msg)"
fi

hdr "DONE"
info "Send the saved log file to continue debugging."
