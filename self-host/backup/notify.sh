#!/bin/sh
# ============================================================================
# Send an email via msmtp using SMTP_* env vars. Best-effort: swallows errors
# so a broken SMTP config never crashes a backup job.
#
# Usage:  notify.sh "<subject>" <<EOF
#         body line 1
#         body line 2
#         EOF
# ============================================================================
set -u

SUBJECT="${1:-(no subject)}"

if [ -z "${SMTP_HOST:-}" ] || [ -z "${NOTIFY_EMAIL_TO:-}" ]; then
  echo "[notify] SMTP_HOST or NOTIFY_EMAIL_TO not set — skipping email: ${SUBJECT}"
  cat >/dev/null
  exit 0
fi

PORT="${SMTP_PORT:-587}"
FROM="${NOTIFY_EMAIL_FROM:-${SMTP_USER:-noreply@localhost}}"
# strip display name, keep bare addr for envelope
FROM_ADDR="$(echo "${FROM}" | sed -E 's/.*<([^>]+)>.*/\1/')"

if [ "${PORT}" = "465" ]; then
  TLS="tls on\ntls_starttls off"
else
  TLS="tls on\ntls_starttls on"
fi

CONF="$(mktemp)"
printf 'account default\nhost %s\nport %s\n%b\nauth on\nuser %s\npassword %s\nfrom %s\nlogfile -\n' \
  "${SMTP_HOST}" "${PORT}" "${TLS}" \
  "${SMTP_USER:-}" "${SMTP_PASS:-}" "${FROM_ADDR}" > "${CONF}"
chmod 600 "${CONF}"

BODY="$(cat)"

{
  printf 'From: %s\n' "${FROM}"
  printf 'To: %s\n' "${NOTIFY_EMAIL_TO}"
  printf 'Subject: %s\n' "${SUBJECT}"
  printf 'Content-Type: text/plain; charset=UTF-8\n'
  printf '\n'
  printf '%s\n' "${BODY}"
} | msmtp --file="${CONF}" -- "${NOTIFY_EMAIL_TO}" \
  || echo "[notify] msmtp failed (non-fatal)"

rm -f "${CONF}"
