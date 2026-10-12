#!/usr/bin/env bash
# Negative/positive tests of the effective-target guard of test-db.sh WITHOUT any real connection:
# `docker` and `pnpm` are replaced by recording shims. A guarded command must exit 3 and never invoke `pnpm`
# (i.e. no Prisma operation can start); with a correct target the guard lets the command reach `pnpm`.
set -uo pipefail
cd "$(dirname "$0")/.."
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
mkdir -p "$T/bin"
cat > "$T/bin/pnpm" <<SH
#!/usr/bin/env bash
echo "pnpm \$*" >> "$T/pnpm.calls"
printf '%s\n' "\${DATABASE_URL:-}" | sed -E 's#^([a-z]+://)[^/]*@#\1***@#' >> "$T/pnpm.urls"
if [ -f "$T/pnpm.ok" ]; then echo "All migrations have been successfully applied."; echo "No difference detected."; exit 0; fi
exit 99
SH
cat > "$T/bin/docker" <<SH
#!/usr/bin/env bash
# behaviour is driven by FAKE_PORT_OUT and FAKE_MARKER
case "\$1" in
  port) printf '%s\n' "\${FAKE_PORT_OUT:-}" ;;
  exec) printf '%s\n' "\${FAKE_MARKER:-}" ;;
  *) exit 0 ;;
esac
SH
chmod +x "$T/bin/pnpm" "$T/bin/docker"
pass=0; failn=0
run_case() { # name expected_exit expect_pnpm(yes|no) url published marker command
  local name="$1" exp="$2" expect_pnpm="$3" url="$4" published="$5" marker="$6" cmd="$7"
  : > "$T/pnpm.calls"
  cat > "$T/env" <<ENV
TEST_DB_NAME=anclora_impulso_test
TEST_DB_USER=impulso_test
TEST_DB_PASSWORD=decoy-not-a-secret
TEST_DB_PORT=54329
DATABASE_URL='$url'
JWT_SECRET=decoy
JWT_REFRESH_SECRET=decoy
ENV
  PATH="$T/bin:$PATH" TEST_ENV_FILE="$T/env" FAKE_PORT_OUT="$published" FAKE_MARKER="$marker" \
    VERIFY_MIGRATIONS_EVIDENCE_DIR="$T/vm-evidence" bash scripts/test-db.sh $cmd >"$T/out" 2>&1; code=$?
  local called="no"; [ -s "$T/pnpm.calls" ] && called="yes"
  if [ "$code" = "$exp" ] && [ "$called" = "$expect_pnpm" ]; then echo "PASS  $name (exit $code, pnpm invoked: $called)"; pass=$((pass+1))
  else echo "FAIL  $name (exit $code expected $exp; pnpm invoked: $called expected $expect_pnpm)"; sed 's/^/        /' "$T/out" | head -4; failn=$((failn+1)); fi
}
GOOD="postgresql://impulso_test:decoy@127.0.0.1:54329/anclora_impulso_test?schema=public"
for cmd in migrate verify-migrations; do
  run_case "$cmd: remote host decoy"             3 no  "postgresql://impulso_test:decoy@db.example.invalid:54329/anclora_impulso_test?schema=public" "127.0.0.1:54329" "impulso-test-v1" "$cmd"
  run_case "$cmd: wrong port in URL"             3 no  "postgresql://impulso_test:decoy@127.0.0.1:5432/anclora_impulso_test?schema=public"          "127.0.0.1:54329" "impulso-test-v1" "$cmd"
  run_case "$cmd: wrong database name"           3 no  "postgresql://impulso_test:decoy@127.0.0.1:54329/production?schema=public"                  "127.0.0.1:54329" "impulso-test-v1" "$cmd"
  run_case "$cmd: wrong user"                    3 no  "postgresql://admin:decoy@127.0.0.1:54329/anclora_impulso_test?schema=public"               "127.0.0.1:54329" "impulso-test-v1" "$cmd"
  run_case "$cmd: container not publishing port" 3 no  "$GOOD" ""                "impulso-test-v1" "$cmd"
  run_case "$cmd: container publishes another"   3 no  "$GOOD" "127.0.0.1:5433"  "impulso-test-v1" "$cmd"
  run_case "$cmd: marker absent"                 3 no  "$GOOD" "127.0.0.1:54329" ""               "$cmd"
done
run_case "test: remote host decoy" 3 no "postgresql://impulso_test:decoy@db.example.invalid:54329/anclora_impulso_test?schema=public" "127.0.0.1:54329" "impulso-test-v1" "test"
# positive control: a correct target passes the guard and reaches the (shimmed) prisma invocation
run_case "migrate: correct target reaches pnpm (positive control)" 99 yes "$GOOD" "127.0.0.1:54329" "impulso-test-v1" "migrate"

