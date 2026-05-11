#!/usr/bin/env bash
# ============================================================================
# diag.sh — sitewide diagnostic + safe auto-fix.
# Run from anywhere:
#   bash /home/deploy/sun-kissed-clone/self-host/diag.sh
#
# What it does (read-only unless flagged):
#   1. Container health: status, restart count, recent crashes.
#      Auto-fixes: restarts containers stuck in restart loops, regenerates
#      placeholder ADMIN_SESSION_SECRET if literal "$(openssl ...)" is present.
#   2. External service probes: SMTP TCP, IRC TCP, NowPayments HTTP, app
#      health endpoint.
#   3. Posts a summary event to /api/internal/diag for the dashboard.
#   4. Sends an email alert (via existing notify pipeline) for any critical
#      findings.
#
# Exit code: 0 if everything healthy, 1 if any critical issue found.
# ============================================================================
set -u

# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

# Load .env safely — values may contain $(...), spaces, <>, etc. that would
# break `source`. Parse line-by-line and export literal KEY=VALUE pairs only.
if [ -f .env ]; then
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in
      ''|\#*) continue ;;
    esac
    case "$line" in
      *=*)
        key="${line%%=*}"
        val="${line#*=}"
        # strip surrounding quotes if present
        case "$val" in
          \"*\") val="${val#\"}"; val="${val%\"}" ;;
          \'*\') val="${val#\'}"; val="${val%\'}" ;;
        esac
        # only export shell-safe variable names
        case "$key" in
          [A-Za-z_]*[!A-Za-z0-9_]*) ;;
          [A-Za-z_]*) export "$key=$val" ;;
        esac
        ;;
    esac
  done < .env
fi

HOSTNAME_S="$(hostname 2>/dev/null || echo unknown)"
APP_INTERNAL_URL="${APP_INTERNAL_URL:-http://localhost:3000}"
TOKEN="${INTERNAL_NOTIFY_TOKEN:-}"

CRIT=0
WARN=0
SUMMARY=""

# hdr/ok/warn/fail provided by _lib.sh (print to terminal + log).
# Local aliases for legacy names used below:
hr()   { hdr "$@"; }
crit() { fail "$@"; CRIT=$((CRIT+1)); SUMMARY="${SUMMARY}CRIT: $*"$'\n'; }
_warn_orig() { warn "$@"; WARN=$((WARN+1)); SUMMARY="${SUMMARY}WARN: $*"$'\n'; }
# Override warn locally so counters update:
warn() { _ts_emit $'  \033[33m⚠\033[0m '"$*" "  [WARN] $*"; WARN=$((WARN+1)); SUMMARY="${SUMMARY}WARN: $*"$'\n'; }

# JSON-escape helper (POSIX awk).
j_esc() {
  awk 'BEGIN { ORS="" } { gsub(/\\/,"\\\\"); gsub(/"/,"\\\""); gsub(/\t/,"\\t"); gsub(/\r/,""); gsub(/\n/,"\\n"); print }' <<< "$1"
}

post_event() {
  local source="$1" severity="$2" kind="$3" message="$4"
  if [ -z "$TOKEN" ]; then return 0; fi
  local body
  body=$(printf '{"source":"%s","severity":"%s","kind":"%s","message":"%s","host":"%s"}' \
    "$source" "$severity" "$kind" "$(j_esc "$message")" "$(j_esc "$HOSTNAME_S")")
  curl -fsS -m 5 -X POST \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$body" \
    "${APP_INTERNAL_URL%/}/api/internal/diag" >/dev/null 2>&1 || true
}

# ---------------------------------------------------------------------------
hr "1. Auto-fix: ADMIN_SESSION_SECRET"
if [ -f .env ] && grep -q 'ADMIN_SESSION_SECRET=\$(openssl' .env; then
  sed -i '/^ADMIN_SESSION_SECRET=/d' .env
  echo "ADMIN_SESSION_SECRET=$(openssl rand -hex 32)" >> .env
  ok "regenerated literal placeholder"
  post_event "cli" "warn" "secret.regenerated" "ADMIN_SESSION_SECRET literal placeholder replaced"
else
  ok "looks fine"
fi

# ---------------------------------------------------------------------------
hr "2. Container health"
SERVICES="db auth rest realtime storage kong studio meta app ircd ws-gateway caddy backup"
RESTART_LOOPERS=""
for svc in $SERVICES; do
  cid="$(docker compose ps -q "$svc" 2>/dev/null || true)"
  if [ -z "$cid" ]; then
    warn "$svc: not running"
    post_event "container" "warn" "container.missing" "$svc has no container"
    continue
  fi
  read -r status restarts exitcode err <<<"$(docker inspect "$cid" --format '{{.State.Status}} {{.RestartCount}} {{.State.ExitCode}} {{.State.Error}}')"
  case "$status" in
    running)
      if [ "${restarts:-0}" -gt 5 ]; then
        warn "$svc: running but restarted $restarts times"
        RESTART_LOOPERS="$RESTART_LOOPERS $svc"
        post_event "container" "warn" "container.flapping" "$svc restarted $restarts times"
      else
        ok "$svc: running (restarts=$restarts)"
      fi
      ;;
    restarting)
      crit "$svc: stuck restarting (exit=$exitcode)"
      RESTART_LOOPERS="$RESTART_LOOPERS $svc"
      post_event "container" "critical" "container.restarting" "$svc stuck restarting (exit=$exitcode err=$err)"
      ;;
    exited|dead)
      crit "$svc: $status (exit=$exitcode)"
      post_event "container" "critical" "container.exited" "$svc $status (exit=$exitcode err=$err)"
      ;;
    *)
      warn "$svc: $status"
      ;;
  esac
