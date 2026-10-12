# INC-01 Data integrity — Tasks v1

Base SHA `77f852aa3a1c67b8d1f58bb8852d408b0a8c0523`, branch `development`; changes are **uncommitted working-tree** modifications (see `git diff` + untracked files below).

| Task | Roadmap | Status | Evidence |
|---|---|---|---|
| T1 Limits + validator + tests | AI-04 | implemented, unit-verified | `tests/unit/workout-plan-validator.test.ts` |
| T2 Deterministic fallback + tests | AI-05 | implemented, unit-verified | `tests/unit/deterministic-fallback.test.ts` |
| T3 Wire generation through validator/fallback | AI-04/05 | implemented, unit-verified (mocked Prisma/LLM) | `tests/unit/workouts-service-integrity.test.ts` |
| T4 Transactional routine update | AI-08 | implemented; mock-verified call routing only | same file |
| T5 Atomic coach quota | AI-08 | implemented; mock-verified predicate and 429 path only | `tests/unit/coach-quota.test.ts` |
| T6 DB-level rollback / concurrency / no-partial-write tests | AI-04/08 | **BLOCKED** | Needs D1 |
| T7 Persist generation mode/version | AI-04/05 | **BLOCKED** | Needs D3 (migration path) |
| T8 Idempotent retry key | AI-08 | **NOT STARTED** | Needs design + D3 |
| T9 Reviewed limits/templates | AI-03→04/05 | **BLOCKED** | Needs D2 |
| T10 Frontend notice of fallback mode | AI-05 | **NOT STARTED** | Needs copy approval (Hermes gate) |

## Defect found by real-DB tests (fixed)
Concurrent creation of the first coach window made `prisma.coachUsageWindow.upsert` throw `P2002` (9 of 12 concurrent requests failed with 500, quota not exceeded). Fixed in `coach.service.ts`: `createMany({skipDuplicates: true})` (`ON CONFLICT DO NOTHING`) then read by unique key; the conditional `updateMany` is unchanged.

## Environment (2026-10-12)
Isolated PostgreSQL 16 (`anclora-impulso-test-postgres`, `127.0.0.1:54329`, db `anclora_impulso_test`), exception `IMPULSO-TEST-DB-2026-10-12`. Effective Prisma target verified from the CLI datasource line and the live `anclora.test_marker`. Existing 20 migrations applied to this database only. Other projects' containers (`:5432`, `:5433`) untouched. Operation guide: `backend/docs/TEST_DATABASE.md`.

## Executed checks (all local; backend working directory; diff = uncommitted changes on base `77f852aa`)
| Command | Result |
|---|---|
| `./scripts/test-db.sh migrate` | 20 migrations applied; datasource `127.0.0.1:54329 / anclora_impulso_test` |
| `./scripts/test-db.sh test tests/integration/inc01-data-integrity.test.ts` | 15/15 pass (after fix; first run 14/15, failing case = defect above) |
| `./scripts/test-db.sh test` (all integration) | 13 suites / 43 tests pass |
| `pnpm exec jest --ci tests/unit` (default config) | 6 suites / 45 tests pass |
| Guard negatives (remote host; loopback wrong port; no script) | 3/3 refuse before any connection |
| Default config on an integration file without script | refused with guard message |
| `pnpm run typecheck` / `pnpm build` (clean env, local DATABASE_URL) | pass |

## Not executed
Frontend lint/typecheck/build/tests (no frontend files changed); E2E (Playwright, no UI change); CI workflow (no push). Groq network calls: none (LLM module mocked, credentials absent).

