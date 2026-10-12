#!/usr/bin/env bash
# `next build` of the CURRENT frontend sources, ISOLATED FROM THE NETWORK, from an env-free copy (no .env*).
#
# Barrier: macOS Seatbelt (`sandbox-exec`) denies every network operation of the build and ALL its children; only unix
# sockets stay allowed (no loopback, no DNS). It is an OS-level, preventive barrier independent of the font mock. It is
# proven BEFORE the build by scripts/support/net-probe.cjs (blocked connect to a LOCAL sentinel with a connection counter,
# plus an unsandboxed control that does reach it). If sandbox-exec is missing or any probe fails, the runner FAILS.
#
# Fonts: next/font/google asks fonts.googleapis.com for CSS (mocked through NEXT_FONT_GOOGLE_MOCKED_RESPONSES; every
# consulted URL is logged) and then fetches the font FILES. In Next 14.2.16 fetchFontFile() with that variable set never
# touches the network: an absolute path is read from disk. The synthetic CSS therefore references ONLY a local fixture
# file, and the emitted .woff2 assets are compared with the fixture hash afterwards.
#
# New evidence directory per run: identity.json, summary-build.log.txt, font-mock-requests.json, network-guard.json,
# MANIFEST.sha256. No `|| true` hides a failure: any failed check yields a non-zero exit and result=fail.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
. "$ROOT/scripts/support/evidence-lib.sh"
RUN_ID="$(date -u +%Y%m%dT%H%M%SZ)-$(openssl rand -hex 4)"
ART="$(evidence_new_dir "$ROOT/artifacts/qa/frontend-build" "$RUN_ID")" || exit 1
WORK="$(mktemp -d)"
RESULT="fail"; REASON="aborted before completion"; BUILD_CODE=-1
finish() {
  local rc=$?
  [ -d "$WORK" ] && rm -rf "$WORK"
  [ "$RESULT" = "pass" ] && rc=0 || { [ "$rc" -ne 0 ] || rc=1; }
  RUN_ID="$RUN_ID" RESULT="$RESULT" REASON="$REASON" BUILD_CODE="$BUILD_CODE" ART="$ART" IDENT="${IDENT:-{\}}" \
  NEXT_VERSION="${NEXT_VERSION:-unknown}" NODE_VERSION="${NODE_VERSION:-unknown}" CMD_LINE="${CMD_LINE:-}" python3 - <<'PY'
import json, os, datetime
e = os.environ
open(os.path.join(e["ART"], "identity.json"), "w").write(json.dumps({
  "runId": e["RUN_ID"], "kind": "frontend-build-isolated",
  "finishedAtUtc": datetime.datetime.utcnow().isoformat() + "Z",
  "result": e["RESULT"], "reason": e["REASON"], "buildExitCode": int(e["BUILD_CODE"]),
  "code": json.loads(e["IDENT"] or "{}"),
  "node": e["NODE_VERSION"], "next": e["NEXT_VERSION"], "command": e["CMD_LINE"],
  "isolation": "macOS Seatbelt (sandbox-exec): deny network*, DNS resolver socket/mach services denied, other unix sockets allowed; font CSS mocked, font files read from a local fixture",
  "copy": "whitelisted frontend sources, fidelity-checked, no .env*, copy removed after the run",
}, indent=2))
PY
  evidence_manifest_write "$ART" || rc=1
  echo "[frontend-build] result=$RESULT ($REASON); evidence: $ART"
  exit "$rc"
}
trap finish EXIT
fail() { REASON="$1"; echo "frontend-build: $1" >&2; exit 1; }

command -v /usr/bin/sandbox-exec >/dev/null 2>&1 || fail "sandbox-exec not available: network isolation cannot be established"
NODE_VERSION="$(node -v)"
NEXT_VERSION="$(cd "$ROOT" && node -p "require('next/package.json').version")"

"$ROOT/scripts/support/make-run-dir.sh" "$WORK/app" || fail "cannot create the build copy"
for entry in app components hooks lib public middleware.ts next.config.mjs postcss.config.mjs tsconfig.json package.json; do
  diff -rq "$ROOT/$entry" "$WORK/app/$entry" >/dev/null || fail "copy differs from the working tree at $entry"
done
if find "$WORK/app" -maxdepth 2 -name '.env*' -not -path '*/node_modules/*' | grep -q .; then fail "env file in the build copy"; fi
IDENT="$("$ROOT/scripts/support/code-identity.sh")" || fail "cannot compute the code identity"

