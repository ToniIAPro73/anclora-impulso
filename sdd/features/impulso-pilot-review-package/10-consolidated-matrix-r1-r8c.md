# Consolidated matrix R1–R8-C (2026-10-12)

> **Actualización 2026-10-12 (posterior a este documento; el texto de abajo se conserva como historia).**
> «D10 no ejecutado» y «sin commit» ya no describen el estado actual: el código está commiteado y publicado en `development`
> (último commit de código `c0333f3`), las seis migraciones `20261012*` se aplicaron en producción (run #1 del workflow protegido,
> modelo P1; ledger re-leído por Toni), el backend se desplegó manualmente en Render en `c0333f3` y Toni verificó tres casos
> funcionales (usuario QA OK, admin 200, usuario normal 403). Esto **no** acepta ninguna tarea AI-xx ni ningún gate ni cierra
> ninguna revisión. Estado de gates y revisiones: `28-gates-evidence-checklist-v1.md`.

State described: base `77f852aa3a1c67b8d1f58bb8852d408b0a8c0523`, branch `development`, **uncommitted** working tree.
Code identity of the final tested tree (authority: `identity.json` of run `20261012T063117Z-c38e75c8`):
`sourceTreeSha256 = dee09279107148dddf28e075a29577cd64692b480d5e1f6db64b6c28ea07efb6`,
`diffSha256 = 3e3269128dc3b792fd5e938dd9aa67959c8f420a5baa3ce5f33e1b95f965d49b`. The same values were recomputed on the
working tree when this document was written (`scripts/support/code-identity.sh`); documentation files do not enter that hash.

This is a **consolidation**: no application code, test, runner, config, schema or migration was touched to produce it.
Nothing here is an approval, a signature or a gate decision. Technical statuses are *bounded to the scope and
environment named in each row*.

## 0. Sources and their provenance (kept distinct)
| Kind | Source | Where it exists |
|---|---|---|
| Implementer status | `STATUS-R1-R6.md`, `ERRATA.md`, `STATUS-R7-R8-R5.md`, `STATUS-R8A-R8B.md`, `STATUS-R8C.md` | inside the corresponding bundle (see `11-…` §4) and, in the consolidated ZIP, under `provenance/<bundle>/` (verbatim) |
| Independent review reports | `ANCLORA-IMPULSO-REVISION-DELTA-R1-R6-2026-10-12.md`, `…-REVISION-FINAL-R7-R8-R5-…`, `…-REVISION-R8AB-…`, and the R8-C review | **not in the repository and not in any bundle**. Their conclusions are known here only through the corrections requested from the implementer and through the description given by Toni for this consolidation. The reports themselves must be attached by Toni if a reviewer needs them. |
| Evidence | run directories (`identity.json`, `MANIFEST.sha256`, sanitized summaries) | repository `artifacts/` (git-ignored) and the bundles |

Independent-review conclusions as far as they are known: R7 and the R5 adjustment were found addressed; R8 was found
addressed for same-tab interleavings with two cross-request gaps (R8-A, R8-B) and later a cross-tab replay gap (R8-C);
the review of R8-C checked ZIP integrity, read code and regressions and ran four probes of the real client with simulated
responses (no PostgreSQL, no full suites) and concluded R8-C is corrected **within the scope reviewed**. None of this is a signature
of AI-06-AC10 and none accepts any AI-xx task.

## A. Technical corrections verified within their scope
Environment key: **PG** = isolated local PostgreSQL 16 (container `anclora-impulso-test-postgres`, synthetic data);
**E2E** = Playwright against the isolated stack (API :3101, Next :3100, same DB); **JSDOM** = Jest/RTL with simulated fetch;
**SIM** = simulated persistence/transport in the reviewer's probes; **STATIC** = reading code.
"Artifact" = result file kept in `artifacts/` and in a bundle; "console" = only reported in the session text.

