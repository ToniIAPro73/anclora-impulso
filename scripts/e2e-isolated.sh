#!/usr/bin/env bash
# Runs the Playwright E2E suite against the ISOLATED test database only (exception IMPULSO-TEST-DB-2026-10-12).
# Every run has an identity (artifacts/qa/runs/<RUN_ID>/identity.json) and PROVES that the servers receiving the
# tests are the processes this run started, running the current working-tree code from env-free copies.
set -euo pipefail
set -m   # job control: each background job is its own process group
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
. "$ROOT/scripts/support/evidence-lib.sh"
RUN_ART="$(evidence_new_dir "$ROOT/artifacts/qa/runs" "$RUN_ID")" || exit 1
API_PORT=3101; WEB_PORT=3100

cd "$ROOT/backend"
ENV_FILE=".env.test.local"
[ -f "$ENV_FILE" ] || { echo "missing backend/$ENV_FILE (run backend/scripts/test-db.sh init-env)"; exit 1; }
set -a; . "./$ENV_FILE"; set +a
cd "$ROOT"

fail() { echo "E2E RUN $RUN_ID REFUSED/FAILED: $*" | tee -a "$RUN_ART/outcome.txt"; exit 1; }

# ---- 1. database target (component-wise validation, NF-1; marker and container checked below) ----------------
# The same validator as backend/scripts/test-db.sh: a glob over the whole string accepted a remote authority followed by
# a local-looking tail. The CANONICAL URL it returns is the only value handed to the API process.
if ! CANON_URL="$(TEST_DB_USER="$TEST_DB_USER" TEST_DB_PORT="$TEST_DB_PORT" TEST_DB_NAME="$TEST_DB_NAME" python3 -I "$ROOT/backend/scripts/validate-db-url.py" 2>"$RUN_ART/db-url-refusal.txt")"; then
  fail "DATABASE_URL does not point to the authorized local test database ($(head -1 "$RUN_ART/db-url-refusal.txt"))"
fi
rm -f "$RUN_ART/db-url-refusal.txt"
DATABASE_URL="$CANON_URL"; export DATABASE_URL
# the container publishing this port on loopback must be OUR container (not a lookalike or a remote tunnel)
[ "$(docker port anclora-impulso-test-postgres 5432/tcp 2>/dev/null | head -1)" = "127.0.0.1:$TEST_DB_PORT" ] \
  || fail "docker port of anclora-impulso-test-postgres is not 127.0.0.1:$TEST_DB_PORT"
MARKER="$(docker exec -i anclora-impulso-test-postgres psql -U "$TEST_DB_USER" -d "$TEST_DB_NAME" -Atc "select current_setting('anclora.test_marker', true)")"
[ "$MARKER" = "impulso-test-v1" ] || fail "test marker missing on live database"
DB_CONTAINER_ID="$(docker inspect -f '{{.Id}}' anclora-impulso-test-postgres | cut -c1-12)"
DB_POSTMASTER_START="$(docker exec -i anclora-impulso-test-postgres psql -U "$TEST_DB_USER" -d "$TEST_DB_NAME" -Atc "select pg_postmaster_start_time()")"
echo "run $RUN_ID | db 127.0.0.1:$TEST_DB_PORT/$TEST_DB_NAME marker ok container=$DB_CONTAINER_ID"

# ---- 2. ports must be free (necessary, NOT sufficient: identity is verified below) --------------------------
for port in $API_PORT $WEB_PORT; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then fail "port $port already in use"; fi
done

# ---- 3. synthetic catalogue (idempotent) --------------------------------------------------------------------
docker exec -i anclora-impulso-test-postgres psql -v ON_ERROR_STOP=1 -U "$TEST_DB_USER" -d "$TEST_DB_NAME" -q <<'SQL'
INSERT INTO exercises (id, name, category, "muscleGroup", equipment, "trainingEnvironments", difficulty, description, instructions, "updatedAt")
SELECT gen_random_uuid()::text, 'E2E ' || d || ' ' || e || ' ' || g, 'strength',
       (ARRAY['chest','back','legs','core','shoulders','arms'])[1 + (g % 6)], 'bodyweight',
       ARRAY[e], d, 'synthetic e2e exercise', ARRAY['synthetic'], now()
