# Review packet 2 — Security (auth, dashboard, logs, OAuth, legacy, idempotency)

Reviewer: **not named** (AI-06-AC10 BLOQUEADA). Independent of the implementer. No approval is claimed.

## Scope
Session model and revocation; token transport; operational endpoints and logs; OAuth callback; legacy-token
transition; idempotency ledger and quota protections; configuration policy; and, for awareness, the test-runner
isolation findings. Out: exercise rules, copy, legal text.

## Original acceptance (plan, AI-06)
"Revocado no renueva; logout cumple política; A no lee/modifica B; CSRF probado si corresponde." Reject: "Solo
limpieza local o protección en UI." Evidence: "Tests integración, revisión independiente y rollback."

## Files
| Area | Files |
|---|---|
| Sessions | `backend/src/services/session.service.ts`, `middleware/auth.ts`, `controllers/auth.controller.ts`, `services/auth.service.ts`, `utils/jwt.ts` |
| Config policy | `backend/src/utils/security-config.ts`, `server.ts`, `config/env.ts` |
| OAuth | `controllers/oauth.controller.ts`, `services/oauth.service.ts`, `services/oauth/*.provider.ts`, `app/auth/callback/page.tsx` |
| Dashboard / logs | `routes/dashboard.routes.ts`, `controllers/dashboard.controller.ts`, `public/dashboard.html`, `utils/redact.ts`, `middleware/errorHandler.ts`, `middleware/httpLogger.ts`, `config/logger.ts` |
| Idempotency / quota | `services/idempotency.service.ts`, `middleware/idempotency.ts`, `services/coach/coach.service.ts`, `services/workouts.service.ts` |
| Client | `lib/api/client.ts`, `lib/api/auth.ts`, `lib/idempotency.ts`, `lib/contexts/auth-context.tsx` |
| Schema | `backend/prisma/migrations/20261012030100_*`, `…030200_*`, `…040000_*` |

## Claims and evidence (valid runs only)
| Claim | Evidence |
|---|---|
| Access needs a live server session; deleted/disabled users rejected | `ai06-sessions` (21) in I-VALID; E2E #4–5 |
| Refresh tokens opaque, hashed, rotated; reuse beyond 10 s revokes the session | `ai06-sessions` |
| Forged tokens rejected (none, wrong secret, refresh-as-access, user/sid mismatch) | `ai06-sessions` |
| Owned resources isolated (11 id routes; inventory forces classification of new routes) | `ai06-sessions`, E2E #6 |
| Operational endpoints admin-only; secrets absent from error/HTTP logs | `dashboard-authorization` (14) |
| Insecure configuration refused under `enforce`; never "acceptable" under `warn`/`off`; legacy acceptance is a warning | `security-config` unit, `ai06-startup-config`, `final-state` |
| Stale idempotency owner cannot complete or release; completion atomic with the effect | `inc03` |
| Limits are per user and not evadable by changing the key | `inc03`, `inc04` |
| End state works (key required, legacy off, enforce, 15 min) | `final-state`, E-VALID |

## Known weaknesses and residual risks (challenge these)
1. Access and refresh tokens in `localStorage`; production CSP allows `'unsafe-inline'` scripts (`middleware.ts`).
2. Grace window 10 s: a replay of a consumed refresh token inside it is accepted and **not detected**.
3. Legacy (pre-session) JWTs cannot be revoked individually while `AUTH_ACCEPT_LEGACY_TOKENS=true`.
4. OAuth returns both tokens in the URL **fragment**; the one-time-code design is proposed, not built.
5. No account lockout; login throttling is per IP per instance; no global ceiling.
6. Stored idempotent responses (24 h) and logs contain personal data (see the legal packet).
7. Production JWT secrets unverified (B2); `env.ts` still falls back to public default constants (reported by the policy).
8. Admin = email in `ADMIN_EMAILS` (no MFA).
9. `/health` and `/api/dashboard` shape: confirm the endpoint set should exist in production at all (D-4).
10. Runner-isolation findings (tooling, informational): see `evidence-validity-register-v1.md`, `effects-assessment-v1.md`.

## Questions
Is bearer + `localStorage` acceptable for the pilot, or must the cookie option precede launch (needs same-site API
domain)? Is a 10 s grace acceptable? Required token lifetimes? MFA for admin? Required controls before
`AUTH_ACCEPT_LEGACY_TOKENS=false`? Is the OAuth fragment acceptable until the exchange code exists? Any blocker in the
idempotency ownership design? Required retention/redaction of logs?

## Review record (empty)
Reviewer/credential · date · `sourceTreeSha256` reviewed · findings · required changes · outcome · written reference — **pending**.
