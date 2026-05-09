#!/bin/sh
# ============================================================================
# Materialize the GPG keyring from env vars into /run/secrets/keys/.
#
# Two ways to provide keys (you can mix them):
#
#   1. Single current key:
#        BACKUP_ENCRYPTION_KEY_ID=k2
#        BACKUP_ENCRYPTION_PASSPHRASE=<passphrase for k2>
#
#   2. Old keys, kept ONLY for decrypting historical dumps:
#        BACKUP_OLD_KEYS=k0:oldpass0,k1:oldpass1
#        (comma-separated <id>:<passphrase> pairs; passphrase must not contain ',' or ':')
#
# All keys land in /run/secrets/keys/<id>, mode 600.
# Only the key named BACKUP_ENCRYPTION_KEY_ID is used to ENCRYPT new dumps.
# ============================================================================
set -eu

KEYS_DIR="/run/secrets/keys"
mkdir -p "${KEYS_DIR}"
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

# Old keys (decrypt-only)
if [ -n "${BACKUP_OLD_KEYS:-}" ]; then
  echo "${BACKUP_OLD_KEYS}" | tr ',' '\n' | while IFS= read -r pair; do
    [ -z "${pair}" ] && continue
    ID="${pair%%:*}"
    PASS="${pair#*:}"
    write_key "${ID}" "${PASS}"
  done
fi

CRON_EXPR="${BACKUP_CRON:-17 3 * * *}"

# Pass only the safe vars to cron; passphrases live in /run/secrets/keys.
{
  echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
  echo "BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}"
  echo "BACKUP_ENCRYPTION_KEY_ID=${BACKUP_ENCRYPTION_KEY_ID:-}"
  echo "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
} > /etc/environment
chmod 600 /etc/environment

mkdir -p /etc/crontabs /backups
echo "${CRON_EXPR} . /etc/environment; /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" \
  > /etc/crontabs/root
touch /var/log/backup.log

echo "[entrypoint] cron schedule:    ${CRON_EXPR}"
echo "[entrypoint] retention:        ${BACKUP_RETENTION_DAYS:-14} days"
echo "[entrypoint] current key:      ${BACKUP_ENCRYPTION_KEY_ID:-<none — PLAINTEXT>}"
echo "[entrypoint] available keys:   $(ls "${KEYS_DIR}" 2>/dev/null | tr '\n' ' ')"

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
