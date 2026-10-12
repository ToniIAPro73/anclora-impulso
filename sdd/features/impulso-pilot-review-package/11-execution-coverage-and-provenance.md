# Execution coverage and provenance (2026-10-12)

Companion of `10-consolidated-matrix-r1-r8c.md`. It says **what was run, on which code, with what result, and what
artifact exists**. The results below are *not* one suite executed on the final tree: they are separate executions on
successive trees, listed with the hash recorded in each run's own `identity.json` (the authority; transcriptions in
status reports were only used to locate runs).

Final tree: `sourceTreeSha256 dee09279107148dddf28e075a29577cd64692b480d5e1f6db64b6c28ea07efb6`.
Hash of the **code** (`sourceTreeSha256`/`diffSha256`) is different from the hash of the **package**
(`SHA256SUMS` of the ZIP). Documentation changes do not invalidate tests of earlier code: `code-identity.sh` covers
`app components hooks lib public middleware.ts … backend/src backend/prisma backend/tests … e2e scripts`, not `sdd/`.

## 1. Executions with preserved artifacts (identity + manifest in the repository `artifacts/`; copies in the bundles)
| Run | Kind | Tree | Scope | Result | Artifact |
|---|---|---|---|---|---|
| `20261012T034530Z-c214631e` | e2e | `76df760527d9…` | E2E 13/13 on the earlier tree (E-VALID of the original package) | valid | `artifacts/qa/runs/20261012T034530Z-c214631e` + `—` |
| `20261012T043534Z-255cfca9` | e2e | `fb1e86da3bbf…` | E2E: 8 passed, 1 failed (`fallback notice … mobile / light`, page ended on login, session revoked with reason `logout` 140 ms after login), 4 not run | FAILED — cause unknown | `artifacts/qa/runs/20261012T043534Z-255cfca9` + `MANIFEST.sha256` |
| `20261012T043655Z-d72ff3ea` | e2e | `fb1e86da3bbf…` | E2E re-run of the same tree, 13/13 | pass | `artifacts/qa/runs/20261012T043655Z-d72ff3ea` + `MANIFEST.sha256` |
| `20261012T060040Z-3a873ad9` | e2e | `bc7c2dc7e14c…` | E2E 14/14 (adds profile 500/abort test) | pass | `artifacts/qa/runs/20261012T060040Z-3a873ad9` + `MANIFEST.sha256` |
| `20261012T060153Z-79f526c9` | e2e | `b1a160b87aeb…` | E2E deliberately against the previous auth context; stops at the logout-attribution assertion | FAILED by design | `artifacts/qa/runs/20261012T060153Z-79f526c9` + `MANIFEST.sha256` |
| `20261012T060237Z-90942e97` | e2e | `b1a160b87aeb…` | E2E `-g profile load` against the previous context; `revoked=1` | FAILED by design | `artifacts/qa/runs/20261012T060237Z-90942e97` + `MANIFEST.sha256` |
| `20261012T060319Z-b81c0a17` | e2e | `091e4fcc9780…` | E2E `-g profile load` against the previous context, with `auth-events.json` (logout reason/origin) | FAILED by design | `artifacts/qa/runs/20261012T060319Z-b81c0a17` + `MANIFEST.sha256` |
| `20261012T060352Z-bca4e5f4` | e2e | `cad25298bb9b…` | E2E 14/14 (end of the R7/R8/R5 delta) | pass | `artifacts/qa/runs/20261012T060352Z-bca4e5f4` + `MANIFEST.sha256` |
| `20261012T061821Z-c42fd39c` | e2e | `f3ad414faa19…` | E2E 14/14 (end of the R8-A/R8-B delta) | pass | `artifacts/qa/runs/20261012T061821Z-c42fd39c` + `MANIFEST.sha256` |
| `20261012T063117Z-c38e75c8` | e2e | `dee092791071…` | E2E 14/14 (R8-C; final tree) | pass | `artifacts/qa/runs/20261012T063117Z-c38e75c8` + `MANIFEST.sha256` |
| `20261012T034453Z-0d42a07e` | backend-integration | `76df760527d9…` | first clone-runner attempt: dependency-verification error, no test executed | not a test result | `backend/artifacts/test-runs/20261012T034453Z-0d42a07e` + `—` |
| `20261012T034510Z-c230c40e` | backend-integration | `76df760527d9…` | 4-suite subset, 25 tests (earlier tree) | pass | `backend/artifacts/test-runs/20261012T034510Z-c230c40e` + `—` |
| `20261012T034716Z-865b056c` | backend-integration | `76df760527d9…` | integration 20 suites / 126 (I-VALID of the original package) | pass | `backend/artifacts/test-runs/20261012T034716Z-865b056c` + `—` |
| `20261012T042446Z-ff46aecf` | backend-integration | `2b207f2a8d58…` | R1/R2 file: suite failed to run (client lacked new columns) | FAILED (setup) | `backend/artifacts/test-runs/20261012T042446Z-ff46aecf` + `MANIFEST.sha256` |
| `20261012T042506Z-e426421c` | backend-integration | `2b207f2a8d58…` | R1/R2 file before the fix: 5 failed / 3 passed | FAILED before fix | `backend/artifacts/test-runs/20261012T042506Z-e426421c` + `MANIFEST.sha256` |
| `20261012T042603Z-df44a997` | backend-integration | `2e0643ced2d0…` | R4 log-files integration file before the fix | FAILED before fix | `backend/artifacts/test-runs/20261012T042603Z-df44a997` + `MANIFEST.sha256` |
| `20261012T042944Z-cdee871f` | backend-integration | `0d707da21f24…` | R1/R2 file: 8 failed (raw advisory-lock query could not deserialize `void`; implementation defect, fixed) | FAILED (defect) | `backend/artifacts/test-runs/20261012T042944Z-cdee871f` + `MANIFEST.sha256` |
| `20261012T043132Z-eb97590b` | backend-integration | `563eca339a1e…` | R1/R2 file after the fix: 8/8 | pass | `backend/artifacts/test-runs/20261012T043132Z-eb97590b` + `MANIFEST.sha256` |
| `20261012T043219Z-74b2798b` | backend-integration | `c2e936b2a6bc…` | full integration: 2 suites / 4 tests failed (`inc03` expectations of the old contract; `premium-form-voice` — cause unknown) | FAILED | `backend/artifacts/test-runs/20261012T043219Z-74b2798b` + `MANIFEST.sha256` |
| `20261012T043321Z-b8c9f49f` | backend-integration | `58e598d7943c…` | `inc03` (updated) + `premium-form-voice`, 20/20 | pass | `backend/artifacts/test-runs/20261012T043321Z-b8c9f49f` + `MANIFEST.sha256` |
| `20261012T043355Z-bd1b9eac` | backend-integration | `fb1e86da3bbf…` | full integration 22 suites / 137 | pass | `backend/artifacts/test-runs/20261012T043355Z-bd1b9eac` + `MANIFEST.sha256` |
| `20261012T055514Z-10c20d25` | backend-integration | `c9e57fe22ffa…` | R7 file against the previous service (+ test seam only): 3 failed / 1 passed | FAILED before fix | `backend/artifacts/test-runs/20261012T055514Z-10c20d25` + `MANIFEST.sha256` |
| `20261012T055534Z-a880085d` | backend-integration | `69d9ca543ad2…` | R7 file after the fix: 4/4 | pass | `backend/artifacts/test-runs/20261012T055534Z-a880085d` + `MANIFEST.sha256` |
| `20261012T055945Z-684e1572` | backend-integration | `bc7c2dc7e14c…` | full integration 23 suites / 141 | pass | `backend/artifacts/test-runs/20261012T055945Z-684e1572` + `MANIFEST.sha256` |
| `20261012T060458Z-16a471fb` | backend-integration | `cad25298bb9b…` | invalid invocation (patterns passed as one argument): "No tests found" | not a test result | `backend/artifacts/test-runs/20261012T060458Z-16a471fb` + `MANIFEST.sha256` |
| `20261012T060515Z-858c360e` | backend-integration | `cad25298bb9b…` | `inc04`, `final-state`, `ai06-sessions`: 3 suites / 37 (logout paths, final backend change) | pass | `backend/artifacts/test-runs/20261012T060515Z-858c360e` + `MANIFEST.sha256` |
| `20261012T060026Z-f2dc8cf6` | verify-migrations | `bc7c2dc7e14c…` | `verify-migrations`: 20 base + 5 new, historical row, 25 finished, clean = upgrade = schema | pass | `backend/artifacts/verify-migrations/20261012T060026Z-f2dc8cf6` + `MANIFEST.sha256` |

