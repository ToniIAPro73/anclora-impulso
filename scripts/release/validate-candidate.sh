#!/usr/bin/env bash
# Validates the candidate commit of a production-migrations run. Run from the root of a checkout of CANDIDATE_SHA with all
# remote branches fetched. The candidate IS the commit the workflow runs on (github.sha): there is no separate SHA input.
#   env: CANDIDATE_SHA (full lowercase SHA), DEFAULT_BRANCH
# Fails closed on anything it cannot establish. Prints no secrets (it handles none).
set -euo pipefail
: "${CANDIDATE_SHA:?CANDIDATE_SHA is required}"
: "${DEFAULT_BRANCH:?DEFAULT_BRANCH is required}"
err() { echo "::error::$1"; exit 1; }

[[ "$CANDIDATE_SHA" =~ ^[0-9a-f]{40}$ ]] || err "candidate must be a full 40-character lowercase commit SHA"
[ "$(git rev-parse HEAD)" = "$CANDIDATE_SHA" ] || err "checked-out commit differs from the candidate"
[ "$(git cat-file -t "$CANDIDATE_SHA")" = "commit" ] || err "object is not a commit"
git rev-parse --verify --quiet "origin/$DEFAULT_BRANCH" >/dev/null || err "default branch ref unavailable: failing closed"

# 1. reviewed history: the candidate must be contained in the default branch
git merge-base --is-ancestor "$CANDIDATE_SHA" "origin/$DEFAULT_BRANCH" || err "candidate is not contained in the default branch"

# 2. not behind: no newer migration may exist in the default branch
TMP="$(mktemp -d)"; trap 'rm -rf "$TMP"' EXIT
ls -1 backend/prisma/migrations | grep -E '^[0-9]{14}_' | sort > "$TMP/sha.txt" || true
git ls-tree -d --name-only "origin/$DEFAULT_BRANCH" backend/prisma/migrations/ | sed 's#.*/##' | grep -E '^[0-9]{14}_' | sort > "$TMP/default.txt" || true
[ -s "$TMP/sha.txt" ] || err "no migrations found in the candidate"
[ -s "$TMP/default.txt" ] || err "cannot list migrations of the default branch: failing closed"
if comm -13 "$TMP/sha.txt" "$TMP/default.txt" | grep -q .; then err "the default branch has migrations that the candidate does not contain"; fi

# 3. release-control files of the candidate must be identical to those of the default branch tip
if ! git diff --quiet "origin/$DEFAULT_BRANCH" "$CANDIDATE_SHA" -- .github/workflows/production-migrations.yml scripts/release; then
  err "release-control files (workflow, scripts/release) differ from the default branch"
fi

# 4. the manifest in the commit must describe exactly the migrations of the commit
test -f backend/prisma/schema.prisma && test -f backend/prisma/migrations/migration_lock.toml || err "prisma schema or migration lock missing"
node scripts/release/verify-release-manifest.mjs .
echo "candidate validated"
