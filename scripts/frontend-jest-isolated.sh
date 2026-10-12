#!/usr/bin/env bash
# Runs the FRONTEND Jest suite from an env-free copy of the working tree (next/jest would otherwise load the operational
# .env.local). Each run gets a NEW evidence directory with identity.json and MANIFEST.sha256.
#   scripts/frontend-jest-isolated.sh [jest args]      (e.g. __tests__/lib/oauth-handoff.test.ts)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
. "$ROOT/scripts/support/evidence-lib.sh"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
ART="$(evidence_new_dir "$ROOT/artifacts/qa/frontend-jest" "$RUN_ID")" || exit 1
WORK="$(mktemp -d)"
"$ROOT/scripts/support/make-run-dir.sh" "$WORK"
for entry in __tests__ data jest.config.js jest.setup.js; do cp -R "$ROOT/$entry" "$WORK/$entry"; done
IDENT="$("$ROOT/scripts/support/code-identity.sh")"
set +e
( cd "$WORK" && env -i HOME="$HOME" PATH="$PATH" TERM="${TERM:-dumb}" NODE_ENV=test NEXT_TELEMETRY_DISABLED=1 \
    ./node_modules/.bin/jest --ci --runInBand "$@" ) > "$ART/jest.log" 2>&1
CODE=$?
set -e
RUN_ID="$RUN_ID" IDENT="$IDENT" CODE="$CODE" ART="$ART" ARGS="$*" python3 - <<'PY'
import json, os, datetime
e = os.environ
open(os.path.join(e["ART"], "identity.json"), "w").write(json.dumps({
  "runId": e["RUN_ID"], "kind": "frontend-jest", "args": e["ARGS"],
  "finishedAtUtc": datetime.datetime.utcnow().isoformat() + "Z",
  "code": json.loads(e["IDENT"]), "exitCode": int(e["CODE"]),
  "copy": "whitelisted frontend sources + __tests__, no .env*; env -i",
}, indent=2))
PY
evidence_manifest_write "$ART" || true
rm -rf "$WORK"
echo "[frontend-jest] exit $CODE; evidence: $ART"
exit "$CODE"
