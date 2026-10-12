#!/usr/bin/env bash
# ==============================================================================
# test-production-migrations-workflow.sh
#
# Local, offline tests of .github/workflows/production-migrations.yml and of the REAL scripts it runs
# (scripts/release/*). The input-validation step is EXTRACTED from the YAML and executed; the candidate validation and the
# manifest/masking checks run the real scripts inside synthetic temporary git repositories.
# No network, no database, no prisma, no .env* files.
# ==============================================================================
set -uo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
WF="$ROOT/.github/workflows/production-migrations.yml"
PASS=0; FAIL=0

ok()   { echo "  [PASS] $1"; PASS=$((PASS+1)); }
bad()  { echo "  [FAIL] $1"; FAIL=$((FAIL+1)); }
assert_ok()   { local d="$1"; shift; if "$@" >/dev/null 2>&1; then ok "$d"; else bad "$d"; fi; }
assert_fail_with() { local d="$1" pat="$2"; shift 2; local out; if out="$("$@" 2>&1)"; then bad "$d (expected failure, succeeded)"; elif echo "$out" | grep -q "$pat"; then ok "$d (rejected: $pat)"; else bad "$d (failed for another reason: $(echo "$out" | tail -1))"; fi; }
assert_fail() { local d="$1"; shift; if "$@" >/dev/null 2>&1; then bad "$d (expected failure, succeeded)"; else ok "$d (failed as expected)"; fi; }

echo "=== Suite 1: workflow structure (parsed YAML) ==="
yaml_check() {
  ruby -ryaml -e '
    d = YAML.load_file(ARGV[0]); on = d[true] || d["on"]
    abort "triggers" unless on.keys == ["workflow_dispatch"]
    inputs = on["workflow_dispatch"]["inputs"].keys.sort
    abort "inputs: #{inputs}" unless inputs == %w[backup_confirmed backup_reference ledger_reviewed preflight_report_sha256]
    abort "perm" unless d["permissions"] == {"contents"=>"read"}
    abort "conc" unless d["concurrency"]["group"] == "production-migrations" && d["concurrency"]["cancel-in-progress"] == false
    abort "migrate env" unless d["jobs"]["migrate"]["environment"] == "production-migrations" && d["jobs"]["migrate"]["needs"] == "validate"
    abort "validate has env/secrets" if d["jobs"]["validate"]["environment"] || d["jobs"]["validate"]["env"]
    abort "timeouts" unless d["jobs"].values.all? { |j| j["timeout-minutes"] }
  ' "$WF"
}
assert_ok "triggers, inputs (no sha input), permissions, concurrency, environment, needs, timeouts" yaml_check
assert_fail "no sha / expected_last_migration input remains" grep -nE "^\s+(sha|expected_last_migration):" "$WF"
assert_fail "no forbidden Prisma command is executed (comments excluded)" bash -c "grep -vE '^\s*#' '$WF' | grep -E 'migrate (dev|reset|resolve)|db push'"
assert_ok "the validator is read from the default branch tip (git show origin/<default>)" grep -q 'git show "origin/${DEFAULT_BRANCH}:scripts/release/validate-candidate.sh"' "$WF"
assert_ok "the migrated commit is github.sha" bash -c "grep -c 'ref: \${{ github.sha }}' '$WF' | grep -qx 2"

echo "=== Suite 2: input validation step (extracted from the YAML) ==="
STEP="$(mktemp)"
ruby -ryaml -e '
  d = YAML.load_file(ARGV[0])
  s = d["jobs"]["validate"]["steps"].find { |x| x["name"] == "Validate inputs (format only)" }
  puts s["run"]
' "$WF" > "$STEP"
run_inputs() {
  INPUT_LEDGER="$1" INPUT_BACKUP="$2" INPUT_BACKUP_REF="$3" INPUT_REPORT="$4" bash "$STEP"
}
GOODREPORT="$(printf 'a%.0s' $(seq 1 64))"
assert_ok   "valid inputs pass" run_inputs true true neon-branch-backup-20261012 "$GOODREPORT"
assert_fail "ledger_reviewed=false is rejected" run_inputs false true neon-branch-backup-20261012 "$GOODREPORT"
assert_fail "backup_confirmed=false is rejected" run_inputs true false neon-branch-backup-20261012 "$GOODREPORT"
assert_fail "URL as backup_reference is rejected" run_inputs true true "postgres://user:pass@host/db" "$GOODREPORT"
assert_fail "short backup_reference is rejected" run_inputs true true bk "$GOODREPORT"
assert_fail "preflight_report_sha256 with wrong length is rejected" run_inputs true true neon-branch-backup-20261012 "abc123"
assert_fail "preflight_report_sha256 with uppercase is rejected" run_inputs true true neon-branch-backup-20261012 "$(printf 'A%.0s' $(seq 1 64))"

