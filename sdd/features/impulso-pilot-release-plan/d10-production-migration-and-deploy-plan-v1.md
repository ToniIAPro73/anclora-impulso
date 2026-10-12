# D10 — Coordinated production migration and deploy plan (v1, NOT executed)

Scope: the four expand-only migrations and the backend/frontend changes of INC-01…INC-03 and AI-06.
This document grants nothing. Executing it needs an explicit, current instruction from Toni, the open
decisions below, and the repository's promotion gates (`development → staging → production → main`, one verified
SHA at a time). No production secret was read for this plan; secrets are named, never valued.

## 0. Open items that block execution
| # | Item | Why it blocks |
|---|---|---|
| B1 | Migration path discrepancy: `PRODUCTION_RUNTIME.md` says `SUPABASE_DASHBOARD_OR_CLI` / "Vercel serverless backend"; repo uses Prisma on Neon with an Express server | Which runner applies SQL and where the API runs is unknown |
| B2 | Production `JWT_SECRET` / `JWT_REFRESH_SECRET` strength unverified | `SECURITY_CONFIG_MODE=enforce` would refuse to start if they are defaults/short |
| B3 | Independent security review (AI-06-AC10) and professional review (AI-03) not done | Acceptance criteria, not deploy mechanics — but launch of the paid pilot depends on them |
| B4 | Commercial quota number per plan (D9) not linked to an offer | Config value `LLM_COACH_WINDOW_LIMIT` stays as is |
| B5 | Hermes copy gate unavailable for the fallback notice | Copy changed in `workout-generator.tsx` |

## 1. Inventory of what ships
| Layer | Item | Compatibility class |
|---|---|---|
| Schema | `20261012030000_add_workout_generation_provenance` | expand; default `unknown` |
| Schema | `20261012030100_add_idempotency_records` | expand (new table) |
| Schema | `20261012030200_add_auth_sessions` (+ `users.disabledAt`) | expand |
| Schema | `20261012040000_add_coach_usage_operational_counters` | expand; default 0 |
| Backend | session service, rotating refresh, idempotency, quota reservation, dashboard authz, log redaction | **needs schema** (fails without tables) |
| Frontend | silent refresh, Idempotency-Key, fallback notice, OAuth fragment callback | needs backend that supports them for refresh rotation; tolerates old backend for the rest |

## 2. Compatibility matrix (what happens if layers are out of step)
| Backend | Frontend | Schema | Result |
|---|---|---|---|
| old | old | old | status quo |
| old | **new** | old | Works: client sends extra header (ignored); `/auth/refresh` returns only `accessToken` (client keeps old refresh token); OAuth fragment callback also accepts query tokens |
| **new** | old | **old** | **Breaks** (missing tables/columns). Never deploy backend before migrations |
| **new** | old | new | Works: legacy clients get derived idempotency keys + `Deprecation`; legacy JWTs accepted while `AUTH_ACCEPT_LEGACY_TOKENS=true`; old client never refreshes, so its access token must live as long as today (see step 6) |
| new | new | new | Target |

## 3. Order of operations (coordinated, one SHA)
1. **Prechecks (read-only).** Schema drift: `prisma migrate diff` / `migrate status` against production using the production runner (B1); confirm the 20 baseline migrations are recorded; row counts of `workouts`, `coach_usage_windows`, `users`; table-lock/size check (all four are metadata-only or new tables); backup/PITR point recorded; `JWT_*` presence checked by name only; confirm current `JWT_EXPIRES_IN`.
2. **Expand migrations** (the four, in order, forward-only) via the production runner. Verify: tables exist, `workouts` historical rows read `generationMode='unknown'`, no data loss (row counts equal).
3. **Backend release** with `SECURITY_CONFIG_MODE=warn`, `AUTH_ACCEPT_LEGACY_TOKENS=true`, `IDEMPOTENCY_KEY_ENFORCEMENT=warn`, `JWT_EXPIRES_IN` unchanged. Verify via health + admin summary (`security.findings` codes, no values).
4. **Smoke tests with a dedicated QA identity** (`QA_PERSISTENT_IDENTITY`): login, refresh rotation, logout revocation, generate (single routine), coach replay, `/api/dashboard/*` 401/403/200.
5. **Frontend release.** Watch refresh error rate, 401 rate, `Deprecation` header counts, legacy-token usage counter.
6. **Shorten access tokens**: set `JWT_EXPIRES_IN=15m` only after the new frontend is the only one in use (monitor legacy-token usage and old-client share).
7. **Retire compatibility** (section 5) and move to `SECURITY_CONFIG_MODE=enforce` once secrets are confirmed.

## 4. Verification after each step
| Step | Pass criteria | Stop condition |
|---|---|---|
| 2 | `_prisma_migrations` has 4 new rows; counts unchanged | any error → stop, do not deploy backend |
| 3 | `/health/ready` ok; login works; 5xx rate within baseline | error-rate increase → code rollback (section 6) |
| 5 | refresh success ≥ 99% of attempts; no spike in forced logouts | spike → hold frontend rollout |
| 6 | 7-day window with legacy-token usage ≈ 0 | non-zero → keep legacy |

