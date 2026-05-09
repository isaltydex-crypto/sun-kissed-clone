#!/usr/bin/env sh
# Revert self-host build patch — restore the editor vite.config.ts.
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

if [ ! -f "$ROOT/vite.config.editor.ts" ]; then
  echo "Nothing to revert (no backup found)."
  exit 0
fi

mv "$ROOT/vite.config.editor.ts" "$ROOT/vite.config.ts"
echo "✔ reverted to editor build config."