# ---- 1. network barrier + probes (BEFORE the build) ------------------------------------------------------------
# deny every IP network operation (loopback included). Unix sockets stay allowed (node IPC), EXCEPT the system resolver
# daemon socket and the DNS-related mach services, so even a name lookup is refused before anything is transmitted.
# TEST_HOOK (used only by scripts/test-frontend-build-runner.sh to prove the runner FAILS): open-barrier | refuse-font-css
TEST_HOOK="${FRONTEND_BUILD_TEST_HOOK:-}"
cat > "$WORK/net.sb" <<'SB'
(version 1)
(allow default)
(deny network*)
(allow network* (local unix-socket))
(allow network* (remote unix-socket))
(deny network* (remote unix-socket (path-literal "/private/var/run/mDNSResponder")))
(deny mach-lookup (global-name "com.apple.dnssd.service") (global-name "com.apple.networkd") (global-name "com.apple.SystemConfiguration.DNSConfiguration") (global-name "com.apple.SystemConfiguration.configd"))
SB
if [ "$TEST_HOOK" = "open-barrier" ]; then printf '(version 1)\n(allow default)\n' > "$WORK/net.sb"; fi
node "$ROOT/scripts/support/net-probe.cjs" "$WORK/net.sb" > "$WORK/probe.json" 2> "$WORK/probe.err"
PROBE_CODE=$?
[ "$PROBE_CODE" -eq 0 ] || { cp "$WORK/probe.json" "$ART/network-guard-probe-failed.json" 2>/dev/null; fail "barrier probe failed: the sentinel was reachable or the control did not connect"; }

# ---- 2. font fixture + mock ------------------------------------------------------------------------------------
printf 'wOF2\x00\x01\x00\x00synthetic-font-fixture-for-isolated-build-%s' "0123456789abcdef0123456789abcdef" > "$WORK/synthetic.woff2"
FIXTURE_SHA="$(shasum -a 256 "$WORK/synthetic.woff2" | cut -d' ' -f1)"
FIXTURE_SIZE="$(wc -c < "$WORK/synthetic.woff2" | tr -d ' ')"
cat > "$WORK/font-mock.cjs" <<'JS'
// Synthetic responses for next/font/google. Every consulted URL is recorded with the class and size of the answer.
const fs = require('fs');
const path = require('path');
const dir = __dirname;
const fixture = path.join(dir, 'synthetic.woff2');
const log = path.join(dir, 'font-mock-requests.jsonl');
const css = (family) => `@font-face { font-family: '${family}'; font-style: normal; font-weight: 400; font-display: swap; src: url(${fixture}) format('woff2'); }`;
module.exports = new Proxy({}, {
  has: () => true,
  get: (_t, url) => {
    if (typeof url !== 'string') return undefined;
    const known = url.startsWith('https://fonts.googleapis.com/') && !process.env.FRONTEND_BUILD_TEST_REFUSE_CSS;
    const m = url.match(/family=([^:&]+)/);
    const family = decodeURIComponent(m ? m[1] : 'Synthetic').replace(/\+/g, ' ');
    const body = known ? css(family) : null;
    fs.appendFileSync(log, JSON.stringify({ class: 'css', url: url.split('?')[0] + (known ? '?[query-omitted]' : ''), family, decision: known ? 'served-synthetic' : 'refused', bytes: body ? Buffer.byteLength(body) : 0 }) + '\n');
    return body ?? undefined;
  },
});
JS

# ---- 3a. negative control: the SAME build WITHOUT the font mock must FAIL under the barrier -----------------------
# (it tries to download the fonts; every attempt is refused before transmission). Proves the barrier covers the real
# build process and that the mock is what lets the build pass.
WINDOW_EPOCH="$(date +%s)"
( cd "$WORK/app" && /usr/bin/sandbox-exec -f "$WORK/net.sb" env -i HOME="$HOME" PATH="$PATH" TERM="${TERM:-dumb}" NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL="http://127.0.0.1:3101/api" ./node_modules/.bin/next build ) > "$WORK/negative.log" 2>&1
NEG_CODE=$?
rm -rf "$WORK/app/.next"
[ "$NEG_CODE" -ne 0 ] || fail "negative control: the build WITHOUT the font mock passed under the barrier (barrier not effective or fonts not needed)"
grep -qiE "Failed to fetch font|fetch failed|EPERM|ENOTFOUND|EAI_AGAIN|ECONNREFUSED|Operation not permitted" "$WORK/negative.log" \
  || fail "negative control failed for an unrecognised reason (see negative.log)"

