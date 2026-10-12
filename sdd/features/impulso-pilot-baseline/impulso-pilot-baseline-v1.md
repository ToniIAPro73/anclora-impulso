# Impulso pilot — AI-01 baseline v1

Mode: PREPARE + authorized local implementation. Date: 2026-10-12. Evidence class legend:
**S** = static read of code/docs at the stated SHA · **H** = historical report (not re-verified) · **R** = runtime verified (none yet) · **P** = proposal.

## 1. Repository state

| Item | Value | Class |
|---|---|---|
| Root | `/Users/toni/Developer/anclora/anclora-impulso` | S |
| Branch / upstream | `development` / `origin/development` | S |
| Base SHA | `77f852aa3a1c67b8d1f58bb8852d408b0a8c0523` (equals the plan's historical SHA; no drift) | S |
| Working tree at start | clean (0 entries) | S |
| Governance read | workspace `AGENTS.md`, repo `AGENTS.md`, `CLAUDE.md`, `.anclora/{AGENT_PROJECT_CONTEXT,PRODUCTION_RUNTIME,AOS_ADOPTION}.md`, `MEMORY.md` | S |
| Not read | `ANCLORA_WORKSPACE_AGENT_POLICY.md` (42 KB, workspace level), `.anclora/global/*`, vault contracts — referenced, not required for this increment; **pending** | — |
| Git model | `FULL_PROMOTION`: work on `development`, no automatic promotion, commits/push/PR not authorized by this mission | S |
| SDD system | repo-native `sdd/features/<name>/<name>-{spec,plan,tasks}-v1.md`; Spec Kit **not installed/used**; specs are immutable once closed | S |
| Docs language | technical docs in English (AGENTS.md); report to Toni in Spanish | S |

## 2. Environment (declared vs. verified)

| Concern | Declared | Verified |
|---|---|---|
| Runtime model | `LOCAL_RUNTIME_MODEL=PRODUCTION_BACKED`, `DO_NOT_CREATE_DEVELOPMENT_DATABASE=true` (`.anclora/PRODUCTION_RUNTIME.md`) | S |
| Database | Neon/Postgres, `LOCAL_DATABASE_SCOPE=production` | S (contract). Effective URL **not inspected** (reading `.env.local` was blocked by the sandbox classifier; not retried) |
| Migrations | `SUPABASE_DASHBOARD_OR_CLI`, `MANUAL_OR_CONSOLE`; Prisma migrations exist in `backend/prisma/migrations` (20 directories) | S — contract and tooling disagree (Supabase vs Neon+Prisma); **needs clarification** |
| Auth | self-managed JWT (access 7d, refresh 30d); `backend/.env` exists locally | S |
| Payments | none: no Stripe/Paddle/etc. in `backend/src`, `lib`, `app` | S |
| LLM | Groq via `groq-sdk`; coach provider abstraction with deterministic provider | S |
| CI | `.github/workflows/ci.yml`: backend job uses an ephemeral `postgres:16` service + `prisma migrate deploy` + `pnpm test:ci` + build; frontend job `npm install` (repo uses pnpm lockfile) + lint + typecheck + test + build | S. No CI result seen (H/R missing) |
| Node | `.nvmrc`/engines `22.x` | S |

**Test isolation:** `backend/tests/integration/*` register users through the real app and Prisma (e.g. `llm-coach.test.ts`). With a production-backed `.env` these write to production. They were **not run**. Only `backend/tests/unit/*` (pure/mocked) were executed.

## 3. Capability inventory (S unless noted; "exists" ≠ "works")

| Area | Evidence | Gap vs plan |
|---|---|---|
| Workout generation | `backend/src/services/workouts.service.ts` | Was: LLM output cast to type without validation; `Math.random` fallback. **Changed in INC-01** |
| Routine update | same | Was: `deleteMany` then `update`, no transaction. **Changed in INC-01** |
| Coach quota | `backend/src/services/coach/coach.service.ts` | Was: read-then-increment (race). **Changed in INC-01**; per-process response cache remains (not shared across serverless instances) |
| Coach guardrails | `coach/guardrails.ts`: regex list (EN/ES partial) | No eval corpus; no prompt-injection handling (AI-14) |
| Auth/session | `middleware/auth.ts`, `utils/jwt.ts`, `auth.controller.ts` | Stateless JWT; logout is a no-op server-side; no revocation; `env.ts` falls back to constant default secrets if env vars missing; tokens kept in `localStorage` (`lib/api/client.ts`, `auth-context.tsx`) although `CLAUDE.md` claims httpOnly cookie (documentation drift) — AI-06 |
| Entitlement | `premium.service.ts` uses `User.subscriptionTier` string only | No Subscription/Entitlement model, no webhooks, no checkout — AI-15/16/17 |
| Privacy | `User.socialProfileVisibility` default `"public"`; no export/erase routes found in `profile.routes.ts`; `product-events` accepts arbitrary `metadata` | AI-07, AI-18 |
| Events | `product-events.controller/service` | No dictionary, no dedupe, no consent gate |
| Progression | `services/progression/*`, tests in `tests/unit/progression-engine.test.ts` (pass locally) | Rules not professionally reviewed (AI-03/13) |
| Out of scope per mission | form analysis, voice coach, wearables, social (code exists; flags default off) | Must stay hidden from paid promises (AI-02) |

## 4. AI-01…AI-30 status map

Columns: **Sit.** = situation · **Eval.** = evaluation. No task is ACEPTADA. "Needs" lists the blocking input.

| ID | Pri | Deps (valid IDs) | Sit. | Eval. | Needs / note |
|---|---|---|---|---|---|
| AI-01 | P0 | — | parcial (this document) | PENDIENTE | Responsible/technician names, weekly capacity, CI result, runtime baseline |
| AI-02 | P0 | 01 | pendiente | BLOQUEADA | Product decision; copy changes need Hermes gate |
| AI-03 | P0 | 01 | pendiente | BLOQUEADA | Competent professional reviewer — not simulated |
| AI-04 | P0 | 01,03 | parcial: validator implemented, limits placeholder | PENDIENTE | AI-03 reviewed limits; runtime/DB evidence blocked (§5) |
| AI-05 | P0 | 03,04 | parcial: deterministic fallback implemented, not reviewed templates | PENDIENTE | AI-03 templates; UI notice of mode not done |
| AI-06 | P0 | 01 | pendiente (findings in §3) | PENDIENTE | Session design decision (cookies vs bearer, revocation store ⇒ schema) |
| AI-07 | P0 | 01 | pendiente | BLOQUEADA | Legal reviewer; retention/backup policy decision |
| AI-08 | P0 | 01 | parcial: atomic update + atomic quota in code; no idempotency key | PENDIENTE | Concurrency/rollback evidence needs isolated DB; reset-period & idempotency design |
| AI-09 | P0 | 01 | parcial: CI exists; lockfile mismatch (npm vs pnpm) | PENDIENTE | Clean-checkout run, restore/rollback rehearsal |
| AI-10 (G1) | P0 | 02,04,05,06,07,08,09 | — | BLOQUEADA | Deps open; reviewers |
| AI-11 | P1 | 10 | pendiente | BLOQUEADA | G1 |
| AI-12 | P1 | 08,11 | pendiente | BLOQUEADA | |
| AI-13 | P1 | 03,12 | pendiente | BLOQUEADA | |
| AI-14 | P0 | 05,08,10 | parcial (guardrails exist) | BLOQUEADA | G1; eval corpus needs professional |
| AI-15 | P0 | 02,10 | pendiente | BLOQUEADA | Provider, price, tax decisions |
| AI-16 | P0 | 15,09 | pendiente | BLOQUEADA | Provider; sandbox account (external service) |
| AI-17 | P0 | 16 | pendiente | BLOQUEADA | |
| AI-18 | P1 | 07,11,15 | pendiente | BLOQUEADA | |
| AI-19 | P1 | 14,15,18 | pendiente | BLOQUEADA | Real cost data |
| AI-20 (G2) | P0 | 11,12,13,14,17,18,19 | — | BLOQUEADA | |
| AI-21…AI-30 | P0/P1 | per plan | pendiente | BLOQUEADA | Human/commercial activities and gates; not executable under this authorization |

Dependency check on AI-01…AI-30 (as listed in the plan): all referenced IDs exist; no cycles (topological order 01 → 02/03/06/07/08/09 → 04 → 05 → 10 → …).

## 5. Conflicts and blocked checks

1. **Isolated tests vs production-backed runtime.** Contract forbids creating a dev database; this mission forbids touching production. Affected checks (marked NOT EXECUTED/BLOCKED): AI-04 "no DB write after failure", AI-08 rollback/concurrency, any `tests/integration/*`, E2E.
   *Concrete options for Toni (pick one):* (a) authorize an ephemeral local Postgres 16 container that mirrors the CI service (`impulso_test`, synthetic data) as a bounded exception to `DO_NOT_CREATE_DEVELOPMENT_DATABASE`; (b) run the same suite only in GitHub CI (already isolated) — requires push, which is not authorized; (c) accept unit-only evidence and keep the DB-level criteria BLOCKED.
2. **Migration contract mismatch:** `MIGRATION_SYSTEM=Supabase PostgreSQL` but repo uses Prisma on Neon. Schema-changing work (persisting generation mode/version, idempotency keys, revocation list, subscriptions) is held until this is clarified.
3. **Spec Kit vs repo SDD:** Spec Kit absent. Repo SDD (`sdd/features/*`) is canonical; no second system introduced. Spec Kit adoption would need a decision and an adapter that links, not duplicates, these files.
4. **CLAUDE.md drift:** claims an httpOnly refresh cookie (not matched by the auth code read: logout is a no-op and the client stores `refreshToken` in `localStorage`) and "Production-ready" (unverified). Rate-limit values were not checked. Treat as non-normative.

### 5.5 Update 2026-10-12 (after Toni's environment authorization)
- Conflict 5.1 **resolved by bounded exception** `IMPULSO-TEST-DB-2026-10-12` (isolated PostgreSQL 16 container, see `backend/docs/TEST_DATABASE.md`). Production contract unchanged. Integration/E2E evidence now obtainable locally; D1 closed.
- Runtime now verified (R) for INC-01 only. All 13 existing integration suites pass on the isolated DB.
- New static finding (S): `GET /api/dashboard/{metrics,db-metrics,logs-stats,logs,summary}` have no authentication (route comments say "Public (en producción, proteger…)"). `logs` may contain personal data. Relates to AI-06/AI-07/AI-09. Not changed: the static dashboard under `public/` presumably calls them without a token; protection needs an owner decision (admin middleware exists in `middleware/admin.ts`).
- New static finding (S): `/api/auth/refresh` verifies only the refresh JWT signature; it does not check that the user still exists, nor any revocation.

### 5.6 Update 2026-10-12 (second pass)
- D8 closed locally: `/api/dashboard/*` now admin-only (anonymous 401, non-admin 403, admin 200; synthetic users, isolated DB). Evidence **before** the fix: anonymous requests returned 200 with system/DB metrics and log entries; the error handler logged request bodies (a synthetic password appeared in the log file) and HTTP logs contained OAuth `code` query values. Both redacted now. Whether real logs contain personal data in production was **not** inspected.
- OAuth callback no longer puts tokens in the URL query; refresh now exists end-to-end (client previously never refreshed).
- Contract/repo discrepancy (decision pending for production): `PRODUCTION_RUNTIME.md` declares `MIGRATION_SYSTEM=Supabase PostgreSQL` / `SUPABASE_DASHBOARD_OR_CLI` and "Vercel Serverless Functions" as backend, while the repo contains Prisma migrations against Neon/Postgres and an Express server (`CLAUDE.md` mentions Railway/Render). The contract was not edited.
- New migrations exist only as reviewable files and in the isolated test DB.
- `metrics.service` created a second `PrismaClient`; now uses the shared one.

### 5.7 Update 2026-10-12 (third pass)
- D9 adopted for this increment (quota policy, fixed 60-min windows); D4 local 15 min; D10 plan written, **not executed**.
- E2E found two real client defects (refresh token not stored by login/signup pages; `/auth/me` not refreshed) — fixed.
- Hermes copy gate and independent security review unavailable → BLOCKED, dossiers prepared.

## 6. Decisions needed (grouped)

| # | Decision | Unblocks |
|---|---|---|
| D1 | ~~Isolated test DB option~~ — **closed** by exception IMPULSO-TEST-DB-2026-10-12 | — |
| D2 | Professional reviewer + review of exercise limits/templates (replace `DEFAULT_PLAN_LIMITS`) | AI-03, AI-04, AI-05 acceptance |
| D3 | Migration path/owner (Prisma on Neon vs Supabase) | Any schema change |
| D4 | Session model for AI-06 (revocation store; cookie vs bearer) | AI-06 |
| D5 | Payments provider, price/tax, trial policy | AI-15…17 |
| D6 | Weekly capacity, named owner/reviewers for each task | Calendar; AI-01 closure |
| D8 | ~~Protect `/api/dashboard/*`~~ — **done locally** (admin-only); decide whether to keep the endpoint set in production | AI-06/07/09 |
| D9 | ~~Coach quota policy~~ adopted. Still open: responses per plan linked to the offer; approval of operational caps; scheduler for purges | AI-08 closure; offer wording |
| D10 | Production migration path and when to apply the 3 reviewed migrations | persistence of provenance/idempotency/sessions in production |
| D7 | Confirm production `JWT_SECRET`/`JWT_REFRESH_SECRET` are set (cannot verify without reading production env) | Whether default-secret fallback is currently exploitable |

## 7. Proposal: earlier demand validation (P, not executed)

Prepare now, run only on approval: interview script, willingness-to-pay question set (no price anchoring from the plan's 9.99/59.99 as fact), consent text, and a fake-door metric definition (denominator = users reaching paywall exposure, deduped, with cut-off date). Contacting people, ads or spend remain unauthorized; moving this ahead of G1 is a roadmap sequencing decision for Toni.

## 8. Capacity / reviewers

Weekly capacity: **pending** (not provided). Reviewers (professional, legal, security, finance): **pending**. No names are assumed.
