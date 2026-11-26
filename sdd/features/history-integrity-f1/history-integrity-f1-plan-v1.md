# History integrity F1 — Plan v1

## Schema (migration `20261126000000_history_integrity_archive_and_fk_guard`)
1. `exercises.archivedAt TIMESTAMP(3) NULL` + index.
2. `workouts.archivedAt TIMESTAMP(3) NULL` + index.
3. FK actions changed from `ON DELETE CASCADE` to `ON DELETE NO ACTION`:
   - `session_exercises.exerciseId → exercises`
   - `personal_records.exerciseId → exercises`
   - `workout_exercises.exerciseId → exercises`
   - `exercise_progression_states.exerciseId → exercises`
   - `workout_sessions.workoutId → workouts`

`NO ACTION` (not `RESTRICT`) is deliberate: PostgreSQL checks it at end of statement, so a user delete that
cascades to both `workouts` and `workout_sessions` in one statement still succeeds (F1-AC07), while a standalone
delete of the parent fails (F1-AC06).

## Services
- `exercises.service.ts`: listing and metadata filter `archivedAt: null`; `deleteExercise` archives when any
  reference exists, otherwise deletes; deleting a missing id keeps current behaviour.
- `workouts.service.ts`: list and generation candidates filter `archivedAt: null`; `getWorkoutById` keeps
  returning archived routines (history links); `deleteWorkout` archives when sessions exist; create/update
  reject archived exercise ids (422); update of an archived routine returns 404.
- `sessions.service.ts`: ownership check also requires `archivedAt: null`.
- `engagement.service.ts`: latest routine ignores archived ones.
- `prisma/seed.ts`: upsert by name, un-archive listed names, archive the rest and duplicates; no deletes.
- `prisma/seed-updated.ts`: removed (unreferenced script that deleted the whole catalogue).

## Frontend
- Delete-routine confirmation text states that history is kept (es/en).

## Docs
- `docs/operations/DEPLOY.md`: replace production seed instruction with a warning.

## Rollout (not executed by agents)
1. Rehearsal on a Neon branch from production (F1-AC10).
2. Protected `production-migrations.yml` with OD-03 backup and Toni's authorization.
