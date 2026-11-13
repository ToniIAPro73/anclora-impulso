# Compatibilidad Pre-M28 / M28 y Plan de Release — Nutrición v2.0 (N1 Commit + M28)

**Fecha:** 2026-11-13  
**Repositorio:** `/Users/toni/Developer/anclora/anclora-impulso`  
**Rama:** `development`  
**SHA base (`HEAD` y `origin/development`):** `9468130a723eecbc8af3126221af01213d72e4de`  
**Feature flag:** `NUTRITION_PLAN_IMPORT_COMMIT_ENABLED` (`false` por defecto)

---

## 1. Causa raíz del fallo `GET /api/nutrition/meal-plans → HTTP 500`

Durante la validación QA previa sobre Neon (esquema **M27**), el cliente Prisma generado desde `backend/prisma/schema.prisma` (**M28**) emitía `SELECT` explícito de todas las columnas escalares de `MealPlan`, `Meal`, `Recipe` y `RecipeIngredient` en cualquier consulta que usara `include` sin `select` explícito o lecturas/retornos sin `select` en `backend/src/services/nutrition.service.ts`.

Al no existir aún las columnas M28 (`meal_plans.title`, `meal_plans.origin`, `meal_plans.lifecycleStatus`, `recipes.nutritionSource`, `recipe_ingredients.unitOverride`, etc.) en Neon M27, PostgreSQL devolvía `P2022` (`The column meal_plans.title does not exist in the current database`), provocando `HTTP 500` incluso con `NUTRITION_PLAN_IMPORT_COMMIT_ENABLED=false`.

---

## 2. Auditoría final de alcance y compatibilidad

Se auditaron todos los accesos `(prisma|tx).(mealPlan|meal|recipe|recipeIngredient|ingredient)` en `backend/src/`:
- `backend/src/services/nutrition/plan-import/meal-plan-preview.service.ts`: usa `select` explícito compatible con M27.
- `backend/src/services/nutrition/plan-import/meal-plan-commit.service.ts`: bloqueado de forma determinista por `NUTRITION_PLAN_IMPORT_COMMIT_ENABLED=false` (`503 M28_REQUIRED_FOR_FULL_PERSISTENCE`).
- `backend/src/services/nutrition.service.ts`: los 21 puntos de consulta y escritura (incluidas transacciones `tx.*` y relaciones anidadas) utilizan proyecciones `PRE_M28_*` o `select: { id: true }`.

