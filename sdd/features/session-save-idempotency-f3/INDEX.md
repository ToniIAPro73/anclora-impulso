# Session save idempotency F3 — No duplicate sessions on retries

| Document | Purpose |
|---|---|
| [session-save-idempotency-f3-spec-v1.md](session-save-idempotency-f3-spec-v1.md) | Problem, requirements, acceptance criteria |
| [session-save-idempotency-f3-decisions-v1.md](session-save-idempotency-f3-decisions-v1.md) | Decisions; all recommendations approved by Toni (2026-11-26) |
| [session-save-idempotency-f3-tasks-v1.md](session-save-idempotency-f3-tasks-v1.md) | Tasks, implementation notes and evidence (includes the test inventory) |

Track R, phase F3 (TASK-042). Status: **approved and implemented locally, pending Toni's validation.** Reproduction tests: `backend/tests/integration/session-save-idempotency-f3.test.ts`,
`__tests__/components/session-save-idempotency-f3.test.tsx`.
