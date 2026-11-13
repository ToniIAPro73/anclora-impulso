# Informe consolidado de campaña — Nutrición v2.0 (N0 + N1 local)

**Fecha:** 2026-11-13  
**Repositorio:** `anclora-impulso` (rama `development`)  
**Commit base previo:** `561bbc00d7e00a8015a4adcae0bcfbf7cc8bd185`  
**Commit N0 publicado:** `0e557cb4fd104d0a5007bd8b77baf1758fda467b` (`feat(nutrition): establish canonical meal-plan contract and skill v2`, 19 archivos)

---

## 1. Estado de publicación N0 y CI

- **Publicación N0:** Completada en `origin/development` con SHA `0e557cb4fd104d0a5007bd8b77baf1758fda467b` (staging selectivo + staging parcial de `validators.ts` y `12_AGENT_READY_BACKLOG.md` preservando los cambios N1 locales).
- **CI GitHub Actions (`43360939016`):** **PASS** (`test-frontend` 1m16s, `test-backend` 2m5s).
- **`Claude outputs/`:** Excluido y sin modificar.

---

## 2. Validación de Skill v2 (`TASK-037`)

- `docs/sdd/nutrition/planificador-nutricion-mealprep-v2/SKILL.md` (3.875 bytes) es una especificación declarativa en Markdown; no existe un runtime LLM ejecutable local autorizado para invocarla sin crear credenciales nuevas.
- **Estado:** `SKILL_GENERATION_NOT_VERIFIED` (contrato y adaptador `skill-adapter.ts` verificados en unit tests; generación viva de la skill pendiente de ejecución en runtime autorizado).

---

## 3. Estudio definitivo de persistencia M28 (`TASK-033`)

- Entregable: [M28_PERSISTENCE_STUDY.md](file:///Users/toni/Developer/anclora/anclora-impulso/docs/sdd/nutrition/M28_PERSISTENCE_STUDY.md).
- **Decisión:** Alternativa B (migración aditiva mínima en `MealPlan`, `Meal`, `Recipe`, `RecipeIngredient` nullable) recomendada para habilitar `commit` completo sin inventar cantidades ni descartar metadatos.
- **Estado:** `M28_NOT_EXECUTED` (ni creada ni aplicada; 0 escrituras en Neon).

---

## 4. Implementación local N1 (`TASK-034` preview + `TASK-036` MVP)

- **Backend (`TASK-034` sin escrituras BD):**
  - `backend/src/services/nutrition/plan-import/meal-plan-preview.service.ts`
  - `backend/src/utils/validators.ts` (`previewImportedMealPlanSchema`)
  - `backend/src/controllers/nutrition.controller.ts` (`previewImportedMealPlan`)
  - `backend/src/routes/nutrition.routes.ts` (`POST /api/nutrition/meal-plans/import/preview`)
  - `backend/tests/unit/meal-plan-import-preview.test.ts` (5/5 PASS)
- **Frontend (`TASK-036` MVP):**
  - `lib/api/index.ts` (`MealPlanImportPreviewResponse`, `nutritionApi.previewImportedMealPlan`)
  - `components/nutrition/meal-plan-import-panel.tsx`
  - `app/nutrition/page.tsx` (selector `"Desde biblioteca"` / `"Importar un plan"` dentro del modal `"Nuevo plan nutricional"`)
  - `__tests__/components/nutrition-plan-import.test.tsx` (3/3 PASS)
- **Backlog actualizado:** `docs/anclora-master-audit/12_AGENT_READY_BACKLOG.md` (reconciliado sin alterar cohortes ni edades de Fase 3).

---

## 5. Evidencia de verificación local (post-última edición)

- Backend unit (`npm --prefix anclora-impulso/backend run test:ci -- tests/unit`): **25/25 suites, 232/232 tests PASS**.
- Frontend unit (`npm --prefix anclora-impulso run test:ci`): **26/26 suites, 166/166 tests PASS**.
- Backend typecheck (`tsc --noEmit && tsc -p scripts/tsconfig.json`): **PASS**.
- Frontend typecheck (`tsc --noEmit`): **PASS**.
- Frontend lint (`next lint`): **PASS**.
- Manifiesto Prisma (`node scripts/release/verify-release-manifest.mjs`): **PASS (27 migraciones)**.

---

## 6. Tokens de estado final

- `N0_TECHNICAL_PUBLISHED` (`0e557cb4fd104d0a5007bd8b77baf1758fda467b`)
- `N0_CI_PASS` (run `43360939016`)
- `TASK-032_ACCEPTED`
- `SKILL_GENERATION_NOT_VERIFIED`
- `N1_PARTIAL_BLOCKED_BY_PERSISTENCE` (preview backend + UI MVP listos y probados; commit BD bloqueado hasta M28)
- `M28_NOT_EXECUTED`
- `NO_PROMOTE`
- `NO_PRODUCTION_DB_WRITES`
- `N1_NOT_PUBLISHED`

