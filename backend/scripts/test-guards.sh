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
DATABASE_URL=$url
JWT_SECRET=decoy
JWT_REFRESH_SECRET=decoy
ENV
  PATH="$T/bin:$PATH" TEST_ENV_FILE="$T/env" FAKE_PORT_OUT="$published" FAKE_MARKER="$marker" \
    bash scripts/test-db.sh $cmd >"$T/out" 2>&1; code=$?
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

# R5: verify-migrations must not mask a failing `migrate deploy`, and must verify the historical row explicitly.
vm_case() { # name pnpm_ok expected_reason_regex
  local name="$1" pnpm_ok="$2" reason="$3" ev; ev="$(mktemp -d)"
  cat > "$T/env" <<ENV
TEST_DB_NAME=anclora_impulso_test
TEST_DB_USER=impulso_test
TEST_DB_PASSWORD=decoy-not-a-secret
TEST_DB_PORT=54329
DATABASE_URL=$GOOD
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
