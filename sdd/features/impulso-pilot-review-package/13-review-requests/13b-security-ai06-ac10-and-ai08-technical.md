# Review request B — Security (AI-06-AC10) and independent technical review of AI-08

**Status of this request: LISTO PARA ASIGNACIÓN** (no reviewer designated; not sent; not in review).
Toni decides recipients and sends it. Prepared 2026-10-12 from the consolidated package; tree
`sourceTreeSha256 dee09279107148dddf28e075a29577cd64692b480d5e1f6db64b6c28ea07efb6`, base `77f852aa…`, uncommitted.

Two distinct engagements in one file. They are **not equivalent** and no reviewer is named for either; they may be
assigned to different people. B1 is the security review the plan calls AC10; B2 is the independent technical review that
the plan requires of AI-08 (a P0 task). Neither is a launch approval.

## B1 — AI-06-AC10: sessions, isolation, logs
**Scope:** server-side sessions and revocation; token transport and storage; client session handling across requests and
tabs (R8, R8-A, R8-B, R8-C); owned-resource isolation; operational endpoints; log redaction; OAuth callback; legacy-token
transition; configuration policy. **Out:** copy, exercise rules, legal text.
**Documents:** `06-packet-security.md` (claims, residual risks 1–10, questions — its file/schema tables are stale, see
`10-…` T-1; use the paths below), `../impulso-pilot-session-security/impulso-pilot-session-security-spec-v1.md`,
`security-review-dossier-v1.md`, `10-consolidated-matrix-r1-r8c.md` (R4, R8…R8-C, §B).
**Paths** (those without a prefix are under `backend/src/`; files unchanged since the base are not in the ZIP and are read from the repository at `77f852aa`): `backend/src/services/session.service.ts`, `middleware/auth.ts`, `controllers/auth.controller.ts`,
`services/auth.service.ts`, `utils/jwt.ts`, `utils/security-config.ts`, `config/logger.ts`, `utils/redact.ts`,
`middleware/errorHandler.ts`, `middleware/httpLogger.ts`, `controllers/oauth.controller.ts`, `routes/dashboard.routes.ts`,
`lib/api/client.ts`, `lib/api/auth.ts`, `lib/contexts/auth-context.tsx`, `app/auth/callback/page.tsx`, migrations
`…030200_add_auth_sessions`.
**Concrete questions:** (1) is bearer + `localStorage` acceptable for the pilot or must the cookie option precede
launch? (2) is the 10 s refresh grace acceptable (replay inside it is accepted and undetected)? (3) required token lifetimes?
(4) required controls before `AUTH_ACCEPT_LEGACY_TOKENS=false`? (5) is the OAuth fragment acceptable until a one-time
code exists? (6) is client-side correlation of sessions by an unverified `sid` claim acceptable given that authorization
stays on the server? (7) the abandoned-rotated-session residual (`10-…` §B-4)? (8) MFA for admin? (9) log retention/redaction coverage?
**Evidence and limits:** `ai06-sessions` (21 tests), `dashboard-authorization` (14), `ai06-startup-config`, `final-state`,
`review-r4-*`, and the client/context/E2E runs in `11-…`. All local PostgreSQL/JSDOM/E2E; no staging or production; the
independent R8-C probes were simulated. The historical E2E session-revoked incident (`…255cfca9`) has an **unknown** cause.

## B2 — AI-08 independent technical review
**Scope:** atomic routine update; idempotency ledger (ownership, CAS takeover, completion atomic with the effect);
quota reservation/release and reconciliation (R1, R7); atomic admission (R2); retention/purge; migrations and
`verify-migrations` (R5); guards (R6). **Out:** commercial quota number (AI-15/AI-19), scheduler (D10).
**Documents:** `../impulso-pilot-baseline/ai-08-acceptance-analysis-v1.md`, `../impulso-pilot-data-integrity/*`
(spec, tasks, retention, limits proposal), `02-proposed-addendum-ai-08-local-evidence.md` (**proposal, unapproved**),
`10-…` R1, R2, R5–R7.
**Paths:** `backend/src/services/idempotency.service.ts`, `middleware/idempotency.ts`, `services/coach/coach.service.ts`,
`services/workouts.service.ts`, `scripts/maintenance/purge-expired.ts`, `prisma/schema.prisma`, migrations
`20261012030000…20261012050000`, `backend/scripts/test-db.sh`, `test-guards.sh`, `backend/tests/integration/{inc01…inc04,review-r1-r2,review-r4,review-r7}*`.
**Concrete questions:** (1) is a compare-and-set takeover with re-read sufficient, or is a row lock required? (2) is the
reconciliation fence (new owner token + `failed`) the right behaviour for a slow-but-alive owner? (3) is the lock order
(window → record) complete across every path? (the earlier deadlock was **not** reproduced). (4) does local-PostgreSQL
evidence satisfy "tests in staging" under addendum A-08-01 or is a deployed environment required? (5) are the experimental
caps (3 / 5 / 2) acceptable as operational protections? (6) migration 5 was edited after one local application — acceptable given
the local-only history in `MIGRATION-5.md` (bundle `…053847Z`)?
**Limits:** AI-08 plan evidence says "staging"; none exists. AI-01 (its predecessor) is PENDIENTE. This review is not an acceptance.

## Return format (to be completed by the reviewer; every field is empty on purpose)
| Field | Entry |
|---|---|
| Reviewer name | |
| Competence / role / credential | |
| Date | |
| Package and code reviewed (ZIP SHA-256, `sourceTreeSha256`) | |
| Documents / files actually reviewed | |
| Findings (id · location · effect · evidence) | |
| Decision | ☐ approved  ☐ requires changes  ☐ not evaluable — with justification: |
| Conditions | |
| Limits of the review | |
| Written reference | |
Nothing in this request is signed or approved. A reviewer may answer "not evaluable" and say what is missing.
