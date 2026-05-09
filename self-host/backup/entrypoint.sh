#!/bin/sh
set -eu

KEYS_DIR="/run/secrets/keys"
mkdir -p "${KEYS_DIR}" /run/secrets
chmod 700 "${KEYS_DIR}"

write_key() {
  ID="$1"; PASS="$2"
  [ -z "${ID}" ] && return 0
  [ -z "${PASS}" ] && return 0
  printf '%s' "${PASS}" > "${KEYS_DIR}/${ID}"
  chmod 600 "${KEYS_DIR}/${ID}"
}

# Current key
if [ -n "${BACKUP_ENCRYPTION_KEY_ID:-}" ] && [ -n "${BACKUP_ENCRYPTION_PASSPHRASE:-}" ]; then
  write_key "${BACKUP_ENCRYPTION_KEY_ID}" "${BACKUP_ENCRYPTION_PASSPHRASE}"
fi

# Old keys (decrypt-only): id1:pass1,id2:pass2
if [ -n "${BACKUP_OLD_KEYS:-}" ]; then
  echo "${BACKUP_OLD_KEYS}" | tr ',' '\n' | while IFS= read -r pair; do
    [ -z "${pair}" ] && continue
    ID="${pair%%:*}"
    PASS="${pair#*:}"
    write_key "${ID}" "${PASS}"
  done
fi

# rclone config for off-site uploads (optional). Provide via RCLONE_CONFIG env
# as a literal INI string.
if [ -n "${RCLONE_CONFIG:-}" ]; then
  printf '%s' "${RCLONE_CONFIG}" > /run/secrets/rclone.conf
  chmod 600 /run/secrets/rclone.conf
fi

CRON_EXPR="${BACKUP_CRON:-17 3 * * *}"
VERIFY_CRON="${BACKUP_VERIFY_CRON:-43 4 * * 0}"   # Sundays 04:43 UTC

{
  echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
  echo "BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}"
  echo "BACKUP_ENCRYPTION_KEY_ID=${BACKUP_ENCRYPTION_KEY_ID:-}"
  echo "OFFSITE_REMOTE=${OFFSITE_REMOTE:-}"
  echo "APP_INTERNAL_URL=${APP_INTERNAL_URL:-http://app:3000}"
  echo "INTERNAL_NOTIFY_TOKEN=${INTERNAL_NOTIFY_TOKEN:-}"
  echo "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
} > /etc/environment
chmod 600 /etc/environment

mkdir -p /etc/crontabs /backups
{
  echo "${CRON_EXPR} . /etc/environment; /usr/local/bin/run-with-alert.sh backup /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1"
  echo "${VERIFY_CRON} . /etc/environment; /usr/local/bin/run-with-alert.sh verify-backup /usr/local/bin/verify-backup.sh >> /var/log/backup.log 2>&1"
} > /etc/crontabs/root
touch /var/log/backup.log

echo "[entrypoint] backup cron:     ${CRON_EXPR}"
echo "[entrypoint] verify cron:     ${VERIFY_CRON}"
echo "[entrypoint] retention:       ${BACKUP_RETENTION_DAYS:-14} days"
echo "[entrypoint] current key:     ${BACKUP_ENCRYPTION_KEY_ID:-<none — PLAINTEXT>}"
echo "[entrypoint] off-site remote: ${OFFSITE_REMOTE:-<disabled>}"
echo "[entrypoint] available keys:  $(ls "${KEYS_DIR}" 2>/dev/null | tr '\n' ' ')"

if [ -z "$(ls -A /backups 2>/dev/null | grep -E '\.sql\.gz(\.gpg)?$' || true)" ]; then
  echo "[entrypoint] no existing backups — running one now"
  . /etc/environment
  /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1 || \
    echo "[entrypoint] initial backup failed (db may still be starting); cron will retry"
fi

crond -f -l 8 &
CRON_PID=$!
tail -F /var/log/backup.log &
wait $CRON_PID
