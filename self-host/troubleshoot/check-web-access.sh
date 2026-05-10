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
PROBE_DOMAIN="${SITE_DOMAIN_VALUE:-local.test}"

is_expected_http_code() {
  local domain="$1"
  local code="$2"
  case "$code" in
    200|301|302|307|308) return 0 ;;
    401) [ "$domain" = "$STUDIO_DOMAIN_VALUE" ] && return 0 ;;
    426) [ "$domain" = "$CHAT_DOMAIN_VALUE" ] && return 0 ;;
  esac
  return 1
}

asset_paths_from_html() {
  sed -nE 's/.*<(script|link|img)[^>]+(src|href)="([^"]+)".*/\3/p' | grep -E '^/|^https?://' | head -n 20 || true
}

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
if [ "${#DOMAINS[@]}" -gt 0 ]; then
  hdr "6. DNS records for configured domains"
  for domain in "${DOMAINS[@]}"; do
    echo "--- $domain ---"
    (dig +short A "$domain" 2>/dev/null || getent ahostsv4 "$domain" 2>/dev/null || true)
    (dig +short AAAA "$domain" 2>/dev/null || true)
  done
  ok "logged DNS records"

  hdr "7. HTTPS / HTTP probes from this VPS"
  for domain in "${DOMAINS[@]}"; do
    echo "--- HTTPS $domain ---"
    https_out="/tmp/_https_${domain//[^A-Za-z0-9]/_}.out"
    https_code=$(curl -kI --max-time 10 -o "$https_out" -w '%{http_code}' "https://$domain" || echo 000)
    cat "$https_out" 2>/dev/null
    if is_expected_http_code "$domain" "$https_code"; then
      ok "HTTPS $domain responded $https_code"
    else
      fail "HTTPS $domain responded $https_code"
    fi

    echo "--- HTTP $domain ---"
    http_out="/tmp/_http_${domain//[^A-Za-z0-9]/_}.out"
    http_code=$(curl -I --max-time 10 -o "$http_out" -w '%{http_code}' "http://$domain" || echo 000)
    cat "$http_out" 2>/dev/null
    if is_expected_http_code "$domain" "$http_code"; then
      ok "HTTP $domain responded $http_code"
    else
      fail "HTTP $domain responded $http_code"
    fi
  done
fi

# ---------------------------------------------------------------------------
hdr "8. App static files inside container"
if docker compose ps app 2>/dev/null | grep -q app; then
  docker compose exec -T app sh -lc 'echo "--- static dirs ---"; for d in .output/public .output/client dist/client dist/public public; do [ -d "$d" ] && { echo "==> $d"; find "$d" -type f | sort; }; done' 2>&1 || true
  static_count=$(docker compose exec -T app sh -lc 'count=0; for d in .output/public .output/client dist/client dist/public public; do [ -d "$d" ] && count=$((count + $(find "$d" -type f | wc -l))); done; echo "$count"' 2>/dev/null | tr -dc '0-9' || echo 0)
  if [ "${static_count:-0}" -gt 0 ]; then
    ok "app container has $static_count static files"
  else
    fail "app container has no static CSS/JS/image files"
  fi
else
  warn "app container not found; skipping static file check"
fi

# ---------------------------------------------------------------------------
if [ -n "$SITE_DOMAIN_VALUE" ]; then
  hdr "9. Homepage assets (CSS/JS/images)"
  html_file="/tmp/_homepage_${SITE_DOMAIN_VALUE//[^A-Za-z0-9]/_}.html"
  html_code=$(curl -ksS --max-time 10 -o "$html_file" -w '%{http_code}' "https://$SITE_DOMAIN_VALUE" || echo 000)
  echo "homepage status: $html_code"
  if ! is_expected_http_code "$SITE_DOMAIN_VALUE" "$html_code"; then
    warn "homepage returned $html_code; skipping asset probes"
  else
    assets=$(asset_paths_from_html < "$html_file")
    if [ -z "$assets" ]; then
      warn "no asset URLs found in homepage HTML"
    else
      bad_assets=0
      while IFS= read -r asset; do
        [ -z "$asset" ] && continue
        case "$asset" in
          http://*|https://*) asset_url="$asset" ;;
          *) asset_url="https://$SITE_DOMAIN_VALUE$asset" ;;
        esac
        asset_code=$(curl -kIsS --max-time 10 -o /tmp/_asset_head.out -w '%{http_code}' "$asset_url" || echo 000)
        content_type=$(grep -i '^content-type:' /tmp/_asset_head.out | tail -n1 | tr -d '\r' || true)
        echo "$asset_code $content_type $asset_url"
        if ! is_expected_http_code "$SITE_DOMAIN_VALUE" "$asset_code"; then
          bad_assets=$((bad_assets + 1))
        fi
      done <<< "$assets"
      if [ "$bad_assets" -gt 0 ]; then
        fail "$bad_assets homepage assets failed; app may render unstyled or with broken images"
      else
        ok "homepage CSS/JS/image assets respond"
      fi
    fi
  fi
fi

# ---------------------------------------------------------------------------
hdr "10. Localhost probes on this VPS"
for scheme in http https; do
  if [ "$scheme" = "https" ]; then
    local_code=$(curl -kI --resolve "$PROBE_DOMAIN:443:127.0.0.1" --max-time 10 -o /tmp/_local_https.out -w '%{http_code}' "https://$PROBE_DOMAIN" || echo 000)
    cat /tmp/_local_https.out 2>/dev/null
    if is_expected_http_code "$PROBE_DOMAIN" "$local_code"; then
      ok "localhost HTTPS for $PROBE_DOMAIN responded $local_code"
    else
      warn "localhost HTTPS for $PROBE_DOMAIN responded $local_code"
    fi
  else
    local_code=$(curl -I --resolve "$PROBE_DOMAIN:80:127.0.0.1" --max-time 10 -o /tmp/_local_http.out -w '%{http_code}' "http://$PROBE_DOMAIN" || echo 000)
    cat /tmp/_local_http.out 2>/dev/null
    if is_expected_http_code "$PROBE_DOMAIN" "$local_code"; then
      ok "localhost HTTP for $PROBE_DOMAIN responded $local_code"
    else
      warn "localhost HTTP for $PROBE_DOMAIN responded $local_code"
    fi
  fi
done

# ---------------------------------------------------------------------------
hdr "11. Public IP of this VPS"
pub_ip=$(curl -4 -s --max-time 5 ifconfig.me || echo "?")
echo "public IP: $pub_ip"
info "VPS public IP: $pub_ip"

if [ "${#DOMAINS[@]}" -gt 0 ] && [ "$pub_ip" != "?" ]; then
  hdr "12. DNS vs VPS IP comparison"
  for domain in "${DOMAINS[@]}"; do
    ips=$(dig +short A "$domain" 2>/dev/null || true)
    echo "--- $domain ---"
    echo "$ips"
    if echo "$ips" | grep -Fxq "$pub_ip"; then
      ok "$domain A record includes VPS IP $pub_ip"
    else
      warn "$domain A record does not include VPS IP $pub_ip"
    fi
  done
fi

# ---------------------------------------------------------------------------
hdr "Common fixes"
cat <<'EOF'
- UFW blocking:    sudo ufw allow 80,443/tcp
- Port 80 in use:  stop apache/nginx, then: docker compose restart caddy
- Cert errors:     check DNS A records match the public IP above
- Local works but external fails: check provider firewall/security group for 80/443
EOF
