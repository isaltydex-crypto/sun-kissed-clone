#!/bin/sh
# ============================================================================
# Decrypt a backup file using whichever key opens it.
#
# Usage (from inside the backup container):
#   decrypt.sh <file.sql.gz.gpg> [out.sql.gz]
#
# From the host:
#   docker compose exec backup decrypt.sh \
#     /backups/peptivalab-20260509-031700.k1.sql.gz.gpg \
#     /backups/restore.sql.gz
#
# Strategy:
#   1. If filename contains `.kN.` and /run/secrets/keys/kN exists, try that first.
#   2. Otherwise, try every key file in /run/secrets/keys until one succeeds.
# ============================================================================
set -eu

IN="${1:-}"
OUT="${2:-}"
KEYS_DIR="/run/secrets/keys"

if [ -z "${IN}" ] || [ ! -f "${IN}" ]; then
  echo "usage: decrypt.sh <file.sql.gz.gpg> [out.sql.gz]" >&2
  exit 2
fi

if [ -z "${OUT}" ]; then
  OUT="$(echo "${IN}" | sed 's/\.gpg$//')"
fi

try_key() {
  KEY_FILE="$1"
  KEY_ID="$(basename "${KEY_FILE}")"
  echo "→ trying key: ${KEY_ID}" >&2
  if gpg --batch --quiet --pinentry-mode loopback \
         --passphrase-file "${KEY_FILE}" \
         -d "${IN}" > "${OUT}.tmp" 2>/dev/null; then
    mv "${OUT}.tmp" "${OUT}"
    echo "✔ decrypted with key ${KEY_ID} → ${OUT}" >&2
    return 0
  fi
  rm -f "${OUT}.tmp"
  return 1
}

# 1. Hint from filename: peptivalab-...-<KEYID>.sql.gz.gpg
HINT="$(basename "${IN}" | sed -n 's/^peptivalab-[0-9]\{8\}-[0-9]\{6\}\.\([^.]\+\)\.sql\.gz\.gpg$/\1/p')"
if [ -n "${HINT}" ] && [ -s "${KEYS_DIR}/${HINT}" ]; then
  if try_key "${KEYS_DIR}/${HINT}"; then exit 0; fi
fi

# 2. Try every available key.
for k in "${KEYS_DIR}"/*; do
  [ -f "${k}" ] || continue
  [ "$(basename "${k}")" = "${HINT}" ] && continue   # already tried
  if try_key "${k}"; then exit 0; fi
done

echo "✗ no available key could decrypt ${IN}" >&2
echo "  Available keys:" >&2
ls -1 "${KEYS_DIR}" >&2 || true
exit 1
