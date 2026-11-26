# History integrity F1 — Spec v1

## Problem
Training history (sessions, sets, personal records) is deleted by database cascades when its parent catalogue
exercise or routine is deleted:

- `backend/prisma/seed.ts` deletes every exercise whose name is not in the seed list and every duplicate by name.
  `Exercise` cascades to `SessionExercise` (and `SessionSet`), `PersonalRecord`, `WorkoutExercise` and
  `ExerciseProgressionState`. `DELETE /api/exercises/:id` (admin) has the same effect.
- `DELETE /api/workouts/:id` deletes the routine and `WorkoutSession.workout` cascades to its sessions.

Read-only production check (2026-11-25, aggregated counts only): no historical loss detected (92 sessions =
92 `complete_workout` XP events), but production holds 521 exercises against 389 names kept by the seed.
One seed run would delete 132 exercises and, by cascade, 90 of 92 sessions, 182 sets, 90 personal records and
94 routine exercises of 90 users.

## Functional requirements
- **FR-001** Exercises and routines gain a nullable `archivedAt` timestamp. Archived rows keep every relation.
- **FR-002** The database refuses to delete an exercise referenced by a session exercise, personal record,
  routine exercise or progression state, and refuses to delete a routine referenced by a session.
  The refusal is evaluated at end of statement (`NO ACTION`), so deleting a user still cascades all of the
  user's data in one statement.
- **FR-003** The catalogue seed never deletes exercises. Exercises absent from the seed list are archived;
  exercises present in the list are un-archived. Duplicates by name are archived, not merged or deleted.
- **FR-004** `DELETE /api/exercises/:id` archives a referenced exercise and physically deletes an unreferenced one.
  The endpoint keeps its current success response (204).
- **FR-005** `DELETE /api/workouts/:id` archives a routine that has sessions and physically deletes one that has
  none. The endpoint keeps its current success response.
- **FR-006** Archived exercises are excluded from the catalogue listing, catalogue metadata, and the candidate set
  of workout generation. `GET /api/exercises/:id` and history (sessions, records, progress) keep showing them.
- **FR-007** Archived routines are excluded from the routine list and from "latest routine" engagement lookups.
  Starting or logging a new session on an archived routine returns 404. Existing sessions keep their routine.
- **FR-008** Creating or updating a routine with an archived exercise is rejected with 422.
- **FR-009** The delete-routine dialog states that training history is kept. `docs/operations/DEPLOY.md` no
  longer instructs running the catalogue seed against production.

## Non-functional requirements
- **NFR-001** The migration is additive: two nullable columns, two indexes, and FK action changes. No data rewrite.
- **NFR-002** No production access by agents. Production rollout only through the protected migration workflow
  with OD-03 backup.
- **NFR-003** Tests first; all new behaviour covered by integration tests against PostgreSQL.

## Out of scope
Reconciling the 132 exercises outside the seed list; restoring archived items; an archive UI; F2–F5
(set completion, numeric input, idempotent session save, record recalculation, progression).

## Acceptance criteria
| ID | Criterion |
|---|---|
| F1-AC01 | Running the seed when an exercise outside the list has sessions, records, routine rows and progression state keeps 100 % of those rows; the exercise is archived |
| F1-AC02 | Running the seed twice leaves an identical exercise table (ids, names, `archivedAt` state) |
| F1-AC03 | `DELETE /api/exercises/:id` on a referenced exercise returns 204, archives it, and removes no history row; on an unreferenced exercise it removes the row |
| F1-AC04 | `DELETE /api/workouts/:id` on a routine with N sessions returns success, keeps N sessions with sets and records, and hides the routine from `GET /api/workouts` |
| F1-AC05 | `DELETE /api/workouts/:id` on a routine without sessions removes it physically |
| F1-AC06 | A direct SQL delete of a referenced exercise or of a routine with sessions fails with a foreign-key violation |
| F1-AC07 | Deleting a user still removes all of that user's routines and sessions |
| F1-AC08 | Archived exercises are absent from `GET /api/exercises`, metadata endpoints and generated plans; present in `GET /api/exercises/:id` and in session history |
| F1-AC09 | `POST /api/sessions` on an archived routine returns 404; creating a routine with an archived exercise returns 422 |
| F1-AC10 | Rehearsal on a Neon branch copy of production: after migration and two seed runs, 92 sessions, 182 exposed sets, 90 records and 521 exercises (active + archived) remain. **Pending: requires Toni (production access)** |
| F1-AC11 | Backend unit + integration suites, typecheck and build pass with no new failures |
