# Phase 1 — Stability, Security & Quality (SDD Spec v1)

**Branch:** `development`
**Scope:** Backlog tasks `TASK-004`, `TASK-005`, `TASK-007`, `TASK-008`, `TASK-009`, `TASK-010`, `TASK-011`, `TASK-013`, plus dependency verification of `TASK-003`.

## 1. Dependency Check (`TASK-003`)
- `TASK-003` (legal framework for minors, health data processing & versioned consent) remains `BLOCKED_EXTERNAL_LEGAL` pending external legal counsel text and owner decision on minimum age.
- `TASK-009` and `TASK-013` proceed strictly without inventing legal/medical clauses: unverified clinical claims in `forty-plus-guidance.ts` are removed or downgraded to attributed public guidelines / non-clinical fitness guidance, and E2E testing uses only isolated synthetic fixture state (`qa.impulso@anclora.local`) without creating a development DB or mutating production.

## 2. Requirements by Task

### `TASK-005` — Backend Prisma + Typecheck CI Gate
- `.github/workflows/ci.yml` executes explicit `pnpm run typecheck` in `backend/` immediately after `prisma generate` (and `prisma migrate deploy`) before running tests, matching `test-frontend`.
- Local workflow documented: `cd backend && pnpm run prisma:generate && pnpm run typecheck`.
- Acceptance: `backend` `tsc --noEmit` exits `0`.

### `TASK-004` — Dependency Cleanup & Exact Version Pinning
- Remove verified unused dependencies from root `package.json`: `@supabase/ssr`, `@supabase/supabase-js`, `anthropic`, `openai`, `psycopg2-binary`, `geist`.
- Pin all remaining `"latest"` dependencies (`@radix-ui/react-*`, `@vercel/analytics`, `next-themes`, `recharts`) to their exact locked versions in `pnpm-lock.yaml`.
- Sync `pnpm-lock.yaml` with `pnpm install --lockfile-only` without mutating `node_modules` unnecessarily or changing runtime behavior.
- Acceptance: `0` `"latest"` specifiers in `package.json` and `backend/package.json`; frontend `typecheck`, `lint`, and Jest pass.

### `TASK-007` — Retire Public `/dashboard` Static Surface
- Remove unauthenticated `app.use('/dashboard', express.static('public'))` from `backend/src/app.ts` (Next.js `/dashboard` and admin-protected `/api/dashboard/*` are the supported surfaces).
- Acceptance: `GET /dashboard` and `GET /dashboard/dashboard.html` never return `200` (return `404` via `notFoundHandler`).

### `TASK-008` — Cohort Age Eligibility Verification
- Verify `isInCohort` rejects `null`, `undefined`, non-integer, and out-of-band ages (`< minAge` or `> maxAge`), and `health-plans.service.enroll` rejects ineligible users with `AppError(422, ...)`.
- Acceptance: domain tests + mocked service unit tests pass cleanly.

### `TASK-009` — Provenance for 40+ & Sex-Specific Guidance + Hermes Copy Note
- Every 40+ workout and nutrition guidance item in `backend/src/services/forty-plus-guidance.ts` is represented in typed registries with `{ id, scope, audience, text, evidenceLevel, sourceTitle, sourceUrl, reviewedAt }`.
- Unverified clinical/hormonal/disease/numeric claims (perimenopause/menopause, bone health, visceral fat, insulin sensitivity, calcium/omega-3 prescriptions, unverified `1,3-1,6 g/kg/dia`) are removed and replaced with either:
  - Verified WHO global guidelines (WHO 2020 Physical Activity Guidelines; WHO Healthy Diet fact sheet), or
  - Explicit `GENERIC_FITNESS_GUIDANCE` non-clinical habit coaching pending external specialist sign-off.
- Unit tests fail if any guidance entry lacks provenance, expires (`> 12 months`), or reintroduces banned unverified clinical phrasing.
- Public UI notices (`components/workout-generator.tsx`, `app/nutrition/page.tsx`) avoid unverified sex-based clinical claims and are logged for Hermes review (`sdd/features/phase1-stability-quality/hermes-copy-diff-v1.md`).

### `TASK-010` — AI Plan Limits Conservative Hardening & Review Dossier
- Preserve `reviewStatus: 'PENDING_PROFESSIONAL_REVIEW'` and frozen `DEFAULT_PLAN_LIMITS` without widening any ceiling.
- Add boundary & immutability assertions in `backend/tests/unit/workout-plan-validator.test.ts` (exact age `40` threshold, `NaN`, frozen immutability).
- Update reviewer dossier references to link `TASK-009`, `TASK-010`, and `TASK-003` external sign-off gates (`BLOCKED_EXTERNAL_REVIEW` until signed).

### `TASK-011` — Documentation Synchronization
- Update stale metrics, CI workflow filenames, hosting topology (`Vercel + Render + Neon`), and LLM stack (`Groq` primary / deterministic fallback instead of stale GPT-4 / Railway / test.yml claims) in `CLAUDE.md` and `docs/business/EXECUTIVE-SUMMARY.md` (marking commercial figures explicitly as unverified business targets).
- Archive stray root report `RESULTADO-IMPLEMENTACION-D10.md` to `docs/archive/RESULTADO-IMPLEMENTACION-D10.md`.
- Preserve all closed `docs/specs/SPEC-*.md` files unmodified.

### `TASK-013` — Ruta Vital E2E & Visual QA
- Add Playwright E2E + visual audit spec `e2e/health-plans-ruta-vital.spec.ts` covering:
  1. Discover (`Explora Ruta Vital`)
  2. Enroll (`Unirme a Ruta Vital`)
  3. Safety-aware onboarding (`Personaliza tu punto de partida`)
  4. Week 1 view, minimum/full versions, next action, pillars
  5. Complete weekly action and verify progress update
  6. Reload / re-login persistence (`qa.impulso@anclora.local`)
  7. Visual/a11y checks (`h1`, landmark `main`, no horizontal overflow at mobile `390x844` and desktop `1440x900`, `role` contrast/visibility)
- Execute strictly against isolated Next.js dev server with intercepted `/api/*` network mocks (`page.route`), zero live DB writes, and no modification of production/Neon state.

