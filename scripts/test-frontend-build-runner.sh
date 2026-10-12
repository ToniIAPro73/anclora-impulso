#!/usr/bin/env bash
# Failure-injection tests of scripts/frontend-build-isolated.sh: the runner must exit non-zero AND record result=fail when
#   (1) the network barrier is not effective (probe reaches the sentinel), or
#   (2) a font CSS URL is not served by the mock (build cannot complete).
# The positive case is the normal run of the runner itself. Each run writes its own evidence directory.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
pass=0; fail=0
check() { # name hook
  local name="$1" hook="$2" before after code dir result
  before="$(ls "$ROOT/artifacts/qa/frontend-build" 2>/dev/null | sort | tail -1)"
  FRONTEND_BUILD_TEST_HOOK="$hook" bash "$ROOT/scripts/frontend-build-isolated.sh" >/dev/null 2>&1; code=$?
  after="$(ls "$ROOT/artifacts/qa/frontend-build" | sort | tail -1)"
  dir="$ROOT/artifacts/qa/frontend-build/$after"
  result="$(python3 -I -c "import json;print(json.load(open('$dir/identity.json'))['result'])" 2>/dev/null)"
  if [ "$code" -ne 0 ] && [ "$after" != "$before" ] && [ "$result" = "fail" ]; then
    echo "PASS  $name (runner exit $code, result=$result, evidence $after)"; pass=$((pass+1))
  else
    echo "FAIL  $name (runner exit $code, result=${result:-none}, evidence ${after:-none})"; fail=$((fail+1))
  fi
}
check "inactive/ineffective barrier makes the runner fail" open-barrier
check "unserved font CSS makes the runner fail" refuse-font-css
echo "passed=$pass failed=$fail"
[ "$fail" -eq 0 ]
