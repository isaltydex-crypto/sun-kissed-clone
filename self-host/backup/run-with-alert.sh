#!/bin/sh
# ============================================================================
# Run a command; if it exits non-zero, capture output and email an alert.
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
{
  echo "Job:     ${LABEL}"
  echo "Host:    ${HOST}"
  echo "Started: ${START}"
  echo "Failed:  $(date -u +%FT%TZ)"
  echo "Exit:    ${RC}"
  echo ""
  echo "--- last 100 lines of output ---"
  tail -n 100 "${LOG}"
} | /usr/local/bin/notify.sh "[peptivalab] ${LABEL} FAILED on ${HOST}"

rm -f "${LOG}"
exit "${RC}"
