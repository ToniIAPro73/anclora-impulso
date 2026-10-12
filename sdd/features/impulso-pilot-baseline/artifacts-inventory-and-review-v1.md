# Artifact inventory and manual-review list

Times are local (CEST). Nothing below was deleted, moved or published by this agent. No screenshot or log is attached
to any report; credentials are never copied here.

## 1. Blocked removal (exact record)
| Item | Detail |
|---|---|
| Action rejected | Bash `rm -rf test-results/*` (earlier in this session, from the repository root) |
| Reason given by the safety check | "Dangerous rm operation detected … the relative glob target cannot be statically resolved"; needs explicit approval and cannot be auto-allowed |
| Handling | Not retried by any other tool or mechanism |
| Current state | Playwright cleans its output directory at the start of every run, so the directory now holds only `test-results/.last-run.json` (45 bytes, 05:28:40). The failure screenshots/traces of the invalid runs **no longer exist** |

## 2. Group A — artifacts of invalid or provisional runs (review, then remove manually if you wish)
| Path | Written | Size | Origin | Sensitivity note |
|---|---|---|---|---|
| `artifacts/qa/e2e-api.log` | 05:28:40 | 482 KB | E-11 (provisional) API output incl. query logs | synthetic users/emails; request bodies not logged on success; no credential expected — **review** |
| `artifacts/qa/e2e-web.log` | 05:28:40 | 1.7 KB | E-11 Next output | low |
| `artifacts/qa/fallback-mobile-light.png`, `…-mobile-dark.png`, `…-desktop-light.png`, `…-desktop-dark.png` | 05:28:32–05:28:36 | 100–223 KB | E-11 captures of the generator page (synthetic user) | no login page; **review** that no operator name/email is in the header |
| `artifacts/qa/env-probe-before-shield.log` | 05:20:50 | 1.8 KB | orphan API probe: file paths and **variable names** of the operational file | names only; contains operational variable names — do not publish |
| `artifacts/qa/env-probe.log` | 05:27:53 | 0 B | empty | none |
| `artifacts/qa/isolation/c1-next-control.log`, `.stdout`; `r1-next-runner.log`, `.stdout`; `r2-api-runner.log`, `.stdout` | 05:27:19–05:27:47 | < 2 KB each | V-03 (provisional) | decoy and variable names, paths |
| `artifacts/qa/isolation/20261012T033906Z-34d659f9/`, `…T033959Z-df2ad9e3/`, `…T034125Z-5e92a65d/`, `…T034227Z-a031316e/` | 03:39–03:42 UTC | small | tooling iterations of the verification script | names/paths only |
| `backend/artifacts/test-runs/20261012T034453Z-0d42a07e/` | 03:44 UTC | small | clone-runner first attempt (pnpm install error); not a test result | none |

## 3. Group B — valid new evidence (keep)
| Path | What |
|---|---|
| `artifacts/qa/runs/20261012T034530Z-c214631e/` | E-VALID: identity.json, api.log, web.log, playwright.log, outcome.txt, screenshots/, test-results/, api-winston-logs/ |
| `artifacts/qa/isolation/20261012T034331Z-65c1904d/` | V-VALID probe records (paths and variable names only) |
| `backend/artifacts/test-runs/20261012T034716Z-865b056c/` | I-VALID full integration baseline (identity.json, jest.log sanitized) |
| `backend/artifacts/test-runs/20261012T034510Z-c230c40e/` | valid 4-suite subset on the clone runner |
| `backend/artifacts/test-failures/failure-2026-10-12T03-20-05-038Z.json`, `run-20261012T032005Z.log` | the captured intermittent failure (incident evidence; sanitized) |

## 4. Group C — pre-existing / other
| Path | Note |
|---|---|
| `backend/logs/{combined,http,error,exceptions,rejections}-2026-10-12.log` (sizes 896 KB, 896 KB, 404 KB, 19 KB, 0) | written by every API/jest process of the day (no pid per line); contain synthetic emails/ids and, from the pre-redaction D8 evidence runs, **synthetic** passwords. Keep for incident traceability; git-ignored. Older files (Sep) pre-date this work: do not touch |
| `playwright-report/` | dated 2026-09-14, pre-existing, untouched |

## 5. What to review by hand, in this order
1. `artifacts/qa/fallback-*.png` (4 files) — open and confirm no personal name/email other than synthetic ones.
2. `artifacts/qa/e2e-api.log` — search for any real address or token; none expected.
3. Remove Group A entries you consider noise. **Do not remove the whole `artifacts/` or `backend/artifacts/` trees**: Group B and the incident capture live there.
4. `.gitignore` now ignores `/test-results/` and `/playwright-report/` (the former was untracked-but-not-ignored).
