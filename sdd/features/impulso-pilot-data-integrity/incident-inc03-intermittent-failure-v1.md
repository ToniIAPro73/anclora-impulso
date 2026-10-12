# Incident — intermittent failure in `inc03-idempotency-hardening` (cause UNKNOWN)

| Field | Value |
|---|---|
| Status | **OPEN — cause unknown, not reproduced** |
| First seen | 2026-10-12, one full-suite run (1 failed / 110 total, suite `inc03`); the next full run and 3 isolated runs passed |
| Captured at the time | Only "1 test failed in inc03". **The exact test name, seed/order, worker output and timings were not captured** (the runner did not retain them) |
| Severity | Test-reliability. No production impact (tests only) |

## What is and is not known
- A later, *different* occurrence was captured by the new reporter: `concurrency cap … rejected before any provider call`
  failed with `getDeterministicCoachProviderCalls() = 1` while `ok = 0`. Two real mechanisms were found and removed:
  1. **Orphan provider call**: the timeout test left a provider promise (`sleep(300)` then `real()`) that completed
     *after* its test ended and incremented the global call counter during a later test.
  2. **All-rejected admission**: the concurrency gate counted every in-flight record, so six simultaneous requests
     could all count each other and all be rejected; replaced by a deterministic rank on (createdAt, id).
- These explain a failure **of that type**; they are **not proven** to be the cause of the original, uncaptured failure.
- Other timing hazards reviewed and hardened (not proven causes): sleeps used as barriers ("original is in the
  provider") now use a gate that signals entry; quota windows aligned to the wall clock could straddle an hour
  boundary (`avoidWindowBoundary`); in-flight waits use bounded polling instead of fixed sleeps.

## Instrumentation now in place
`backend/scripts/test-db.sh test` keeps, **only on failure**, under `backend/artifacts/test-failures/` (git-ignored):
- `failure-<ts>.json`: exact failing test names, per-suite status/duration/start offset, **actual suite execution
  order**, seed and randomization flag, worker model (jest does not expose worker ids; runs are in-band),
  slow tests (> 1 s), last console lines, host load average, node/platform;
- `run-<ts>.log`: the full output with connection strings, bearer tokens, JWTs and refresh tokens redacted.
`TEST_RANDOMIZE=1 [TEST_SEED=n]` makes order reproducible (`jest --randomize --seed`).

## Targeted check (bounded) and result
10 iterations of `inc02 + inc03 + inc04` with randomized order (seeds 1001–1010) under 6 CPU-burner processes on a
6-core host: **37/37 tests passed in 10/10 iterations, 0 failures**. Insufficient to conclude anything about the
original failure; it only shows the suites are stable under that load.

## Residual risk
The original failure may recur from a mechanism not found here (for example a cross-suite leak or a DB-side
timing). Policy: any recurrence must be investigated from its `failure-*.json` before re-running; a green rerun does
not close this incident. Closure condition: ≥ 1 captured failure explained and fixed, or 30 consecutive full-suite
runs on CI without recurrence.
