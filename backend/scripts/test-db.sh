#!/usr/bin/env bash
# Manage the isolated Anclora Impulso test database. Touches only the compose project
# "anclora-impulso-test" (container anclora-impulso-test-postgres, volume anclora_impulso_test_pgdata).
set -euo pipefail
cd "$(dirname "$0")/.."
BACKEND_DIR="$PWD"
REPO_ROOT="$(cd .. && pwd)"

ENV_FILE="${TEST_ENV_FILE:-.env.test.local}"   # override exists only so the negative guard tests can inject decoys
CONTAINER="anclora-impulso-test-postgres"
COMPOSE=(docker compose -p anclora-impulso-test -f docker-compose.test.yml --env-file "$ENV_FILE")

load_env() {
  local f="$ENV_FILE"; case "$f" in /*) ;; *) f="./$f" ;; esac
  set -a; . "$f"; set +a
}

die() { echo "REFUSED: $*" >&2; exit 3; }

# Effective-target guard. Runs BEFORE any operation that can write (migrate, verify-migrations, test).
# The IMPULSO_TEST_DB_* variables are NOT evidence of anything; the target is proven by:
#   1. DATABASE_URL validated COMPONENT BY COMPONENT by scripts/validate-db-url.py (NF-1: a glob over the whole string
#      accepted a remote authority followed by a local-looking tail). The validated, canonical URL replaces the original
#      in this process: it is the only value ever handed to Prisma/Jest.
#   2. that port is the one THIS project's container publishes on 127.0.0.1 (ties the URL to our container)
#   3. the live database of that container carries the test marker
assert_target() {
  [ -n "${DATABASE_URL:-}" ] && [ -n "${TEST_DB_PORT:-}" ] && [ -n "${TEST_DB_NAME:-}" ] && [ -n "${TEST_DB_USER:-}" ] \
    || die "test environment file is incomplete"
  local canonical reason
  reason="$(mktemp)"
  if ! canonical="$(python3 -I "$BACKEND_DIR/scripts/validate-db-url.py" 2>"$reason")"; then
    local why; why="$(head -1 "$reason")"; rm -f "$reason"
    die "DATABASE_URL does not match the authorized local test database ($why)"
  fi
  rm -f "$reason"
  DATABASE_URL="$canonical"; export DATABASE_URL
  local published marker
  published="$(docker port "$CONTAINER" 5432/tcp 2>/dev/null | head -1 || true)"
  [ "$published" = "127.0.0.1:$TEST_DB_PORT" ] || die "container $CONTAINER does not publish 127.0.0.1:$TEST_DB_PORT (found: ${published:-nothing})"
  marker="$(docker exec -i "$CONTAINER" psql -U "$TEST_DB_USER" -d "$TEST_DB_NAME" -Atc "select current_setting('anclora.test_marker', true)" 2>/dev/null || true)"
  [ "$marker" = "impulso-test-v1" ] || die "test marker missing on the live database"
}

clean_env_run() {
  # Minimal environment: operational .env values never reach the child process. Prisma's client loader would
  # merge backend/.env into process.env for undefined keys, so every name the backend reads is predefined empty.
  SHIELD=()
  while IFS= read -r assignment; do SHIELD+=("$assignment"); done < <("$REPO_ROOT/scripts/support/shield-env.sh")
  env -i HOME="$HOME" PATH="$PATH" TERM="${TERM:-dumb}" "${SHIELD[@]}" \
    DATABASE_URL="$DATABASE_URL" JWT_SECRET="$JWT_SECRET" JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
    JWT_EXPIRES_IN="${JWT_EXPIRES_IN:-15m}" IDEMPOTENCY_KEY_ENFORCEMENT="${IDEMPOTENCY_KEY_ENFORCEMENT:-warn}" \
    NODE_ENV=test IMPULSO_TEST_DB_PORT="$TEST_DB_PORT" IMPULSO_TEST_DB_NAME="$TEST_DB_NAME" IMPULSO_TEST_DB_USER="$TEST_DB_USER" \
    "$@"
}

# Local, database-free runs (unit tests, typecheck, build) from a fresh env-free clone of the CURRENT working tree:
# no .env* file is in the lookup path of dotenv/Prisma, every name the backend reads is predefined empty, no database
# target is configured. Each run gets a NEW evidence directory with identity.json and MANIFEST.sha256.
isolated_local_run() { # kind label cmd...
  local kind="$1"; shift
  . "$REPO_ROOT/scripts/support/evidence-lib.sh"
  local run_id art clone code rc ident
  run_id="$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
  art="$(evidence_new_dir "$BACKEND_DIR/artifacts/local-runs" "$run_id")" || exit 1
  clone="$(mktemp -d)"
  "$REPO_ROOT/scripts/support/clone-backend.sh" "$clone"
  ident="$("$REPO_ROOT/scripts/support/code-identity.sh")"
  SHIELD=(); while IFS= read -r a; do SHIELD+=("$a"); done < <("$REPO_ROOT/scripts/support/shield-env.sh")
  set +e
  ( cd "$clone/backend" && env -i HOME="$HOME" PATH="$PATH" TERM="${TERM:-dumb}" "${SHIELD[@]}" \
      JWT_SECRET="unit-secret-not-used" JWT_REFRESH_SECRET="unit-refresh-not-used" NODE_ENV=test "$@" ) > "$art/output.log" 2>&1
  rc=$?
  set -e
  sed -E -i '' 's#postgres(ql)?://[^[:space:]@]*@#postgresql://***@#g; s#Bearer [A-Za-z0-9._~+/=-]+#Bearer ***#g' "$art/output.log"
  RUN_ID="$run_id" KIND="$kind" CMD="$*" RC="$rc" IDENT="$ident" ART="$art" python3 - <<'PY'
import json, os, datetime
e = os.environ
open(os.path.join(e["ART"], "identity.json"), "w").write(json.dumps({
  "runId": e["RUN_ID"], "kind": e["KIND"], "command": e["CMD"],
  "finishedAtUtc": datetime.datetime.utcnow().isoformat() + "Z",
  "code": json.loads(e["IDENT"]), "exitCode": int(e["RC"]),
  "copy": "fresh clone of backend, no .env*, fidelity-checked; shielded environment; no database target",
}, indent=2))
PY
  evidence_manifest_write "$art" || true
  rm -rf "$clone"
  echo "[test-db] $kind exit $rc; evidence: $art"
  return "$rc"
}

case "${1:-}" in
  init-env)
    if [ -f "$ENV_FILE" ]; then echo "$ENV_FILE already exists (kept)"; exit 0; fi
    umask 077
    pw="$(openssl rand -hex 16)"
    {
      echo "TEST_DB_NAME=anclora_impulso_test"
      echo "TEST_DB_USER=impulso_test"
      echo "TEST_DB_PASSWORD=$pw"
      echo "TEST_DB_PORT=54329"
      echo "DATABASE_URL=postgresql://impulso_test:$pw@127.0.0.1:54329/anclora_impulso_test?schema=public"
      echo "JWT_SECRET=$(openssl rand -hex 32)"
      echo "JWT_REFRESH_SECRET=$(openssl rand -hex 32)"
      echo "JWT_EXPIRES_IN=15m"
    } > "$ENV_FILE"
    chmod 600 "$ENV_FILE"
    echo "created $ENV_FILE (mode 600, values not shown)"
    ;;
  up)      "${COMPOSE[@]}" up -d --wait ;;
  migrate) load_env; assert_target; clean_env_run pnpm exec prisma migrate deploy ;;
  test)
    shift; load_env; assert_target
    # Every run: fresh env-free clone of the CURRENT working tree (fidelity-checked), identity record, DB identity.
    RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
    . "$REPO_ROOT/scripts/support/evidence-lib.sh"
    mkdir -p "$BACKEND_DIR/artifacts/test-failures"
    RUN_ART="$(evidence_new_dir "$BACKEND_DIR/artifacts/test-runs" "$RUN_ID")" || exit 1
    MARKER="$(docker exec -i anclora-impulso-test-postgres psql -U "$TEST_DB_USER" -d "$TEST_DB_NAME" -Atc "select current_setting('anclora.test_marker', true)")"
    [ "$MARKER" = "impulso-test-v1" ] || { echo "refusing: test marker missing on live database"; exit 1; }
    DB_CONTAINER_ID="$(docker inspect -f '{{.Id}}' anclora-impulso-test-postgres | cut -c1-12)"
    DB_POSTMASTER_START="$(docker exec -i anclora-impulso-test-postgres psql -U "$TEST_DB_USER" -d "$TEST_DB_NAME" -Atc "select pg_postmaster_start_time()")"
    CLONE="$(mktemp -d)"
    "$REPO_ROOT/scripts/support/clone-backend.sh" "$CLONE"
    CODE_ID="$("$REPO_ROOT/scripts/support/code-identity.sh")"

    # TEST_RANDOMIZE=1 [TEST_SEED=n] makes suite/test order reproducible via jest --randomize --seed.
    EXTRA=()
    if [ "${TEST_RANDOMIZE:-0}" = "1" ]; then EXTRA+=(--randomize "--seed=${TEST_SEED:-$RANDOM}"); fi

    RUN_LOG="$RUN_ART/jest.log"
    ( cd "$CLONE/backend" && clean_env_run ./node_modules/.bin/jest --config jest.integration.config.js --ci --runInBand ${EXTRA[@]+"${EXTRA[@]}"} "$@" ) > "$RUN_LOG" 2>&1 &
    JEST_PID=$!
    tail -f "$RUN_LOG" & TAIL_PID=$!
    sleep 3
    descendants() { local p="$1" c; for c in $(pgrep -P "$p" 2>/dev/null || true); do echo "$c"; descendants "$c"; done; }
    CHILDREN="$(descendants "$JEST_PID" | tr '\n' ' ')"
    set +e; wait "$JEST_PID"; CODE=$?; set -e
    sleep 0.5; kill "$TAIL_PID" 2>/dev/null || true

    RUN_ID="$RUN_ID" CODE_ID="$CODE_ID" JEST_PID="$JEST_PID" CHILDREN="$CHILDREN" SCRIPT_PID="$$" CLONE_PATH="$CLONE" \
    DB_PORT="$TEST_DB_PORT" DB_NAME="$TEST_DB_NAME" DB_CONTAINER_ID="$DB_CONTAINER_ID" DB_POSTMASTER_START="$DB_POSTMASTER_START" \
    CODE="$CODE" RUN_ART="$RUN_ART" python3 - <<'PY'
import json, os, datetime
e = os.environ
open(os.path.join(e["RUN_ART"], "identity.json"), "w").write(json.dumps({
  "runId": e["RUN_ID"], "kind": "backend-integration",
  "finishedAtUtc": datetime.datetime.utcnow().isoformat() + "Z",
  "code": json.loads(e["CODE_ID"]),
  "copy": "fresh clone of backend (cp -c node_modules), no .env*, fidelity-checked, no build output",
  "processes": {"scriptPid": int(e["SCRIPT_PID"]), "jestRootPid": int(e["JEST_PID"]), "jestChildren": [int(x) for x in e["CHILDREN"].split()]},
  "effectiveTargets": {"database": {"host": "127.0.0.1", "port": int(e["DB_PORT"]), "name": e["DB_NAME"], "marker": "impulso-test-v1",
                                    "containerId": e["DB_CONTAINER_ID"], "postmasterStart": e["DB_POSTMASTER_START"]},
                       "externalServices": "none reachable: shielded environment, LLM/OAuth/SMTP names predefined empty"},
  "exitCode": int(e["CODE"]),
}, indent=2))
PY
    # failure bundles live in the clone: bring them (sanitized by the reporter) next to the run record
    if [ -d "$CLONE/backend/artifacts/test-failures" ]; then cp "$CLONE"/backend/artifacts/test-failures/* "$RUN_ART/" 2>/dev/null || true; cp "$CLONE"/backend/artifacts/test-failures/* "$BACKEND_DIR/artifacts/test-failures/" 2>/dev/null || true; fi
    if [ "$CODE" -ne 0 ]; then
      sed -E -i '' 's#postgres(ql)?://[^[:space:]@]*@#postgresql://***@#g; s#Bearer [A-Za-z0-9._~+/=-]+#Bearer ***#g; s#eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*#[jwt]#g; s#rt1\.[A-Za-z0-9_-]{10,}#rt1.[refresh]#g' "$RUN_LOG"
      echo "[test-db] run $RUN_ID failed (exit $CODE); record kept at backend/artifacts/test-runs/$RUN_ID"
    else
      echo "[test-db] run $RUN_ID passed; identity at backend/artifacts/test-runs/$RUN_ID/identity.json"
    fi
    evidence_manifest_write "$RUN_ART" || true
    rm -rf "$CLONE"
    exit "$CODE" ;;
  verify-migrations)
    # Clean install vs upgrade-from-baseline equivalence on throw-away databases inside the SAME test container.
    # Every step's exit status is checked explicitly (nothing is masked by a pipe), the historical row is verified
    # against an exact expected value, and the sanitized output + identity are kept as evidence (never overwritten).
    load_env; assert_target
    . "$REPO_ROOT/scripts/support/evidence-lib.sh"
    VM_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
    VM_DIR="$(evidence_new_dir "${VERIFY_MIGRATIONS_EVIDENCE_DIR:-$BACKEND_DIR/artifacts/verify-migrations}" "$VM_ID")" || exit 1
    VM_LOG="$VM_DIR/output.log"; : > "$VM_LOG"
    VM_RESULT="fail"; VM_REASON="aborted before completion"
    sanitize() { sed -E 's#postgres(ql)?://[^[:space:]@]*@#postgresql://***@#g'; }
    say() { printf '%s\n' "$*" | tee -a "$VM_LOG"; }
    psql_admin() { docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$TEST_DB_USER" -d postgres "$@"; }
    url_for() { echo "postgresql://$TEST_DB_USER:$TEST_DB_PASSWORD@127.0.0.1:$TEST_DB_PORT/$1?schema=public"; }
    CLEAN="${TEST_DB_NAME}_clean"; UPGRADE="${TEST_DB_NAME}_upgrade"
    BASELINE_DIR="$(mktemp -d)"
    vm_finish() {
      local rc=$?
      rm -rf "$BASELINE_DIR"
      for db in "$CLEAN" "$UPGRADE"; do docker exec -i "$CONTAINER" psql -U "$TEST_DB_USER" -d postgres -qc "DROP DATABASE IF EXISTS \"$db\"" >/dev/null 2>&1 || true; done
      [ "$rc" -eq 0 ] && VM_RESULT="pass" && VM_REASON="all checks passed"
      MIGS="$(cd prisma/migrations && ls -d */ | tr -d '/' | tr '\n' ' ')"
      HASHES="$(cd prisma/migrations && find . -name migration.sql -exec shasum -a 256 {} + | sort -k2 | tr '\n' ';')"
      VM_RESULT="$VM_RESULT" VM_REASON="$VM_REASON" VM_ID="$VM_ID" MIGS="$MIGS" HASHES="$HASHES" RC="$rc" \
      CODE_ID="$("$REPO_ROOT/scripts/support/code-identity.sh" 2>/dev/null || echo '{}')" \
      DB_CONTAINER_ID="$(docker inspect -f '{{.Id}}' "$CONTAINER" 2>/dev/null | cut -c1-12)" \
      DB_PORT="$TEST_DB_PORT" DB_NAME="$TEST_DB_NAME" VM_DIR="$VM_DIR" python3 - <<'PY'
