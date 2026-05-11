#!/bin/sh
# Copies the Caddy-managed cert for $CHAT_DOMAIN into a place inspircd can
# read, then hands off to the image's normal entrypoint.
#
# Caddy stores certs at:
#   /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/<host>/<host>.crt
#   /data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/<host>/<host>.key
# We mount that volume read-only at /caddy-data.
#
# When Caddy renews the cert (every ~60 days), restart this container to pick
# up the new file:   docker compose restart ircd
set -e

: "${CHAT_DOMAIN:?CHAT_DOMAIN env var is required}"

CADDY_DIR="/caddy-data/caddy/certificates/acme-v02.api.letsencrypt.org-directory/${CHAT_DOMAIN}"
TLS_DIR="/inspircd/conf/tls"

mkdir -p "$TLS_DIR"

if [ -f "$CADDY_DIR/${CHAT_DOMAIN}.crt" ] && [ -f "$CADDY_DIR/${CHAT_DOMAIN}.key" ]; then
  cp "$CADDY_DIR/${CHAT_DOMAIN}.crt" "$TLS_DIR/cert.pem"
  cp "$CADDY_DIR/${CHAT_DOMAIN}.key" "$TLS_DIR/key.pem"
  # inspircd-docker runs as uid 10000
  chown -R 10000:10000 "$TLS_DIR"
  chmod 644 "$TLS_DIR/cert.pem"
  chmod 600 "$TLS_DIR/key.pem"
  echo "[entrypoint-tls] cert installed for ${CHAT_DOMAIN}"
else
  echo "[entrypoint-tls] WARNING: cert for ${CHAT_DOMAIN} not found at ${CADDY_DIR}"
  echo "[entrypoint-tls] make sure Caddy has provisioned ${CHAT_DOMAIN} (visit https://${CHAT_DOMAIN} once)"
  echo "[entrypoint-tls] continuing without TLS — 6697 bind will fail to load"
fi

exec /entrypoint.sh "$@"