# NF-1: the guard must judge the authority/path/query COMPONENTS, not a glob over the whole string.
GOODCANON="postgresql://***@127.0.0.1:54329/anclora_impulso_test?schema=public"
PORT_OK="127.0.0.1:54329"; MK="impulso-test-v1"
# NOTE: `test` is deliberately NOT driven here: after the guard it launches clone-backend.sh and the real jest, which
# cannot be shimmed. The `test` branch is covered through check-target (same load_env + assert_target prefix).
for cmd in migrate verify-migrations; do
  run_case "$cmd NF-1: remote authority + local decoy in query" 3 no "postgresql://impulso_test:synthetic@remote.invalid:5432/other?decoy=@127.0.0.1:54329/anclora_impulso_test" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: remote authority + local decoy in path"  3 no "postgresql://impulso_test:synthetic@remote.invalid:5432/x/@127.0.0.1:54329/anclora_impulso_test" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: second @ (local host after remote)"      3 no "postgresql://impulso_test:x@127.0.0.1:54329@remote.invalid:5432/anclora_impulso_test" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: unencoded @ in password"                 3 no "postgresql://impulso_test:p@ss@127.0.0.1:54329/anclora_impulso_test" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: host= parameter"                         3 no "postgresql://impulso_test:s@127.0.0.1:54329/anclora_impulso_test?schema=public&host=remote.invalid" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: hostaddr= parameter"                     3 no "postgresql://impulso_test:s@127.0.0.1:54329/anclora_impulso_test?hostaddr=192.0.2.1" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: port= parameter"                         3 no "postgresql://impulso_test:s@127.0.0.1:54329/anclora_impulso_test?schema=public&port=5432" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: encoded parameter name"                  3 no "postgresql://impulso_test:s@127.0.0.1:54329/anclora_impulso_test?%68ost=remote.invalid" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: repeated schema parameter"               3 no "postgresql://impulso_test:s@127.0.0.1:54329/anclora_impulso_test?schema=public&schema=other" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: other schema value"                      3 no "postgresql://impulso_test:s@127.0.0.1:54329/anclora_impulso_test?schema=other" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: fragment"                                3 no "postgresql://impulso_test:s@127.0.0.1:54329/anclora_impulso_test?schema=public#@remote.invalid" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: localhost name instead of 127.0.0.1"     3 no "postgresql://impulso_test:s@localhost:54329/anclora_impulso_test?schema=public" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: encoded database name"                   3 no "postgresql://impulso_test:s@127.0.0.1:54329/anclora_impulso_tes%74?schema=public" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: wrong protocol (mysql)"                  3 no "mysql://impulso_test:s@127.0.0.1:54329/anclora_impulso_test" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: protocol postgres:// not on the list"    3 no "postgres://impulso_test:s@127.0.0.1:54329/anclora_impulso_test" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: malformed (no authority)"                3 no "postgresql:impulso_test@127.0.0.1:54329/anclora_impulso_test" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: not a URL"                               3 no "not a url" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: empty password"                          3 no "postgresql://impulso_test:@127.0.0.1:54329/anclora_impulso_test" "$PORT_OK" "$MK" "$cmd"
done
# positive controls: canonical URL, URL without query, reserved characters correctly percent-encoded in the password
ENCPW="postgresql://impulso_test:p%40ss%3Aw%2Frd%3F%23%25@127.0.0.1:54329/anclora_impulso_test?schema=public"
for cmd in migrate; do
  run_case "$cmd NF-1: canonical URL reaches pnpm (positive)"        99 yes "$GOOD"  "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: URL without query reaches pnpm (positive)"    99 yes "postgresql://impulso_test:s@127.0.0.1:54329/anclora_impulso_test" "$PORT_OK" "$MK" "$cmd"
  run_case "$cmd NF-1: encoded reserved chars reach pnpm (positive)" 99 yes "$ENCPW" "$PORT_OK" "$MK" "$cmd"
done
# the child receives the validated CANONICAL target, rebuilt from components (query added, original string not forwarded)
last_url() { tail -1 "$T/pnpm.urls" 2>/dev/null; }
: > "$T/pnpm.urls"
run_case "migrate NF-1: URL without query (canonicalised)" 99 yes "postgresql://impulso_test:s@127.0.0.1:54329/anclora_impulso_test" "$PORT_OK" "$MK" "migrate"
if [ "$(last_url)" = "$GOODCANON" ]; then echo "PASS  NF-1: migrate child receives the canonical validated URL"; pass=$((pass+1))
else echo "FAIL  NF-1: migrate child URL is '$(last_url)' (expected $GOODCANON)"; failn=$((failn+1)); fi
# verify-migrations rebuilds its own URLs from validated components: only throw-away databases of the SAME local endpoint
: > "$T/pnpm.urls"
run_case "verify-migrations NF-1: correct target reaches the (shimmed) first prisma call" 1 yes "$GOOD" "$PORT_OK" "$MK" "verify-migrations"
if [ "$(head -1 "$T/pnpm.urls" 2>/dev/null)" = "postgresql://***@127.0.0.1:54329/anclora_impulso_test_upgrade?schema=public" ]; then
  echo "PASS  NF-1: verify-migrations child receives only the local throw-away database URL"; pass=$((pass+1))
