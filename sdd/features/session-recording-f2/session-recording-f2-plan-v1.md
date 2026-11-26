# Session recording F2 — Plan v1 (decisions D1–D5 = A, approved)

## Schema (migration `<timestamp>_session_recording_version`)
1. `workout_sessions.recordingVersion INTEGER NOT NULL DEFAULT 1`. Existing rows read 1 (legacy). No data rewrite.

## Shared domain (new, pure, unit-tested)
- `lib/session-recording.ts` (frontend):
  - `parseDecimalInput(raw)` → number | null; accepts `,` and `.`, max 2 decimals, rejects anything else.
  - `allowsBodyweight(equipment)` → boolean (D2 allow-list).
  - `computeActiveDuration({ startedAt, lastActivityAt, now })` → seconds, gap rule 4 h, capped by D1.
  - `buildSessionPayload(workout, draft)` → `{ payload } | { errors }`; only completed sets; reps required; weight rule;
    `recordingVersion: 2`.
- No backend mirror of `allowsBodyweight`: the backend only sees the stored 0 and cannot tell an empty weight from an
  entered 0, so the bodyweight rule is enforced in the client; the backend validates ranges and decimals.

## Frontend (`app/workouts/[id]/start/page.tsx`)
- Draft type gains `lastActivityAt` and `version: 2`; every set edit/mark updates `lastActivityAt`.
- Restoring a draft older than 4 h (or without `lastActivityAt` and `startedAt` older than 4 h) shows the
  resume/discard dialog (D3).
- `handleFinish` uses `buildSessionPayload`; validation errors shown per field and in a `role="alert"` summary;
  `catch` shows a save error, keeps the draft and re-enables the button.
- es/en copy for the new messages (Hermes gate if any text is public-facing).

## Backend
- `createSessionSchema`: optional `recordingVersion` (`1 | 2`). For v2 (400 on failure): `duration` ≤ 14 400, at least
  one exercise, each exercise with ≥ 1 set, reps ≥ 1, weight ≥ 0 with ≤ 2 decimals. Without it: today's rules (D4), stored as 1,
  `legacy_session_payload` logged.
- `sessions.service.createSession` persists `recordingVersion`.
- Swagger/OpenAPI: `src/docs/swagger.ts` documents no sessions endpoint, so there is nothing to update.

## Rollout
1. Tests first (frontend reproduction tests already red; unit tests for the pure functions; backend integration tests).
2. Implement, local suites green, Toni validates in development, commit/push.
3. Neon branch rehearsal of the migration (as F1 T8), then `production-migrations.yml` with OD-03 backup.
4. `PROMOTE=FULL` (Render backend before Vercel frontend).
5. Production check with the QA account (needs QA credentials in Anclora Identity; otherwise service-level as F1).
