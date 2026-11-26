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
| T8 Rehearsal on a Neon branch copy of production | AC10 | **pending, needs Toni** | see below |
| T9 Production rollout through the protected migration workflow | — | **not started, needs Toni** | OD-03 backup, preflight, explicit authorization |

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
