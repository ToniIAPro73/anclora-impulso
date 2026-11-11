# Phase 2 SDD — Modular Health Plan Catalog, Eligibility Engine & Privacy Preparation

**Feature ID:** `phase2-modular-health-plan-catalog`
**Repository:** `anclora-impulso`
**Base Branch / HEAD:** `development` @ `0b40779336df8468359ae03504e9a109fe78e223`
**Date:** 2026-11-11
**Tasks:** `TASK-020`, `TASK-017`, `TASK-018`, `TASK-019`
**Status:** `IMPLEMENTED_DEVELOPMENT_PENDING_ENV_AND_LEGAL`

---

## 1. Initial Reconciliation Classification

| Area | Current State (`0b40779`) | Classification | Action in Phase 2 |
|---|---|---|---|
| Eligibility bands & checks (`health-plans.domain.ts`, `health-plans.domain.test.ts`) | `HEALTH_PLAN_MODALITY_BANDS`, `getEligibleModalitiesForAge`, `validateNonOverlappingBands`, `isInCohort` | `PARTIAL` | Add formal `AGE_BANDS` (`A1`–`A5`), pure `resolveAgeBand`, neutral/explicit `suggestModalitiesForProfile` (`autoEnroll: false`), strict float/NaN/invalid handling, and full boundary tests (`17, 18, 29, 30, 39, 40, 49, 50, 59, 60, 61, null`, floats, neutral options). |
| Catalog persistence (`HealthPlanDefinition` in `schema.prisma`) | `minAge Int`, `maxAge Int`, `status`, `version` only | `MISSING` | Add `cohortKey String?`, `variantKey String?`, `maxAge Int?` (reusing `minAge`/`maxAge` without redundant columns), `@@unique([cohortKey, version])`, additive migration + Ruta Vital backfill (`RV-50-60`, `NEUTRAL`), update `scripts/release/release-manifest.json`. |
| Optional sensitive attributes (`TASK-018`) | `User.sex String?` (`male \| female`) only; no `sexAtBirth`/`genderIdentity` | `MISSING` | Add nullable `User.sexAtBirth` / `User.genderIdentity` (additive migration), isolated validation/non-inference module + `redactSensitive` log protection, keep runtime collection inactive (`TASK-003` legal gate). |
| Modular draft catalog seed (`TASK-019`) | Only `seed.ts` (recipes/exercises) and lazy `ensureRutaVitalDefinition()` | `MISSING` | Create idempotent `backend/prisma/seed-health-plans.ts` (`upsert`) seeding `P01`–`P10` strictly with `status='draft'`, zero clinical overclaiming, zero mutation to `seed.ts` or Ruta Vital enrollments. |

---

## 2. Scope & Explicit Non-Goals (Phases 3–7 Excluded)

- Included: `TASK-020` (eligibility domain), `TASK-017` (additive catalog schema + migration), `TASK-018` (privacy-safe schema/validators/redaction, inactive at runtime), `TASK-019` (10 draft modalities idempotent seed).
- Excluded: modality selection UI (`TASK-022`), plan switching (`TASK-023`), sensitive onboarding screens/forms (`TASK-025`), 24-week full clinical content (`TASK-021`), recommendations engine API endpoints, production DB migration execution, or feature activation.

---

## 3. Architectural Decisions

### D-P2-01 — Reuse `minAge` and `maxAge` on `HealthPlanDefinition`
Existing `health_plan_definitions` stores `"minAge" INTEGER NOT NULL` and `"maxAge" INTEGER NOT NULL`, and the live Ruta Vital contract (`GET /api/health-plans/definitions`, `health-plans.service.ts`, `tests/integration/health-plans.test.ts`) expects `minAge` and `maxAge` in JSON responses.
- **Decision:** Keep existing column names `minAge` and `maxAge`; relax `maxAge` to nullable (`Int?` / `ALTER COLUMN "maxAge" DROP NOT NULL`) for `60+` bands (`P09`/`P10`), and add `cohortKey String?` and `variantKey String?` (`@@unique([cohortKey, version])`, `@@index([cohortKey, variantKey])`). Avoid duplicate `ageMin`/`ageMax` columns on the same table.

### D-P2-02 — Backward Compatibility Strategy with Ruta Vital v1 (`50–60`)
Ruta Vital v1 (`key: 'ruta-vital-50-60'`, `minAge: 50`, `maxAge: 60`, `status: 'published'`, `version: 1`) overlaps age `60` relative to the new modular catalog (`P07`/`P08` `[50,59]`, `P09`/`P10` `[60,null]`).
- **Decision:** Keep Ruta Vital v1 completely intact (`minAge: 50`, `maxAge: 60`, `published`, backfilled to `cohortKey: 'RV-50-60'`, `variantKey: 'NEUTRAL'`). All 10 new modalities (`P01`–`P10`, `version: 1`) use separate stable `key`s and `cohortKey`s (`P01`–`P10`) and remain `status: 'draft'`, so `listDefinitions()` (`where: { status: 'published' }`) and `enroll()` (`ruta-vital-50-60`) behave identically for existing and new users.
- **Owner Decision Pending (carried from `06_AGE_GENDER_PLANS.md §3`):** Decide before Phase 3 publication whether age `60` migrates to a clean v2 (`maxAge: 59`) or treats `RV-50-60` as a fallback compatibility route alongside `P09`/`P10`.

