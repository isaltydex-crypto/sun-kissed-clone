#!/usr/bin/env bash
# ============================================================================
# diagnose-app.sh — one-shot diagnostic + auto-fix for the `app` container.
#
# Run from anywhere:
#   bash /home/deploy/sun-kissed-clone/self-host/diagnose-app.sh
#
# What it does:
#   1. Fixes ADMIN_SESSION_SECRET if it's still the literal $(openssl ...) string.
#   2. Pulls latest config + restarts ircd and shows its log tail.
#   3. Shows app container status + exit code.
#   4. Runs the start script manually inside a fresh container so we can see
#      WHY node exits silently (env, entry file, stderr, exit code).
# ============================================================================
set -u

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

hr() { printf '\n\033[1;36m=== %s ===\033[0m\n' "$*"; }

# ---------------------------------------------------------------------------
hr "1. ADMIN_SESSION_SECRET"
if [ -f .env ] && grep -q 'ADMIN_SESSION_SECRET=\$(openssl' .env; then
  echo "→ literal string detected, regenerating..."
  sed -i '/^ADMIN_SESSION_SECRET=/d' .env
  echo "ADMIN_SESSION_SECRET=$(openssl rand -hex 32)" >> .env
  echo "→ fixed."
fi
if [ -f .env ]; then
  VAL="$(grep '^ADMIN_SESSION_SECRET=' .env | cut -d= -f2-)"
  LEN=${#VAL}
  echo "current length: ${LEN} chars (expect 64)"
fi

# ---------------------------------------------------------------------------
hr "2. git pull + restart ircd"
git pull --ff-only || echo "(git pull skipped/failed — continuing)"
docker compose restart ircd >/dev/null 2>&1 || true
sleep 3
docker compose logs --tail=20 ircd || true

# ---------------------------------------------------------------------------
hr "3. app container status"
APP_CID="$(docker compose ps -q app)"
if [ -n "$APP_CID" ]; then
  docker inspect "$APP_CID" --format \
    'status={{.State.Status}} exit={{.State.ExitCode}} restarts={{.RestartCount}} err={{.State.Error}}'
else
  echo "(no app container yet)"
fi
docker compose logs --tail=40 app || true

# ---------------------------------------------------------------------------
hr "4. manual run inside fresh app container"
docker compose run --rm --entrypoint sh app -c '
  echo "--- env (presence only) ---"
  env | grep -E "^(NODE_ENV|PORT|HOST|ADMIN_SESSION_SECRET|VITE_|SUPABASE)" \
      | sed "s/=.*/=<set>/"
  echo
  echo "--- start-server.sh ---"
  cat start-server.sh 2>/dev/null || echo "(missing)"
  echo
  echo "--- entry file listing ---"
  ls -la dist/server 2>/dev/null || echo "(no dist/server)"
  ls -la .output/server 2>/dev/null || echo "(no .output/server)"
  echo
  echo "--- running entry (10s timeout) ---"
  ENTRY="$(grep -oE "node [^ ]+" start-server.sh | awk "{print \$2}")"
  echo "entry=$ENTRY"
  timeout 10 node "$ENTRY"
  echo "exit=$?"
' 2>&1 | tail -n 100

hr "DONE"
echo "Send the full output of this script to continue debugging."