### R1 — quota reservation orphaned after a crash
| Field | Content |
|---|---|
| Problem | An owner could die after reserving a quota unit; the unit stayed consumed without a persisted answer, and a retry could consume a second one |
| Final files | `backend/src/services/coach/coach.service.ts` (`reserveUsage`, `releaseRecordReservation`, `reconcileOrphanReservations`), `backend/src/services/idempotency.service.ts` (`completeIdempotent` clears the marker), `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261012050000_add_idempotency_quota_reservation/migration.sql` |
| Correction | Reservation persisted on the idempotency record (window, owner token, tokens, time) in the same transaction as the increment; released exactly once by conditional UPDATE; only the matching owner releases; orphans of expired locks reconciled; recovery across window boundary |
| Introduced / adjusted | delta R1-R6 (`…053847Z`); lock order and fencing adjusted by R7 (`…060549Z`) |
| Review basis | independent review of delta R1-R6 raised no new finding on R1 (inferred from the correction request; report not available here) |
| Regression before / after | before: run `20261012T042506Z-e426421c` (R1+R2 file: 5 failed / 3 passed); after: `…043132Z-eb97590b` 8/8; `…043355Z-bd1b9eac` 22 suites / 137; `…055945Z-684e1572` 23 / 141 |
| Env / evidence | PG · artifact |
| Tree tested | `fb1e86da…` and `bc7c2dc7…`; later changes are frontend/auth-controller only (see §F) |
| Residual / review | local-PG only; staging evidence (AI-08 plan text) not obtained; independent AI-08 review pending |

### R2 — atomic concurrency admission
| Field | Content |
|---|---|
| Problem | Retrying an old failed key while two calls were active could start a third provider call |
| Final files | `backend/src/services/idempotency.service.ts` (`beginIdempotent`: advisory lock, `maxConcurrent`, `concurrency_limited`), `coach.service.ts`, `backend/src/services/workouts.service.ts` |
| Correction | Admission under `pg_advisory_xact_lock` per (user, operation); counts executions `in_progress` with a live lock; permits expire with the lock; refusal creates no record |
| Introduced | delta R1-R6 |
| Regression before / after | same files and runs as R1; burst of 8 admits exactly 2; old key refused without a third provider call |
| Env / evidence | PG · artifact |
| Residual | operational caps (3 attempts per key, 5 failed per window, 2 concurrent) remain *experimental, not approved* (decision D-1 of the closure matrix) |

### R3 — stable client idempotency key
| Field | Content |
|---|---|
| Problem | The client replaced an unresolved operation's key after a time limit, defeating the server guarantee |
| Final files | `lib/idempotency.ts`, `components/workout-generator.tsx`, `__tests__/lib/idempotency.test.ts` |
| Correction | No time-based replacement; explicit `discardPendingOperation` when the user asks for another routine; keys cleared on logout |
| Introduced | delta R1-R6 |
| Regression before / after | reported by the implementer as written before the fix; **no failing-run artifact kept**; after: Jest frontend (console; later totals in `11-…`) |
| Env / evidence | JSDOM · console only |

### R4 — secrets in logs
| Field | Content |
|---|---|
| Problem | 404 handler logged the query string; free-text error paths could carry secrets |
| Final files | `backend/src/utils/redact.ts` (`redactText`), `backend/src/middleware/errorHandler.ts`, `backend/src/config/logger.ts`, `backend/src/controllers/oauth.controller.ts` |
| Correction | URL query stripped in the 404 handler; free-text redaction in `logError` and OAuth failure logs |
| Introduced | delta R1-R6 |
| Regression before / after | before: run `20261012T042603Z-df44a997` (integration file failed); unit file reported 4/4 (console); after: included in the 22 / 23 suites above |
| Env / evidence | unit + PG (log files) · artifact (integration) / console (unit) |
| Residual | decoys cover 404, normal error, slow request, OAuth callback; other log call sites were not exhaustively audited |

### R5 — `verify-migrations`
| Field | Content |
|---|---|
| Problem | The script had been destroyed by an earlier replacement (R5); the first restoration masked exit statuses and did not assert the historical row |
| Final files | `backend/scripts/test-db.sh`, `backend/scripts/test-guards.sh` |
| Correction | Guard before any write; every `prisma` exit status checked; success line required; historical row asserted exactly (`unknown|<NULL>`); 25 migrations finished in both DBs; clean = upgrade = `schema.prisma`; sanitized output + identity + manifest kept per run |
| Introduced / adjusted | delta R1-R6, then adjusted in `…060549Z` |
| Evidence | run `backend/artifacts/verify-migrations/20261012T060026Z-f2dc8cf6` **pass** on tree `bc7c2dc7…` (artifact with manifest); guard tests 18/18 (console) |
| Review basis | independent review of the R7/R8/R5 delta found the R5 adjustment addressed (output shown: 20 base + 5 new, 25 finished, no drift) |
| Residual | not re-run on the final tree (`test-db.sh` and migrations unchanged since); no production migration applied or authorized |