## Criterion-by-criterion
| Criterion | Implementation verified | Acceptance |
|---|---|---|
| AI-04-AC01 invalid corpus rejected | yes (unit suites + 5 real-DB cases) | PENDIENTE — limits not professionally reviewed (AI-03) |
| AI-04-AC02 no write of rejected output | yes (real DB) | PENDIENTE (AI-03) |
| AI-04-AC03 version and mode | response-only; **not persisted** | PENDIENTE — needs schema decision (D3) |
| AI-04-AC04 DB check after failure | yes | PENDIENTE (AI-03) |
| AI-05-AC01 outage/credential/invalid → plan | yes (error, rejected output, absent credential) | PENDIENTE (AI-03 templates) |
| AI-05-AC02 same input ⇒ same plan | yes (unit + real DB) | PENDIENTE (AI-03) |
| AI-05-AC03 mode visible | in API response only; no UI | PENDIENTE — UI/copy not done |
| AI-08-AC01 rollback | yes (real DB, 2 failure kinds) | implementation verified; task not complete (see AC03) |
| AI-08-AC02 quota concurrency | yes (real DB) | implementation verified; task not complete |
| AI-08-AC03 retry idempotency | **no** | NOT MET → AI-08 **incomplete** |
| AI-08-AC04 period/reset | partial | decision needed |

## Not covered / residual
- Idempotency of retries (quota and routine create/update): needs client idempotency key + storage ⇒ schema proposal, not applied.
- Coach response cache is per process (`Map`); across serverless instances a repeated message can still consume quota.
- Groq clients set no explicit timeout (SDK default, unverified); a hung provider delays the request before fallback.
- `workouts.service` rejection logs include violation codes only; no metric/alert on fallback rate yet.
- Prompt still does not tell the model the ceilings (sets ≤5, reps ≤15, rest ≤75 s): expect high fallback rate until aligned with AI-03 values.
- Limitations/injury mapping to exercises not implemented (needs AI-03).

## Evaluation
AI-04: PENDIENTE · AI-05: PENDIENTE · AI-08: PENDIENTE (incomplete: AC03). None BLOCKED by environment any more; remaining blocks are AI-03 review, schema/migration-path decision and idempotency design. G1 not evaluated.


---

# Update 2026-10-12 (second pass)

## Schema proposals applied to the isolated database only (3 migrations, expand-only)
| Migration | Content | Rollback |
|---|---|---|
| `20261012030000_add_workout_generation_provenance` | `workouts.generationMode` (default `unknown`, CHECK in ai/fallback/manual/unknown), `generationVersion`, `generationReason` | drop columns/constraint (documented in file) |
| `20261012030100_add_idempotency_records` | table `idempotency_records`, unique (userId, operation, key), status CHECK | drop table |
| `20261012030200_add_auth_sessions` | `users.disabledAt`, tables `auth_sessions`, `refresh_tokens` | drop tables/column |

Validation (`./scripts/test-db.sh verify-migrations`): baseline of the 20 existing migrations + one synthetic historical
workout → 3 new migrations applied → historical row reads `mode=unknown version=NULL`; clean install of all 23 gives
**no schema difference** against the upgraded DB and against `schema.prisma`. **Not applied to production**; production
migration path (D3 discrepancy Supabase vs Prisma/Neon) remains an open decision.

## What changed
- `workouts.service.ts`: provenance persisted (`createWorkout(..., provenance)`), `generation` returned by every read path; manual creation = `manual`.
- `idempotency.service.ts` + `coach.service.ts`: persistent idempotency (see spec AC03/AC05), provider timeout (504), quota release on failure, `Idempotency-Key` header, `Idempotent-Replayed` response header, replay marked `idempotentReplay`.
- `PUT /api/workouts/:id` now validates its body (`updateWorkoutSchema`); previously the raw body reached the ORM.
- Frontend: `Workout.generation` type; fallback notice in `workout-generator.tsx` (copy requires the Hermes copy gate).

## Evidence (isolated DB; clean env; diff = uncommitted working tree on `77f852aa`)
| Check | Result |
|---|---|
| `inc01-data-integrity` (real DB) | 16/16 |
| `inc02-coach-idempotency` | 10/10: replay, conflict 422, 10 simultaneous ⇒ 1 execution, in-flight 409, failure releases slot + retry, timeout 504 + retry, restart (stale lock takeover + cold-module replay), retention/purge, per-user scoping, HTTP header |
| Full backend integration | 17 suites / 90 tests pass (see final run in delivery report) |

