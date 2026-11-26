# Session recording F2 — Spec v1 (approved 2026-11-26)

## Problem
The active-workout page (`app/workouts/[id]/start/page.tsx`) does not record what the user actually trained.
Verified in code at `development` `9f8b89e` and reproduced by `__tests__/components/session-recording-f2.test.tsx`
(6 tests, all red before the fix):

| # | Defect | Code | Effect |
|---|---|---|---|
| D1 | Every planned set is sent, completed or not | `handleFinish` maps all `setState` entries; `completed` is ignored | Untrained sets become history, volume, records and progression input |
| D2 | Empty reps take the target value | `reps: Number(set.reps) \|\| exercise.reps` | Reps never entered are recorded as performed |
| D3 | A decimal comma becomes 0 kg | `weight: Number(set.weight) \|\| 0`; `Number('12,5')` is `NaN` | 12,5 kg is recorded as 0 kg (Spanish keyboards type a comma) |
| D4 | Duration is measured from the draft start | `elapsedSeconds = now - startedAt`; a restored draft keeps its original `startedAt` | A draft resumed after 3 days records ~259 200 s |
| D5 | Save errors are not caught | `try { … } finally { setIsSaving(false) }` without `catch` | The user gets no feedback; the rejection escapes |

Production context (read-only, 2026-11-26): 93 sessions, 209 sets; 24 sets stored with weight 0 across 8 exercises.
The catalogue marks 118 exercises with `equipment = 'bodyweight'`. `SessionSet.weight` is a non-null `Float`.

Already decided by Toni: inactivity threshold **4 h**; sessions recorded before F2 ("legacy") are **excluded from
personal records and progression** (applied in F4/F5, enabled here by `recordingVersion`).

## Functional requirements
- **FR-001** Only sets marked as completed are sent. Exercises without completed sets are omitted. A session with no
  completed set cannot be finished (the page explains why; the draft is kept).
- **FR-002** A completed set must have reps entered by the user (integer ≥ 1). Empty or invalid reps block finishing
  with a field-level message; the target value is never substituted.
- **FR-003** Weight accepts `.` and `,` as decimal separator (`12,5` → 12.5), at most 2 decimals, ≥ 0. Invalid input
  blocks finishing with a field-level message; it never becomes 0 silently.
- **FR-004** Empty weight is accepted only for exercises that allow bodyweight (decision **D2**); it is stored as 0.
  For other exercises an empty weight on a completed set blocks finishing.
- **FR-005** The draft records `lastActivityAt` (set edited or marked). Duration = active time from `startedAt` to the
  last activity, excluding any inactivity gap longer than 4 h (decision **D3** for drafts without `lastActivityAt`).
  Duration is never negative and never exceeds the API maximum (decision **D1**).
- **FR-006** A failed save shows an accessible error (`role="alert"`), keeps the draft, re-enables the button and does
  not navigate. A retry re-sends the same payload (idempotency itself is F3).
- **FR-007** New sessions carry `recordingVersion = 2`. The backend stores it (`WorkoutSession.recordingVersion`,
  default 1). Sessions without it are legacy (decision **D4**).
- **FR-008** The backend rejects a v2 session with a duration above the maximum, a set with reps < 1, or an empty
  exercise list (400, the existing validation status of `validateBody`). Legacy behaviour for requests without `recordingVersion` follows decision **D4**.

## Non-functional requirements
- **NFR-001** Migration additive only: one column `workout_sessions.recordingVersion INT NOT NULL DEFAULT 1`. Existing
  rows become 1 (legacy). Applied through `production-migrations.yml` with OD-03 backup **before** the backend deploy.
- **NFR-002** Backward compatible deploy: backend first (accepts old and new payloads), frontend after (same
  `PROMOTE=FULL` chain: Render before Vercel).
- **NFR-003** Tests first. Payload building, decimal parsing and duration are pure functions with unit tests; the page
  keeps the RTL reproduction tests; backend validation covered by integration tests on isolated PostgreSQL.
- **NFR-004** UI copy in es/en; error messages accessible (WCAG 2.1 AA, `role="alert"`, field `aria-invalid`).

## Out of scope
Idempotent save and retry de-duplication (F3); recalculating personal records (F4); progression on faithful history
(F5); editing past sessions; backfilling legacy sessions; a `loadType` field on `Exercise` unless chosen in D2.

## Acceptance criteria
| ID | Criterion |
|---|---|
| F2-AC01 | Finishing with 1 of 5 sets completed sends exactly that set; exercises without completed sets are omitted |
| F2-AC02 | A completed set with empty reps blocks finishing with an alert; nothing is sent; the target is never used |
| F2-AC03 | `12,5` and `12.5` are sent as 12.5; `abc` blocks finishing with a field message |
| F2-AC04 | A draft restored days later records a duration ≤ the API maximum, computed from activity, not from `startedAt` |
| F2-AC05 | A failed save shows an alert, keeps the draft, re-enables the button and does not navigate |
| F2-AC06 | The payload carries `recordingVersion: 2`; the backend stores it; legacy rows read as 1 |
| F2-AC07 | Empty weight on a bodyweight exercise is accepted (stored 0); on a loaded exercise it blocks finishing |
| F2-AC08 | Backend: v2 payload with duration > maximum, reps < 1, no exercises or > 2 weight decimals → 400; legacy payload per D4 |
| F2-AC09 | Finishing with no completed set is blocked with an explanation; the draft is kept |
| F2-AC10 | Migration rehearsed on a Neon branch, then applied through the protected workflow; counts unchanged, all existing sessions `recordingVersion = 1` |
| F2-AC11 | Frontend and backend suites, typecheck, lint and build pass with no new failures |