### R6 — guards on write-capable commands
| Field | Content |
|---|---|
| Problem | `migrate`, `verify-migrations` and the default Jest config could write to a target proven only by variables |
| Final files | `backend/scripts/test-db.sh` (`assert_target`), `backend/tests/support/db-target.ts`, `backend/tests/support/default-integration-guard.ts`, `scripts/e2e-isolated.sh`, `backend/jest.integration.config.js` |
| Correction | Loopback URL, port/name match, `docker port` of the own container and live marker required before any write; runner variables are not proof; negative tests without remote connection |
| Evidence | `test-guards.sh` 18/18 and `integration-access.test.ts` 6/6 (console); positive control reached the shimmed `pnpm` |
| Residual | guards are tooling for local runs; they are not a production safeguard |

### R7 — takeover vs completion race
| Field | Content |
|---|---|
| Problem | A taker read a recoverable lock, the owner completed and committed, and the taker reopened the `completed` record (second effect / consumption) |
| Final files | `backend/src/services/idempotency.service.ts` (compare-and-set takeover, re-read, `onAfterRead` test seam), `backend/src/services/coach/coach.service.ts` (single lock order window→record; reconciliation fences the dead owner) |
| Correction | Every transition out of a read state is a CAS on id/owner/status/lock/attempts; on loss the row is re-read and decided again |
| Introduced | `…060549Z` |
| Regression before / after | before: `20261012T055514Z-10c20d25` (3 failed / 1 passed, against the previous service plus only the test seam); after: `…055534Z-a880085d` 4/4 and full `…055945Z-684e1572` 23 / 141 |
| Env / evidence | PG · artifact |
| Review basis | independent review: the concrete R7 defect addressed by code and evidence; **not** a certification of all concurrency |
| Residual | the lock-order interleaving test passes also against the previous code: the former deadlock was **not reproduced**; order was fixed by review |

### R8 — session check separated from profile load
| Field | Content |
|---|---|
| Problem | One `catch` in the session check ended and revoked the server session on any error of `/auth/me` or of the profile load |
| Final files | `lib/contexts/auth-context.tsx`, `lib/api/auth.ts`, `lib/api/client.ts` (logout info), `backend/src/controllers/auth.controller.ts` (logout attribution log) |
| Correction | Only a definitive 401 of `/auth/me` discards the session, locally, without a logout request; 500/network/abort/profile failure keep it; explicit logout still revokes; every logout records reason and origin, never tokens |
| Introduced | `…060549Z` |
| Regression before / after | before: E2E run `20261012T060319Z-b81c0a17` (fails by design against the previous context; `revoked=1`; `auth-events` kept) and Jest 8/8 failing (console); after: E2E 14/14 `…060352Z-bca4e5f4`, `…061821Z-c42fd39c`, `…063117Z-c38e75c8` |
| Env / evidence | JSDOM + E2E · artifact (E2E) |
| **Not claimed** | that this mechanism caused the historical E2E failure `…255cfca9` (see §B-1) |

### R8-A — stale refresh
| Field | Content |
|---|---|
| Problem | A refresh started under session A could delete, overwrite or restore credentials after a login/logout in the same tab |
| Final files | `lib/api/client.ts` (session generation, revalidation at the write point, no replay for a request that outlived its session) |
| Introduced | `…062001Z` (R8AB) |
| Regression before / after | before: 7 failed / 2 control passed (summary in the R8AB bundle); after: Jest `__tests__/lib` 9 suites / 76 (bundle), E2E `…061821Z-c42fd39c` 14/14 |
| Env / evidence | JSDOM + E2E · artifact (summaries, E2E) |
| Review basis | independent review of R8AB: same-tab scenarios addressed; found R8-C |

### R8-B — stale profile publication / legacy migration
| Field | Content |
|---|---|
| Problem | A profile request of identity A could publish into the state of B or send the legacy migration under another identity |
| Final files | `lib/contexts/auth-context.tsx` (`loadProfile(user, isStale)`; identity re-checked after each await and before each effect) |
| Introduced | `…062001Z`; same regressions and runs as R8-A |

