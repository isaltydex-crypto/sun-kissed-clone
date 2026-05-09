#!/bin/sh
# ============================================================================
# Daily Postgres backup with GPG key rotation + optional off-site upload.
# See entrypoint.sh / .env.example for env vars.
# ============================================================================
set -eu

STAMP="$(date -u +%Y%m%d-%H%M%S)"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"
KEYS_DIR="/run/secrets/keys"
KEY_ID="${BACKUP_ENCRYPTION_KEY_ID:-}"

dump_pg() {
  PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
    -h db -U postgres -d postgres \
    --no-owner --clean --if-exists
}

if [ -n "${KEY_ID}" ] && [ -s "${KEYS_DIR}/${KEY_ID}" ]; then
  OUT="/backups/peptivalab-${STAMP}.${KEY_ID}.sql.gz.gpg"
  echo "[$(date -u +%FT%TZ)] starting ENCRYPTED backup (key=${KEY_ID}) → ${OUT}"
  PASS="$(cat "${KEYS_DIR}/${KEY_ID}")"
  dump_pg \
    | gzip -9 \
    | gpg --batch --yes --pinentry-mode loopback \
          --passphrase "${PASS}" \
          --symmetric --cipher-algo AES256 \
          --compress-algo none \
          -o "${OUT}.tmp"
  unset PASS
  mv "${OUT}.tmp" "${OUT}"
  GLOB='peptivalab-*.sql.gz.gpg'
else
  OUT="/backups/peptivalab-${STAMP}.sql.gz"
  echo "[$(date -u +%FT%TZ)] starting PLAINTEXT backup → ${OUT}"
  echo "[$(date -u +%FT%TZ)] WARNING: no encryption key configured — dumps are NOT encrypted at rest"
  dump_pg | gzip -9 > "${OUT}.tmp"
  mv "${OUT}.tmp" "${OUT}"
  GLOB='peptivalab-*.sql.gz'
fi

echo "[$(date -u +%FT%TZ)] wrote $(du -h "${OUT}" | cut -f1)"

# --- Off-site upload (rclone) ----------------------------------------------
# Set OFFSITE_REMOTE to e.g. "b2:peptivalab-backups" or "s3:bucket/path".
# rclone reads its config from /run/secrets/rclone.conf (mounted from env).
if [ -n "${OFFSITE_REMOTE:-}" ] && [ -s /run/secrets/rclone.conf ]; then
  echo "[$(date -u +%FT%TZ)] uploading to ${OFFSITE_REMOTE}"
  rclone --config /run/secrets/rclone.conf \
         copy "${OUT}" "${OFFSITE_REMOTE}" \
         --no-traverse --transfers 1 --retries 5
  # Mirror retention to the remote (delete files older than RETENTION days)
  rclone --config /run/secrets/rclone.conf \
         delete "${OFFSITE_REMOTE}" \
         --min-age "${RETENTION}d" --include "peptivalab-*" || true
  echo "[$(date -u +%FT%TZ)] off-site upload done"
else
  [ -n "${OFFSITE_REMOTE:-}" ] && \
    echo "[$(date -u +%FT%TZ)] WARNING: OFFSITE_REMOTE set but no rclone.conf"
fi

# Local retention
find /backups -maxdepth 1 -type f -name "${GLOB}" \
  -mtime +"${RETENTION}" -print -delete

echo "[$(date -u +%FT%TZ)] done. retention=${RETENTION}d"