done

# Auto-fix: nudge flapping containers once.
if [ -n "$RESTART_LOOPERS" ]; then
  hr "2b. Auto-fix: restarting flapping containers"
  for svc in $RESTART_LOOPERS; do
    echo "  → docker compose restart $svc"
    docker compose restart "$svc" >/dev/null 2>&1 && ok "restarted $svc" || warn "restart failed: $svc"
  done
  post_event "cli" "warn" "container.autorestart" "Restarted: $RESTART_LOOPERS"
fi

# ---------------------------------------------------------------------------
hr "3. App health endpoint"
# Port 3000 isn't published on the host (only caddy is); probe from inside
# the app container via node, which is guaranteed to exist.
PROBE='const t=setTimeout(()=>{console.error("timeout");process.exit(2)},5000);
fetch("http://127.0.0.1:3000/api/public/health").then(r=>{clearTimeout(t);process.exit(r.ok?0:1)}).catch(e=>{clearTimeout(t);console.error(e.message);process.exit(1)});'
if docker compose exec -T app node -e "$PROBE" >/dev/null 2>&1; then
  ok "app responds on /api/public/health (in-container)"
elif curl -fsS -m 5 "${APP_INTERNAL_URL%/}/api/public/health" >/dev/null 2>&1; then
  ok "app responds on /api/public/health ($APP_INTERNAL_URL)"
else
  out=$(docker compose exec -T app node -e "$PROBE" 2>&1 || true)
  crit "app health endpoint unreachable — $out"
  post_event "external" "critical" "app.unreachable" "app health endpoint unreachable: $out"
fi

# ---------------------------------------------------------------------------
hr "4. External services"

# SMTP
if [ -n "${SMTP_HOST:-}" ]; then
  if timeout 5 bash -c "</dev/tcp/${SMTP_HOST}/${SMTP_PORT:-587}" 2>/dev/null; then
    ok "SMTP ${SMTP_HOST}:${SMTP_PORT:-587} reachable"
  else
    crit "SMTP ${SMTP_HOST}:${SMTP_PORT:-587} unreachable"
    post_event "external" "critical" "smtp.unreachable" "SMTP ${SMTP_HOST}:${SMTP_PORT:-587} unreachable"
  fi
else
  ok "SMTP not configured (skipping)"
fi

# IRC (internal)
if timeout 5 bash -c "</dev/tcp/127.0.0.1/6697" 2>/dev/null; then
  ok "IRC TLS port 6697 reachable"
else
  warn "IRC TLS port 6697 unreachable"
  post_event "external" "warn" "irc.unreachable" "IRC port 6697 unreachable"
fi

# Paymento (only if key configured)
if [ -n "${PAYMENTO_API_KEY:-}" ]; then
  base="${PAYMENTO_BASE_URL:-https://api.paymento.io/v1}"
  # No public health endpoint; HEAD against the host should answer < 500.
  status=$(curl -fsS -o /dev/null -w '%{http_code}' -m 5 "$base" 2>/dev/null || echo 000)
  if [ "$status" != "000" ] && [ "$status" -lt 500 ]; then
    ok "Paymento API reachable (HTTP $status)"
  else
    warn "Paymento API status=$status"
    post_event "external" "warn" "paymento.degraded" "Paymento status=$status"
  fi
fi

# ---------------------------------------------------------------------------
hr "5. Summary"
echo "  critical=$CRIT  warnings=$WARN"

if [ "$CRIT" -gt 0 ]; then
  # Email alert via existing notify pipeline.
  TMP=$(mktemp)
  printf 'Diagnostik på %s @ %s\n\n%s\n' "$HOSTNAME_S" "$(date -u +%FT%TZ)" "$SUMMARY" > "$TMP"
  if [ -x ./backup/notify.sh ] && [ -n "$TOKEN" ]; then
    APP_INTERNAL_URL="$APP_INTERNAL_URL" INTERNAL_NOTIFY_TOKEN="$TOKEN" \
      ./backup/notify.sh "diagnostik" "$HOSTNAME_S" "$(date -u +%FT%TZ)" "$(date -u +%FT%TZ)" "$CRIT" "$TMP" || true
  fi
  rm -f "$TMP"
  exit 1
fi

exit 0
