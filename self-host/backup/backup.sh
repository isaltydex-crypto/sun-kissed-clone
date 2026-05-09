#!/bin/sh
# ============================================================================
# Daily Postgres backup — runs inside the `backup` container via cron.
# Dumps the `postgres` database to /backups/peptivalab-YYYYMMDD-HHMMSS.sql.gz
# If BACKUP_ENCRYPTION_PASSPHRASE is set, the file is encrypted with GPG
# (AES-256) and saved as .sql.gz.gpg instead — the plaintext .sql.gz never
# touches disk.
# Keeps the last $BACKUP_RETENTION_DAYS (default 14) and deletes older files.
# ============================================================================
set -eu

STAMP="$(date -u +%Y%m%d-%H%M%S)"
BASE="/backups/peptivalab-${STAMP}.sql.gz"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"

if [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  OUT="${BASE}.gpg"
  echo "[$(date -u +%FT%TZ)] starting ENCRYPTED backup → ${OUT}"
  PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
      -h db -U postgres -d postgres \
      --no-owner --clean --if-exists \
    | gzip -9 \
    | gpg --batch --yes --pinentry-mode loopback \
          --passphrase "${BACKUP_ENCRYPTION_PASSPHRASE}" \
          --symmetric --cipher-algo AES256 \
          --compress-algo none \
          -o "${OUT}.tmp"
  mv "${OUT}.tmp" "${OUT}"
  GLOB='peptivalab-*.sql.gz.gpg'
else
  OUT="${BASE}"
  echo "[$(date -u +%FT%TZ)] starting PLAINTEXT backup → ${OUT}"
  echo "[$(date -u +%FT%TZ)] WARNING: BACKUP_ENCRYPTION_PASSPHRASE not set — dumps are NOT encrypted at rest"
  PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
      -h db -U postgres -d postgres \
      --no-owner --clean --if-exists \
    | gzip -9 > "${OUT}.tmp"
  mv "${OUT}.tmp" "${OUT}"
  GLOB='peptivalab-*.sql.gz'
fi

echo "[$(date -u +%FT%TZ)] wrote $(du -h "${OUT}" | cut -f1)"

# Prune old dumps (matching whichever format is currently active)
find /backups -maxdepth 1 -type f -name "${GLOB}" \
  -mtime +"${RETENTION}" -print -delete

echo "[$(date -u +%FT%TZ)] done. retention=${RETENTION}d"
