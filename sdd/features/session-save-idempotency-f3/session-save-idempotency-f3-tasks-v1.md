# Session save idempotency F3 — Tasks v1

Branch `development` (no feature branch). Decisions D1–D4 approved (all recommendations). No migration: the existing
`idempotency_records` table is reused. Implemented locally, **uncommitted, pending Toni's validation**.

| Task | Criteria | Status | Evidence |
|---|---|---|---|
| T0 Reproduction tests (red) | AC01–AC09 | done | backend 4/5 red (AC05 already correct), frontend 4/4 red |
| T1 Backend: `createSessionIdempotent`, `hashSessionRequest`, controller with `resolveIdempotencyKey` | AC01–AC05 | done | `session-save-idempotency-f3.test.ts` 5/5 |
| T2 Client helpers: `createPendingSubmission`, `newSessionIdempotencyKey`, `classifySaveFailure` | AC06, D2 | done | `__tests__/lib/session-recording.test.ts` |
| T3 Page: frozen submission in the draft, retry with the same key, locked sets, discard, 422 handling | AC06–AC09, D1, D2 | done | `session-save-idempotency-f3.test.tsx` 6/6 |
| T4 Full suites, typecheck, lint, local visual QA | AC10 | done | see "T4 evidence" below |
| T5 Production rollout (no migration; `PROMOTE=FULL`) and QA check | — | not started, needs Toni | — |

## Implementation notes
- Operation `sessions.create`; request hash over the validated fields only (`hashSessionRequest`); lock 30 s;
  retention `IDEMPOTENCY_RETENTION_HOURS` (24 h); attempts `IDEMPOTENCY_MAX_ATTEMPTS`. The session insert and
  `completeIdempotent` commit in one transaction (`createSession(..., onCreated)`); side effects (streak, XP, strength
  progress, feed) run only for a newly created session, never on replay.
- Responses: 201 created; 200 + `Idempotent-Replayed: true` replay; 422 conflict (`reason: idempotency_conflict`);
  409 in progress / ownership lost; 429 attempts exhausted. Clients without a key: derived 30 s key (D3).
- Client: the first "Finalizar" stores `{ key, payload, createdAt }` as `pendingSubmission` in the draft
  (written before the request, so a reload keeps it). Retries resend it unchanged. While pending: sets, marks and
  notes are disabled; a status banner offers "Descartar y empezar de nuevo". 422 → alert "ya se registró con otros
  datos" + "Descartar borrador e ir a Progreso" (D2). 400/403/404 → the submission is released.
- Bug found and fixed while implementing: after a successful save the draft-persisting effect re-wrote the removed
  draft (ghost draft with the set already marked). A `sessionSavedRef` stops persisting once the session is saved;
  covered by F3-AC09.

## Test inventory
| Test | Criterion |
|---|---|
| backend: same key + same body → 201 then 200 replay, one session, one XP event | F3-AC01 |
| backend: same key + different body → 422 | F3-AC02 |
| backend: 3 concurrent requests, one key → one session | F3-AC03 |
| backend: legacy double submit without key → one session | F3-AC04 |
| backend: different keys → two sessions | F3-AC05 |
| client: key sent | F3-AC06 |
| client: retry 3 min later → same payload and key | F3-AC07 |
| client: reload keeps key and payload | F3-AC08 |
| client: new key after success; no ghost draft | F3-AC09 |
| client: sets locked while pending; discard unlocks | D1 |
| client: 422 → already-saved alert, discard and go to progress | D2 |
| helpers: key format and uniqueness, frozen submission, failure classification | D1, D2 |

## T4 evidence (2026-11-26, local, `development` `85bc82b` + F3 changes)
| Command | Result |
|---|---|
| backend `tsc --noEmit` | pass |
| backend unit (full) | 281/286; only `anclora-identity-oidc-e2e` 5 tests fail (pre-existing, TASK-045) |
| backend integration (full, isolated PostgreSQL 16) | 35/35 suites, 239/239 tests |
| frontend `tsc --noEmit`, eslint on changed files | pass |
| frontend jest (full, `--maxWorkers=50%`) | 36/36 suites, 243/243 tests |
| visual QA (local dev server, API mocked with agent-browser, save forced to fail then succeed) | pending banner shown, sets/notes locked (10 fields), frozen submission persisted and kept after reload, retry succeeded → `/progress`, draft removed; mobile (iPhone 14): no overflow, cookie button clear of the actions |

Test-only change: the two page test files set `jest.setTimeout(20000)`; under a fully parallel run the 5 s default
timed out (they pass alone and in the full run with the higher limit).
