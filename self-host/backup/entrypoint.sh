#!/bin/sh
set -eu

CRON_EXPR="${BACKUP_CRON:-17 3 * * *}"

# Write the env vars cron will need (cron strips the environment).
# Write the env vars cron will need (cron strips the environment).
{
  echo "POSTGRES_PASSWORD=${POSTGRES_PASSWORD}"
  echo "BACKUP_RETENTION_DAYS=${BACKUP_RETENTION_DAYS:-14}"
  echo "BACKUP_ENCRYPTION_PASSPHRASE=${BACKUP_ENCRYPTION_PASSPHRASE:-}"
  echo "PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"
} > /etc/environment
chmod 600 /etc/environment

mkdir -p /etc/crontabs
echo "${CRON_EXPR} . /etc/environment; /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1" \
  > /etc/crontabs/root

mkdir -p /backups
touch /var/log/backup.log

echo "[entrypoint] cron schedule: ${CRON_EXPR}"
echo "[entrypoint] retention: ${BACKUP_RETENTION_DAYS:-14} days"

# Optional: take a backup immediately on first boot if /backups is empty.
if [ -z "$(ls -A /backups 2>/dev/null | grep -E '\.sql\.gz$' || true)" ]; then
  echo "[entrypoint] no existing backups — running one now"
  /usr/local/bin/backup.sh >> /var/log/backup.log 2>&1 || \
    echo "[entrypoint] initial backup failed (db may still be starting); cron will retry"
fi

# Run cron in the foreground and tail the log so `docker logs` shows progress.
crond -f -l 8 &
CRON_PID=$!
tail -F /var/log/backup.log &
wait $CRON_PID
