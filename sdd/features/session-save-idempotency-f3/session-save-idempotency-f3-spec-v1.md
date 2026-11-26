# Session save idempotency F3 — Spec v1 (approved 2026-11-26)

Track R, phase F3 (backlog TASK-042). Depends on F2 (in production since 2026-11-26).

## Problem
`POST /api/sessions` has no idempotency. A retry, a double submit, two tabs, or a save whose response was lost creates
a second session and re-runs its side effects (XP, streak, strength progress and records, activity feed). After F2
the client keeps the draft and lets the user retry a failed save, which makes the risk real:
- the backend ignores `Idempotency-Key` on this endpoint (reproduced: `backend/tests/integration/session-save-idempotency-f3.test.ts`);
- the client sends no key, and every "Finalizar" recomputes the duration, so even a keyed client would send a
  different request on each retry (reproduced: `__tests__/components/session-save-idempotency-f3.test.tsx`).

Existing infrastructure to reuse (no new mechanism):
- Backend `idempotency.service` (`beginIdempotent` / `completeIdempotent` / `failIdempotent`): per (user, operation,
  key) record, replay of the completed response, conflict on a different body, in-progress, bounded takeover,
  retention (`IDEMPOTENCY_RETENTION_HOURS`, default 24 h). Used by `workouts.generate` and `coach.message`.
- `resolveIdempotencyKey` middleware: reads `Idempotency-Key`; without it derives a 30 s legacy key (dedupes double
  taps of old clients) while `IDEMPOTENCY_KEY_ENFORCEMENT=warn`; 428 once `require`/sunset.
- Client `lib/idempotency.ts` (`runIdempotent`), used by generation and coach.

Production baseline (read-only, 2026-11-26): 0 session pairs on the same routine within 2 minutes; 15 idempotency
records, operations `coach.message`, `workouts.generate`.

## Functional requirements
- **FR-001** `POST /api/sessions` runs through the idempotency gate with operation `sessions.create` and the request
  hash of the normalized body. The session insert and `completeIdempotent` commit in one transaction.
- **FR-002** Same key + same body → 200 with the first session, header `Idempotent-Replayed: true`; no new session,
  no side effects. Same key + different body → 422. In flight → 409 with retry hint. Exhausted → 429.
- **FR-003** Requests without a key keep working with the derived legacy key (decision **D3**).
- **FR-004** The client creates one key per finish attempt of a draft and **freezes** the payload (including the
  duration) at the first "Finalizar". Retries resend the frozen payload with the same key. Key and frozen payload
  live in the draft (`localStorage`), so a reload keeps them (decision **D1**).
- **FR-005** After success, or a definitive rejection, the pending submission is cleared; the next session uses a new
  key. A 422 conflict is shown as "this session was already saved" with a way to discard the draft (decision **D2**).
- **FR-006** Side effects run once per created session (never on replay).

## Acceptance criteria
| ID | Criterion |
|---|---|
| F3-AC01 | Same key + same body twice → 201 then 200 replay, same session id, one session, one XP event |
| F3-AC02 | Same key + different body → 422, no new session |
| F3-AC03 | Three concurrent requests with one key → exactly one session |
| F3-AC04 | Legacy client (no key) double submit within the window → one session |
| F3-AC05 | Different keys → different sessions |
| F3-AC06 | The client sends an `Idempotency-Key` |
| F3-AC07 | A retry minutes after a failed save resends the same payload (same duration) and key |
| F3-AC08 | Key and frozen payload survive a page reload |
| F3-AC09 | After success the next session uses a new key |
| F3-AC10 | Full suites, typecheck, lint pass; no migration needed (existing `idempotency_records`) |

## Out of scope
Making the post-commit side effects transactional; idempotency of `PUT`/`DELETE /api/sessions`; record recalculation (F4).
