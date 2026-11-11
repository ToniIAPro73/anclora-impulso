# Spec v1 — Phase 0 Runtime, Secret & Cohort Eligibility Guards (TASK-006, TASK-008, TASK-012, TASK-020)

- **Status:** Draft (Pending Toni validation in `development`)
- **Tasks covered:** `TASK-006`, `TASK-008`, `TASK-012`, `TASK-020`
- **Origins:** `AUD-002`, `AUD-004`, `AUD-014`, `AUD-023`

## 1. Objective

1. **Mandatory JWT secrets outside test (`TASK-006`):** Prevent backend startup with default or empty `JWT_SECRET` / `JWT_REFRESH_SECRET` in any environment other than `test` (not only when `NODE_ENV === 'production'`).
2. **Integration test guard hardening (`TASK-012`):** Ensure integration test target evaluation (`describeDatabaseTarget` / `evaluateIntegrationAccess`) strictly rejects remote/Neon hosts and non-test database names (such as `neondb`, `postgres`, `verceldb`, or any database name not ending in `_test`).
3. **Strict age eligibility & non-overlapping modality bands (`TASK-008`, `TASK-020`):**
   - `isInCohort(null | undefined)` must return `false` instead of `true`.
   - Provide pure band eligibility resolution for the 10 age/sex modalities (`P01`–`P10`: `18–29`, `30–39`, `40–49`, `50–59`, `60+`), blocking `< 18` and `null`, and enforcing non-overlapping integer boundaries and architectural boundary checks.

## 2. Acceptance Criteria

- **AC-01 (`TASK-006`):** `assertRequiredJwtSecrets` throws in `development`, `staging`, and `production` when `jwtSecret` or `jwtRefreshSecret` is empty, shorter than 32 chars, identical, or matches `KNOWN_DEFAULT_SECRETS`, while allowing `NODE_ENV === 'test'` to run unit tests without external env files.
- **AC-02 (`TASK-012`):** `describeDatabaseTarget` and `evaluateIntegrationAccess` reject Neon hostnames (`*.neon.tech`) and database names that do not end in `_test` (e.g., `neondb`, `postgres`), even if tunnelled through loopback.
- **AC-03 (`TASK-008`):** `isInCohort(null, 50, 60)` and `isInCohort(undefined, 50, 60)` return `false`.
- **AC-04 (`TASK-020`):** Pure modality band lookup covers boundaries `17 -> []`, `18 -> P01/P02`, `29 -> P01/P02`, `30 -> P03/P04`, `39 -> P03/P04`, `40 -> P05/P06`, `49 -> P05/P06`, `50 -> P07/P08`, `59 -> P07/P08`, `60 -> P09/P10`, `null -> []`; band overlap validation confirms zero overlap; core engines (`workouts`, `nutrition`, `gamification`) do not import `health-plans.*`.
