# Phase closure report — consolidated (2026-10-12)

Base `77f852aa` on `development`, working tree dirty (uncommitted), `sourceTreeSha256 76df760527d9cd1b…`.
Nothing committed, pushed, deployed or run against production; D10 not executed.

## 1. Valid evidence and superseded evidence
| Valid (identified env + code) | Result |
|---|---|
| I-VALID `backend/artifacts/test-runs/20261012T034716Z-865b056c` | integration 20 suites / 126 tests, env-free clone, DB marker + container id recorded |
| E-VALID `artifacts/qa/runs/20261012T034530Z-c214631e` | Playwright 13/13, listener/cwd/marker-request identity verified, own processes removed |
| V-VALID `artifacts/qa/isolation/20261012T034331Z-65c1904d` | isolation 11/11 with positive controls |
| Unit (7/57), frontend jest (11/96), `tsc`, builds, `verify-migrations` | unaffected by the defects |
| **Superseded / not valid for isolation or current code** | E-01…E-11 (orphans, loaded variables, no identity), V-01…V-03, pre-clone integration runs as isolation evidence (behaviour kept) — see `evidence-validity-register-v1.md` |

## 2. Effects: observed vs undetermined
Observed: all writes landed in the isolated database; 14 OAuth callback requests (own test, 302 in < 1 ms, no provider
start request, 0 OAuth accounts); no AI provider client constructed in any logged process; no notification rows.
**Undetermined** (no network capture): any outbound connection of the orphan Next (production-backed names present,
no repository code reads them) and orphan API; whether login-autofill credentials were rendered locally. Earlier
claims "no production access / no OAuth request" are withdrawn. Details: `effects-assessment-v1.md`.

## 3. Work delivered (cumulative)
- **Code**: plan validator + deterministic fallback + provenance (INC-01); atomic update; atomic quota with D9
  reservation/release; persistent idempotency with owner token and atomic completion (coach, generate); operational
  caps; retention/purge; server sessions with rotating hashed refresh tokens, revocation, config policy; admin-only
  operational endpoints, log redaction; client silent refresh, idempotency keys, neutral copy + mode badge.
- **Migrations (expand-only, applied to the isolated DB only)**: `20261012030000_add_workout_generation_provenance`,
  `…030100_add_idempotency_records`, `…030200_add_auth_sessions`, `…040000_add_coach_usage_operational_counters`.
- **Tooling**: isolated PostgreSQL compose, env-free clones, run identity, failure reporter, isolation probe, E2E runner.
- **Documents**: `sdd/features/impulso-pilot-*` (baseline, data-integrity, session-security, professional-review,
  release-plan) and this phase's register, effects, artifact inventory, AI-08 analysis.

## 4. Residual risks (priority order)
1. **Possible outbound contact of orphan processes is undetermined** (needs provider/host-side logs for 05:00–05:28 CEST).
2. **Tokens in `localStorage` + CSP `unsafe-inline`** (XSS exposure); OAuth tokens still in the URL fragment.
3. **Legacy JWTs unrevocable while accepted**; 10 s refresh grace undetected-replay window.
4. **No global spend ceiling**; per-IP limits per instance; AI-08 staging evidence absent.
5. **Intermittent `inc03` failure, cause unknown** (not reproduced; instrumentation in place).
6. Production migration path / secrets (B1/B2) and retention scheduler unresolved (launch operations).
7. Third-party packages of the frontend not audited for ambient env reads.

## 5. Minimal decisions needed
| # | Decision | Unblocks |
|---|---|---|
| 1 | Provider/host-side log review for the 05:00–05:28 CEST window (owner action) and rotation policy if autofill credentials were operational | closes effect uncertainty |
| 2 | Name the independent reviewers: professional (AI-03), security (AI-06-AC10), Hermes copy gate, legal | AI-03/04/05/06/02 acceptance |
| 3 | Whether a staging environment will exist (AI-08 evidence is defined "en staging") | AI-08, AI-06, AI-04 evidence |
| 4 | Commercial quota and caps approval (AI-15/AI-19 scope) | offer wording; not AI-08 |
| 5 | B1/B2 and authorization to execute D10 | launch only |

## 6. Status by task and gate
| Item | Status | Reason |
|---|---|---|
| AI-01 | PENDIENTE | owners/capacity not confirmed; predecessor of everything |
| AI-02 | PENDIENTE | copy changed locally; Hermes gate pending; matrix not complete |
| AI-03 | BLOQUEADA | no professional reviewer |
| AI-04 / AI-05 | PENDIENTE | implementation verified; AI-03 review, staging evidence |
| AI-06 | PENDIENTE (AC10 BLOQUEADA) | security reviewer absent; transport transitional |
| AI-08 | BLOQUEADA for acceptance, **no mandatory criterion known to be violated** | staging evidence, independent review, AI-01 (see analysis) |
| AI-14 | not started | no coach UI; depends on G1 |
| AI-09 | PENDIENTE | CI not run; clean-checkout/restore not rehearsed |
| G1…G4 | **not evaluated, not approved** | dependencies and reviews missing |
