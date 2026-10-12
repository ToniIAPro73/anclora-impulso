#!/usr/bin/env bash
# clone-backend.sh <target-dir> : builds an isolated COPY of the backend (sources, prisma, tests, configs) and a
# copy-on-write clone of node_modules, WITHOUT any .env* file. Prisma's client loader resolves its env file relative
# to the generated client's real path, which is inside this clone, so the operational backend/.env is never in its
# lookup path (verified by scripts/verify-runner-isolation.sh). Fidelity is checked file by file.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SRC="$ROOT/backend"
TARGET="$1"
mkdir -p "$TARGET/backend"
for entry in src prisma tests scripts package.json tsconfig.json jest.config.js jest.integration.config.js jest.setup.js; do
  [ -e "$SRC/$entry" ] && cp -R "$SRC/$entry" "$TARGET/backend/$entry"
done
cp -cR "$SRC/node_modules" "$TARGET/backend/node_modules"   # APFS clone: instant, no extra space, independent files

# 1. no operational env file anywhere in the clone's own tree
if find "$TARGET/backend" -path "$TARGET/backend/node_modules" -prune -o -name '.env*' -print | grep -q .; then
  echo "clone-backend: env file present in clone" >&2; exit 1
fi
# 2. fidelity: every copied path equals the working tree (catches stale or partial copies)
for entry in src prisma tests package.json tsconfig.json jest.config.js jest.integration.config.js jest.setup.js; do
  if ! diff -rq "$SRC/$entry" "$TARGET/backend/$entry" >/dev/null; then
    echo "clone-backend: copy differs from working tree at $entry" >&2; exit 1
  fi
done
# 3. no earlier build output reused
for stale in dist .next coverage artifacts logs; do
  [ -e "$TARGET/backend/$stale" ] && { echo "clone-backend: unexpected $stale in clone" >&2; exit 1; }
done
# 4. the Prisma client inside the CLONE is regenerated from the clone's own schema (new models, e.g. oauth_handoffs, would
#    otherwise be missing from the stale generated client). The clone has no .env*, so nothing operational can be loaded;
#    node_modules was cloned copy-on-write, so the original client is untouched. No network: engines are already present.
( cd "$TARGET/backend" && env -i HOME="$HOME" PATH="$PATH" CHECKPOINT_DISABLE=1 PRISMA_HIDE_UPDATE_MESSAGE=1 \
    ./node_modules/.bin/prisma generate >/dev/null 2>&1 ) || { echo "clone-backend: prisma generate failed in the clone" >&2; exit 1; }
exit 0
