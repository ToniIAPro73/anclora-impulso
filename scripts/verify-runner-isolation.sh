#!/usr/bin/env bash
# Verifies, by OBSERVING the real processes, that operational env files contribute no configuration to the processes
# the E2E/integration runners start. No secret value is read or printed: only file PATHS accessed and variable NAMES
# added to process.env after startup (scripts/support/env-probe.cjs). Every phase also proves that the process it
# probes is the one it started (listener pid in own tree), so a stale server cannot produce a vacuous pass.
#
#  C1  control (Next):   env-free copy WITH decoy .env/.env.local            -> decoys MUST be applied
#  R1  runner (Next):    runner's env-free copy; repository root holds the operational .env.local plus a decoy
#                        .env.development.local                           -> nothing applied, no root .env* touched
#  C2  control (API):    backend clone WITH a decoy .env defining a NEW name that is NOT in the shield list, shield ON
#                        -> the decoy MUST be applied: shielding by name alone is not isolation
#  R2  runner (API):     backend clone without .env, shield OFF           -> nothing applied, the operational
#                        backend/.env is never stat'ed or read (the real mechanism: it is not in the loader's path)
set -euo pipefail
set -m
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
. "$ROOT/scripts/support/evidence-lib.sh"
OUT="$(evidence_new_dir "$ROOT/artifacts/qa/isolation" "$RUN_ID")" || exit 1
PROBE="$ROOT/scripts/support/env-probe.cjs"
DECOY="DECOY_$(date +%s)_$RANDOM"
PLANTED=(); STARTED=(); TMPS=()
fail=0
check() { if [ "$2" = "ok" ]; then echo "PASS  $1"; else echo "FAIL  $1"; fail=1; fi; }
descendants() { local p="$1" c; for c in $(pgrep -P "$p" 2>/dev/null || true); do echo "$c"; descendants "$c"; done; }

cleanup() {
  evidence_manifest_write "$OUT" 2>/dev/null || true
  for p in "${STARTED[@]:-}"; do [ -n "$p" ] || continue; for d in $p $(descendants "$p"); do kill -TERM "$d" 2>/dev/null || true; done; kill -TERM -- "-$p" 2>/dev/null || true; done
  sleep 1
  for p in "${STARTED[@]:-}"; do [ -n "$p" ] || continue; for d in $p $(descendants "$p"); do kill -KILL "$d" 2>/dev/null || true; done; done
  for f in "${PLANTED[@]:-}"; do [ -n "$f" ] && rm -f "$f"; done
  for d in "${TMPS[@]:-}"; do [ -n "$d" ] && rm -rf "$d"; done
}
trap cleanup EXIT

for port in 3120 3121 3122 3123; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then echo "refusing: port $port in use"; exit 1; fi
done

# start_and_probe <label> <port> <cwd> <log> <cmd...>   (env is passed through the caller's environment array E)
# Short-lived helper processes (esbuild, workers) dump their own env-added line on exit, so the first dump is not
# proof that the server is up: wait for the port to listen, then for the probe's timed dump of the main process.
wait_dump() {  # logfile port dump_ms
  for _ in $(seq 1 120); do lsof -nP -iTCP:"$2" -sTCP:LISTEN >/dev/null 2>&1 && break; sleep 0.5; done
  sleep $(( $3 / 1000 + 2 ))
}
added_names() { grep '^env-added' "$1" | awk -F'\t' '{print $3}' | tr ',' '\n' | grep -v '^$' | sort -u; }
own_listener() {  # port rootpid -> 0 when the port's listener belongs to the tree started here
  local l; l="$(lsof -nP -iTCP:$1 -sTCP:LISTEN -t 2>/dev/null | head -1)"; [ -n "$l" ] || return 1
  local tree; tree="$2 $(descendants "$2" | tr '\n' ' ')"
  case " $tree " in *" $l "*) return 0 ;; esac
  echo "      (debug) listener=$l root=$2 tree=[$tree] ppid_of_listener=$(ps -o ppid= -p "$l" | tr -d ' ')" >&2
  return 1
}