Isolation verifier (`scripts/verify-runner-isolation.sh`, evidence = paths and variable **names** only):
`artifacts/qa/isolation/20261012T034331Z-65c1904d` (V-VALID of the original package, 11/11, no per-run manifest; listed in
`evidence-manifest-v1.sha256`) and `…20261012T043435Z-957cb211` (11/11 on the R1-R6 tree, with `MANIFEST.sha256`).
The verifier was **not** re-run after the frontend changes of R8; it observes environment isolation, not client code.
Failure-reporter files: `backend/artifacts/test-failures/*.json` (7 files; sanitized by the reporter).

## 2. Results that exist only as console output of the implementer's sessions (no artifact)
| Check | Reported result | Last reported on | Note |
|---|---|---|---|
| Backend unit (Jest) | 7 / 57 (original), 9 / 67 (R1-R7) | tree `bc7c2dc7…` or earlier | not repeated for R8-A/B/C (no backend change) |
| `test-guards.sh` | 16/16, then 18/18 | R5 adjustment | offline, with shimmed `docker`/`pnpm` |
| `integration-access.test.ts` | 6/6 | R6 | unit |
| Frontend Jest, whole project | 11/96 → 13/108 → 15/117 → **17/123** | final R8-C session | the R8C bundle holds only the `__tests__/lib` summary (11 suites / 82 tests); the 17/123 total is a console report |
| `tsc --noEmit` frontend and backend | clean | final R8-C session | console |
| Failing-before runs of R3, of R4 unit and of R8 Jest | failed before the fix | corresponding sessions | summaries exist for R8-A/B (R8AB bundle) and R8-C (R8C bundle); not for R3/R4 unit/R8 |
| Independent reviewers' probes (R7, R8-A/B, R8-C) | see `10-…` §0 | reports not in the repository | **SIM**/**STATIC** evidence; not PostgreSQL, not full suites |

