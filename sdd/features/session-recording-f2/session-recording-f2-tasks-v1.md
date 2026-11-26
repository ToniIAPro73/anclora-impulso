# Session recording F2 — Tasks v1

Branch: `development` (D5 = A). Decisions D1–D5 approved by Toni on 2026-11-26. Implemented locally, **uncommitted,
pending Toni's validation**. Nothing applied to production.

| Task | Criteria | Status | Evidence |
|---|---|---|---|
| T0 Reproduce current defects with tests (red) | AC01–AC06 | done | 6/6 red before the fix (see below) |
| T1 Decisions D1–D5 | — | done | approved: all recommendations (`session-recording-f2-decisions-v1.md`) |
| T2 Unit tests + pure functions (`lib/session-recording.ts`) | AC01–AC04, AC07, AC09 | done | `__tests__/lib/session-recording.test.ts` 32/32 |
| T3 Active-workout page: payload, validation, error handling, draft activity, resume/discard | AC01–AC07, AC09 | done | `__tests__/components/session-recording-f2.test.tsx` 9/9 |
| T4 Backend tests first, then validator/service (`recordingVersion`, v2 rules, legacy path) | AC06, AC08 | done | unit `session-recording-f2-validator.test.ts` 7/7; integration `session-recording-f2.test.ts` 4/4 |
| T5 Migration `20261126180000_session_recording_version` (isolated PostgreSQL 16) | AC06, NFR-001 | done | applied to the isolated test DB; release manifest regenerated (31 migrations, verified) |
| T6 Full suites, typecheck, lint, build | AC11 | done except build and visual QA | see below |
| T7 Neon branch rehearsal of the migration | AC10 | not started, needs Toni | — |
| T8 Production rollout (protected workflow, `PROMOTE=FULL`, QA check) | AC10 | not started, needs Toni | — |

## Implementation notes
- D2: `resistance_bands` added to the bodyweight allow-list (no kilogram value for bands). Pending Toni's validation.
- Validation failures return 400 (existing `validateBody` behaviour), not 422 as first written in the spec.
- AC04 page test: after D3 the old-draft test resumes the draft ("Reanudar borrador") before finishing; the assertion
  (duration ≤ 4 h) is unchanged. New page tests: discard (D3), AC07 bodyweight, AC09 no completed set.
- `legacy_session_payload` is logged (session id only) when a client omits `recordingVersion` (D4).
- `backend/scripts/test-db.sh test` fails on Linux (`cp -c` is macOS-only in `scripts/support/clone-backend.sh`);
  integration suites were run with the same target guard (`assert_target`) and clean environment (`clean_env_run`),
  from the working tree instead of a clone. Not changed in this task.

## T6 evidence (2026-11-26, local, working tree on `development` `9f8b89e` + F2 changes)
| Command | Result |
|---|---|
| backend `tsc --noEmit` | pass |
| backend unit `jest tests/unit` | 281/286 tests pass; failures only in `anclora-identity-oidc-e2e` 5 tests (pre-existing, TASK-045) |
| backend integration `jest --config jest.integration.config.js` (isolated PostgreSQL 16) | 33/33 suites, 228/228 tests |
| frontend `tsc --noEmit`, eslint on changed files | pass |
| frontend `jest` (full) | 34/35 suites, 231/233; `onboarding-dialog-feedback` 2 failures in the full run, 3/3 pass alone (intermittent, unrelated) |
| build (frontend/backend) | not run |
| visual QA (`anclora-visual-qa`) | not run: needs the migration in the target database and a QA login through Anclora Identity |

## T0 evidence (2026-11-26, `development` `9f8b89e`)
`npx jest --ci --coverage=false __tests__/components/session-recording-f2.test.tsx` → 6 failed / 6:
| Test | Failure observed (current code) |
|---|---|
| AC01 only completed sets | 2 exercises / 5 sets sent for 1 completed set (unmarked sets with reps 10/12, weight 0) |
| AC02 empty reps | no alert; the page records the target reps |
| AC03 decimal comma | weight `12,5` sent as 0 |
| AC04 duration of an old draft | 259 200 s sent (limit 14 400) |
| AC05 save error | no alert; the rejection escapes |
| AC06 `recordingVersion` | field absent |
After the fix the same file passes (9/9 with the D3, AC07 and AC09 tests added).