echo "=== Suite 3: database URL checks (real script scripts/release/mask-and-check-db-url.mjs) ==="
mask() { DATABASE_URL="$1" node "$ROOT/scripts/release/mask-and-check-db-url.mjs"; }
assert_ok   "direct Neon URL passes" mask "postgresql://app_user:secret_pwd@ep-direct-1234.eu-central-1.aws.neon.tech/neondb?sslmode=require"
assert_fail "pooled (-pooler) URL is rejected" mask "postgresql://app_user:secret_pwd@ep-direct-1234-pooler.eu-central-1.aws.neon.tech/neondb"
assert_fail "non-postgres scheme is rejected" mask "mysql://app_user:secret_pwd@db.host.com/mydb"
assert_fail "newline in a credential is rejected" mask "postgresql://app_user:secret%0Apwd@ep-direct-1234.aws.neon.tech/neondb"
assert_fail "missing URL is rejected" mask ""
OUT="$(DATABASE_URL='postgresql://app_user:secret_pwd@ep-direct-1234.aws.neon.tech/neondb' node "$ROOT/scripts/release/mask-and-check-db-url.mjs")"
if echo "$OUT" | grep -q '^::add-mask::secret_pwd$' && echo "$OUT" | grep -q '^::add-mask::ep-direct-1234.aws.neon.tech$' && ! echo "$OUT" | grep -q 'postgresql://'; then ok "host, user, password and database are masked and the URL is never printed"; else bad "masking output incomplete"; fi

echo "=== Suite 4: candidate validation (real scripts/release/validate-candidate.sh) in synthetic repos ==="
TMP="$(mktemp -d /tmp/test-release-XXXXXX)"
trap 'rm -rf "$TMP" "$STEP"' EXIT
REPO="$TMP/repo"
mkdir -p "$REPO" && cd "$REPO"
git init -b development -q
git config user.name Tester; git config user.email tester@test.local
mkdir -p scripts/release .github/workflows backend/prisma/migrations/20260101000000_init
cp "$ROOT"/scripts/release/*.sh "$ROOT"/scripts/release/*.mjs scripts/release/
echo "name: wf v1" > .github/workflows/production-migrations.yml
echo "-- init" > backend/prisma/migrations/20260101000000_init/migration.sql
echo 'provider = "postgresql"' > backend/prisma/migrations/migration_lock.toml
echo "model User {}" > backend/prisma/schema.prisma
node scripts/release/generate-release-manifest.mjs . >/dev/null
git add -A && git commit -qm "init" && C1="$(git rev-parse HEAD)"

mkdir -p backend/prisma/migrations/20260102000000_second
echo "-- second" > backend/prisma/migrations/20260102000000_second/migration.sql
node scripts/release/generate-release-manifest.mjs . >/dev/null
git add -A && git commit -qm "second" && C2="$(git rev-parse HEAD)"

git checkout -q -b feature "$C2"
mkdir -p backend/prisma/migrations/20260103000000_third
echo "-- third" > backend/prisma/migrations/20260103000000_third/migration.sql
node scripts/release/generate-release-manifest.mjs . >/dev/null
git add -A && git commit -qm "third (unmerged)" && C3="$(git rev-parse HEAD)"
git checkout -q development

validate() { # sha default_tip
  git update-ref refs/remotes/origin/development "$2"
  git checkout -q "$1"
  CANDIDATE_SHA="$1" DEFAULT_BRANCH=development bash scripts/release/validate-candidate.sh
}
assert_ok   "candidate = default tip with a consistent manifest passes" validate "$C2" "$C2"
assert_fail_with "candidate behind the default branch (fewer migrations) is rejected" "does not contain" validate "$C1" "$C2"
assert_fail_with "candidate not contained in the default branch is rejected" "not contained in the default branch" validate "$C3" "$C2"

git checkout -q "$C2"
echo "-- tampered" > backend/prisma/migrations/20260102000000_second/migration.sql
git add -A && git commit -qm "edit migration without regenerating manifest" && C4="$(git rev-parse HEAD)"
assert_fail_with "migration edited without regenerating the manifest is rejected" "checksum mismatch" validate "$C4" "$C4"

git checkout -q "$C2"
echo "name: wf v2" > .github/workflows/production-migrations.yml
git add -A && git commit -qm "workflow changed" && C5="$(git rev-parse HEAD)"
assert_fail_with "release-control files differing from the default branch tip are rejected" "release-control files" validate "$C2" "$C5"

assert_fail_with "short SHA is rejected" "full 40-character" bash -c "cd '$REPO' && git checkout -q '$C2' && CANDIDATE_SHA='${C2:0:8}' DEFAULT_BRANCH=development bash scripts/release/validate-candidate.sh"
assert_fail_with "candidate different from the checked-out commit is rejected" "differs from the candidate" bash -c "cd '$REPO' && git checkout -q '$C2' && CANDIDATE_SHA='$C1' DEFAULT_BRANCH=development bash scripts/release/validate-candidate.sh"
assert_fail_with "missing default branch ref fails closed" "default branch ref unavailable" bash -c "cd '$REPO' && git checkout -q '$C2' && git update-ref -d refs/remotes/origin/development; CANDIDATE_SHA='$C2' DEFAULT_BRANCH=development bash scripts/release/validate-candidate.sh"

cd "$ROOT"
echo
echo "=== Test Summary ==="
echo "Total Passed: $PASS"
echo "Total Failed: $FAIL"
[ "$FAIL" -eq 0 ]
