# AI-06 Sessions and isolation — Spec v1 (draft)

Status: v1.1 — design resolved for the server side and implemented locally (isolated DB only); transport/lifetime defaults pending decision D4. Production startup behaviour is unchanged (`SECURITY_CONFIG_MODE` defaults to `warn`).

## 1. Verified current state (static, SHA `77f852aa`)
| ID | Observation | Evidence |
|---|---|---|
| O1 | Access (7 d default) and refresh (30 d) JWTs are stateless; no server store | `utils/jwt.ts`, `config/env.ts` |
| O2 | `authenticate` verifies signature/expiry only; no user-exists, no revocation check | `middleware/auth.ts` |
| O3 | `POST /auth/logout` is a no-op; `POST /auth/refresh` verifies signature only and mints an access token (no rotation, no user check) | `controllers/auth.controller.ts` |
| O4 | `jwtSecret`/`jwtRefreshSecret` fall back to constant strings if env vars are missing | `config/env.ts` |
| O5 | Client keeps `accessToken` and `refreshToken` in `localStorage` | `lib/api/client.ts`, `lib/contexts/auth-context.tsx` |
| O6 | `/api/dashboard/*` unauthenticated | `routes/dashboard.routes.ts` |
| O7 | Per-user scoping exists in services read so far (`where: { id, userId }`), but no systematic A/B test across routes | `workouts.service.ts` etc. |
| O8 | Production values of JWT secrets are **unknown** (not confirmed by Toni) | — |

## 2. Requirements
- **FR-001 Configuration validation.** A pure function `evaluateSecurityConfig(env)` returns a list of findings (missing secret, secret equals known default, secret shorter than a minimum length, access secret equals refresh secret). No secret value is ever logged or returned.
- **FR-002 Staged enforcement.** Mode `off | warn | enforce`, from a new variable (default `warn`). `warn` logs finding **codes** at startup and exposes them to the authenticated admin only; `enforce` makes startup fail. Moving a deployment to `enforce` is an explicit operational step after Toni confirms D7. Default changes nothing at runtime beyond a log line.
- **FR-003 Revocable sessions.** Each login creates a server-side session record; access and refresh tokens carry the session identifier. A request is rejected if the session is revoked/expired or the user no longer exists.
- **FR-004 Refresh rotation with reuse detection.** Each refresh invalidates the presented refresh token and issues a new one; reuse of an invalidated token revokes the whole session family.
- **FR-005 Logout and password/credential reset** revoke the current session (logout) or all sessions of the user (reset), effective on the next request.
- **FR-006 Short access lifetime** (value is a product/security decision, see D4); no longer relying on 7 days.
- **FR-007 Isolation.** For every authenticated route that takes a resource identifier, user A cannot read, modify or delete user B's resource (404 or 403, never data).
- **FR-008 Transport.** Decision pending between HttpOnly+Secure+SameSite cookies (requires CSRF protection) and bearer tokens in memory with rotation. The chosen option and its CSRF position are recorded in the plan.
- **FR-009 Operational endpoints.** `/api/dashboard/*` require admin authentication (or are removed from production) — owner decision D8.

## 3. Out of scope
New identity providers, MFA, device management UI, changing OAuth flows.

## 4. Acceptance criteria (binary)
| ID | Criterion | Evidence required |
|---|---|---|
| AI-06-AC01 | Missing secret, default secret, short secret, equal secrets each yield the expected finding code; no value appears in output | unit tests |
| AI-06-AC02 | In `enforce` mode startup fails on any finding; in `warn` mode it does not and logs codes only | unit + startup test with synthetic env |
| AI-06-AC03 | Revoked session: access request returns 401 on the next call; refresh returns 401 | integration (isolated DB) |
| AI-06-AC04 | Logout invalidates the session server-side; the same tokens no longer work | integration |
| AI-06-AC05 | Refresh rotates; replaying the old refresh token revokes the family | integration |
| AI-06-AC06 | Deleted user's tokens are rejected | integration |
| AI-06-AC07 | For each route with an id parameter, A→B access fails; route inventory is generated and checked in a test so new routes cannot silently skip it | integration + inventory test |
| AI-06-AC08 | If cookies are chosen: state-changing requests without a valid CSRF token are rejected | integration |
| AI-06-AC09 | Rollback procedure rehearsed: feature switch off restores previous token validation without data loss | runbook + test |
| AI-06-AC10 | Independent security review recorded | review record (**BLOCKED**: reviewer not named) |
| AI-06-N01…N05 | Expired token, malformed token, token signed with refresh secret used as access, algorithm confusion (`none`), clock-skew boundary | unit/integration |