FROM unnest(ARRAY['beginner','intermediate','advanced']) d,
     unnest(ARRAY['home','gym','outdoor']) e,
     generate_series(0, 11) g
WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE name LIKE 'E2E %');
SQL

# ---- 4. fresh, env-free copies of the CURRENT working tree -------------------------------------------------
WORK="$(mktemp -d)"
BCLONE="$WORK/api"; FCLONE="$WORK/web"
"$ROOT/scripts/support/clone-backend.sh" "$BCLONE"          # fidelity-checked; no env files; no build output
"$ROOT/scripts/support/make-run-dir.sh" "$FCLONE"
[ ! -e "$FCLONE/.next" ] || fail "frontend copy already contains build output"
CODE_ID="$("$ROOT/scripts/support/code-identity.sh")"
# frontend copy fidelity (same working tree)
for entry in app components hooks lib public middleware.ts next.config.mjs postcss.config.mjs tsconfig.json package.json; do
  diff -rq "$ROOT/$entry" "$FCLONE/$entry" >/dev/null || fail "frontend copy differs from working tree at $entry"
done

# ---- 5. start servers (shielded env, no operational files reachable) ---------------------------------------
descendants() { local p="$1" c; for c in $(pgrep -P "$p" 2>/dev/null || true); do echo "$c"; descendants "$c"; done; }
SHIELD=(); while IFS= read -r a; do SHIELD+=("$a"); done < <("$ROOT/scripts/support/shield-env.sh")

# E2E_FAKE_OAUTH=1: simulated Google/GitHub (no network): the API process preloads e2e/support/fake-oauth-providers.cjs,
# which answers the provider token/userinfo endpoints for synthetic codes; the browser leg is intercepted by Playwright.
FAKE_OAUTH_ENV=(); WEB_OAUTH_ENV=()
if [ "${E2E_FAKE_OAUTH:-0}" = "1" ]; then
  FAKE_OAUTH_ENV=(NODE_OPTIONS="--require $ROOT/e2e/support/fake-oauth-providers.cjs"
    GOOGLE_OAUTH_CLIENT_ID=synthetic-google GOOGLE_OAUTH_CLIENT_SECRET=synthetic GOOGLE_OAUTH_CALLBACK_URL="http://127.0.0.1:$API_PORT/api/auth/google/callback"
    GITHUB_OAUTH_CLIENT_ID=synthetic-github GITHUB_OAUTH_CLIENT_SECRET=synthetic GITHUB_OAUTH_CALLBACK_URL="http://127.0.0.1:$API_PORT/api/auth/github/callback")
  WEB_OAUTH_ENV=(NEXT_PUBLIC_ENABLE_GOOGLE_AUTH=true NEXT_PUBLIC_ENABLE_GITHUB_AUTH=true)
fi

( cd "$BCLONE/backend" && exec env -i PATH="$PATH" HOME="$HOME" "${SHIELD[@]}" NODE_ENV=development PORT=$API_PORT \
    ${FAKE_OAUTH_ENV[@]+"${FAKE_OAUTH_ENV[@]}"} \
    DATABASE_URL="$DATABASE_URL" JWT_SECRET="$JWT_SECRET" JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
    JWT_EXPIRES_IN="${E2E_JWT_EXPIRES_IN:-5s}" AUTH_REFRESH_REUSE_GRACE_SECONDS=10 \
    FRONTEND_URL="http://127.0.0.1:$WEB_PORT,http://localhost:$WEB_PORT" \
    LLM_COACH_ENABLED=true LLM_PROVIDER=deterministic LLM_COACH_CACHE_TTL_SECONDS=0 \
    IDEMPOTENCY_KEY_ENFORCEMENT=require AUTH_ACCEPT_LEGACY_TOKENS=false SECURITY_CONFIG_MODE=enforce \
    ./node_modules/.bin/tsx src/server.ts ) > "$RUN_ART/api.log" 2>&1 &
API_PID=$!