### R8-C — identity change between tabs
| Field | Content |
|---|---|
| Problem | When another tab signed in as B (shared storage only), the stored-pair adoption could replay an operation of A under B |
| Final files | `lib/api/client.ts` (`identityOf` by `sid`, pre-refresh identity check, adoption only for the same session, `hasIdentityDrifted`), `lib/contexts/auth-context.tsx` (drift is staleness) |
| Introduced | `…063242Z` (R8C) |
| Regression before / after | before: 4 failed / 2 control passed (summary in the R8C bundle); after: Jest `__tests__/lib` 11 suites / 82 (bundle), E2E `20261012T063117Z-c38e75c8` 14/14 on `dee09279…` |
| Env / evidence | JSDOM (two clients / shared storage; fake server applying the PUT to the user of `Authorization`) + E2E · artifact |
| Review basis | independent review of R8-C: addressed within the scope reviewed (see §0) |
| Residual | §B items 2–5 |

## B. Known residual risks (recorded; no solution implemented here)
| # | Risk | Evidence / where it came from |
|---|---|---|
| 1 | **Historical E2E failure `20261012T043534Z-255cfca9` — cause UNKNOWN.** `/api/profile` answered 200 before the logout; the mechanism reproduced later (profile 500/abort) is not the observed one. The refresh-race suspicion was not supported by the DB data. | `…060549Z/04-evidence`, `INCIDENT-e2e-session-revoked.md`, `ERRATA.md` |
| 2 | **`premium-form-voice` failure in run `…043219Z-74b2798b` — cause UNKNOWN.** The message is in the failure report; the earlier attribution to stranded `inc03` calls was **withdrawn** (no evidence). | `INCIDENT-premium-form-voice.md`, `STATUS-R7-R8-R5.md` |
| 3 | No visual synchronization between tabs (no `storage` events): a superseded tab stops migrating/publishing but is not refreshed until reload. | R8-C status |
| 4 | An abandoned rotated session A (late refresh 200 after login B) stays alive on the server until expiry; explicit logout revokes it. | R8AB / R8-C status |
| 5 | Opaque (non-JWT) tokens are compared by value: may reject a legitimate rotation from another tab; never accepts a foreign one. Identity is read from an unverified claim on the client (correlation only). | R8-C status |
| 6 | Other data hooks (`hooks/use-*.ts`) publish results without an identity check; all authenticated calls do go through `apiClient`. Not audited. | R8AB / R8-C status; static grep: only `lib/api/*` and `app/auth/callback/page.tsx` touch tokens |
| 7 | Lock-order deadlock of R7 not reproduced (order corrected by review). | `STATUS-R7-R8-R5.md` |
| 8 | Quota/operational caps (3/5/2) are experimental; commercial number per plan belongs to AI-15/AI-19. | `ai-08-acceptance-analysis-v1.md` |
| 9 | Security packet risks 1–10 (localStorage tokens + `'unsafe-inline'`, 10 s grace, legacy JWTs, OAuth fragment, no lockout, personal data in stored responses/logs, unverified production secrets, admin without MFA, endpoint set, runner findings). | `06-packet-security.md` |
| 10 | Local PostgreSQL ≠ deployment environment (managed provider, version, pooling); no scheduler for the retention job; production secrets not confirmed; D10 not executed. | closure matrix §B/§E, D10 plan |
| 11 | Migration 5 file was edited after being applied once in the local test DB and re-applied (04:29:42Z; checksum `4becd718…` = current file). History kept in `MIGRATION-5.md` (bundle `…053847Z`). No other environment is affected; the file must not be edited again. | `MIGRATION-5.md` |
| 12 | Historical isolation was invalidated for most earlier runs; statements about external contact stay limited to what was observed (document 03 and `evidence-validity-register-v1.md`). | document 03 |
| 13 | `tsconfig.json` and `jest.config.js` now exclude `artifacts/` (review bundles with `.ts` sources were being picked up). Configuration change, tooling only. | R7/R8/R5 status |

### Candidate new items found while consolidating (pending triage; not corrected, cause not asserted)
| # | Where | Observation | Effect |
|---|---|---|---|
| T-1 | `06-packet-security.md` § Files / Schema | Lists migrations `…030100`, `…030200`, `…040000` only; `…030000` and `…050000` are missing, and R7/R8 client files are listed only partly | stale reviewer map → superseded by `13-review-requests/` |
| T-2 | `04-artifact-inventory.md` §A | "Current" runs list stops at the first valid runs; later runs are not inventoried there | superseded by `11-…` |
| T-3 | `closure-matrix-v1.md` vs `ai-08-acceptance-analysis-v1.md` / `INDEX.md` | AI-08 is labelled "PENDIENTE — not closed" in the matrix and "BLOQUEADA for acceptance" in INDEX | label contradiction; **not resolved here** (no status change) |
| T-4 | `01-ai-01-evaluation.md` §B | cites `sourceTreeSha256 76df7605…` / `diffSha256 183782a8…` | historical; the delivered tree is now `dee09279…` |
| T-5 | `STATUS-R1-R6.md` / `INCIDENT-premium-form-voice.md` (bundle `…053847Z`) | state "sin mensaje" and a stranded-calls hypothesis | corrected/withdrawn by `ERRATA.md` and `STATUS-R7-R8-R5.md`; the older files are kept unmodified |

