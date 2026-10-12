#!/usr/bin/env bash
# Minimal test of the evidence-preservation helpers with SYNTHETIC files only (no application, no servers, no DB).
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
. "$ROOT/scripts/support/evidence-lib.sh"
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT
pass=0; failn=0
ok()  { echo "PASS  $1"; pass=$((pass+1)); }
bad() { echo "FAIL  $1"; failn=$((failn+1)); }

# 1. first run directory is created
A="$(evidence_new_dir "$T/runs" "run-A")" && [ -d "$A" ] && ok "creates a new run directory" || bad "creates a new run directory"
printf 'result=alpha\n' > "$A/result.txt"; printf 'log-A\n' > "$A/api.log"; mkdir "$A/sub"; printf 'shot-A\n' > "$A/sub/shot.png"
evidence_manifest_write "$A"

# 2. creating the same directory again is refused and leaves the evidence untouched
H1="$(shasum -a 256 "$A/result.txt" | cut -d' ' -f1)"
if evidence_new_dir "$T/runs" "run-A" >/dev/null 2>&1; then bad "existing run directory is refused"; else ok "existing run directory is refused"; fi
[ "$(shasum -a 256 "$A/result.txt" | cut -d' ' -f1)" = "$H1" ] && ok "refusal leaves existing evidence unchanged" || bad "refusal leaves existing evidence unchanged"

# 3. a second run with the SAME file names does not touch the first run's files
B="$(evidence_new_dir "$T/runs" "run-B")" && ok "second run gets its own directory" || bad "second run gets its own directory"
printf 'result=beta\n' > "$B/result.txt"; printf 'log-B\n' > "$B/api.log"
evidence_manifest_write "$B"
[ "$(cat "$A/result.txt")" = "result=alpha" ] && [ "$(cat "$A/api.log")" = "log-A" ] && ok "first run's files are preserved after the second run" || bad "first run's files are preserved after the second run"
[ "$(cat "$B/result.txt")" = "result=beta" ] && ok "second run has its own content" || bad "second run has its own content"

# 4. manifest validation: untouched passes; modification, addition and removal are detected
evidence_manifest_verify "$A" 2>/dev/null && ok "manifest verifies an untouched run" || bad "manifest verifies an untouched run"
printf 'tampered\n' >> "$A/result.txt"
evidence_manifest_verify "$A" 2>/dev/null && bad "modified file is detected" || ok "modified file is detected"
printf 'result=alpha\n' > "$A/result.txt"
evidence_manifest_verify "$A" 2>/dev/null && ok "restoring the content makes the manifest verify again" || bad "restoring the content makes the manifest verify again"
printf 'extra\n' > "$A/extra.txt"
evidence_manifest_verify "$A" 2>/dev/null && bad "added file is detected" || ok "added file is detected"
rm "$A/extra.txt"
rm "$A/sub/shot.png"
evidence_manifest_verify "$A" 2>/dev/null && bad "removed file is detected" || ok "removed file is detected"
evidence_manifest_verify "$T/runs/does-not-exist" 2>/dev/null && bad "missing manifest is an error" || ok "missing manifest is an error"

# 5. the manifest file itself is not listed (no self-reference)
grep -q "MANIFEST.sha256" "$B/MANIFEST.sha256" && bad "manifest does not list itself" || ok "manifest does not list itself"

echo; echo "passed=$pass failed=$failn"
[ "$failn" -eq 0 ]
