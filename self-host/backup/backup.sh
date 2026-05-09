#!/bin/sh
# ============================================================================
# Daily Postgres backup — runs inside the `backup` container via cron.
# Dumps the `postgres` database to /backups/peptivalab-YYYYMMDD-HHMMSS.sql.gz
# Keeps the last $BACKUP_RETENTION_DAYS (default 14) and deletes older files.
# ============================================================================
set -eu

STAMP="$(date -u +%Y%m%d-%H%M%S)"
OUT="/backups/peptivalab-${STAMP}.sql.gz"
RETENTION="${BACKUP_RETENTION_DAYS:-14}"

echo "[$(date -u +%FT%TZ)] starting backup → ${OUT}"

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h db -U postgres -d postgres \
  --no-owner --clean --if-exists \
  | gzip -9 > "${OUT}.tmp"

mv "${OUT}.tmp" "${OUT}"
echo "[$(date -u +%FT%TZ)] wrote $(du -h "${OUT}" | cut -f1)"

# Prune old dumps
find /backups -maxdepth 1 -type f -name 'peptivalab-*.sql.gz' \
  -mtime +"${RETENTION}" -print -delete

echo "[$(date -u +%FT%TZ)] done. retention=${RETENTION}d"