# ---- C1 ------------------------------------------------------------------------------------------------------
D1="$(mktemp -d)"; TMPS+=("$D1"); "$ROOT/scripts/support/make-run-dir.sh" "$D1"
printf '%s_LOCAL=control-local\nNEXT_PUBLIC_%s_PUBLIC=control-public\n' "$DECOY" "$DECOY" > "$D1/.env.local"
printf '%s_ENV=control-env\n' "$DECOY" > "$D1/.env"
LOG="$OUT/c1.log"; : > "$LOG"
( cd "$D1" && exec env -i PATH="$PATH" HOME="$HOME" NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--require=$PROBE" \
    ENV_PROBE_LOG="$LOG" ENV_PROBE_DUMP_MS=9000 "$ROOT/node_modules/.bin/next" dev -p 3120 -H 127.0.0.1 ) > "$OUT/c1.stdout" 2>&1 &
P=$!; STARTED+=("$P"); wait_dump "$LOG" 3120 9000
if own_listener 3120 "$P"; then check "C1 control: listener on :3120 is the process started here" ok; else check "C1 control: listener on :3120 is the process started here" bad; fi
if added_names "$LOG" | grep -q "$DECOY"; then check "C1 control: decoys from .env/.env.local ARE applied when isolation is absent (the probe sees leakage)" ok
else check "C1 control: decoys from .env/.env.local ARE applied when isolation is absent (the probe sees leakage)" bad; fi
kill -TERM -- "-$P" 2>/dev/null || true; sleep 1

# ---- R1 ------------------------------------------------------------------------------------------------------
DEC_ROOT="$ROOT/.env.development.local"
[ -e "$DEC_ROOT" ] && { echo "refusing: $DEC_ROOT exists"; exit 1; }
printf '%s_ROOT=must-not-apply\n' "$DECOY" > "$DEC_ROOT"; PLANTED+=("$DEC_ROOT")
R1="$(mktemp -d)"; TMPS+=("$R1"); "$ROOT/scripts/support/make-run-dir.sh" "$R1"
LOG="$OUT/r1.log"; : > "$LOG"
( cd "$R1" && exec env -i PATH="$PATH" HOME="$HOME" NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS="--require=$PROBE" \
    ENV_PROBE_LOG="$LOG" ENV_PROBE_DUMP_MS=9000 NEXT_PUBLIC_API_URL="http://127.0.0.1:3101/api" \
    "$ROOT/node_modules/.bin/next" dev -p 3121 -H 127.0.0.1 ) > "$OUT/r1.stdout" 2>&1 &
P=$!; STARTED+=("$P"); wait_dump "$LOG" 3121 9000
if own_listener 3121 "$P"; then check "R1 runner: listener on :3121 is the process started here" ok; else check "R1 runner: listener on :3121 is the process started here" bad; fi
NAMES="$(added_names "$LOG" || true)"
if echo "$NAMES" | grep -q "$DECOY"; then check "R1 runner: decoy at the repo root was NOT applied" bad; else check "R1 runner: decoy at the repo root was NOT applied" ok; fi
UNEXPECTED="$(echo "$NAMES" | grep -vE '^(NEXT_RUNTIME|NODE_ENV|__NEXT_[A-Z_]+|NEXT_[A-Z_]+|PORT|HOSTNAME)$' || true)"
if [ -z "$UNEXPECTED" ]; then check "R1 runner: no variable from any env file was added" ok; else check "R1 runner: no variable from any env file was added ($(echo "$UNEXPECTED" | wc -l | tr -d ' ') names)" bad; fi
if grep '^access' "$LOG" | awk -F'\t' '{print $3}' | grep -q "^$ROOT/"; then check "R1 runner: no repository-root .env* path was stat'ed or read" bad; else check "R1 runner: no repository-root .env* path was stat'ed or read" ok; fi
kill -TERM -- "-$P" 2>/dev/null || true; rm -f "$DEC_ROOT"; sleep 1

# ---- API phases ------------------------------------------------------------------------------------------------
set -a; . "$ROOT/backend/.env.test.local"; set +a
SHIELD=(); while IFS= read -r a; do SHIELD+=("$a"); done < <("$ROOT/scripts/support/shield-env.sh")
run_api() {  # label port clone shield(1/0)
  local label="$1" port="$2" clone="$3" use_shield="$4" log="$OUT/$1.log"; : > "$log"
  local S=(); [ "$use_shield" = "1" ] && S=("${SHIELD[@]}")
  ( cd "$clone/backend" && exec env -i PATH="$PATH" HOME="$HOME" ${S[@]+"${S[@]}"} NODE_ENV=development PORT=$port \
      NODE_OPTIONS="--require=$PROBE" ENV_PROBE_LOG="$log" ENV_PROBE_DUMP_MS=8000 \
      DATABASE_URL="$DATABASE_URL" JWT_SECRET="$JWT_SECRET" JWT_REFRESH_SECRET="$JWT_REFRESH_SECRET" \
      ./node_modules/.bin/tsx src/server.ts ) > "$OUT/$label.stdout" 2>&1 &
  LASTPID=$!; STARTED+=("$LASTPID"); wait_dump "$log" "$port" 8000
}

# C2: decoy .env with a name the shield does not know
C2="$(mktemp -d)"; TMPS+=("$C2"); "$ROOT/scripts/support/clone-backend.sh" "$C2"
printf 'DECOY_NEW_NAME_%s=applied-by-loader\n' "$DECOY" > "$C2/backend/.env"
run_api c2 3122 "$C2" 1; P=$LASTPID
if own_listener 3122 "$P"; then check "C2 control: listener on :3122 is the process started here" ok; else check "C2 control: listener on :3122 is the process started here" bad; fi
if added_names "$OUT/c2.log" | grep -q "DECOY_NEW_NAME_$DECOY"; then check "C2 control: a NEW name in .env IS applied even with the shield on (name shielding alone is not isolation)" ok
else check "C2 control: a NEW name in .env IS applied even with the shield on (name shielding alone is not isolation)" bad; fi
kill -TERM -- "-$P" 2>/dev/null || true; sleep 1

# R2: clone without .env, shield OFF
R2="$(mktemp -d)"; TMPS+=("$R2"); "$ROOT/scripts/support/clone-backend.sh" "$R2"
run_api r2 3123 "$R2" 0; P=$LASTPID
if own_listener 3123 "$P"; then check "R2 runner: listener on :3123 is the process started here" ok; else check "R2 runner: listener on :3123 is the process started here" bad; fi
API_NAMES="$(added_names "$OUT/r2.log" || true)"
if [ -z "$API_NAMES" ]; then check "R2 runner: nothing was added to the API process, with the shield OFF" ok
else check "R2 runner: nothing was added to the API process, with the shield OFF ($(echo "$API_NAMES" | wc -l | tr -d ' ') names)" bad; fi
if grep '^access' "$OUT/r2.log" | awk -F'\t' '{print $3}' | grep -q "^$ROOT/backend/\.env"; then check "R2 runner: the operational backend/.env was never stat'ed or read" bad
else check "R2 runner: the operational backend/.env was never stat'ed or read" ok; fi
kill -TERM -- "-$P" 2>/dev/null || true; sleep 1

for port in 3120 3121 3122 3123; do
  if lsof -nP -iTCP:$port -sTCP:LISTEN >/dev/null 2>&1; then check "cleanup: :$port released" bad; fi
done
echo; echo "artifacts: artifacts/qa/isolation/$RUN_ID  (paths and variable names only)"
[ "$fail" -eq 0 ] && echo "ISOLATION VERIFIED (observation-based, identity-checked)" || { echo "ISOLATION NOT VERIFIED"; exit 1; }
