#!/usr/bin/env bash
# Diagnose why the site isn't reachable from a browser.
# Run from anywhere — script cd's into self-host/ via _lib.sh.
set -u

# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

read_env_value() {
  local key="$1"
  local value="${!key:-}"
  if [ -z "$value" ] && [ -f .env ]; then
    value=$(grep -E "^${key}=" .env | tail -n1 | cut -d= -f2- | tr -d '"' | tr -d "'")
  fi
  printf '%s' "$value"
}

SITE_DOMAIN_VALUE="$(read_env_value SITE_DOMAIN)"
WWW_DOMAIN_VALUE="$(read_env_value WWW_DOMAIN)"
CHAT_DOMAIN_VALUE="$(read_env_value CHAT_DOMAIN)"
STUDIO_DOMAIN_VALUE="$(read_env_value STUDIO_DOMAIN)"

DOMAINS=()
for d in "$SITE_DOMAIN_VALUE" "$WWW_DOMAIN_VALUE" "$CHAT_DOMAIN_VALUE" "$STUDIO_DOMAIN_VALUE"; do
  if [ -n "$d" ]; then
    DOMAINS+=("$d")
  fi
done

info "SITE_DOMAIN=${SITE_DOMAIN_VALUE:-<unset>}"
info "WWW_DOMAIN=${WWW_DOMAIN_VALUE:-<unset>}"
info "CHAT_DOMAIN=${CHAT_DOMAIN_VALUE:-<unset>}"
info "STUDIO_DOMAIN=${STUDIO_DOMAIN_VALUE:-<unset>}"

# ---------------------------------------------------------------------------
hdr "1. Caddy logs (cert / errors)"
echo "--- last 200 caddy log lines ---"
docker compose logs --tail=200 caddy 2>&1 || true
echo "--- end caddy logs ---"
# Surface a one-line verdict to the terminal.
matches=$(docker compose logs --tail=200 caddy 2>/dev/null | grep -ciE 'error|fail|obtain' || true)
if [ "${matches:-0}" -gt 0 ]; then
  warn "$matches error/fail lines in recent Caddy logs (see log file)"
else
  ok "no recent Caddy errors"
fi

# ---------------------------------------------------------------------------
hdr "2. Listening sockets on :80 / :443"
listening=$( (ss -tlnp 2>/dev/null || netstat -tlnp 2>/dev/null) | grep -E ':80\b|:443\b' || true)
echo "$listening"
if [ -n "$listening" ]; then
  ok "ports 80/443 are bound"
else
  fail "nothing listening on 80/443"
fi

# ---------------------------------------------------------------------------
hdr "3. Processes holding :80"
if command -v lsof >/dev/null; then
  sudo lsof -i :80 -sTCP:LISTEN 2>&1 || true
else
  echo "(lsof not available)"
fi
ok "logged port-80 holders"

# ---------------------------------------------------------------------------
hdr "4. UFW firewall status"
ufw_out=$(sudo ufw status 2>&1 || true)
echo "$ufw_out"
if echo "$ufw_out" | grep -qiE '80.*ALLOW|443.*ALLOW'; then
  ok "UFW allows 80/443 (or is inactive)"
elif echo "$ufw_out" | grep -qi 'inactive'; then
  ok "UFW inactive (no firewall blocking)"
else
  warn "UFW may be blocking 80/443 (see log)"
fi

# ---------------------------------------------------------------------------
hdr "5. Docker containers"
docker compose ps 2>&1 || true
unhealthy=$(docker compose ps 2>/dev/null | grep -ciE 'restart|exit|unhealthy' || true)
if [ "${unhealthy:-0}" -gt 0 ]; then
  warn "$unhealthy containers in bad state (see log)"
else
  ok "all containers look up"
fi

# ---------------------------------------------------------------------------
if [ -n "$DOMAIN" ]; then
  hdr "6. HTTPS probe → $DOMAIN"
  https_code=$(curl -kI --max-time 10 -o /tmp/_https.out -w '%{http_code}' "https://$DOMAIN" 2>&1 || echo 000)
  cat /tmp/_https.out 2>/dev/null
  if [ "$https_code" = "200" ] || [ "$https_code" = "301" ] || [ "$https_code" = "302" ]; then
    ok "HTTPS responded $https_code"
  else
    fail "HTTPS responded $https_code"
  fi

  hdr "7. HTTP probe → $DOMAIN"
  http_code=$(curl -I --max-time 10 -o /tmp/_http.out -w '%{http_code}' "http://$DOMAIN" 2>&1 || echo 000)
  cat /tmp/_http.out 2>/dev/null
  if [ "$http_code" = "200" ] || [ "$http_code" = "301" ] || [ "$http_code" = "302" ]; then
    ok "HTTP responded $http_code"
  else
    fail "HTTP responded $http_code"
  fi
fi

# ---------------------------------------------------------------------------
hdr "8. Public IP of this VPS"
pub_ip=$(curl -4 -s --max-time 5 ifconfig.me || echo "?")
echo "public IP: $pub_ip"
info "VPS public IP: $pub_ip"

# ---------------------------------------------------------------------------
hdr "Common fixes"
cat <<'EOF'
- UFW blocking:    sudo ufw allow 80,443/tcp
- Port 80 in use:  stop apache/nginx, then: docker compose restart caddy
- Cert errors:     check DNS A records match the public IP above
EOF