import json, os, datetime
e = os.environ
open(os.path.join(e["VM_DIR"], "identity.json"), "w").write(json.dumps({
  "runId": e["VM_ID"], "kind": "verify-migrations",
  "finishedAtUtc": datetime.datetime.utcnow().isoformat() + "Z",
  "result": e["VM_RESULT"], "reason": e["VM_REASON"], "exitCode": int(e["RC"]),
  "code": json.loads(e["CODE_ID"] or "{}"),
  "migrations": e["MIGS"].split(),
  "migrationSqlSha256": [x for x in e["HASHES"].split(";") if x],
  "database": {"host": "127.0.0.1", "port": int(e["DB_PORT"]), "server": e["DB_NAME"], "containerId": e["DB_CONTAINER_ID"],
               "throwAway": [e["DB_NAME"] + "_clean", e["DB_NAME"] + "_upgrade"], "marker": "impulso-test-v1"},
}, indent=2))
PY
      evidence_manifest_write "$VM_DIR" || true
      echo "[verify-migrations] $VM_RESULT ($VM_REASON); evidence: $VM_DIR"
      exit "$rc"
    }
    trap vm_finish EXIT
    vm_fail() { VM_REASON="$1"; say "FAIL: $1"; exit 1; }

    # run a prisma command; capture output (sanitized) and FAIL on a non-zero exit status or a missing success line
    run_prisma() { # url expected-regex args...
      local u="$1" expect="$2"; shift 2
      local out rc=0
      SHIELD=(); while IFS= read -r a; do SHIELD+=("$a"); done < <("$REPO_ROOT/scripts/support/shield-env.sh")
      if [ -n "$u" ]; then
        out="$(env -i HOME="$HOME" PATH="$PATH" "${SHIELD[@]}" DATABASE_URL="$u" pnpm exec prisma "$@" 2>&1)" || rc=$?
      else
        out="$(env -i HOME="$HOME" PATH="$PATH" pnpm exec prisma "$@" 2>&1)" || rc=$?
      fi
      printf '%s\n' "$out" | sanitize | tee -a "$VM_LOG" >/dev/null
      [ "$rc" -eq 0 ] || vm_fail "prisma $1 exited with status $rc"
      [ -z "$expect" ] || printf '%s\n' "$out" | grep -Eq "$expect" || vm_fail "prisma $1: expected output /$expect/ not found"
    }
    q() { docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$TEST_DB_USER" -d "$1" -At -F'|' -c "$2"; }

    for db in "$CLEAN" "$UPGRADE"; do psql_admin -qc "DROP DATABASE IF EXISTS \"$db\"" -c "CREATE DATABASE \"$db\"" || vm_fail "cannot create throw-away database"; done
    mkdir -p "$BASELINE_DIR/prisma/migrations"
    cp prisma/schema.prisma "$BASELINE_DIR/prisma/"; cp prisma/migrations/migration_lock.toml "$BASELINE_DIR/prisma/migrations/"
    # baseline = the migrations that existed before this work (names before 20261012*)
    for d in prisma/migrations/*/; do case "$(basename "$d")" in 20261012*) ;; *) cp -R "${d%/}" "$BASELINE_DIR/prisma/migrations/" ;; esac; done
    NBASE="$(ls -d "$BASELINE_DIR"/prisma/migrations/*/ | wc -l | tr -d ' ')"; NNEW="$(ls -d prisma/migrations/20261012*/ | wc -l | tr -d ' ')"
    say "baseline migrations: $NBASE   new migrations: $NNEW"
    [ "$NNEW" -ge 1 ] || vm_fail "no new migrations found"

    say "== upgrade path: apply baseline, insert a historical row, then apply the new migrations"
    run_prisma "$(url_for "$UPGRADE")" "successfully applied" migrate deploy --schema "$BASELINE_DIR/prisma/schema.prisma"
    docker exec -i "$CONTAINER" psql -v ON_ERROR_STOP=1 -U "$TEST_DB_USER" -d "$UPGRADE" -q <<SQL || vm_fail "cannot insert the historical row"