## Criterion status (cumulative)
| Criterion | Implementation | Acceptance |
|---|---|---|
| AI-04-AC01/02/04 | verified | PENDIENTE — AI-03 |
| AI-04-AC03 mode/version persisted | verified | PENDIENTE — AI-03; production migration not decided |
| AI-05-AC01/02 | verified | PENDIENTE — AI-03 |
| AI-05-AC03 mode visible | API + UI notice implemented; no browser E2E run | PENDIENTE — copy gate and visual review |
| AI-08-AC01 rollback | verified | verified |
| AI-08-AC02 quota concurrency incl. first window | verified | verified |
| AI-08-AC03 idempotency (keyed) | verified | verified for clients that send the key; **frontend does not send it yet** |
| AI-08-AC04 period/reset | window `LLM_COACH_WINDOW_MINUTES`, epoch-aligned; product reset semantics undecided | OPEN — D9 |
| AI-08-AC05 quota policy | implemented as proposal | OPEN — D9 |

**AI-08 is not closed**: the quota policy needs a product decision (D9), the client does not send `Idempotency-Key`,
and idempotency of `POST /workouts/generate` (duplicate routines on retry) is not covered.


---

# Update 2026-10-12 (third pass: D9, complete idempotency, E2E)

## Behaviour and design
- **Reservation model** (`coach.service.ts`): reservation by one conditional UPDATE (`requestCount < limit AND failedAttempts < cap`); persisted answer + idempotency completion in ONE transaction; any failure releases the reservation and increments `failedAttempts` (also on unknown-outcome timeouts).
- **Ledger** (`idempotency.service.ts`): `ownerToken` per takeover, `attempts` bound, completion owner-checked and transactional; `IdempotencyOwnershipLostError` aborts a stale owner's transaction.
- **`POST /workouts/generate`**: idempotent (`generateWorkoutIdempotent`), creation + completion in one transaction; LLM call bounded (`LLM_WORKOUT_TIMEOUT_MS`, falls back with reason `ai_timeout`).
- **Transition of previous clients**: no header → server-derived 30 s-bucket key (dedupes double taps only), `Deprecation: true` + `Warning`; `IDEMPOTENCY_KEY_ENFORCEMENT=require` or a past `IDEMPOTENCY_LEGACY_SUNSET_AT` → 428. Default `warn` keeps production behaviour; the shipped frontend always sends the key.
- New migration `20261012040000_add_coach_usage_operational_counters` (applied to the isolated DB only).

## Differences from earlier tests
| Earlier test / expectation | Now | Why |
|---|---|---|
| `llm-coach`: repeated prompt returns `cached: true` | returns `idempotentReplay: true` + `Idempotent-Replayed` + `Deprecation` | legacy clients get a persistent derived key; per-process cache is only used by callers without a gate |
| `inc01` characterization: retry consumes quota twice | same, now labelled "without a key" | keyed behaviour is covered in `inc02`/`inc03` |
| `coach-quota` unit mocks (upsert/predicate only) | reservation predicate includes failure cap; 429 body asserted; release on persist failure | D9 |
| Startup test "strong config starts clean" | requires `AUTH_ACCEPT_LEGACY_TOKENS=false`; new case: strong secrets + legacy on = reported NOT acceptable | legacy acceptance is a warning finding |
| Security unit: legacy finding was `info` | `warning` | revocation incomplete while legacy accepted |

## Evidence (isolated DB; diff = uncommitted working tree on `77f852aa`)
| Check | Result |
|---|---|
| `inc03-idempotency-hardening` (real PostgreSQL) | 16/16: stale owner after lock expiry (coach and generate), owner-checked completion, atomic rollback on lost ownership, lost response replay, 5 simultaneous generate ⇒ 1 routine, 422 conflict, unknown-outcome timeout, attempts bound, failure cap, concurrency cap, reset instant + Retry-After, transition/enforcement/sunset |
| Backend integration, all suites | see delivery report (run after last code change) |
| Frontend jest | `idempotency` (9) + `api-client-refresh` (6) + existing |
| Playwright E2E (isolated stack) | 13/13 |

