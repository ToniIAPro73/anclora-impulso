#!/usr/bin/env bash
# code-identity.sh : prints a JSON identity of the code under test (no secrets, no file contents).
#   gitHead/branch/dirty, diffSha256 (tracked changes), untrackedCount, sourceTreeSha256 (content hash of the
#   source files that tests/servers execute). Two runs with the same sourceTreeSha256 ran the same code.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
HEAD_SHA="$(git rev-parse HEAD)"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
DIFF_SHA="$(git diff HEAD | shasum -a 256 | cut -d' ' -f1)"
UNTRACKED="$(git ls-files -o --exclude-standard | wc -l | tr -d ' ')"
DIRTY=false; [ -n "$(git status --porcelain)" ] && DIRTY=true
TREE_SHA="$( { git ls-files -c -o --exclude-standard -- app components hooks lib public middleware.ts next.config.mjs postcss.config.mjs tsconfig.json package.json \
                 backend/src backend/prisma backend/tests backend/package.json backend/tsconfig.json backend/jest.config.js backend/jest.integration.config.js backend/jest.setup.js e2e scripts \
               | sort | while read -r f; do [ -f "$f" ] && printf '%s  %s\n' "$(shasum -a 256 < "$f" | cut -d' ' -f1)" "$f"; done; } | shasum -a 256 | cut -d' ' -f1)"
printf '{"gitHead":"%s","branch":"%s","dirty":%s,"diffSha256":"%s","untrackedCount":%s,"sourceTreeSha256":"%s"}\n' \
  "$HEAD_SHA" "$BRANCH" "$DIRTY" "$DIFF_SHA" "$UNTRACKED" "$TREE_SHA"