INSERT INTO users (id, email, "fullName", "updatedAt") VALUES ('hist-user', 'hist@example.test', 'Historical', now());
INSERT INTO workouts (id, "userId", name, "updatedAt") VALUES ('hist-workout', 'hist-user', 'Old routine', now());
SQL
    run_prisma "$(url_for "$UPGRADE")" "successfully applied" migrate deploy
    HIST="$(q "$UPGRADE" "SELECT \"generationMode\" || '|' || coalesce(\"generationVersion\",'<NULL>') FROM workouts WHERE id='hist-workout'")" || vm_fail "cannot read the historical row"
    say "historical row (mode|version) = $HIST"
    [ "$HIST" = "unknown|<NULL>" ] || vm_fail "historical row expected 'unknown|<NULL>', got '$HIST'"

    say "== clean install path"
    run_prisma "$(url_for "$CLEAN")" "successfully applied" migrate deploy

    say "== every migration finished, in both databases"
    TOTAL=$((NBASE + NNEW))
    for db in "$CLEAN" "$UPGRADE"; do
      DONE="$(q "$db" "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL")" || vm_fail "cannot read _prisma_migrations of $db"
      OPEN="$(q "$db" "SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL")" || vm_fail "cannot read _prisma_migrations of $db"
      say "$db: finished=$DONE unfinished=$OPEN expected=$TOTAL"
      [ "$DONE" = "$TOTAL" ] && [ "$OPEN" = "0" ] || vm_fail "$db: migration ledger incomplete"
    done

    say "== schema equivalence (clean vs upgraded), and vs prisma/schema.prisma"
    run_prisma "" "No difference detected" migrate diff --from-url "$(url_for "$CLEAN")" --to-url "$(url_for "$UPGRADE")" --exit-code
    say "clean == upgrade: no schema difference"
    run_prisma "" "No difference detected" migrate diff --from-url "$(url_for "$CLEAN")" --to-schema-datamodel prisma/schema.prisma --exit-code
    say "clean == schema.prisma: no drift"
    ;;
  unit)       shift; isolated_local_run backend-unit ./node_modules/.bin/jest --config jest.config.js --ci --runInBand "$@" --testPathIgnorePatterns=/tests/integration/ ;;
  typecheck)  isolated_local_run backend-typecheck ./node_modules/.bin/tsc --noEmit ;;
  build)      isolated_local_run backend-build ./node_modules/.bin/tsc --outDir ./dist-check ;;
  check-target) load_env; assert_target; echo "target ok: 127.0.0.1:$TEST_DB_PORT/$TEST_DB_NAME (validated, no operation performed)" ;;
  status)  "${COMPOSE[@]}" ps ;;
  down)    "${COMPOSE[@]}" down -v ;;   # removes ONLY this project's container, network and volume
  *) echo "usage: $0 {init-env|up|migrate|verify-migrations|test [jest args]|unit [jest args]|typecheck|build|check-target|status|down}"; exit 2 ;;
esac