## Criterion status (cumulative, after this pass)
| Criterion | Implementation | Acceptance |
|---|---|---|
| AI-08-AC01/02 rollback, quota concurrency | verified | verified |
| AI-08-AC03 idempotency (coach + generate, keyed) | verified incl. crash/lock-expiry/lost-response | verified for keyed clients |
| AI-08-AC05 D9 policy; AC06 operational caps; AC08 owner/versioned lock; AC09 unknown outcome | verified | verified as engineering behaviour |
| AI-08-AC07 key lifecycle (client) | verified (unit + E2E) | verified |
| AI-08-AC04 period/reset | fixed 60-min windows with exact reset instant | policy adopted; **plan-level quota numbers not linked to the commercial offer → AI-08 NOT closed** |
| AI-04 / AI-05 | verified | **PENDIENTE — AI-03 review absent**; mode visible in UI (E2E) but copy gate **BLOCKED** |

## Why AI-08 is still not closed
(1) number of responses per plan is a placeholder configuration with no commercial link; (2) operational caps are
engineering defaults without approval; (3) production migration/deploy not executed (D10 plan only); (4) scheduled
purge of expired idempotency records/sessions is not wired to a scheduler.

## Own-change inventory and recovery (no blanket revert)
The working tree was clean at the start, so every uncommitted change belongs to this work; nothing of anyone else's
was present. Recover **by group, with explicit paths**, never with a global reset/stash/clean:
| Group | Paths |
|---|---|
| Quota/idempotency | `backend/src/services/{idempotency,coach/coach}.service.ts`, `backend/src/services/coach/{types.ts,providers/groq.provider.ts}`, `backend/src/middleware/{idempotency,errorHandler}.ts`, `backend/src/controllers/{coach,workouts}.controller.ts`, `backend/src/services/workouts.service.ts`, `backend/src/config/env.ts` |
| Sessions/security | `backend/src/services/{session,auth,oauth}.service.ts`, `backend/src/middleware/auth.ts`, `backend/src/utils/{jwt,security-config,redact}.ts`, `backend/src/server.ts`, `backend/src/controllers/{auth,oauth,dashboard}.controller.ts`, `backend/src/routes/{dashboard,workouts}.routes.ts`, `backend/public/dashboard.html` |
| Schema | `backend/prisma/schema.prisma`, `backend/prisma/migrations/2026101203*`, `…2026101204*` (data rule: never drop the new tables/columns as part of a rollback — see D10 §6) |
| Frontend | `lib/{idempotency.ts,api/*}`, `hooks/use-workouts.ts`, `components/{workout-generator,dashboard-user-menu}.tsx`, `app/auth/callback/page.tsx`, `__tests__/lib/*` |
| Test infrastructure | `backend/{docker-compose.test.yml,docker/,scripts/test-db.sh,jest*.js,tests/support/,tests/**}`, `scripts/e2e-isolated.sh`, `e2e/**`, `.gitignore` (adds `artifacts/`) |
| Documentation | `sdd/features/impulso-pilot-*`, `backend/docs/TEST_DATABASE.md`, `backend/.env.example`, `.anclora/AOS_ADOPTION.md` (exception block) |
Safe per-file recovery of a tracked file: `git diff -- <path>` to review, then `git checkout -- <path>` for that path
only. Untracked new files: delete by explicit path. Test database: `backend/scripts/test-db.sh down`.


---

# Update 2026-10-12 (fourth pass: technical closure)

Documents added: `incident-inc03-intermittent-failure-v1.md`, `coach-capability-status-v1.md`,
`limits-scope-and-pilot-quota-proposal-v1.md`, `retention-and-purge-v1.md`; cross-cutting matrix:
`../impulso-pilot-baseline/closure-matrix-v1.md`; copy diff: `../impulso-pilot-professional-review/ai-02-copy-diff-for-hermes-v1.md`.

Changes: retention/purge (logical vs physical), held executions never taken over, deterministic in-flight admission,
failure-capture reporter and `TEST_RANDOMIZE`, runner isolation (copy without env files, shielded API, probe),
neutral generator copy + real mode badge, `final-state` and `inc04` suites.

Verification of this pass: backend integration 20 suites / 126 tests; unit 7 / 57; frontend jest 11 / 96;
Playwright 13/13 on the corrected runner; `verify-runner-isolation.sh` all PASS; `verify-migrations` clean.
AI-08 remains **not closed** (see closure matrix B/C).
