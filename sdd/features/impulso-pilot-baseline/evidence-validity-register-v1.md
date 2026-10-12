# Evidence validity register (2026-10-12)

Purpose: say which results can be relied on, for what, and what replaces the rest. Nothing here deletes or rewrites
earlier reports: they stay as written; this register overrides their **evidential weight**. Times are the host's local
time (CEST); run ids are UTC.

## Defect classes
| Class | Meaning |
|---|---|
| **A** | Operational variables were loaded into the process under test (Next at the repo root loaded `.env.local`; the API's Prisma loader merged `backend/.env`) |
| **B** | The runner talked to **orphan servers** from an earlier run (new servers failed with `EADDRINUSE`) |
| **C** | No check that the server answering was the process just started, or of which code it ran |

Timeline source: `backend/logs/exceptions-2026-10-12.log` (EADDRINUSE entries) and `combined-…log` (API starts).

## E2E (Playwright)
| Ref | When (local) | Evidence of what happened | Defects | Verdict | Replaced by |
|---|---|---|---|---|---|
| E-01 | 05:00:42 | First stack start. Spec failed on the cookie dialog (a test defect). **Created the orphan API :3101 (code snapshot of 05:00:42) and orphan Next :3100 at the repo root** | A, B (origin), C | **INVALID** for isolation and for current code | E-VALID |
| E-02…E-05 | 05:01:30, 05:02:15, 05:02:35, **05:03:31** | Each new API crashed with EADDRINUSE; tests ran against the orphans. The "13/13" reported in the earlier delivery is the 05:03:31 run | A, B, C | **INVALID** (isolation, current code, "runner passes"). Behaviour of the 05:00:42 API snapshot is only anecdotal | E-VALID |
| E-06 | 05:18:22 | Symlinked-sources attempt; again against orphans (failures were artefacts) | A, B, C | **INVALID** | E-VALID |
| E-07…E-10 | 05:23:42, 05:24:22, 05:25:27, 05:26:10 | EADDRINUSE on :3101 each time; failures/passes belong to the orphans | A, B, C | **INVALID** | E-VALID |
| E-11 | 05:27:53 | Fresh servers after orphans were killed; copy-Next, shielded API; API ran from the real `backend/` tree (Prisma loader still read `backend/.env`); 13/13; no identity check | C (A mitigated, not proven) | **PROVISIONAL** — identified only indirectly (no processes, ports free before start) | E-VALID |
| **E-VALID** | `20261012T034530Z-c214631e` | Fresh env-free copies of the working tree; listener pid in own tree, cwd = own copy, unique request seen in own log; 13/13; processes removed (none force-killed) | — | **VALID** | — |

## Isolation verification (`verify-runner-isolation.sh` and predecessors)
| Ref | When | What | Defects | Verdict | Replaced by |
|---|---|---|---|---|---|
| V-01 | ~05:21:46 | Next at the repo root with the internal flag: **FAIL** (showed the leak) | (it *is* the demonstration of A) | **VALID as a negative finding**; leaves an orphan API on :3122 | — |
| V-02 | 05:23:31 | R2 collided with V-01's orphan on :3122 (EADDRINUSE) → the API probed was not the one started; the PASS was **vacuous** | B, C | **INVALID** | V-VALID |
| V-03 | 05:27:39 | PASS; no listener-identity check | C | **PROVISIONAL** | V-VALID |
| V-04…V-07 | 03:39–03:42 UTC | Script iterations (array bug, wait bug, tree-matching bug): FAIL/incomplete | tooling | **NOT EVIDENCE** (tooling development) | V-VALID |
| **V-VALID** | `artifacts/qa/isolation/20261012T034331Z-65c1904d` | 11/11 PASS, each phase proves the probed listener is its own; controls C1 (decoys applied when isolation absent) and C2 (a new name in `.env` applied even with the shield on); R1 (Next copy) and R2 (API clone, shield OFF) apply nothing and never touch repository-root / operational `.env*` | — | **VALID** | — |

## Backend (jest) and other suites
| Ref | What | Assessment |
|---|---|---|
| I-OLD | All integration runs up to the first clone-runner run (real `backend/` tree; DB identified and marker-guarded; sandbox env probed once) | **Valid for behaviour** (independent of the server-identity defects; DB target was identified). **Not valid as isolation evidence** (loader read `backend/.env`; code identity not recorded). Not invalidated automatically |
| I-SHIELD | Last full run before the clone runner (20 suites / 126 tests, shielded env) | Valid for behaviour; superseded as the baseline by I-VALID |
| **I-VALID** | `backend/artifacts/test-runs/20261012T034716Z-865b056c`: 20 suites / 126 tests from an env-free clone; code `sourceTreeSha256 76df7605…`; DB container `2a03a3f3fffd`, marker verified | **VALID baseline** |
| U-ALL | Unit suites (pure/mocked) | Unaffected by A/B/C |
| F-ALL | Frontend jest, `tsc`, `next build` (build in an env-free copy) | Unaffected; do not touch servers or operational files (the earlier root-level `next build` read `.env.local` at build time: build output only) |
| M-ALL | `verify-migrations` (clean ≡ upgrade, historical row `unknown`) | Unaffected (own throw-away databases in the isolated container) |
| G-ALL | Spawn-based suites `ai06-startup-config`, `final-state` before the shield / clone | Behaviour valid; "operational config absent" claim **not** supported for pre-shield runs; re-proved inside I-VALID (the spawned servers now run from the clone) |

Both VALID runs report the same `sourceTreeSha256` (`76df760527d9cd1b…`, base `77f852aa`, dirty): **same code**.

## Criterion → valid replacement
| Criterion | Previous evidence | Valid evidence now | If none |
|---|---|---|---|
| Silent refresh, rotation | E-02…E-05 | E-VALID #2 | — |
| Two tabs refreshing simultaneously | E-02…E-05 | E-VALID #3 + I-VALID `ai06-sessions` | — |
| Logout revokes server-side | E-02…E-05 | E-VALID #4 + I-VALID | — |
| Disabled user rejected | E-02…E-05 | E-VALID #5 + I-VALID | — |
| A/B isolation (UI and API) | E-02…E-05 | E-VALID #6 + I-VALID inventory test | — |
| Coach retry, no double consumption (API level) | E-02…E-05 | E-VALID #7 + I-VALID `inc02/inc03` | — |
| Generation, lost response → one routine | E-02…E-05 | E-VALID #8 + I-VALID `inc03` | — |
| Fallback notice visible (mobile/desktop × light/dark), mode shown, not an error | E-02…E-05 | E-VALID #9–12 (screenshots under the run dir) | visual review by a human still pending |
| Error states (500, quota with reset) | E-02…E-05 | E-VALID #13 | — |
| Target end state (key required, legacy off, enforce, 15 min) | `final-state` pre-shield | I-VALID `final-state` (real server from the clone) + E-VALID config | — |
| Isolation of runners from operational env | V-01…V-03 | V-VALID | — |
| "No Groq/OAuth/DB-production contact" | statements in earlier reports | **no valid replacement**: see effects-assessment-v1.md | **UNDETERMINED** at network level |
