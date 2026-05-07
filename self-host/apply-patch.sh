#!/usr/bin/env sh
# Apply self-host build target (Node SSR instead of Cloudflare Workers).
# Idempotent — safe to run multiple times.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ -f "$ROOT/vite.config.lovable.ts" ]; then
  echo "Patch already applied. Skipping."
  exit 0
fi

echo "→ backing up vite.config.ts → vite.config.lovable.ts"
mv "$ROOT/vite.config.ts" "$ROOT/vite.config.lovable.ts"

echo "→ installing Node-target vite.config.ts"
cp "$ROOT/self-host/vite.config.node.ts" "$ROOT/vite.config.ts"

echo "→ installing Node build dependencies (if missing)"
cd "$ROOT"
# These may already be in package.json; bun add is idempotent.
bun add -d @tanstack/react-start vite-tsconfig-paths @vitejs/plugin-react @tailwindcss/vite vite >/dev/null 2>&1 || true

echo "✔ self-host build patch applied."
