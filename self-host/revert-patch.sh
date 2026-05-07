#!/usr/bin/env sh
# Revert self-host build patch — restore Lovable's vite.config.ts.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$ROOT/vite.config.lovable.ts" ]; then
  echo "Nothing to revert (no backup found)."
  exit 0
fi

mv "$ROOT/vite.config.lovable.ts" "$ROOT/vite.config.ts"
echo "✔ reverted to Lovable build config."