## 5. Retirement of legacy compatibility
| Switch | Condition to flip | Proposed earliest date (proposal, not commitment) | Test that must pass |
|---|---|---|---|
| `AUTH_ACCEPT_LEGACY_TOKENS=false` | preconditions P1–P4 below, plus legacy-token usage ≈ 0 for 7 consecutive days | **relative:** coordinated deployment day D + ≥ 30 days (longest legacy refresh lifetime) unless a forced re-login is performed — **no absolute date fixed** | `ai06-sessions` legacy block, `final-state` (legacy access/refresh → 401), `ai06-startup-config` |
| `IDEMPOTENCY_KEY_ENFORCEMENT=require` (or `IDEMPOTENCY_LEGACY_SUNSET_AT`) | P1–P4 plus `Deprecation`-flagged requests ≈ 0 for 7 days | **relative:** D + ≥ 14 days; set `IDEMPOTENCY_LEGACY_SUNSET_AT` only once the date is known | `inc03` (428 / sunset), `final-state` |
| `SECURITY_CONFIG_MODE=enforce` | B2 resolved (secrets confirmed by name/length check performed by their owner) | after secrets confirmed | `ai06-startup-config`, `final-state` |

Revocation is **not complete** while `AUTH_ACCEPT_LEGACY_TOKENS=true`: a valid legacy JWT cannot be revoked
individually (it is only blocked if the user is deleted/disabled).

### 5.1 Preconditions for any retirement step (all must hold; none is satisfied today)
| # | Precondition | Evidence |
|---|---|---|
| P1 | Compatible frontend (silent refresh, `Idempotency-Key`, fragment OAuth callback) deployed to 100 % of users and cache-busted | release record |
| P2 | Refresh verified in production: success rate ≥ 99 % over 7 days, no spike of forced logouts; QA identity run of the E2E smoke | dashboards + smoke log |
| P3 | Observability live: refresh success/failure and reuse-detection counters, 401 by route, requests without `Idempotency-Key`, legacy-token usage, fallback rate, `failedAttempts` per window | monitoring definitions |
| P4 | Recovery rehearsed: switch back (`AUTH_ACCEPT_LEGACY_TOKENS=true` / `IDEMPOTENCY_KEY_ENFORCEMENT=warn`) tested in staging and documented | rehearsal note |
Proposed window (relative to the coordinated deployment day **D**): D → frontend + backend + migrations; D+7 first
review of P2/P3; D+14 earliest idempotency enforcement; D+30 earliest legacy-token retirement; D+37 earliest
`enforce`. Each step is a separate, reversible configuration change with its own go/no-go.

### 5.2 Local final-state evidence (not a launch authorization)
`final-state.test.ts` (real server process) and the Playwright suite run with `IDEMPOTENCY_KEY_ENFORCEMENT=require`,
`AUTH_ACCEPT_LEGACY_TOKENS=false`, `SECURITY_CONFIG_MODE=enforce`, 15-minute access tokens (E2E: 5 s).
This proves the target configuration works locally; it does not authorize applying it anywhere.

## 6. Recovery — code and data are separate
**Code recovery (safe, fast).** Redeploy the previous backend/frontend artifact. The new schema is additive, so the
old code runs against it unchanged (columns have defaults; new tables are ignored). Switches that soften behavior
without redeploy: `AUTH_ACCEPT_LEGACY_TOKENS=true`, `IDEMPOTENCY_KEY_ENFORCEMENT=warn`, `SECURITY_CONFIG_MODE=warn`.
Note: after rolling back the backend, sessions issued by the new backend (opaque refresh tokens, `sid` access tokens)
are rejected by the old code (it expects JWT refresh tokens) → affected users must log in again. Expected, not data loss.

**Data recovery (only on explicit decision, never as part of a rollback).** Do **not** drop the new tables or columns
as part of recovery: they may hold information created after the migration (idempotency results, session history,
provenance of generated routines, failure counters). If removal is ever required: (1) take a backup/export of the
affected tables, (2) run in a window with the code that no longer references them, (3) get a separate explicit
authorization. The migration files document reversing SQL for reference only.

**Failure points.** Migration 2 fails midway → each migration is a single transaction on PostgreSQL; fix and rerun,
code stays old. Backend smoke fails → code recovery. Refresh storm after frontend release → disable client refresh by
raising `JWT_EXPIRES_IN` back (tokens longer-lived) rather than touching data.

## 7. Secrets and configuration required (names only)
`DATABASE_URL`, `JWT_SECRET`, `JWT_REFRESH_SECRET` (≥ 32 chars, distinct), `FRONTEND_URL`, `ADMIN_EMAILS`
(dashboard access), `GROQ_API_KEY` (existing), `LLM_COACH_*`, `AUTH_*`, `IDEMPOTENCY_*`, `SECURITY_CONFIG_MODE`.
Nothing here was read, printed, or generated for production.

## 8. Retention job (prepared, NOT scheduled or deployed)
`backend/scripts/maintenance/purge-expired.ts` (`--dry-run` first). Preconditions: scheduler choice depends on B1
(where the backend runs). Frequency ≤ hourly; grace `RETENTION_PURGE_GRACE_SECONDS` (3600); batch size 500;
alert on non-zero exit; record counts only. Safe to run concurrently/repeatedly (verified locally, `inc04`).
Until scheduled, `idempotency_records` and `auth_sessions` grow without physical deletion; logical expiry still
applies, so behaviour is correct, only storage grows. No scheduler or service is contracted by this plan.

## 9. Monitoring to add before step 3
Refresh success/failure and reuse-detection counters; 401 rate by route; count of requests without
`Idempotency-Key`; `idempotency_records` growth and a scheduled call to `purgeExpiredIdempotencyRecords` and
`purgeExpiredSessions` (not scheduled yet — **open**); coach `failedAttempts` per window; fallback rate of generated routines.
