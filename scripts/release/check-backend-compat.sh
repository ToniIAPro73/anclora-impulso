#!/usr/bin/env bash
# Promotion gate: the backend live on Render must not lag the backend of the SHA being promoted.
# Run from a full-history checkout. Pure git logic, no network and no secrets.
#   usage: check-backend-compat.sh <render_deployed_sha> <source_sha>
# Passes only when backend/ is identical in both commits.
# Blocks (exit 1) when backend/ differs or compatibility cannot be established.
set -euo pipefail
fail() { echo "::error::PROMOTION_BLOCKED_$1"; exit 1; }

RENDER_SHA="${1:-}"
SOURCE_SHA="${2:-}"
[[ "$RENDER_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "BACKEND_COMPAT_UNVERIFIABLE: Render deployed SHA is not a full 40-character SHA."
[[ "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]] || fail "BACKEND_COMPAT_UNVERIFIABLE: source SHA is not a full 40-character SHA."
git cat-file -e "$RENDER_SHA^{commit}" 2>/dev/null \
  || fail "BACKEND_COMPAT_UNVERIFIABLE: Render deployed commit is not in this repository history."
git cat-file -e "$SOURCE_SHA^{commit}" 2>/dev/null \
  || fail "BACKEND_COMPAT_UNVERIFIABLE: source commit is not in this repository history."

if git diff --quiet "$RENDER_SHA" "$SOURCE_SHA" -- backend/; then
  echo "Backend compatible: backend/ is identical between Render (${RENDER_SHA:0:7}) and source (${SOURCE_SHA:0:7})."
  exit 0
else
  diff_status=$?
fi

if [[ "$diff_status" -ne 1 ]]; then
  fail "BACKEND_COMPAT_UNVERIFIABLE: git could not compare backend/ between Render ${RENDER_SHA:0:7} and source ${SOURCE_SHA:0:7}."
fi
changed="$(git diff --name-only "$RENDER_SHA" "$SOURCE_SHA" -- backend/ | head -n 10 | tr '\n' ' ')" \
  || fail "BACKEND_COMPAT_UNVERIFIABLE: could not list backend/ differences."
fail "BACKEND_CONTENT_MISMATCH: backend/ differs between Render ${RENDER_SHA:0:7} and source ${SOURCE_SHA:0:7} (first files: $changed)."
