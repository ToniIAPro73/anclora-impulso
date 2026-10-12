# AI-06 security review dossier v1

For an **independent security reviewer** (not yet named; AI-06-AC10 stays BLOCKED). Prepared by engineering;
contains no approval and no production secret.

## 1. Scope for review
Session model (`session.service.ts`, `middleware/auth.ts`, `auth.controller.ts`), idempotency ledger
(`idempotency.service.ts`), security-config policy (`utils/security-config.ts`, `server.ts`), dashboard authorization,
log redaction (`utils/redact.ts`), client token handling (`lib/api/client.ts`, `lib/api/auth.ts`, OAuth callback).

## 2. Claims and where they are evidenced
| Claim | Evidence |
|---|---|
| Access requires a live server-side session (sid), user exists and not disabled | `ai06-sessions` |
| Refresh tokens are opaque, stored as SHA-256, rotated, reuse beyond 10 s revokes the session | `ai06-sessions` |
| Logout/revocation take effect on the next request | `ai06-sessions`, E2E logout |
| alg=none, wrong secret, refresh-secret-as-access, user/sid mismatch are rejected | `ai06-sessions` |
| A cannot read/modify/delete B's owned resources on 11 id routes; new routes must be classified | `ai06-sessions` inventory |
| Dashboard/operational endpoints are admin-only; error logs contain no passwords or OAuth codes | `dashboard-authorization` |
| Insecure JWT configuration is refused in `enforce` and never reported acceptable in `warn`/`off` | `security-config` unit, `ai06-startup-config` |
| A stale idempotency owner cannot complete or release a recovered operation | `inc03` |

## 3. Known weaknesses and residual risks (reviewer please challenge)
1. **Tokens in `localStorage`** (access and refresh): readable by any script in the origin (XSS), persistent across
   restarts until logout/rejection; not sent automatically (no CSRF) — exposure is XSS, not CSRF. CSP allows
   `'unsafe-inline'` scripts in production (`middleware.ts`), which weakens XSS containment. Transitional transport;
   **not accepted as final**.
2. **Grace window (10 s)**: a stolen consumed token replayed inside the window yields a valid token and no alarm
   (tested, documented). Detection happens only on later reuse outside the window.
3. **Legacy JWTs** (no sid): cannot be revoked individually while `AUTH_ACCEPT_LEGACY_TOKENS=true`; password change
   does not invalidate them (there is no password-change flow in the repo).
4. **OAuth callback** puts tokens in the URL **fragment** (not sent to servers) — still visible to scripts and
   cleared with `history.replaceState`; one-time exchange code proposed (see spec §12), not implemented.
5. **Production secrets unverified** (B2). Defaults exist in `env.ts` as fallbacks; `warn` mode reports but runs.
6. **No per-account lockout**; login throttling is per IP (`express-rate-limit`, 5 failures/15 min outside development).
7. **Rate limiting and in-process counters** are per instance (serverless/multi-instance deployments share nothing).
8. **Idempotency responses are stored** (coach answers, generated routines) for 24 h: personal data retention to be
   covered by AI-07.
9. `metrics`/`logs` served by the dashboard may still contain personal data (emails in error context); admin-only now.

## 4. Questions for the reviewer
Is bearer-in-memory + rotating refresh in `localStorage` acceptable for the pilot, or must the cookie option
(needs same-site API domain) precede launch? Is a 10 s grace acceptable? Required lifetime of access/refresh tokens?
Required controls for admin accounts (MFA)? Anything blocking in the idempotency/ownership design?

## 5. Review record (to be completed by the reviewer)
Reviewer / credential: *pending* · Date: *pending* · Artifacts and commit/diff: *pending* · Outcome: *pending* ·
Findings and required changes: *pending* · Written confirmation reference: *pending*