# ---- 3. build under the barrier ---------------------------------------------------------------------------------
sleep 8   # separate the negative control's denials from the final build's in the log
FINAL_EPOCH="$(date +%s)"
CMD_LINE="sandbox-exec -f net.sb env -i NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL=http://127.0.0.1:3101/api NEXT_FONT_GOOGLE_MOCKED_RESPONSES=<mock> next build"
( cd "$WORK/app" && /usr/bin/sandbox-exec -f "$WORK/net.sb" env -i HOME="$HOME" PATH="$PATH" TERM="${TERM:-dumb}" NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 NEXT_PUBLIC_API_URL="http://127.0.0.1:3101/api" \
    NEXT_FONT_GOOGLE_MOCKED_RESPONSES="$WORK/font-mock.cjs" ${TEST_HOOK:+FRONTEND_BUILD_TEST_REFUSE_CSS=1} ./node_modules/.bin/next build ) > "$WORK/build.log" 2>&1
BUILD_CODE=$?
BUILD_END_EPOCH="$(date +%s)"
sed -E 's#postgres(ql)?://[^[:space:]@]*@#postgresql://***@#g; s#Bearer [A-Za-z0-9._~+/=-]+#Bearer ***#g' "$WORK/build.log" > "$ART/summary-build.log.txt"
sed -E 's#postgres(ql)?://[^[:space:]@]*@#postgresql://***@#g' "$WORK/negative.log" | head -60 > "$ART/negative-control-build.log.txt"
# Seatbelt denials of this window (unified log); recorded when the log is readable, otherwise marked unavailable.
sleep 6
ELAPSED=$(( $(date +%s) - WINDOW_EPOCH + 15 ))
/usr/bin/log show --last "${ELAPSED}s" --style compact \
  --predicate 'eventMessage CONTAINS "Sandbox:" AND eventMessage CONTAINS "deny" AND (eventMessage CONTAINS "network" OR eventMessage CONTAINS "mach-lookup")' \
  > "$WORK/denials.log" 2>"$WORK/denials.err" && DENIALS_OK=1 || DENIALS_OK=0
FINAL_ELAPSED=$(( BUILD_END_EPOCH - FINAL_EPOCH + 6 ))
AGE=$(( $(date +%s) - FINAL_EPOCH + 6 ))
/usr/bin/log show --last "${AGE}s" --style compact \
  --predicate 'eventMessage CONTAINS "Sandbox:" AND eventMessage CONTAINS "deny" AND (eventMessage CONTAINS "network" OR eventMessage CONTAINS "mach-lookup")' \
  > "$WORK/denials-final.log" 2>>"$WORK/denials.err" || DENIALS_OK=0
[ "$BUILD_CODE" -eq 0 ] || fail "next build exited with status $BUILD_CODE under the barrier"

# ---- 4. evidence checks -------------------------------------------------------------------------------------------
[ -f "$WORK/font-mock-requests.jsonl" ] || fail "the font mock was never consulted"
EMITTED="$(find "$WORK/app/.next" -name '*.woff2' -type f 2>/dev/null)"
[ -n "$EMITTED" ] || fail "no .woff2 asset was emitted by the build"
BAD=0; : > "$WORK/emitted.txt"
while IFS= read -r f; do
  h="$(shasum -a 256 "$f" | cut -d' ' -f1)"; printf '%s  %s\n' "$h" "$(basename "$f")" >> "$WORK/emitted.txt"
  [ "$h" = "$FIXTURE_SHA" ] || BAD=1
done <<< "$EMITTED"
[ "$BAD" -eq 0 ] || fail "an emitted .woff2 does not match the local synthetic fixture"

FIXTURE_SHA="$FIXTURE_SHA" FIXTURE_SIZE="$FIXTURE_SIZE" WORK="$WORK" ART="$ART" NEG_CODE="$NEG_CODE" DENIALS_OK="$DENIALS_OK" FINAL_EPOCH="$FINAL_EPOCH" python3 - <<'PY' || fail "font mock log or barrier record invalid"
import json, os, sys
e = os.environ
reqs = [json.loads(l) for l in open(os.path.join(e["WORK"], "font-mock-requests.jsonl"))]
if not reqs or any(r["decision"] != "served-synthetic" for r in reqs):
    sys.exit("unserved or refused font mock request")
