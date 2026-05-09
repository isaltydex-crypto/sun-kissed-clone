#!/usr/bin/env sh
# Apply self-host build target (Node SSR instead of Cloudflare Workers).
# Idempotent — safe to run multiple times.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# 1. Swap vite.config.ts ------------------------------------------------------
if [ -f "$ROOT/vite.config.editor.ts" ]; then
  echo "✔ vite.config already patched (vite.config.editor.ts exists). Skipping swap."
else
  echo "→ backing up vite.config.ts → vite.config.editor.ts"
  mv "$ROOT/vite.config.ts" "$ROOT/vite.config.editor.ts"
  echo "→ installing Node-target vite.config.ts"
  cp "$ROOT/self-host/vite.config.node.ts" "$ROOT/vite.config.ts"
fi

# 2. Add a `start` script to package.json (used by `npm start` / bare node) ---
if ! grep -q '"start"' "$ROOT/package.json"; then
  echo "→ adding \"start\" script to package.json"
  # Portable in-place edit (works on macOS + GNU sed). Inserts after "dev":
  node - <<'NODE'
const fs = require('fs');
const path = require('path');
const pkgPath = path.join(process.cwd(), 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
pkg.scripts = pkg.scripts || {};
if (!pkg.scripts.start) {
  pkg.scripts.start = 'node .output/server/index.mjs';
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
}
NODE
fi

# 3. Install Node-target build deps if missing -------------------------------
echo "→ ensuring Node build deps present"
cd "$ROOT"
bun add -d @tanstack/react-start vite-tsconfig-paths @vitejs/plugin-react @tailwindcss/vite vite >/dev/null 2>&1 || \
  npm install --save-dev @tanstack/react-start vite-tsconfig-paths @vitejs/plugin-react @tailwindcss/vite vite >/dev/null 2>&1 || true

# 4. Remove Cloudflare-only deps that break Node build (kept commented; safe to keep installed)
# We don't uninstall — the Node vite config simply doesn't reference them.

echo "✔ self-host build patch applied."
echo "  Next: bun install && bun run build"
