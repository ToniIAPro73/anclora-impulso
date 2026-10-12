# Technical closure matrix — INC-01…INC-04, AI-06 (2026-10-12)

Reading rules. "Local verification" is evidence on the isolated PostgreSQL with synthetic data; it is **not** a
launch authorization. A pending production migration is a launch/release condition, **not** a failure of a local test.
G1–G4 are not evaluated or approved.

## A. Technical criteria satisfied (local verification)
| Area | Criterion | Evidence |
|---|---|---|
| AI-04 | Invalid AI output never persisted; no partial writes | `inc01` (real DB) |
| AI-05 | Deterministic, compatible fallback; mode+version persisted, explicit `unknown` for history | `inc01`, `verify-migrations` |
| AI-08 | Atomic routine update; atomic quota incl. first window; D9 reservation/release | `inc01`, `inc03`, unit |
| AI-08 | Persistent idempotency: replay, 422, in-flight 409, simultaneous, lost response, crash recovery, lock expiry with stale owner, atomic completion | `inc02`, `inc03`, E2E |
| AI-08 | Unknown-outcome timeout classification; bounded attempts/failures/concurrency; limits scoped per user (not evadable by key) | `inc03`, `inc04` |
| AI-08 | Retention: logical expiry vs physical deletion; safe concurrent purges; no duplicate effects inside the guarantee | `inc04` |
| AI-06 | Server sessions, rotation, reuse detection, grace limits, revocation, disabled/deleted users, A/B isolation (11 id routes + inventory) | `ai06-sessions` (21), E2E |
| AI-06 | Config policy: enforce refuses insecure start; warn/off never "acceptable"; legacy acceptance = warning | unit (11), `ai06-startup-config` (5) |
| Transition | Target end state (require key, legacy off, enforce, 15 min) works on a real process | `final-state` (5), E2E |
| D8 | Operational endpoints admin-only; no secrets in error/HTTP logs | `dashboard-authorization` (14) |
| Client | Single-flight silent refresh; key lifecycle; fallback notice | jest (idempotency 9, refresh 6), E2E (13) |
| Runner | No operational env file contributes configuration to Next or API; probe proven sensitive | `verify-runner-isolation.sh` |
| Schema | 4 migrations: clean ≡ upgrade, no drift, history = `unknown` | `verify-migrations` |
| Totals | backend integration 20 suites / 126 tests; unit 7 / 57; frontend jest 11 / 96; Playwright 13/13; builds (backend, Next in a copy) | latest runs |

## B. Pending defects / residual technical risks (not resolved)
| ID | Item | Class |
|---|---|---|
| R-1 | Intermittent failure in `inc03`, cause unknown, not reproduced; instrumentation added | open incident |
| R-2 | API still *reads* `backend/.env` through Prisma's loader (nothing applied thanks to the shield); a new env name read by code is shielded automatically, but the file is still opened | residual |
| R-3 | Earlier E2E runs loaded `.env.local` into Next and operational names into the API (impact assessed, see TEST_DATABASE.md); `test-results/` may hold screenshots from those runs — deletion pending (blocked for the agent) | remediation by owner |
| R-4 | Grace window: replay of a consumed refresh token within 10 s is accepted and undetected | accepted risk, documented |
| R-5 | Legacy JWTs cannot be revoked individually while `AUTH_ACCEPT_LEGACY_TOKENS=true` | accepted until retirement |
| R-6 | Tokens in `localStorage` (XSS exposure); CSP allows `'unsafe-inline'` scripts | transitional, not accepted as final |
| R-7 | No global/system-wide spend ceiling; per-IP limits are per instance | gap |
| R-8 | Retention job not scheduled; tables grow until it is | open (D10 §8) |
| R-9 | `POST /workouts/generate` replays return the *stored* routine; later edits are not reflected | by design, documented |
| R-10 | Coach has no UI consumer; Playwright covers it at API level only | capability status |
| R-11 | OAuth callback still returns tokens in the URL fragment (one-time code proposed, not built) | proposal |

## C. Product / owner decisions
| ID | Decision |
|---|---|
| D-1 | Responses per plan and link to the commercial offer; approval (or replacement) of the experimental caps 3 / 5 / 2 |
| D-2 | Whether `Idempotency-Key` stays mandatory long term and the relative window (D10 §5.1) |
| D-3 | Access-token lifetime default (15 min proposed) and long-term token transport (cookie needs a same-site API domain) |
| D-4 | Whether operational endpoints (`/api/dashboard/*`) exist in production at all |
| D-5 | Retention values (24 h replay guarantee, 1 h grace) and personal-data retention of stored responses (AI-07) |
| D-6 | Scheduler for the retention job (depends on B1) |

## D. Reviews required (none obtained)
| Review | Scope | Status |
|---|---|---|
| Professional (AI-03) | exercise ceilings, fallback templates, exclusions, referral wording | **BLOCKED** — dossier ready, no reviewer named; AI-04/AI-05 cannot be ACCEPTED |
| Security (AI-06-AC10) | session model, idempotency ownership, residual risks | **BLOCKED** — dossier ready, no reviewer named |
| Hermes copy gate | `ai-02-copy-diff-for-hermes-v1.md` | **PENDING** — no Hermes reviewer available; nothing approved |
| Legal (AI-07) | stored responses, logs, legal text mentioning AI | not started |

## E. Launch-only conditions (exclusive to production; none executed or authorized)
B1 migration path decision · B2 production secrets confirmed (by owner, by name/length) · execution of D10 (4 migrations,
backend, frontend, switches) · production smoke with the dedicated QA identity · scheduler/monitoring for refresh,
401s, idempotency, fallback rate and retention · G1…G4 per the plan with their reviewers · commercial authorization.

## Status of tasks
AI-03 BLOQUEADA · AI-04 PENDIENTE (review) · AI-05 PENDIENTE (review, copy gate) · AI-06 PENDIENTE (AC10 BLOQUEADA, AC08 N/A under bearer) ·
AI-08 PENDIENTE — **not closed** (D-1, R-8) · AI-02 PENDIENTE (Hermes) · AI-14 not started (coach UI absent) · G1–G4 not evaluated.

---

## Addendum 2026-10-12 (phase consolidation) — supersedes where stated, nothing above was deleted

| Item above | Superseded by |
|---|---|
| Section A "Runner: no operational env file contributes configuration…" and totals measured with earlier runners | `evidence-validity-register-v1.md`: only V-VALID (`…034331Z-65c1904d`), E-VALID (`…034530Z-c214631e`) and I-VALID (`…034716Z-865b056c`) carry isolation/identity weight |
| R-2 "API still reads `backend/.env` … (nothing applied thanks to the shield)" | Resolved at the mechanism level: the API and jest now run from an env-free clone whose Prisma loader path cannot reach `backend/.env` (R2 proves it with the shield OFF; C2 proves name shielding alone is insufficient). The shield remains defence in depth |
| R-3 "`test-results/` may hold screenshots from those runs" | `artifacts-inventory-and-review-v1.md`: the directory holds only `.last-run.json`; exact manual-review paths listed |
| Status line "AI-08 PENDIENTE — not closed (D-1, R-8)" and §C D-1/R-8 as AI-08 conditions | `ai-08-acceptance-analysis-v1.md`: the commercial figure belongs to AI-15/AI-19 and the scheduler to D10; AI-08's plan-derived blockers are staging evidence, independent review and predecessor AI-01 |
| Any statement that no OAuth route was requested / that no external service could be contacted | `effects-assessment-v1.md`: 14 callback requests were made by this work's test (302 in < 1 ms); contact with external services is **undetermined** at network level |
