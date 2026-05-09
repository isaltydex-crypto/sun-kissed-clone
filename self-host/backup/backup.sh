#!/bin/sh
# ============================================================================
# Daily Postgres backup with GPG key rotation support.
#
# Encryption keys live in /run/secrets/keys (one file per key, name = key ID,
# contents = passphrase). The CURRENT key is named in BACKUP_ENCRYPTION_KEY_ID
# and is the only one used to ENCRYPT new dumps. All keys in the directory
# remain available for DECRYPTION (see decrypt.sh).
#
# Filenames embed the key ID:
#   peptivalab-20260509-031700.k2.sql.gz.gpg
# So years from now you can tell which passphrase opens which dump.
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

find /backups -maxdepth 1 -type f -name "${GLOB}" \
  -mtime +"${RETENTION}" -print -delete

echo "[$(date -u +%FT%TZ)] done. retention=${RETENTION}d"