else echo "FAIL  NF-1: verify-migrations first child URL is '$(head -1 "$T/pnpm.urls" 2>/dev/null)'"; failn=$((failn+1)); fi
# `test` shares the load_env + assert_target prefix; check-target runs exactly that prefix and nothing else
for url in "postgresql://impulso_test:synthetic@remote.invalid:5432/other?decoy=@127.0.0.1:54329/anclora_impulso_test" \
           "postgresql://impulso_test:s@127.0.0.1:54329/anclora_impulso_test?schema=public&host=remote.invalid" \
           "postgresql://impulso_test:p@ss@127.0.0.1:54329/anclora_impulso_test"; do
  run_case "check-target NF-1: rejected" 3 no "$url" "$PORT_OK" "$MK" "check-target"
done
run_case "check-target NF-1: canonical accepted (positive)" 0 no "$GOOD" "$PORT_OK" "$MK" "check-target"
run_case "check-target NF-1: encoded reserved chars accepted (positive)" 0 no "$ENCPW" "$PORT_OK" "$MK" "check-target"
# structural: in the `test` branch the guard precedes the clone/jest launch
if awk '/^  test\)/{f=1} f&&/load_env; assert_target/{print "ok"; exit} f&&/clone-backend|jest/{print "late"; exit}' scripts/test-db.sh | grep -q ok; then
  echo "PASS  NF-1: test branch calls the guard before cloning or running jest"; pass=$((pass+1))
else echo "FAIL  NF-1: test branch guard order"; failn=$((failn+1)); fi
# the guard must not echo the URL (password) in its refusal message
: > "$T/pnpm.calls"
cat > "$T/env" <<ENV
TEST_DB_NAME=anclora_impulso_test
TEST_DB_USER=impulso_test
TEST_DB_PASSWORD=x
TEST_DB_PORT=54329
DATABASE_URL='postgresql://impulso_test:SECRET-CANARY-42@remote.invalid:5432/other?a=@127.0.0.1:54329/anclora_impulso_test'
JWT_SECRET=d
JWT_REFRESH_SECRET=d
ENV
PATH="$T/bin:$PATH" TEST_ENV_FILE="$T/env" FAKE_PORT_OUT="$PORT_OK" FAKE_MARKER="$MK" bash scripts/test-db.sh check-target >"$T/out" 2>&1 || true
if grep -q "SECRET-CANARY-42" "$T/out"; then echo "FAIL  NF-1: refusal message leaks the password"; failn=$((failn+1))
else echo "PASS  NF-1: refusal message does not contain the password"; pass=$((pass+1)); fi

# R5: verify-migrations must not mask a failing `migrate deploy`, and must verify the historical row explicitly.
vm_case() { # name pnpm_ok expected_reason_regex
  local name="$1" pnpm_ok="$2" reason="$3" ev; ev="$(mktemp -d)"
  cat > "$T/env" <<ENV
TEST_DB_NAME=anclora_impulso_test
TEST_DB_USER=impulso_test
TEST_DB_PASSWORD=decoy-not-a-secret
TEST_DB_PORT=54329
DATABASE_URL='$GOOD'
JWT_SECRET=decoy
JWT_REFRESH_SECRET=decoy
ENV
  rm -f "$T/pnpm.ok"; [ "$pnpm_ok" = "1" ] && : > "$T/pnpm.ok"   # (env -i inside the script hides env vars from the shim)
  PATH="$T/bin:$PATH" TEST_ENV_FILE="$T/env" FAKE_PORT_OUT="127.0.0.1:54329" FAKE_MARKER="impulso-test-v1" \
    VERIFY_MIGRATIONS_EVIDENCE_DIR="$ev" bash scripts/test-db.sh verify-migrations >"$T/out" 2>&1; code=$?
  local idf; idf="$(ls "$ev"/*/identity.json 2>/dev/null | head -1)"
  if [ "$code" != "0" ] && [ -n "$idf" ] && grep -q '"result": "fail"' "$idf" && grep -Eq "$reason" "$idf" && [ -f "$(dirname "$idf")/MANIFEST.sha256" ]; then
    echo "PASS  $name (exit $code, evidence+identity+manifest written, result=fail)"; pass=$((pass+1))
  else
    echo "FAIL  $name (exit $code; identity: ${idf:-none})"; sed 's/^/        /' "$T/out" | tail -4; failn=$((failn+1))
  fi
  rm -rf "$ev"
}
vm_case "verify-migrations: failing migrate deploy is NOT ignored" 0 "exited with status 99"
vm_case "verify-migrations: wrong historical row fails explicitly"  1 "historical row expected"
echo; echo "passed=$pass failed=$failn"
[ "$failn" -eq 0 ]
