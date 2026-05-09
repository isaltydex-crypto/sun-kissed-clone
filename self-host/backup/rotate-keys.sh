#!/bin/sh
# ============================================================================
# Re-encrypt every existing backup with the CURRENT key.
# After this completes, you can safely retire (delete) old keys from .env.
#
# Usage:
#   docker compose exec backup rotate-keys.sh
#
# What it does:
#   - For each /backups/peptivalab-*.sql.gz.gpg whose key ID != current
#   - Decrypt with whichever old key works → re-encrypt with the current key
#   - Rename so the filename reflects the new key ID
#   - Delete the old file only after the new one is fsynced
# ============================================================================
set -eu

KEYS_DIR="/run/secrets/keys"
CUR="${BACKUP_ENCRYPTION_KEY_ID:-}"

if [ -z "${CUR}" ] || [ ! -s "${KEYS_DIR}/${CUR}" ]; then
  echo "✗ BACKUP_ENCRYPTION_KEY_ID not set or key file missing" >&2
  exit 2
fi

CUR_PASS="$(cat "${KEYS_DIR}/${CUR}")"
COUNT=0
SKIPPED=0
FAILED=0

for f in /backups/peptivalab-*.sql.gz.gpg; do
  [ -f "${f}" ] || continue

  STEM="$(basename "${f}" .sql.gz.gpg)"          # peptivalab-DATE.kN
  HINT="${STEM##*.}"                              # kN
  BASE="${STEM%.*}"                               # peptivalab-DATE

  if [ "${HINT}" = "${CUR}" ]; then
    SKIPPED=$((SKIPPED + 1))
    continue
  fi

  NEW="/backups/${BASE}.${CUR}.sql.gz.gpg"
  echo "→ re-encrypting ${f} (${HINT} → ${CUR})"

  TMP_PLAIN="$(mktemp)"
  if ! /usr/local/bin/decrypt.sh "${f}" "${TMP_PLAIN}" >/dev/null 2>&1; then
    echo "  ✗ could not decrypt — keeping original" >&2
    rm -f "${TMP_PLAIN}"
    FAILED=$((FAILED + 1))
    continue
  fi

  gpg --batch --yes --pinentry-mode loopback \
      --passphrase "${CUR_PASS}" \
      --symmetric --cipher-algo AES256 \
      --compress-algo none \
      -o "${NEW}.tmp" "${TMP_PLAIN}"
  rm -f "${TMP_PLAIN}"
  sync
  mv "${NEW}.tmp" "${NEW}"
  rm -f "${f}"
  COUNT=$((COUNT + 1))
done

unset CUR_PASS
echo "done. re-encrypted=${COUNT} already-current=${SKIPPED} failed=${FAILED}"
[ "${FAILED}" -eq 0 ]
