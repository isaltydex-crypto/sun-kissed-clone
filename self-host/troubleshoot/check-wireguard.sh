#!/usr/bin/env bash
# Verify the optional WireGuard admin-gating setup:
#   - container running (vpn profile)
#   - UDP port open in UFW
#   - peers configured + recent handshakes
#   - Caddy actually returns 404 for /admin from outside the VPN subnet
set -u
. "$(cd "$(dirname "$0")" && pwd)/_lib.sh"

# shellcheck disable=SC1091
[ -f .env ] && . .env || true

WG_PORT="${WG_SERVERPORT:-51820}"
WG_SUBNET="${WG_INTERNAL_SUBNET:-10.13.13.0/24}"
SITE="${SITE_DOMAIN:-}"

hdr "WireGuard container"
if docker compose ps --status running --services 2>/dev/null | grep -qx wireguard; then
  ok "wireguard container is running"
  docker compose ps wireguard
else
  warn "wireguard container is NOT running"
  info "start it with: docker compose --profile vpn up -d wireguard"
  info "(it's intentionally inactive by default — under the 'vpn' profile)"
fi

hdr "Firewall (UFW)"
if command -v ufw >/dev/null 2>&1; then
  if ufw status 2>/dev/null | grep -qE "${WG_PORT}/udp\s+ALLOW"; then
    ok "UFW allows ${WG_PORT}/udp"
  else
    fail "UFW does NOT allow ${WG_PORT}/udp"
    info "fix: sudo ufw allow ${WG_PORT}/udp comment 'WireGuard' && sudo ufw reload"
  fi
  ufw status numbered 2>/dev/null || true
else
  warn "ufw not installed — check your provider firewall manually"
fi

hdr "Peer configs"
if docker compose --profile vpn exec -T wireguard sh -c 'ls /config 2>/dev/null' \
  | grep -q '^peer_'; then
  ok "peer directories present"
  docker compose --profile vpn exec -T wireguard sh -c \
    'ls /config | grep ^peer_ | sed "s/^peer_/  - /"'
  info "show a config: docker compose --profile vpn exec wireguard cat /config/peer_<name>/peer_<name>.conf"
  info "show QR code:  docker compose --profile vpn exec wireguard /app/show-peer peer_<name>"
else
  warn "no peer_* directories found in /config"
  info "set WG_PEERS in .env then: docker compose --profile vpn up -d --force-recreate wireguard"
fi

hdr "Handshakes"
if docker compose --profile vpn exec -T wireguard wg show 2>/dev/null; then
  if docker compose --profile vpn exec -T wireguard wg show 2>/dev/null \
    | grep -q "latest handshake"; then
    ok "at least one peer has handshaked"
  else
    warn "no peer handshakes yet — install a client config and connect"
  fi
else
  fail "could not query wg interface (container down?)"
fi

hdr "Caddy admin-allowlist"
if grep -qE '^\s*@admin_paths\s+path\s+/admin' Caddyfile 2>/dev/null; then
  ok "Caddyfile has the admin-allowlist block active"
else
  warn "Caddyfile admin-allowlist block is still commented out"
  info "uncomment the 'WireGuard-gated admin allowlist' block in self-host/Caddyfile"
  info "then: docker compose exec caddy caddy reload --config /etc/caddy/Caddyfile"
fi

if [ -n "$SITE" ]; then
  hdr "External probe: GET https://${SITE}/admin/login"
  code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 8 "https://${SITE}/admin/login" || true)"
  echo "HTTP ${code}"
  if [ "$code" = "404" ]; then
    ok "admin returns 404 from outside (VPN gate is working)"
  elif [ "$code" = "200" ]; then
    warn "admin returns 200 — either gate not enabled, or this VPS IS in the allowlist"
    info "if you intended to gate it, check that the Caddy block is uncommented"
  else
    warn "unexpected status ${code}"
  fi
else
  warn "SITE_DOMAIN not set in .env — skipping external probe"
fi

hdr "Summary"
info "VPN subnet:  ${WG_SUBNET}"
info "UDP port:    ${WG_PORT}"
info "Server URL:  ${WG_SERVERURL:-<unset>}"
info "Docs:        self-host/wireguard/README.md"
