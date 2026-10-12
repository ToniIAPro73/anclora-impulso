#!/usr/bin/env bash
# make-run-dir.sh <target-dir> : builds a self-contained Next project directory by COPYING the frontend sources
# from a whitelist. It contains no .env* file (nor .git/.next/.vercel), so the process under test cannot find
# operational environment files in its own project directory. node_modules is a symlink to the repository's.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
TARGET="$1"
mkdir -p "$TARGET"
for entry in app components hooks lib public middleware.ts next.config.mjs postcss.config.mjs tsconfig.json package.json components.json next-env.d.ts; do
  [ -e "$ROOT/$entry" ] && cp -R "$ROOT/$entry" "$TARGET/$entry"
done
ln -sfn "$ROOT/node_modules" "$TARGET/node_modules"
# defence in depth: refuse to continue if an env file slipped in
if find "$TARGET" -maxdepth 2 -name '.env*' -not -path '*/node_modules/*' | grep -q .; then
  echo "make-run-dir: env file found in run directory" >&2; exit 1
fi
