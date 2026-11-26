# Session recording F2 — Tasks v1

Branch: `development` (D5 = A). Decisions D1–D5 approved by Toni on 2026-11-26. Implemented, validated by Toni and pushed
(`aaa8f44`); migrated and promoted to production on 2026-11-26.

| Task | Criteria | Status | Evidence |
|---|---|---|---|
| T0 Reproduce current defects with tests (red) | AC01–AC06 | done | 6/6 red before the fix (see below) |
| T1 Decisions D1–D5 | — | done | approved: all recommendations (`session-recording-f2-decisions-v1.md`) |
| T2 Unit tests + pure functions (`lib/session-recording.ts`) | AC01–AC04, AC07, AC09 | done | `__tests__/lib/session-recording.test.ts` 32/32 |
| T3 Active-workout page: payload, validation, error handling, draft activity, resume/discard | AC01–AC07, AC09 | done | `__tests__/components/session-recording-f2.test.tsx` 9/9 |
| T4 Backend tests first, then validator/service (`recordingVersion`, v2 rules, legacy path) | AC06, AC08 | done | unit `session-recording-f2-validator.test.ts` 7/7; integration `session-recording-f2.test.ts` 4/4 |
| T5 Migration `20261126180000_session_recording_version` (isolated PostgreSQL 16) | AC06, NFR-001 | done | applied to the isolated test DB; release manifest regenerated (31 migrations, verified) |
| T6 Full suites, typecheck, lint, build | AC11 | done except build and visual QA | see below |
| T7 Neon branch rehearsal of the migration | AC10 | done (2026-11-26) | see "T7 rehearsal" below |
| T8 Production rollout (protected workflow, `PROMOTE=FULL`, QA check) | AC10 | done (2026-11-26) | see "T8 production rollout" below |

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

## T7 rehearsal (2026-11-26)
Neon branch `rehearsal-f2-recording-version-20261126` (`br-dry-band-agfuv6er`, endpoint `ep-spring-scene-ag3vi6al`) from
`br-gentle-bar-ag3slpph`, code `development` `aaa8f44`. Host guard refused the production endpoint; checks in `READ ONLY`.
Each write confirmed by Toni.
- Before: 93 sessions, 99 session exercises, 209 sets, 98 records, 99 routines, 521 exercises; ledger 30 applied,
  8 historical rollbacks, 0 unfinished; only `20261126180000_session_recording_version` pending; session fingerprint
  `ca44031e…`.
- `prisma migrate deploy`: applied only `20261126180000_session_recording_version`. After: ledger 31 applied; column
  `recordingVersion integer NOT NULL DEFAULT 1`; all 93 sessions = 1; every count and the fingerprint unchanged.
- Functional check (QA user, real validator and service): a v2 session stored `recordingVersion = 2` with sets as sent
  (8 reps × 12.5 kg, order 1); a request without the field stored 1 (legacy, D4); v2 with 14 401 s and v2 without
  exercises rejected by the validator. PASS. Test data remains on the branch.

## T8 production rollout (2026-11-26)
Neon `lucky-hat-25002521` / `br-gentle-bar-ag3slpph` (`ep-lingering-paper-agjnrga3`); candidate `aaa8f44` (CI success).
- Preflight (read-only): 93 sessions, 209 sets, 98 records, 99 routines, 521 exercises; ledger 30 applied, only F2
  pending. OD-03 backup `br-lively-glade-ags4t6hv` (`2026-11-26T02:51:00Z`, created by Toni).
  `operator-preflight.ts` (`--baseline-count 30`, `--max-backup-age-minutes 30`): `READY_FOR_HUMAN_AUTHORIZATION`,
  report SHA-256 `b4c68232475120ec988bf86b877398bc7abcba5885c2fe9addc75933aa12e067`.
- `production-migrations.yml` run `45745311280`, environment approved by Toni: both jobs `success`; live backup check
  380 s old; applied `20261126180000_session_recording_version`; attestation artifact `15083286898`.
- After migration (read-only): ledger 31 applied, 8 historical rollbacks, 0 unfinished; `recordingVersion integer
  NOT NULL DEFAULT 1`; all 93 sessions = 1; counts and session fingerprint `ca44031e…` unchanged.
- `PROMOTE=FULL` by Toni: `promote.yml` run `45745921978` (`target=full`, `source_sha=aaa8f44`) `success`;
  `development`, `staging`, `production`, `main` at `aaa8f4482bd7dba30445bf85c9c42b7e52823e2f`. Render backend
  `/health/live` 200; frontend `impulso.anclora.com` 200. Render live deploy of the SHA inferred from the workflow gate.
- Pending: visual QA and an end-to-end session through the deployed app (needs the QA account in Anclora Identity, or
  Toni records one session and the agent verifies `recordingVersion = 2` and the sets read-only).

## End-to-end and visual QA in production (2026-11-26, QA account `qa.impulso@anclora.local`)
Signed in through Anclora Identity (QA identity `2bc723fa-…`, linked by operator; see
`sdd/features/qa-identity-account/`), `agent-browser` on `impulso.anclora.com`, routine "F2 visual QA"
(`b06fb8fe-…`, Barbell Curls 3 × 10) created through the API.
- Set 1 marked with empty reps and empty weight → alert "indica repeticiones" + "indica peso", both fields
  `aria-invalid`, nothing sent.
- Set 1 = 8 reps, `12,5` kg; sets 2 and 3 left unmarked → session `dad4a6e5-…` stored with `recordingVersion = 2`,
  one exercise, one set `{ reps: 8, weight: 12.5, order: 0 }`, duration 39 s; redirected to `/progress`. PASS.
- Mobile (iPhone 14 emulation): alert readable, no horizontal overflow.
- Minor, pre-existing, not F2: the floating cookie-preferences button overlaps the corner of "Finalizar y registrar".
Screenshots kept outside the repository (`anclora-verificacion/resultados/qa-f2-*.png`).