## 3. What was NOT executed on the final tree
- Complete backend integration (23 / 141) and `verify-migrations`: last run on `bc7c2dc7…`; backend services, schema and migrations unchanged since.
- Backend unit, frontend whole-project Jest and `tsc`: last reported on the final session; only the client/context subset has an artifact.
- Nothing was run for this consolidation (instruction: no suites, containers or services).
- No run exists against staging, production, a managed PostgreSQL, a real AI provider or an OAuth provider.

## 4. Bundle chain (nothing deleted or overwritten)
| # | Bundle | SHA-256 | Bytes | Role |
|---|---|---|---|---|
| 1 | `anclora-impulso-review-20261012T040910Z.zip` | `b4e67f950dd7db7e00df8915fddc8f9bd1be39830978eef8a14a5fa399a59251` | 281449 | original package (base diff, new files, specs, evidence) |
| 2 | `anclora-impulso-review-delta-R1-R6-20261012T053847Z.zip` | `4f75d337478344059411a3ffafde752e041a76b7e9a57567e1cc0ca777b699d8` | 174560 | R1–R6 (23 files) |
| 3 | `anclora-impulso-review-delta-R7-R8-R5-20261012T060549Z.zip` | `0ef20b42eabf3e670c7fa1a636dbf310c586e9dfeca586f8127565d181b3de48` | 157396 | R7, R8, R5 adjustment (19 files) |
| 4 | `anclora-impulso-review-delta-R8AB-20261012T062001Z.zip` | `847889162c854407ed1d9c3b82d5bc5bd1fbc17c6eb98d8ce96f1192ebcdca71` | 34221 | R8-A, R8-B (6 files) |
| 5 | `anclora-impulso-review-delta-R8C-20261012T063242Z.zip` | `b2af4bd33439a96d75688a0b3cd96a51c595db4047d022888b85d6f3053db53a` | 32641 | R8-C (5 files) |
All five pass `unzip -t`. Their SHA-256 values match those quoted in the delivery reports of the corresponding sessions.
A sixth directory, `artifacts/review-bundles/correction-R1-R6-20261012T043829Z/`, is the unzipped working copy of bundle 2's file set.
Fidelity of the chain to the working tree (byte comparison, see `fidelity-report.md` in the consolidated ZIP): every
file of bundle 5 equals the tree; files of bundles 1–4 that differ were replaced by a later bundle of the chain and
equal the tree there. The tree is the authority.

## 5. Provenance gaps (declared, not repaired)
- The independent review reports are not in the repository or in any bundle (see `10-…` §0).
- Bundles 1–3 carry sanitized **summaries**, not the raw `jest.log`/`api.log`; raw logs stay only in the git-ignored `artifacts/` and are not packaged.
- Evidence of runs E-01…E-11 of the first day (invalidated for isolation) is gone or provisional; see `04-artifact-inventory.md` §B–C and `evidence-validity-register-v1.md`.
- `evidence-manifest-v1.sha256` refers to the three original valid runs; its listed files are not all packaged.

---
## Addendum 2026-10-12 — executions not listed above (historical text unchanged)
| Run | Scope | Tree | Result |
|---|---|---|---|
| `backend/artifacts/test-runs/20261012T073824Z-846d1e27` | backend integration, isolated PostgreSQL | `a15ad0e3…7583` = code of `ed4bb64` (verified from git objects) | 23 suites / 141 tests, exit 0; manifest verified |
| NF-1/F-1/F-2/F-3 increment | see `16-correction-nf1-f1-f2-f3.md` §5 | `53b14939…5bf7` (uncommitted) | integration 26/167 (one failed run, one passed run), unit 71, typecheck, build, verify-migrations pass, guards 68/0 |
Accidental red-phase executions are listed in doc 16 §6 and are not evidence.