### Cambios de compatibilidad aplicados
1. **[pre-m28-selects.ts](file:///Users/toni/Developer/anclora/anclora-impulso/backend/src/services/nutrition/pre-m28-selects.ts)** (nuevo): proyecciones explícitas Prisma M27-only (`PRE_M28_RECIPE_INGREDIENT_SELECT`, `PRE_M28_RECIPE_BASE_SELECT`, `PRE_M28_RECIPE_SELECT`, `PRE_M28_MEAL_BASE_SELECT`, `PRE_M28_MEAL_WITH_RECIPES_SELECT`, `PRE_M28_MEAL_WITH_RECIPE_BASE_SELECT`, `PRE_M28_MEAL_PLAN_BASE_SELECT`, `PRE_M28_MEAL_PLAN_WITH_MEALS_SELECT`).
2. **[nutrition.service.ts](file:///Users/toni/Developer/anclora/anclora-impulso/backend/src/services/nutrition.service.ts)** (modificado): sustitución de todos los `include` implícitos y retornos sin `select` por `PRE_M28_*`, manteniendo tipado estricto con `Prisma.RecipeGetPayload<{ select: typeof PRE_M28_RECIPE_SELECT }>` sin alterar el comportamiento funcional previo.
3. **[pre-m28-compatibility.test.ts](file:///Users/toni/Developer/anclora/anclora-impulso/backend/tests/unit/pre-m28-compatibility.test.ts)** (nuevo): test unitario de regresión que verifica ausencia de campos M28 en todas las proyecciones `PRE_M28_*` y ausencia de `recipeInclude` en `nutrition.service.ts`.

---

## 3. Matriz de compatibilidad y coherencia M28

| Escenario | Código desplegado | Esquema BD | `NUTRITION_PLAN_IMPORT_COMMIT_ENABLED` | Estado | Evidencia |
|---|---|---|---|---|---|
| **A (Pre-M28 seguro)** | App con Prisma M28 + `PRE_M28_*` | **M27** (Neon actual) | `false` | **PASS verificado** | QA funcional sobre Neon M27 + `pre-m28-compatibility.test.ts` |
| **B (Post-M28 flag off/on)** | App con Prisma M28 + `PRE_M28_*` | **M28** | `false` / `true` | **Unitario PASS; integración PG real pendiente de M28** | `meal-plan-import-commit.test.ts`, `prisma validate/generate` |
| **C (Migración aditiva)** | App previa o actual | **M28** | `false` | **Verificado estáticamente (100% aditiva)** | `migration.sql` sin drops ni cambios destructivos |

### Coherencia de migración
- Migración `20261113060000_add_meal_plan_import_persistence/migration.sql` (`sha256`: `b3bf651283b1fbcbd76b4ffa61c1c3e636bd6eb20379c1e8a651e19b2462356e`) registrada de forma idéntica en `scripts/release/release-manifest.json` (28 migraciones totales).
- Migraciones anteriores intactas.

---

## 4. Evidencias de QA ejecutadas

### 4.1 Validación funcional sobre Neon M27 (`qa.impulso@anclora.local`, `NUTRITION_PLAN_IMPORT_COMMIT_ENABLED=false`)
- `POST /api/auth/login`: **200**
- `GET /api/nutrition/meal-plans`: **200** (`count: 0`)
- `GET /api/nutrition/meal-plans/:id` (UUID inexistente): **404** (consulta SQL ejecutada sin error de columnas M28)
- `GET /api/nutrition/recipes?limit=5`: **200** (`returned: 5`)
- `GET /api/nutrition/recipes/:id`: **200**
- `GET /api/nutrition/logs`: **200**
- `GET /api/nutrition/summary`: **200**
- `GET /api/nutrition/targets`: **200**
- `GET /api/nutrition/foods`: **200**
- `GET /api/nutrition/meal-logs`: **200**
- `GET /api/nutrition/health-import/status`: **200**
- `POST /api/nutrition/meal-plans/import/preview` (`valid-1day-plan.json`): **200** (`VALID`, `canCommitToDatabase: false`)
- `POST /api/nutrition/meal-plans/import/commit`: **503** (`M28_REQUIRED_FOR_FULL_PERSISTENCE`)

### 4.2 Gates automatizados (post-última edición de código)
- Frontend `typecheck` (`tsc --noEmit && tsc -p __tests__/tsconfig.json --noEmit`): **PASS**
- Backend `typecheck` (`tsc --noEmit && tsc -p scripts/tsconfig.json`): **PASS**
- `next lint`: **PASS** (0 warnings/errors)
- `prisma validate` + `prisma generate`: **PASS** (v5.22.0)
- `node scripts/release/verify-release-manifest.mjs`: **PASS** (`28 migrations`)
- Backend unit (`tests/unit`): **27/27 suites, 240/240 tests PASS** (incluyendo `pre-m28-compatibility.test.ts`, `meal-plan-import-commit.test.ts`, `meal-plan-import-preview.test.ts`, `nutrition-plan-variety.test.ts`)
- Frontend (`test:ci`): **26/26 suites, 168/168 tests PASS**

---

## 5. Inventario definitivo de entrega (24 archivos)

Excluidos explícitamente: `Claude outputs/`, `.env*`, credenciales, logs y artefactos temporales.

### Código y configuración (19)
- `package.json`
- `__tests__/tsconfig.json`
- `__tests__/components/nutrition-plan-import.test.tsx`
- `components/nutrition/meal-plan-import-panel.tsx`
- `lib/api/index.ts`
- `backend/prisma/schema.prisma`
- `backend/prisma/migrations/20261113060000_add_meal_plan_import_persistence/migration.sql`
- `scripts/release/release-manifest.json`
- `backend/src/config/env.ts`
- `backend/src/controllers/nutrition.controller.ts`
- `backend/src/routes/nutrition.routes.ts`
- `backend/src/services/nutrition.service.ts`
- `backend/src/services/nutrition/pre-m28-selects.ts`
- `backend/src/services/nutrition/plan-import/meal-plan-preview.service.ts`
- `backend/src/services/nutrition/plan-import/meal-plan-commit.service.ts`
- `backend/src/utils/validators.ts`
- `backend/tests/unit/meal-plan-import-commit.test.ts`
- `backend/tests/unit/nutrition-plan-variety.test.ts`
- `backend/tests/unit/pre-m28-compatibility.test.ts`

### Documentación (5)
- `docs/anclora-master-audit/12_AGENT_READY_BACKLOG.md`
- `docs/sdd/nutrition/M28_PERSISTENCE_STUDY.md`
- `docs/sdd/nutrition/N1_COMMIT_M28_IMPLEMENTATION_REPORT.md`
- `docs/sdd/nutrition/N1_COMMIT_M28_QA_FINAL_REPORT.md`
- `docs/sdd/nutrition/M28_COMPATIBILITY_AND_RELEASE_READINESS.md`

### Propuesta de commit único (pendiente de autorización)
`feat(nutrition): add N1 commit persistence, M28 migration, and pre-M28 compatibility`

---

## 6. Riesgos pendientes y precondiciones del workflow

### Riesgos / pruebas pendientes de M28 aplicada (NO ejecutadas)
- Persistencia transaccional real de `commit` (`DRAFT`/`ACTIVE`) sobre PostgreSQL/Neon con M28 aplicada.
- Concurrencia real `P2002` e idempotencia `(userId, importFingerprint)` y rollback SQL real en BD.
- Verificación visual E2E en navegador con `NUTRITION_PLAN_IMPORT_COMMIT_ENABLED=true` tras aplicar M28.
- `TASK-037`: ejecución generativa de la skill v2 sigue pendiente (`SKILL_GENERATION_NOT_VERIFIED`).

### Precondiciones del workflow AOS protegido para M28
- Publicación previa del paquete en `origin/development` y CI en verde.
- Backup lógico previo obligatorio (OD-03) y registro en ledger de migraciones.
- Validación de checksum M28 (`b3bf651283b1fbcbd76b4ffa61c1c3e636bd6eb20379c1e8a651e19b2462356e`) contra `release-manifest.json`.
- Autorización explícita del propietario (`PROMOTE=FULL` / ejecución del workflow protegido).

---

## 7. Procedimiento posterior (Fases A–F, sin ejecutar)

- **Fase A — Commit y push a `origin/development`:** tras `commit y push ok` explícito, incorporar exclusivamente los archivos del inventario (sin `Claude outputs/`, `.env*` ni temporales) y publicar en `origin/development`.
- **Fase B — CI satisfactoria:** verificar que los jobs de `backend`, `frontend`, `typecheck` (`__tests__/tsconfig.json` incluido), `lint` y manifiesto pasan sobre el nuevo SHA.
- **Fase C — Verificación independiente de precondiciones M28:** confirmar backup OD-03, integridad del manifiesto de 28 migraciones y estado limpio del entorno objetivo.
- **Fase D — Aplicación mediante workflow AOS protegido:** con autorización específica del propietario, ejecutar el workflow protegido para aplicar `20261113060000_add_meal_plan_import_persistence` y registrar atestación.
- **Fase E — QA posterior con la cuenta existente (`qa.impulso@anclora.local`):** validar persistencia real (`commit`), idempotencia `(userId, importFingerprint)`, aislamiento de usuario, rollback ante error e integridad referencial en Neon M28.
- **Fase F — Activación controlada de N1 Commit:** habilitar `NUTRITION_PLAN_IMPORT_COMMIT_ENABLED=true` solo tras superar la Fase E; ante cualquier anomalía, revertir el flag a `false` como corte inmediato.

---

## 8. Estados de salida

- `PRE_M28_COMPATIBILITY_PASS`
- `M28_RELEASE_PACKAGE_READY`
- `N1_COMMIT_CODE_READY`
- `M28_PRODUCTION_NOT_EXECUTED`
- `GIT_PUBLICATION_PENDING`
