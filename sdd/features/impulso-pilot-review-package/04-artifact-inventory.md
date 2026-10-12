# Artifact inventory — current, old and gone (reviewed state 2026-10-12)

Policy from this point: every run writes only to **its own, never reused directory**; the directory creation fails if
it already exists; each directory ends with `MANIFEST.sha256`; ad-hoc Playwright screenshots go to a timestamped
folder. This agent attempted no deletion and will not retry the rejected one (Bash `rm -rf test-results/*`, refused by
the safety check as an unresolvable relative glob). Times local (CEST).
`evidence-manifest-v1.sha256` (this package) lists the SHA-256 of every file of the valid runs at review time (the
`api-winston-logs/` copies are excluded); a mismatch means the evidence changed after review.

## A. Current (valid, under review — do not modify)
| Path | Run / kind | Notes |
|---|---|---|
| `artifacts/qa/runs/20261012T034530Z-c214631e/` | E-VALID (Playwright 13/13) | identity.json, api.log, web.log, playwright.log, outcome.txt, screenshots/, test-results/, api-winston-logs/ |
| `artifacts/qa/isolation/20261012T034331Z-65c1904d/` | V-VALID (isolation 11/11) | paths and variable **names** only |
| `backend/artifacts/test-runs/20261012T034716Z-865b056c/` | I-VALID (integration 20 / 126) | identity.json, jest.log (sanitized) |
| `backend/artifacts/test-runs/20261012T034510Z-c230c40e/` | valid 4-suite subset | identity.json, jest.log |
| `backend/artifacts/test-failures/failure-2026-10-12T03-20-05-038Z.json`, `run-20261012T032005Z.log` | captured intermittent failure | incident evidence; sanitized |
| `sdd/features/impulso-pilot-*/` | documents | versioned working tree (uncommitted) |

## B. Old (invalid / provisional / tooling) — still on disk; review then remove manually if desired
| Path | Written | Why old |
|---|---|---|
| `artifacts/qa/e2e-api.log` (482 KB), `artifacts/qa/e2e-web.log` (1.7 KB) | 05:28:40 | provisional run E-11 (no identity check) |
| `artifacts/qa/fallback-mobile-light.png`, `…-mobile-dark.png`, `…-desktop-light.png`, `…-desktop-dark.png` | 05:28:32–36 | E-11 captures; valid copies exist under the E-VALID run |
| `artifacts/qa/env-probe-before-shield.log`, `artifacts/qa/env-probe.log` | 05:20:50 / 05:27:53 | probe of an invalid API run (variable **names**); 0-byte file |
| `artifacts/qa/isolation/c1-next-control.{log,stdout}`, `r1-next-runner.{log,stdout}`, `r2-api-runner.{log,stdout}` | 05:27:19–47 | V-03 provisional |
| `artifacts/qa/isolation/20261012T033906Z-34d659f9/`, `…T033959Z-df2ad9e3/`, `…T034125Z-5e92a65d/`, `…T034227Z-a031316e/` | 03:39–03:42 UTC | verification-script development iterations |
| `backend/artifacts/test-runs/20261012T034453Z-0d42a07e/` | 03:44 UTC | first clone-runner attempt (dependency-verification error); not a test result |
| `backend/logs/*-2026-10-12.log` | all day | mixed processes, no pid; synthetic emails/ids and (pre-redaction D8 evidence) **synthetic** passwords; keep for traceability; git-ignored |
| `test-results/.last-run.json` | 05:28:40 | 45 bytes, harmless; directory is now git-ignored |

## C. Gone (no longer retrievable)
| Item | What happened |
|---|---|
| Failure screenshots/traces/`error-context.md` of E-01…E-10 | Playwright empties `test-results/` at the start of every run; each later run replaced them |
| `artifacts/qa/e2e-api.log` / `e2e-web.log` content of E-01…E-10 | the same fixed filenames were truncated by each new run (new runner uses a run directory) |
| Early `fallback-*.png` of 05:04 | overwritten at 05:28 under the same names |
| Probe/isolation logs of V-01, V-02 | overwritten by later runs (fixed filenames) |
| Orphan servers' own stdout | went to the truncated log files above |
What this loses: the ability to inspect the old failures visually and to check whether a login page was captured.
What it does not lose: the winston logs (`backend/logs`), which still contain the timeline used in the register.

## D. Pre-existing, untouched
`playwright-report/` (2026-09-14) and September winston files predate this work.