## 5. Design proposal (for review)
- New table `UserSession(id, userId, familyId, refreshTokenHash, createdAt, expiresAt, revokedAt, lastUsedAt, userAgentHash?)` — **schema change, proposal only**, not applied; requires D3 (migration path).
- `authenticate` loads the session by `sid` claim (indexed lookup, optionally short-TTL cache) — adds one query per request; measure before adding a cache.
- Backward compatibility: tokens without `sid` are accepted only while a documented transition flag is on, with a hard end date; then rejected.
- Rollout: expand (table + issuing `sid`) → validate in `warn` (log tokens lacking `sid`) → enforce → contract (remove legacy acceptance).
- Rollback: disable enforcement flag; table can remain.
- Observability: counters for revoked-session rejections, refresh reuse detections; alert on spikes.

## 6. Decisions required
D3 (migration path), D4 (token lifetimes + transport), D7 (production secrets confirmed), D8 (dashboard), named security reviewer (D6).

## 7. Test environment
Isolated PostgreSQL per exception `IMPULSO-TEST-DB-2026-10-12`; JWT secrets are local random values created by `scripts/test-db.sh init-env`.


---

## 8. Flow review (2026-10-12, static, SHA 77f852aa + working tree)
| Flow | Producer | Consumer | Finding |
|---|---|---|---|
| Register / login | `auth.controller` → `auth.service` | `lib/contexts/auth-context.tsx` stores `refreshToken` in localStorage; `apiClient` stores `accessToken` in localStorage | tokens now come from `session.service` |
| OAuth Google/GitHub | `oauth.controller` redirect | `app/auth/callback/page.tsx` | **tokens were in the URL query** (history, Referer, host logs). Now in the URL fragment; page strips it with `history.replaceState` |
| Refresh | `POST /auth/refresh` | **nobody** (`authApi.refreshToken` existed but was never called) | Client had no renewal; a 7-day access token was the only session. Added single-flight refresh in `apiClient` |
| Logout | `POST /auth/logout` | `authApi.logout()` cleared storage only | Now revokes server-side |
| Dashboard | `public/dashboard.html` | `/api/dashboard/*` | admin-only, login panel, token in memory |

Topology: frontend (Next.js, Vercel) and API are **different origins** (`NEXT_PUBLIC_API_URL`, CSP `connect-src`
lists the API origin; no rewrite/proxy in `next.config.mjs`). CORS uses `credentials: true` with an allowlist.

## 9. Transport evaluation and proposal (decision D4 — not applied)
| Option | Works with today's topology? | Implications |
|---|---|---|
| A. Keep refresh token in JSON body + localStorage (current transport), opaque + rotating + server-hashed | Yes | Readable by injected script (XSS). Mitigated by: short access lifetime, rotation with reuse detection, revocation, strict CSP |
| B. HttpOnly+Secure refresh cookie | Only if API and web share a registrable domain (e.g. `api.<same-site>`) or a same-origin proxy | Cross-site cookies need `SameSite=None; Secure` and are blocked by Safari ITP/third-party-cookie policies; needs CSRF protection (double-submit/Origin check) on `/auth/refresh` and `/auth/logout`; `Path=/api/auth` |

**Proposal.** Ship A now (done locally, no new contract needed). Plan B only after the product owns a same-site API
domain: then add `Set-Cookie` with `HttpOnly; Secure; SameSite=Lax; Path=/api/auth`, Origin/CSRF check, and drop
the body token. **Lifetimes:** access token 15 min (`JWT_EXPIRES_IN=15m`), absolute session lifetime 30 days from login
(`AUTH_REFRESH_SESSION_DAYS=30`; rotation does not extend it). Switching the default to 15 min is safe only after the new frontend (silent
refresh) is deployed — old clients cannot refresh a session-bound token — hence the default remains `7d`.

## 10. Implemented locally (isolated DB) — criterion status
| ID | Status | Evidence |
|---|---|---|
| AI-06-AC01 | implemented, unit-verified | `tests/unit/security-config.test.ts` (11) |
| AI-06-AC02 | implemented; process-level verified | `ai06-startup-config.test.ts`: enforce refuses start (exit 1, codes only); warn starts and reports `SECURITY_CONFIG_NOT_ACCEPTABLE`; strong config starts clean |
| AI-06-AC03 | verified | revoked session ⇒ access and refresh 401 |
| AI-06-AC04 | verified | logout revokes server-side, idempotent, works with expired access token |
| AI-06-AC05 | verified | rotation; reuse beyond grace revokes family; concurrent legit refreshes tolerated in grace |
| AI-06-AC06 | verified | deleted and disabled users rejected (access, refresh, login) |
| AI-06-AC07 | verified for all 11 owned id routes; inventory test forces classification of new routes | `ai06-sessions.test.ts` |
| AI-06-AC08 | **not applicable** under transport A (no cookie); required before option B | — |
| AI-06-AC09 | partial: `AUTH_ACCEPT_LEGACY_TOKENS`/`SECURITY_CONFIG_MODE` are switches; migrations are expand-only | rollback SQL documented in migration files |
| AI-06-AC10 | **BLOCKED**: independent security reviewer not named | — |
| AI-06-N01…N05 | verified: expired, alg=none, wrong secret, refresh-secret-as-access, user/sid mismatch, opaque-as-bearer | — |

