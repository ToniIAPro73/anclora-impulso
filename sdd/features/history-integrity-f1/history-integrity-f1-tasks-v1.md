# History integrity F1 — Tasks v1

Branch `claude/project-thread-0c4f1l` (from `development` at `a80c88a`). Nothing is applied to production.

| Task | Criteria | Status | Evidence |
|---|---|---|---|
| T1 Tests first (catalogue and routines) | AC01–AC09 | done | `backend/tests/integration/history-integrity-f1.test.ts` (10 tests; first run failed on the missing sync module) |
| T2 Migration `20261126000000_history_integrity_archive_and_fk_guard` | FR-001, FR-002, NFR-001 | done | applied to isolated PostgreSQL 16; FK actions verified in `pg_constraint` |
| T3 `prisma/exercise-catalog-sync.ts` + `seed.ts` | FR-003 | done | AC01, AC02 |
| T4 Exercise service: archive on delete, hide archived | FR-004, FR-006 | done | AC03, AC08 |
| T5 Workout, session and engagement services | FR-005, FR-007, FR-008 | done | AC04, AC05, AC09 |
| T6 Remove `prisma/seed-updated.ts` (deleted whole catalogue, no references) | FR-003 | done | `git rm` |
| T7 Delete-routine dialog text, `DEPLOY.md` warning | FR-009 | done | frontend tsc, eslint, jest pass |
| T8 Rehearsal on a Neon branch copy of production | AC10, AC04, AC06 | **done, validated by Toni (2026-11-26)** | see "T8 rehearsal result" below |
| T9 Production rollout through the protected migration workflow | AC04, AC06 (production) | **done, pending Toni validation** | see "T9 production rollout" below |

## Existing tests adjusted
- `tests/unit/workouts-service-integrity.test.ts`: exercise mock gains `count` (new active-exercise check on manual routine updates).
- `tests/integration/inc04-retention-and-limits.test.ts`: the cleanup deleted an exercise still used by a generated routine, which the database now refuses; it removes the routine first.

## Executed checks (isolated PostgreSQL 16, loopback, synthetic data)
| Command | Result |
|---|---|
| `jest --ci --runInBand tests/integration/history-integrity-f1.test.ts` | 10/10 pass |
| `jest --ci --runInBand` (backend, full) | 63 suites pass, 1 fails: `anclora-identity-oidc-e2e` 5 tests (`code_challenge_method` is null). **Same 5 failures before any change** (baseline run), unrelated |
| `tsc --noEmit` and `pnpm build` (backend) | pass |
| Frontend `tsc --noEmit`, eslint on the changed component, `jest` | pass (192 tests) |

## Not executed
Playwright E2E, any production or Neon access, CI workflow, `PROMOTE`.

## T8 rehearsal procedure (for Toni)
1. Create a Neon branch from production. Do not use the production branch.
2. `prisma migrate deploy` against the branch URL, then run the seed twice with the branch URL.
3. Run the read-only SQL checks: 92 sessions, 182 sets exposed, 90 records, 521 exercises (active + archived).

## T8 rehearsal result (2026-11-26)
Neon project `lucky-hat-25002521`, branch `br-winter-boat-agfqm57r` (endpoint `ep-lucky-sky-agfdlhim`), created by Toni
from `br-gentle-bar-ag3slpph`. Code at `development` `74080e0`. Every command ran behind a host guard that refused the
production endpoint `ep-lingering-paper-agjnrga3`; every check ran in a `READ ONLY` transaction with aggregated counts.
Nothing was run against the production branch. Each write step was confirmed by Toni beforehand.

### Ledger before migration
29 applied, 8 historical rollbacks (all re-applied later), 0 unfinished, 37 rows. Compared with the 30 migration
directories, the only pending migration was `20261126000000_history_integrity_archive_and_fk_guard`. M28
(`20261113060000`) and identity links (`20261113103000`) are applied, so `.anclora/PRODUCTION_RUNTIME.md`
(`MIGRATION_RUNNER_STATUS`, still "M27 / 27 applied") is out of date.

### Counts
| Stage | Sessions | Session exercises | Sets | Records | Routines | Routine exercises | Progression states | Exercises (active / archived) | Exercise fingerprint |
|---|---|---|---|---|---|---|---|---|---|
| Before | 92 | 98 | 206 | 98 | 98 | 125 | 41 | 521 (no column) | — |
| After `migrate deploy` | 92 | 98 | 206 | 98 | 98 | 125 | 41 | 521 (521 / 0) | `4ab9ad76…` |
| After seed run 1 | 92 | 98 | 206 | 98 | 98 | 125 | 41 | 521 (389 / 132) | `81c6bff3…` |
| After seed run 2 | 92 | 98 | 206 | 98 | 98 | 125 | 41 | 521 (389 / 132) | `81c6bff3…` |

- The 25-11 reference figures (90 records, 182 sets) are the rows *exposed* to the old seed; the totals are 98 records
  and 206 sets. Exposure check before and after: 132 exercises outside the list, 0 duplicates, 90 sessions, 182 sets,
  90 records, 94 routine exercises, 90 users. All of these rows still exist.
- Seed run 1: created 0, updated 416, archived 132. Seed run 2: created 0, updated 416, archived 0.
  Fingerprint = md5 of `(id, name, archivedAt)`, identical after both runs (F1-AC02).
- The archived set equals the set of exercises outside the seed list: 132 archived outside the list, 0 active outside
  the list, 389 active in the list, 0 archived in the list. No un-archiving was observed (no archived rows existed
  before run 1). All 132 archived exercises keep their references. 0 orphan rows. Forensic check: 0 lost sessions,
  0 XP deficit (92/92), 0 deleted routines.
