#!/usr/bin/env bash
# Diagnose why the site isn't reachable from a browser.
# Run from: /home/deploy/sun-kissed-clone/self-host
set -u

# shellcheck source=_lib.sh
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

GREEN=$'\033[0;32m'; RED=$'\033[0;31m'; YEL=$'\033[1;33m'; NC=$'\033[0m'
hdr() { echo; echo "${YEL}=== $* ===${NC}"; }

DOMAIN="${SITE_DOMAIN:-}"
if [ -z "$DOMAIN" ] && [ -f .env ]; then
  DOMAIN=$(grep -E '^SITE_DOMAIN=' .env | cut -d= -f2- | tr -d '"')
fi
echo "SITE_DOMAIN=${DOMAIN:-<unset>}"

hdr "Caddy logs (cert / errors)"
docker compose logs --tail=150 caddy 2>/dev/null | grep -iE "cert|error|obtain|ready|acme|fail" || echo "(no matches)"

hdr "Listening sockets on :80 / :443"
if command -v ss >/dev/null; then
  ss -tlnp 2>/dev/null | grep -E ':80\b|:443\b' || echo "${RED}nothing listening on 80/443${NC}"
else
  netstat -tlnp 2>/dev/null | grep -E ':80\b|:443\b' || echo "${RED}nothing listening on 80/443${NC}"
fi

hdr "Processes holding :80"
(command -v lsof >/dev/null && sudo lsof -i :80 -sTCP:LISTEN 2>/dev/null) || echo "(lsof not available)"

hdr "UFW firewall status"
sudo ufw status 2>/dev/null || echo "(ufw not installed / not sudo)"

hdr "Docker containers"
docker compose ps 2>/dev/null

if [ -n "$DOMAIN" ]; then
  hdr "Local HTTPS probe to $DOMAIN"
  curl -kI --max-time 10 "https://$DOMAIN" || echo "${RED}HTTPS probe failed${NC}"
  hdr "Local HTTP probe to $DOMAIN"
  curl -I --max-time 10 "http://$DOMAIN" || echo "${RED}HTTP probe failed${NC}"
fi

hdr "Public IP of this VPS"
curl -4 -s --max-time 5 ifconfig.me; echo

echo
echo "${GREEN}Done.${NC} Common fixes:"
echo "  - UFW blocking:    sudo ufw allow 80,443/tcp"
echo "  - Port 80 in use:  stop apache/nginx, then: docker compose restart caddy"
echo "  - Cert errors:     check DNS A records match the public IP above"