`off`/`warn` never produce an "acceptable" result: AI-06 acceptance requires `SECURITY_CONFIG_MODE=enforce`
with zero error/warning findings **in the target environment**, which is unverifiable here (D7).

## 11. Compatibility and transition of existing sessions
- Tokens issued before this change have no `sid`. While `AUTH_ACCEPT_LEGACY_TOKENS=true` they are accepted for
  access after a user-exists/not-disabled check, and legacy refresh JWTs are upgraded into a server-side session on
  the first refresh. Flip the flag to `false` after ≥ 30 days (longest legacy refresh lifetime) or after a forced re-login.
- Clients that ignore the new `refreshToken` field in the refresh response keep an already-consumed token; after the
  grace window a second refresh with it revokes the session (forces re-login). The shipped frontend stores it.


---

## 12. Update v1.2 (2026-10-12): D4/D7 authorizations, OAuth exchange proposal, legacy retirement, E2E

**Local lifetime.** Access tokens of 15 minutes are the local default of the isolated test environment
(`JWT_EXPIRES_IN=15m` in `.env.test.local`; E2E uses 5 s to exercise silent refresh). The application default remains
`7d` until the production plan (D10) is executed; production unchanged.

**Where the client keeps tokens (verified in code).**
| Token | Storage | Lifetime/persistence | Exposure |
|---|---|---|---|
| access | `localStorage['accessToken']` + memory | 15 min (target) | any script of the origin (XSS) |
| refresh | `localStorage['refreshToken']` | until logout, rejection or session expiry (30 d absolute); survives browser restart | any script of the origin (XSS); stolen token is usable until rotated/revoked |
| idempotency keys | `sessionStorage['impulso:idem:*']` | tab session, ≤ 10 min, cleared on logout | low (random, per user/operation) |
Transport **bearer + localStorage is transitional and is not accepted as final** (see dossier §3). Defects found and
fixed by E2E: email login/signup pages never persisted the refresh token (bypassed `AuthProvider`), and `/auth/me`
was excluded from silent refresh.

**OAuth flow review.** `GET /api/auth/{google,github}` sets an HttpOnly, `SameSite=Lax`, `Path=/api/auth`, 10-minute
PKCE transaction cookie and redirects to the provider; the callback validates `state`, exchanges `code` with the
verifier, creates/links the user, issues a session and redirects to `FRONTEND_URL[0]/auth/callback#accessToken=…&refreshToken=…`.
Redirect target is configuration, not user input (no open redirect). Weakness: long-lived credentials travel in the
redirect.
**Proposal (not implemented):** replace tokens by a **one-time exchange code**:
1. callback creates `oauth_exchange` row {codeHash, userId, sessionId, expiresAt ≤ 60 s, usedAt, bound to the PKCE
   `state` hash and the originating transaction cookie id} and redirects to `/auth/callback#code=<random 256-bit>`;
2. page calls `POST /auth/oauth/exchange {code, state}`; server atomically `UPDATE … SET usedAt WHERE usedAt IS NULL
   AND expiresAt > now() AND stateHash = …` and returns the token pair; a second use or wrong `state` → 401 and the
   session created for that code is revoked;
3. codes are never reusable, never logged, and the redirect URL is fixed from configuration.
Tests required: single use, expiry, wrong state, replay revokes session, cross-user code, concurrent exchange.

**Retirement of `AUTH_ACCEPT_LEGACY_TOKENS`** — conditions, proposed timeline and tests: see D10 plan §5.
Until the flag is `false` in the target environment, **revocation is not complete** (legacy JWTs bypass server-side
revocation); `LEGACY_TOKENS_ACCEPTED` is therefore a *warning* finding and keeps `acceptable=false`.

**Refresh grace window — limits (tested).**
| Case | Behaviour |
|---|---|
| Two tabs refresh the same token within 10 s | both succeed, each gets its own successor; session stays active |
| Same token replayed after 10 s | session revoked; every token of that session stops working |
| Attacker replays a consumed token inside 10 s | **succeeds and is not detected** (indistinguishable from a second tab) — accepted cost, shortenable via `AUTH_REFRESH_REUSE_GRACE_SECONDS`; with 0, concurrent legitimate tabs would log out |
| Client keeps a consumed token after rotation | next refresh outside the window revokes the session (forces login) |

**E2E (Playwright, isolated stack) — evidence.** 13/13: login; silent refresh with rotated opaque token; two tabs
refreshing at once (≤ 1 request per tab, session not revoked); logout revokes server-side and old tokens fail;
disabled user is returned to login and rejected by API; A/B isolation in UI and API; coach retry (API level, no
coach UI exists) without double consumption, 422 on different content, 428 without key; lost response on
generation retried with the same key → exactly one routine; fallback notice visible/fits/`role=status` on
mobile+desktop × light+dark (screenshots in `artifacts/qa/`, git-ignored); server-failure and quota (with reset time)
messages. Hermes copy gate: **BLOCKED** (no Hermes reviewer available in this environment).