( cd "$FCLONE" && exec env -i PATH="$PATH" HOME="$HOME" NEXT_TELEMETRY_DISABLED=1 \
    NEXT_PUBLIC_API_URL="http://127.0.0.1:$API_PORT/api" ${WEB_OAUTH_ENV[@]+"${WEB_OAUTH_ENV[@]}"} \
    ./node_modules/.bin/next dev -p $WEB_PORT -H 127.0.0.1 ) > "$RUN_ART/web.log" 2>&1 &
WEB_PID=$!

cleanup() {
  local all="$API_PID $WEB_PID $(descendants "$API_PID") $(descendants "$WEB_PID")"
  for p in $API_PID $WEB_PID; do kill -TERM -- "-$p" 2>/dev/null || true; done
  for p in $all; do kill -TERM "$p" 2>/dev/null || true; done
  sleep 2
  local alive=""
  for p in $all; do kill -0 "$p" 2>/dev/null && alive="$alive $p"; done
  for p in $alive; do kill -KILL "$p" 2>/dev/null || true; done
  sleep 1
  local still=""
  for p in $all; do kill -0 "$p" 2>/dev/null && still="$still $p"; done
  echo "own processes: started={$all } force-killed={$alive } still-alive={$still }" | tee -a "$RUN_ART/outcome.txt"
  mkdir -p "$RUN_ART/api-winston-logs"; cp "$BCLONE"/backend/logs/*.log "$RUN_ART/api-winston-logs/" 2>/dev/null || true
  # integrity manifest: later modification of this run's evidence becomes detectable
  evidence_manifest_write "$RUN_ART" || true
  rm -rf "$WORK"
}
trap cleanup EXIT

wait_for() { for _ in $(seq 1 90); do curl -fs -o /dev/null "$1" && return 0; sleep 1; done; fail "timeout waiting for $1"; }
wait_for "http://127.0.0.1:$API_PORT/health/live"
wait_for "http://127.0.0.1:$WEB_PORT/auth/login"

# ---- 6. server identity: the listener IS our process, from OUR directory, and answers OUR marker request ------
real() { ( cd "$1" && pwd -P ); }
verify_server() {  # name port rootpid expected_cwd logfile
  local name="$1" port="$2" root="$3" cwd_expected="$4" logfile="$5"
  local listener tree
  listener="$(lsof -nP -iTCP:$port -sTCP:LISTEN -t | head -1)"
  [ -n "$listener" ] || fail "$name: nothing listens on :$port"
  tree="$root $(descendants "$root" | tr '\n' ' ')"
  case " $tree " in *" $listener "*) ;; *) fail "$name: listener pid $listener on :$port is NOT in the process tree this run started ($tree)" ;; esac
  local cwd_actual
  cwd_actual="$(lsof -a -p "$listener" -d cwd -Fn 2>/dev/null | sed -n 's/^n//p' | head -1)"
  [ "$(cd "$cwd_actual" && pwd -P)" = "$(real "$cwd_expected")" ] || fail "$name: listener cwd '$cwd_actual' != expected '$cwd_expected'"
  curl -s -o /dev/null "http://127.0.0.1:$port/__run-$RUN_ID" || true
  for _ in $(seq 1 20); do grep -q "__run-$RUN_ID" "$logfile" && break; sleep 0.5; done
  grep -q "__run-$RUN_ID" "$logfile" || fail "$name: the unique request did not appear in THIS run's log (another server answered)"
  echo "$listener"
}
API_LISTENER="$(verify_server api $API_PORT $API_PID "$BCLONE/backend" "$RUN_ART/api.log")"
WEB_LISTENER="$(verify_server web $WEB_PORT $WEB_PID "$FCLONE" "$RUN_ART/web.log")"
echo "identity verified: api listener=$API_LISTENER web listener=$WEB_LISTENER (own tree, own cwd, own marker request)"

# ---- 7. warm-up (cold dev build) ---------------------------------------------------------------------------
for pass in 1 2; do
  for route in /auth/login /dashboard /workouts/generate /workouts/00000000-0000-0000-0000-000000000000; do
    html="$(curl -s --max-time 180 "http://127.0.0.1:$WEB_PORT$route" || true)"
    echo "$html" | grep -oE '/_next/static/[^"]+\.(css|js)[^"]*' | sort -u | while read -r asset; do
      curl -s -o /dev/null --max-time 120 "http://127.0.0.1:$WEB_PORT$asset" || true
    done
  done
done

# ---- 8. identity record -------------------------------------------------------------------------------------
RUN_ID="$RUN_ID" CODE_ID="$CODE_ID" API_PID="$API_PID" WEB_PID="$WEB_PID" API_LISTENER="$API_LISTENER" WEB_LISTENER="$WEB_LISTENER" \
API_TREE="$API_PID $(descendants "$API_PID")" WEB_TREE="$WEB_PID $(descendants "$WEB_PID")" \
DB_HOST=127.0.0.1 DB_PORT="$TEST_DB_PORT" DB_NAME="$TEST_DB_NAME" DB_CONTAINER_ID="$DB_CONTAINER_ID" DB_POSTMASTER_START="$DB_POSTMASTER_START" \
API_PORT="$API_PORT" WEB_PORT="$WEB_PORT" JWT_TTL="${E2E_JWT_EXPIRES_IN:-5s}" RUN_ART="$RUN_ART" python3 - <<'PY'
import json, os, datetime
e = os.environ
identity = {
  "runId": e["RUN_ID"],
  "kind": "e2e",
  "startedAtUtc": datetime.datetime.utcnow().isoformat() + "Z",
  "code": json.loads(e["CODE_ID"]),
  "copies": {"api": "fresh clone (cp -c node_modules), no .env*, fidelity-checked", "web": "fresh copy, no .env*, no .next before start"},
  "processes": {
    "scriptPid": os.getppid(),
    "api": {"rootPid": int(e["API_PID"]), "listenerPid": int(e["API_LISTENER"]), "tree": [int(x) for x in e["API_TREE"].split()]},
    "web": {"rootPid": int(e["WEB_PID"]), "listenerPid": int(e["WEB_LISTENER"]), "tree": [int(x) for x in e["WEB_TREE"].split()]},
  },
  "serverIdentityChecks": ["listener pid in own process tree", "listener cwd equals own copy", "unique request seen in own log"],
  "effectiveTargets": {
    "database": {"host": e["DB_HOST"], "port": int(e["DB_PORT"]), "name": e["DB_NAME"], "marker": "impulso-test-v1",
                 "containerId": e["DB_CONTAINER_ID"], "postmasterStart": e["DB_POSTMASTER_START"]},
    "api": f"http://127.0.0.1:{e['API_PORT']}", "web": f"http://127.0.0.1:{e['WEB_PORT']}",
    "ai": {"provider": "deterministic", "groqApiKey": "predefined empty (shield)"},
    "oauth": {"clientIds": "predefined empty (shield)"},
    "notifications": {"smtp": "predefined empty (shield)"},
  },
  "configuration": {"idempotencyKey": "require", "legacyTokens": False, "securityConfigMode": "enforce", "accessTokenTtl": e["JWT_TTL"]},
}
open(os.path.join(e["RUN_ART"], "identity.json"), "w").write(json.dumps(identity, indent=2))
PY

# ---- 9. tests -------------------------------------------------------------------------------------------------
cd "$ROOT"
set +e
env -i PATH="$PATH" HOME="$HOME" \
  BASE_URL="http://127.0.0.1:$WEB_PORT" API_URL="http://127.0.0.1:$API_PORT/api" \
  E2E_DB_USER="$TEST_DB_USER" E2E_DB_NAME="$TEST_DB_NAME" E2E_JWT_EXPIRES_IN="${E2E_JWT_EXPIRES_IN:-5s}" \
  E2E_RUN_ID="$RUN_ID" E2E_ARTIFACT_DIR="$RUN_ART" \
  pnpm exec playwright test --reporter=list --workers=1 --output "$RUN_ART/test-results" "$@" 2>&1 | tee "$RUN_ART/playwright.log"
CODE=${PIPESTATUS[0]}
set -e
echo "exit=$CODE" >> "$RUN_ART/outcome.txt"
echo "run $RUN_ID finished with exit $CODE (artifacts: artifacts/qa/runs/$RUN_ID)"
exit "$CODE"
