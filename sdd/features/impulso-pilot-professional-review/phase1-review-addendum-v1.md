# Phase 1 Professional Review Addendum (`TASK-009` & `TASK-010`)

**Status:** `BLOCKED_EXTERNAL_REVIEW` (external exercise/nutrition professional and legal counsel review have not occurred).
**Baseline Limits File:** `backend/src/services/workouts/plan-limits.ts` (`reviewStatus: 'PENDING_PROFESSIONAL_REVIEW'`, unchanged conservative ceilings).

## 1. Scope Awaiting External Sign-off

1. **`TASK-010` — AI Workout Limits (`plan-limits.ts` / `plan-validator.ts`)**
   - `DEFAULT_PLAN_LIMITS` remains frozen at `minExercises: 1`, `maxExercises: 6`, `maxExercisesAge40Plus: 5`, `minSets: 1`, `maxSets: 5`, `minReps: 1`, `maxReps: 15`, `minRestSeconds: 0`, `maxRestSeconds: 75`.
   - Exact boundary coverage added in `backend/tests/unit/workout-plan-validator.test.ts` (immutability, `reviewStatus`, `age: 40`, ceiling `+1` rejections).
   - Transition to `reviewStatus: 'REVIEWED'` requires completing Section 7 of `ai-03-reviewer-dossier-v1.md` with reviewer name, credential, date, reviewed commit, and outcome.

2. **`TASK-009` — 40+ & Sex-Specific Guidance Registry (`forty-plus-guidance.ts`)**
   - All entries now declare `evidenceLevel`, `sourceTitle`, `sourceUrl`, and `reviewedAt` (`2026-11-11`).
   - Unverified clinical/hormonal claims (`perimenopausia/menopausia`, `salud osea`, `grasa visceral`, `sensibilidad a la insulina`, `calcio`, `omega-3`, unverified `1,3-1,6 g/kg/dia`) were removed.
   - Public-health statements cite verified WHO references (`WHO Guidelines on Physical Activity and Sedentary Behaviour 2020`, `WHO Healthy Diet Fact Sheet`); remaining coaching items are explicitly labeled `GENERIC_FITNESS_GUIDANCE` pending specialist validation.

3. **`TASK-003` — Legal Dependency Note**
   - Minimum age threshold, parental consent rules (if <18 allowed), and health-data explicit consent schema remain `BLOCKED_EXTERNAL_LEGAL` pending counsel text and owner decision.

