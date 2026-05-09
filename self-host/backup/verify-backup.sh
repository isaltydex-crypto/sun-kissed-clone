#!/bin/sh
# ============================================================================
# Restore-drill: pick the newest dump, restore it into a throwaway Postgres
# in /tmp, run a few smoke queries, exit non-zero if anything looks wrong.
#
# Run weekly via cron, or manually:
#   docker compose exec backup verify-backup.sh
# ============================================================================
set -eu

LATEST="$(ls -1t /backups/peptivalab-*.sql.gz* 2>/dev/null | head -n1 || true)"
if [ -z "${LATEST}" ]; then
  echo "✗ no backups in /backups"
  exit 1
fi
echo "→ verifying ${LATEST}"

PLAIN="/tmp/verify.sql"
case "${LATEST}" in
  *.gpg) /usr/local/bin/decrypt.sh "${LATEST}" "${PLAIN}.gz" >/dev/null
         gunzip -f "${PLAIN}.gz" ;;
  *.gz)  gunzip -kc "${LATEST}" > "${PLAIN}" ;;
esac

# Spin up an embedded Postgres (initdb + pg_ctl) under an unprivileged user.
PGDATA="/tmp/verify-pg"
PGPORT=55432
rm -rf "${PGDATA}"
adduser -D -u 70 verifier 2>/dev/null || true
mkdir -p "${PGDATA}" && chown -R verifier "${PGDATA}" /tmp

su verifier -s /bin/sh -c "
  initdb -D ${PGDATA} -U postgres --auth=trust --no-locale --encoding=UTF8 >/dev/null
  echo \"port = ${PGPORT}\" >> ${PGDATA}/postgresql.conf
  echo \"unix_socket_directories = '/tmp'\" >> ${PGDATA}/postgresql.conf
  pg_ctl -D ${PGDATA} -l /tmp/verify-pg.log -w start
"

cleanup() {
  su verifier -s /bin/sh -c "pg_ctl -D ${PGDATA} -m fast stop" >/dev/null 2>&1 || true
  rm -rf "${PGDATA}" "${PLAIN}"
}
trap cleanup EXIT

echo "→ restoring dump"
psql -h /tmp -p ${PGPORT} -U postgres -d postgres -v ON_ERROR_STOP=1 \
     -f "${PLAIN}" > /tmp/verify-restore.log 2>&1 || {
  tail -20 /tmp/verify-restore.log
  echo "✗ restore FAILED"
  exit 2
}

echo "→ smoke queries"
for tbl in site_pages site_content chat_channels chat_messages; do
  N=$(psql -h /tmp -p ${PGPORT} -U postgres -d postgres -tAc "SELECT count(*) FROM public.${tbl}" 2>/dev/null || echo "ERR")
  echo "   ${tbl}: ${N} rows"
  [ "${N}" = "ERR" ] && { echo "✗ table ${tbl} unreadable"; exit 3; }
done

echo "✔ backup verified OK"