- FK delete actions after migration: the five guarded relations are `NO ACTION`; `workout_exercises → workouts`
  stays `CASCADE` as planned.

### Deviation outside F1 scope: the seed also writes the recipe catalogue
Seed run 1 created 20 new system recipes ("Cena mediterranea de … con arroz integral/quinoa y brocoli, zanahoria y
pimiento") present in the current seed but not in production: recipes 471 → 491, system recipes 454 → 474,
recipe ingredients 2701 → 2841. Ingredients unchanged (128). Run 2 changed nothing (recipe ingredients are re-created
with new ids). 12 duplicate system-recipe names already existed before the seed. This confirms the seed must not
be run against production. Latent issue: the seed list has 416 entries for 389 unique names; if a repeated name did
not exist in the database, `syncExerciseCatalog` would create it twice. Not triggered here.

### Routine delete test (F1-AC04, F1-AC06), dedicated QA user
A test routine with 1 session, 1 session exercise and 3 sets was created for `qa.impulso@anclora.local` on the branch.
A direct SQL delete was refused with `23503` (`workout_sessions_workoutId_fkey`) and rolled back. `deleteWorkout()`
archived the routine: it still exists, history unchanged (1 / 1 / 3), hidden from `getUserWorkouts`, readable by id.
Result PASS. The test data remains on the branch (93 sessions there from now on).

### Verdict
F1-AC10 PASS on the branch. Evidence (aggregates only) is kept outside the repository in
`anclora-verificacion/resultados/`. The Neon branch can be deleted when Toni decides; agents do not delete it.
Toni deleted the rehearsal branch `br-winter-boat-agfqm57r` after validating T8.

## T9 production rollout (2026-11-26)
Neon `lucky-hat-25002521` / `br-gentle-bar-ag3slpph` (endpoint `ep-lingering-paper-agjnrga3`). Candidate `74080e0`.
Every write step was confirmed by Toni in writing; read-only checks ran in `READ ONLY` transactions.

### Preflight (read-only)
- Production matched the rehearsal before migrating: 92 sessions, 98 session exercises, 206 sets, 98 records,
  98 routines, 125 routine exercises, 41 progression states, 521 exercises, 565 users; the five guarded FKs still
  `CASCADE`; ledger 37 rows, 29 applied, 8 historical rollbacks, 0 unfinished; only F1 pending.
- OD-03 backup: Neon branch `br-small-poetry-ag75p3vh` from `br-gentle-bar-ag3slpph`, created
  `2026-11-26T01:48:15Z` (created by Toni; it expires on 2026-11-27 unless Toni removes the expiry).
- `scripts/verifier/operator-preflight.ts` (`--baseline-count 29`, `--max-backup-age-minutes 30`):
  `READY_FOR_HUMAN_AUTHORIZATION`, report SHA-256 `8fba34fedf68974c0ee2c88fe84fec1fd7c5a802605c99dc910e11734ab68b37`.

### Migration
- `production-migrations.yml` run `45738373135` (2026-11-26T01:49:54Z → 01:50:59Z) on `development` = `74080e0`,
  environment approved by Toni: both jobs `success`. Live backup verification: `br-small-poetry-ag75p3vh`,
  branch, 149 s old (limit 30 min). Applied `20261126000000_history_integrity_archive_and_fk_guard`.
  Attestation artifact `migration-attestation` id `15080520629`.
- Post-migration (read-only): ledger 30 applied, 8 historical rollbacks, 0 unfinished; `archivedAt` on `exercises`
  and `workouts`; the five guarded FKs `NO ACTION`, `workout_exercises → workouts` `CASCADE`. All counts unchanged;
  exercise fingerprint `4ab9ad76…` (same as the rehearsal after migration); 0 orphans; 0 lost sessions.

### Promotion
- `PROMOTE=FULL` by Toni. `promote.yml` run `45738595312` (`target=full`, `source_sha=74080e0`): `success`.
  `development`, `staging`, `production` and `main` at `74080e00256c2aa3c5d6de66527536908dbaf7fc`.
  Render live deploy of that SHA is inferred from the workflow gate (it advances `main` only after it); not checked
  in Render directly. `GET /health/live` on the Render backend: 200.

### Routine delete test in production (option a), dedicated QA user
Password login is disabled (Anclora Identity) and the QA password is not available, so the test ran the service
code of `74080e0` (the deployed commit) locally against the production database instead of through the deployed
API. A test routine "F1 production delete test" (`273f03a7-2814-4ac3-84a4-7c03f598a64e`) with 1 session
(`6a66da8e-8928-4dde-b143-e1570b1b9c89`), 1 session exercise and 3 sets was created for `qa.impulso@anclora.local`.
A direct SQL delete was refused with `23503` and rolled back. `deleteWorkout()` archived the routine: it still exists,
history unchanged (1 / 1 / 3), hidden from `getUserWorkouts`, readable by id. Result PASS. Test data kept
(`QA_DELETE_AFTER_TEST=false`). Production now: 93 sessions, 99 session exercises, 209 sets, 99 routines
(98 active, 1 archived), 126 routine exercises; 521 exercises, all active (the seed is not run in production).

### Pending
- End-to-end delete test through the deployed API with the QA account (needs QA credentials in Anclora Identity).
- `.anclora/PRODUCTION_RUNTIME.md` `MIGRATION_RUNNER_STATUS` still describes M27; it should record M28, identity
  links and this F1 run.
- The 132 exercises outside the seed list stay active in production; archiving them requires an explicit decision
  (the seed must not be run against production: it also creates 20 system recipes).