### D-P2-03 — Pure Suggestion Eligibility Contract (`TASK-020`)
- Bands: `A1` `[18,29]`, `A2` `[30,39]`, `A3` `[40,49]`, `A4` `[50,59]`, `A5` `[60,null]`. Both bounds inclusive; `ageMax === null` means unbounded above.
- Invalid/non-integer/missing/`<18` ages produce zero band and empty suggestions (`UNDER_18`, `AGE_REQUIRED`, `INVALID_AGE`).
- `suggestModalitiesForProfile({ age, variantPreference })` ALWAYS sets `autoEnroll: false`.
- When `variantPreference` is absent, `null`, `'prefer_not_say'`, or unrecognized, it NEVER infers sex from any other attribute and returns `suggestionMode: 'NEUTRAL_OPTIONS'` with both options for the eligible age band.
- Variants (`M`/`F`) are editorial configuration selectors only; they NEVER adjust physiological capacity, clinical status, sets/reps/load limits, or safety classification.

### D-P2-04 — Privacy & `TASK-003` Legal Guard (`TASK-018`)
- `User.sexAtBirth` and `User.genderIdentity` are added as nullable columns alongside existing `User.sex` (legacy `sex` preserved untouched).
- `SENSITIVE_PROFILE_COLLECTION_ENABLED = false` in `backend/src/utils/sensitive-attributes.ts`; active routes (`/api/auth/register`, `/api/profile`, `/api/health-plans/onboarding`) do NOT accept, request, populate, infer, or return `sexAtBirth` or `genderIdentity` until `TASK-003` legal approval is documented.
- No cross-field inference (`sex` does NOT populate `sexAtBirth`; `sexAtBirth` does NOT populate `genderIdentity`).
- `redactSensitive` in `backend/src/utils/redact.ts` redacts `sexAtBirth` and `genderIdentity` keys in structured logs.

### D-P2-05 — Idempotent Draft Seed (`TASK-019`)
- `backend/prisma/seed-health-plans.ts` exports `seedHealthPlanCatalog(prisma)` and upserts by `key` for `P01`–`P10` strictly with `status: 'draft'`, `version: 1`, `cohortKey: 'P01'..'P10'`, `variantKey: 'M'|'F'`, plus idempotent `HealthPlanPillar` rows (`planId_key`) and non-clinical `HealthPlanContentReference` notice (`PENDING_PROFESSIONAL_REVIEW`).
- Existing `seed.ts` and existing `HealthPlanEnrollment` / `ruta-vital-50-60` rows are never modified destructively.

---

## 4. Migration Strategy & Data Integrity

1. Additive migration `backend/prisma/migrations/20261111211500_add_modular_health_plan_catalog_and_optional_identity/migration.sql`:
   - `ALTER TABLE "health_plan_definitions" ADD COLUMN IF NOT EXISTS "cohortKey" TEXT;`
   - `ALTER TABLE "health_plan_definitions" ADD COLUMN IF NOT EXISTS "variantKey" TEXT;`
   - `ALTER TABLE "health_plan_definitions" ALTER COLUMN "maxAge" DROP NOT NULL;`
   - Non-destructive backfill for existing Ruta Vital v1 row only where `"cohortKey" IS NULL`.
   - `CREATE UNIQUE INDEX IF NOT EXISTS "health_plan_definitions_cohortKey_version_key"` & `CREATE INDEX IF NOT EXISTS "health_plan_definitions_cohortKey_variantKey_idx"`.
   - `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "sexAtBirth" TEXT;`
   - `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "genderIdentity" TEXT;`
2. Synchronize `scripts/release/release-manifest.json` via `node scripts/release/generate-release-manifest.mjs`.
3. Never apply locally against Neon production; verify via CI isolated PostgreSQL 16 (and `verify-release-manifest.mjs` locally).

---

## 5. Acceptance Criteria

1. Pure eligibility tests cover `17, 18, 29, 30, 39, 40, 49, 50, 59, 60, 61, null`, floats/`NaN`, non-overlap across `A1`–`A5` & `P01`–`P10`, neutral multi-option suggestions, `autoEnroll: false`, zero core-engine circular dependencies.
2. Additive schema + SQL migration passes `prisma validate`, `prisma generate`, and `verify-release-manifest.mjs` cleanly; Ruta Vital v1 contract (`listDefinitions`, `enroll`, `saveOnboarding`, `getHome`) untouched.
3. `TASK-018` isolated types/validators pass unit tests (`prefer_not_say`, non-inference, log redaction, runtime route inactivity) while `TASK-003` collection remains disabled.
4. `seed-health-plans.ts` creates/upserts exactly 10 `draft` definitions `P01`–`P10` idempotently (unit-tested with mocked Prisma state + CI/isolated-Postgres verification).