## C. Product / operation decisions pending (not gates of the technical findings)
Responses per plan and caps (AI-15/AI-19) · `Idempotency-Key` mandatory long term · access-token lifetime default and
long-term transport (cookie needs same-site API domain) · whether operational endpoints exist in production ·
retention values and personal-data retention of stored responses (AI-07) · scheduler for the retention job ·
staging environment yes/no · external log checks of document 03 · naming of the técnico and reviewers.

## D. Reviews and acceptances pending
| Review | Scope | State |
|---|---|---|
| Professional (AI-03; supports AI-04/AI-05) | ceilings, fallback, exclusions, referral wording | no reviewer named; `13-review-requests/13a-…` |
| Security (AI-06-AC10) | session model, isolation, logs | no reviewer named; `13-review-requests/13b-…` |
| Independent technical review of AI-08 | idempotency, quotas, migrations, guards | no reviewer named; separate from the security review; same file |
| Hermes / copy (AI-02, strings of AI-04/05) | copy diff | no Hermes reviewer available; `13c-…` |
| Legal (L1–L8) | items listed in `08-packet-legal.md` | no reviewer named; `13d-…` |
Task/gate statuses are **unchanged**: AI-01 PENDIENTE · AI-02 PENDIENTE · AI-03 BLOQUEADA · AI-04 / AI-05 PENDIENTE ·
AI-06 PENDIENTE (AC10 BLOQUEADA) · AI-08 not accepted (see T-3 for the label) · AI-14 not started · G1–G4 not evaluated,
not approved. Addendum A-08-01 (document 02) remains a **proposal**; no approval by Toni is recorded.

## E. Launch-only conditions (none executed or authorized)
B1 migration path · B2 production secrets confirmed by the owner · D10 (5 migrations now, backend, frontend, switches) ·
production smoke with the dedicated QA identity · scheduler/monitoring · G1–G4 with their reviewers · commercial authorization.

## F. Differences between the tested tree and the final tree
| Evidence | Tree | Differences to the final tree `dee09279…` that matter |
|---|---|---|
| backend integration 23 / 141 and `verify-migrations` | `bc7c2dc7…` | after it changed: `lib/api/auth.ts` (default logout reason), `backend/src/controllers/auth.controller.ts` (logout reason whitelist), `e2e/session-and-fallback.spec.ts` (attaching events), then the R8-A/B/C client/context files. Backend services, schema and migrations unchanged since `bc7c2dc7…` |
| auth/logout suites 3 / 37 and E2E 14/14 | `cad25298…` | R8-A/B/C client/context files and their tests |
| E2E 14/14 | `f3ad414f…` (R8AB) | R8-C client/context files and tests |
| E2E 14/14 + Jest client/context 11 / 82 | `dee09279…` | none (final) |
The complete integration suite and `verify-migrations` were **not** repeated on the final tree; the backend files they exercise did not change.

---
## Addendum 2026-10-12 (after the AI pre-assessments) — historical text above is unchanged
- **R6 (guards) reopened by NF-1 and re-covered**, and **new rows NF-1 / F-1 / F-2 / F-3** (mechanism, red/green, limits):
  see `16-correction-nf1-f1-f2-f3.md`. Status: implemented locally, uncommitted; nothing accepted.
- Integration run `backend/artifacts/test-runs/20261012T073824Z-846d1e27` (23 suites / 141 tests) has the code identity of `ed4bb64`;
  see §7 of doc 16. The statement in §D/§G that backend integration ran only on tree `bc7c2dc7…` is incomplete.

## Addendum 2026-10-12 (OAuth increment) — see `17-oauth-f4-handoff-and-linking.md`
F-4 reproduced in an isolated browser and corrected in the local scope; e-mail linking triaged (demonstrated) and closed by policy.
Nothing accepted; real-provider interoperability not evaluated.