emitted = [l.split() for l in open(os.path.join(e["WORK"], "emitted.txt"))]
json.dump({
  "cssRequests": reqs,
  "fontFiles": {
    "mechanism": "Next 14.2.16 fetchFontFile(): with NEXT_FONT_GOOGLE_MOCKED_RESPONSES an absolute path is read from disk; no network call exists on this path. The synthetic CSS references only the local fixture.",
    "fixture": {"sha256": e["FIXTURE_SHA"], "bytes": int(e["FIXTURE_SIZE"])},
    "emittedAssets": [{"sha256": h, "name": n, "equalsFixture": h == e["FIXTURE_SHA"]} for h, n in emitted],
    "unresolvedRemoteFontUrls": 0,
  },
}, open(os.path.join(e["ART"], "font-mock-requests.json"), "w"), indent=2)
probe = json.load(open(os.path.join(e["WORK"], "probe.json")))
import re, collections
denied = collections.Counter()
if e.get("DENIALS_OK") == "1":
    for line in open(os.path.join(e["WORK"], "denials.log"), errors="replace"):
        m = re.search(r"Sandbox: (\S+?)\(\d+\) deny\(\d+\) (network\S*|mach-lookup)\s*(.*)$", line)
        if m:
            denied[f"{m.group(1)} {m.group(2)} {m.group(3).strip()[:80]}"] += 1
final_denied = collections.Counter()
if e.get("DENIALS_OK") == "1":
    import time
    start = float(e["FINAL_EPOCH"])
    for line in open(os.path.join(e["WORK"], "denials-final.log"), errors="replace"):
        m = re.search(r"Sandbox: (\S+?)\(\d+\) deny\(\d+\) (network\S*|mach-lookup)\s*(.*)$", line)
        ts = re.match(r"(\d{4}-\d\d-\d\d \d\d:\d\d:\d\d)", line)
        if not (m and ts):
            continue
        if time.mktime(time.strptime(ts.group(1), "%Y-%m-%d %H:%M:%S")) < start - 1:
            continue  # before the final build started (negative control tail)
        # only the build's own process family; unrelated system daemons in the same system-wide log are not attributed to it
        if re.match(r"^(node|next|next-.*|swc.*|esbuild|env|sh|zsh|bash|sandbox-exec)$", m.group(1)):
            final_denied[f"{m.group(1)} {m.group(2)} {m.group(3).strip()[:80]}"] += 1
neg = open(os.path.join(e["WORK"], "negative.log"), errors="replace").read()
json.dump({
  "mechanism": "macOS Seatbelt via sandbox-exec -f <profile>; applies to the build process and all children",
  "profile": open(os.path.join(e["WORK"], "net.sb")).read().strip().splitlines(),
  "effect": "every IP socket operation (loopback and external) is denied before transmission; the system resolver socket and DNS mach services are denied too; other unix sockets allowed",
  "probe": probe,
  "externalHostsContactedForTheProbe": 0,
  "negativeControl": {"description": "same build WITHOUT the font mock under the barrier", "exitCode": int(e["NEG_CODE"]), "failedAsRequired": int(e["NEG_CODE"]) != 0,
                      "mentionsFontFetchFailure": bool(re.search(r"Failed to fetch font|fetch failed|EPERM|ENOTFOUND", neg, re.I))},
  "buildExitCodeUnderBarrier": 0,
  "deniedAttemptsInWindow": {"source": "unified log (Sandbox kernel messages) from the start of the negative control to after the final build",
                              "available": e.get("DENIALS_OK") == "1",
                              "note": "system-wide window: may include denials of unrelated sandboxed processes; the negative control is expected to appear here",
                              "entries": [{"count": c, "denial": d} for d, c in denied.most_common()]},
  "finalBuildDenials": {"window": "from the start of the final (mocked) build to its end plus margin; system-wide log, kept only for the build process family (node/next/swc/sh...)",
                         "entries": [{"count": c, "denial": d} for d, c in final_denied.most_common()],
                         "interpretation": "denials listed here were refused before any transmission. A `mach-lookup` of the resolver configuration is a name-resolution/listen preparation step by node, not a connection; the target name cannot be attributed from this log"},
  "limits": "Seatbelt gives no per-connection allowed/blocked totals: attempts are known only from the denial log; allowed connections are impossible for IP sockets by construction (all denied), so none of the build's traffic left the process",
}, open(os.path.join(e["ART"], "network-guard.json"), "w"), indent=2)
PY
RESULT="pass"; REASON="build exit 0 under the network barrier; font CSS mocked, font bytes from the local fixture"
