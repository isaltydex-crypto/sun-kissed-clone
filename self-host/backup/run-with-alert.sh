#!/bin/sh
# ============================================================================
# Run a command; if it exits non-zero, send an alert via the app's internal
# notify endpoint (which uses the editable templates from /admin/innehall).
#
# Usage: run-with-alert.sh "<job label>" /path/to/command [args...]
# ============================================================================
set -u

LABEL="$1"; shift

LOG="$(mktemp)"
START="$(date -u +%FT%TZ)"

if "$@" >"${LOG}" 2>&1; then
  cat "${LOG}"
  rm -f "${LOG}"
  exit 0
fi
RC=$?

cat "${LOG}"

HOST="$(hostname 2>/dev/null || echo unknown)"
FAILED="$(date -u +%FT%TZ)"

/usr/local/bin/notify.sh "${LABEL}" "${HOST}" "${START}" "${FAILED}" "${RC}" "${LOG}" \
  || echo "[run-with-alert] notify wrapper failed (non-fatal)"

rm -f "${LOG}"
exit "${RC}"
