#!/bin/sh
# ============================================================================
# Send an alert email by POSTing to the app's internal notify endpoint.
# Templates are stored in the database (site_content.emails) and edited from
# /admin/innehall — this script only forwards variables.
#
# Required env: APP_INTERNAL_URL, INTERNAL_NOTIFY_TOKEN
# Best-effort: failures are logged but never crash the calling job.
#
# Usage: notify.sh <job> <host> <startedAt> <failedAt> <exitCode> <log-file>
# ============================================================================
set -u

JOB="${1:-unknown-job}"
HOST="${2:-$(hostname 2>/dev/null || echo unknown)}"
STARTED_AT="${3:-}"
FAILED_AT="${4:-$(date -u +%FT%TZ)}"
EXIT_CODE="${5:-?}"
LOG_FILE="${6:-}"

if [ -z "${APP_INTERNAL_URL:-}" ] || [ -z "${INTERNAL_NOTIFY_TOKEN:-}" ]; then
  echo "[notify] APP_INTERNAL_URL or INTERNAL_NOTIFY_TOKEN not set — skipping alert for ${JOB}"
  exit 0
fi

LOG_TAIL=""
if [ -n "${LOG_FILE}" ] && [ -f "${LOG_FILE}" ]; then
  LOG_TAIL="$(tail -n 100 "${LOG_FILE}")"
fi

# JSON-escape arbitrary text using awk (POSIX, no jq dependency).
json_escape() {
  awk 'BEGIN { ORS=""; first=1 }
       { if (!first) print "\\n"; first=0;
         gsub(/\\/, "\\\\");
         gsub(/"/,  "\\\"");
         gsub(/\t/, "\\t");
         gsub(/\r/, "");
         print }' <<EOF
${1}
EOF
}

J_JOB="$(json_escape "${JOB}")"
J_HOST="$(json_escape "${HOST}")"
J_START="$(json_escape "${STARTED_AT}")"
J_FAIL="$(json_escape "${FAILED_AT}")"
J_EXIT="$(json_escape "${EXIT_CODE}")"
J_LOG="$(json_escape "${LOG_TAIL}")"

PAYLOAD="{\"kind\":\"alert\",\"vars\":{\"job\":\"${J_JOB}\",\"host\":\"${J_HOST}\",\"startedAt\":\"${J_START}\",\"failedAt\":\"${J_FAIL}\",\"exitCode\":\"${J_EXIT}\",\"log\":\"${J_LOG}\"}}"

HTTP_CODE="$(printf '%s' "${PAYLOAD}" | wget -qO- \
  --header="Content-Type: application/json" \
  --header="Authorization: Bearer ${INTERNAL_NOTIFY_TOKEN}" \
  --post-data="${PAYLOAD}" \
  --server-response \
  "${APP_INTERNAL_URL%/}/api/internal/notify" 2>&1 | awk '/HTTP\// {code=$2} END {print code}')"

if [ "${HTTP_CODE}" = "200" ]; then
  echo "[notify] alert sent for ${JOB}"
else
  echo "[notify] alert delivery failed (HTTP ${HTTP_CODE:-?}) for ${JOB}"
fi
