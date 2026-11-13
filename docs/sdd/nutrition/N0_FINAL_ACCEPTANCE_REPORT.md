# Informe Final de Aceptación y Cierre de N0 — Nutrición v2.0 (`anclora-impulso`)

- **Fecha:** 2026-11-13
- **Repositorio:** `anclora-impulso` (rama `development`, base `561bbc00d7e00a8015a4adcae0bcfbf7cc8bd185`, `0/0` respecto a `origin/development`)
- **Estados finales verificados:**
  - `N0_ACCEPTANCE_PARTIAL` *(debido exclusivamente a `SKILL_GENERATION_NOT_VERIFIED` en entorno local sin runtime externo de skill)*
  - `TASK_032_ACCEPTED`
  - `TASK_037_IMPLEMENTED_OR_ADAPTATION_READY` *(adaptación v2 y adaptador validados; falta ejecución real end-to-end de la skill declarativa)*
  - `SKILL_GENERATION_NOT_VERIFIED`
  - `N0_CLEAN_ENV_TYPECHECK_PASS`
  - `N0_FINAL_QA_PASS` *(validación local de contrato, seguridad, regresión y TypeScript en entorno limpio)*
  - `M28_NOT_EXECUTED`

---

## 1. Inventario exacto de archivos preparados para publicación (N0)

### Modificados
- `backend/package.json` (`typecheck` ampliado con `&& tsc -p scripts/tsconfig.json`; script `nutrition:validate-plan`)
- `backend/scripts/nutrition/import-recipes.ts` (usa `PUBLISHED_DIET_TYPES` desde `protocol-catalog.ts`)
- `backend/src/utils/validators.ts` (usa `PUBLISHED_DIET_TYPES` desde `protocol-catalog.ts`)
- `docs/anclora-master-audit/11_MASTER_ROADMAP.md` (pista transversal **N**: N0–N3, subordinada a Fase 3)
- `docs/anclora-master-audit/12_AGENT_READY_BACKLOG.md` (`TASK-031` reservada; `TASK-032` a `TASK-039` incorporadas)

### Nuevos
- `shared/nutrition-protocols.json` (fuente única de verdad del catálogo de protocolos)
- `backend/scripts/tsconfig.json` (resolución `@types/node` y `node:*` para `scripts/nutrition/*.ts`)
- `backend/scripts/nutrition/validate-meal-plan.ts` (validador CLI reproducible para salidas de la skill)
- `backend/src/services/nutrition/plan-import/protocol-catalog.ts`
- `backend/src/services/nutrition/plan-import/meal-plan-import.contract.ts`
- `backend/src/services/nutrition/plan-import/meal-plan-import.validator.ts`
- `backend/src/services/nutrition/plan-import/skill-adapter.ts`
- `backend/tests/fixtures/nutrition/valid-1day-plan.json`
- `backend/tests/fixtures/nutrition/odt-reference-incomplete-plan.json`
- `backend/tests/unit/meal-plan-import.test.ts`
- `docs/development/meal-plan-import-v1.schema.json`
- `docs/sdd/NUTRITION_SPEC_V2_N0.md`
- `docs/sdd/nutrition/planificador-nutricion-mealprep-v2/SKILL.md`
- `docs/sdd/nutrition/N0_FINAL_ACCEPTANCE_REPORT.md`

*(Nota: el directorio local sin seguimiento `Claude outputs/` es previo a esta tarea y queda excluido del alcance de commit/push.)*

---

## 2. Estado de `TASK-032` y `TASK-037`

- **`TASK-032` (`TASK_032_ACCEPTED`):** Contrato `meal-plan-import-v1` (Zod + JSON Schema sincronizados), catálogo único de protocolos sin habilitar protocolos sin soporte en producción (`low_carb_moderada`, `bajo_indice_glucemico`, `cetogenica_controlada`), normalizador, validadores estructurales/seguridad y compatibilidad con `recipes-import-v1` verificados.
- **`TASK-037` (`TASK_037_IMPLEMENTED_OR_ADAPTATION_READY`):** Adaptación v2 documentada en `docs/sdd/nutrition/planificador-nutricion-mealprep-v2/SKILL.md` y adaptador determinista en `skill-adapter.ts` + CLI `validate-meal-plan.ts`. La copia externa en `~/.claude/skills/.../planificador-nutricion-mealprep-50/SKILL.md` permanece intacta por restricción AOS.

---

## 3. Verificación de TypeScript en entorno limpio

Ejecutada desde un directorio temporal limpio (`/tmp/n0-clean-ts-check`) sin `.env*`, sin `node_modules` previos y sin configuración del editor:

1. `pnpm install --frozen-lockfile --ignore-scripts` → **PASS** (lockfile verificado, 486 paquetes).
2. `pnpm exec prisma generate` → **PASS** (Prisma Client v5.22.0).
3. `pnpm exec tsc -p scripts/tsconfig.json` → **PASS** (0 errores en `node:fs/promises`, `node:path`, `node:process` y `@types/node`).
4. `pnpm run typecheck` (`tsc --noEmit && tsc -p scripts/tsconfig.json`) → **PASS** (0 errores).

---

## 4. Validación real de la skill v2 (`SKILL_GENERATION_NOT_VERIFIED`)

- **Causa concreta:** `planificador-nutricion-mealprep-v2/SKILL.md` es una skill declarativa en Markdown para un runtime conversacional/agente externo con la skill cargada (Claude / Antigravity), no un script ejecutable determinista local. En este entorno headless sin invocación real de la skill externa, no se simula una ejecución LLM ni se usan fixtures manuales como prueba de generación real.
- **Prueba reproducible preparada para ejecutar en runtime con la skill v2 cargada:**
  1. **Caso A (1 día completo):** Solicitar plan `mediterranea`, `es-ES`, `1 día`, `maxMainIngredients: 5`, `budgetTier: economico`, `excludedEquipment: ["horno_convencional"]`, cantidades explícitas en `g`/`ml`/`unidad` y procedencia nutricional declarada.
  2. **Caso B (7 días general):** Solicitar plan `ninguna` o `mediterranea`, `es-ES`, `7 días`, `budgetTier: medio`, `excludedFoods: ["tofu"]`, `mealTimes: ["08:30", "14:00", "20:00"]`.
  3. **Caso C (7 días ayuno 16:8):** Solicitar plan `ayuno_intermitente`, `es-ES`, `7 días`, 2 comidas diarias, `mealTimes: ["14:30", "19:00"]`, `eatingWindow` configurable.
  4. Validar cada salida JSON generada con:
     ```bash
     cd anclora-impulso/backend
     pnpm run nutrition:validate-plan -- <ruta-salida-caso.json>
     ```

---

## 5. Resultado de validadores y seguridad nutricional

Verificado en `backend/tests/unit/meal-plan-import.test.ts` y `pnpm run nutrition:validate-plan -- tests/fixtures/nutrition/valid-1day-plan.json`:

- `VALID`: planes completos de 1 día y 7 días con cantidades explícitas y macros coherentes.
- `VALID_WITH_WARNINGS`: valores nutricionales `estimated` / `approximate` o desviación moderada 4-4-9.
- `INCOMPLETE`: fixture fiel al ODT real (`odt-reference-incomplete-plan.json`, sin fabricar cifras) y unidades no convertibles (`cucharada` sin tabla específica, evitando `1 cucharada = 1 ml`).
- `REJECTED`: cantidades `<= 0`, duplicados con unidades conflictivas, incompatibilidad grave 4-4-9 (>50%), equipamiento/alimento excluido, exceso de `maxMainIngredients`, protocolos no habilitados (`cetogenica_controlada`, `low_carb_moderada`), prompt-injection (`UNTRUSTED_CONTENT_DETECTED`) y afirmaciones clínicas terapéuticas no justificadas (`CLINICAL_CLAIM_DETECTED`).

---

## 6. Resultados de regresión

| Verificación | Comando | Resultado |
| --- | --- | --- |
| Validador CLI N0 | `pnpm run nutrition:validate-plan -- tests/fixtures/nutrition/valid-1day-plan.json` | **PASS** (`status: VALID`) |
| Typecheck backend + scripts (local y limpio) | `pnpm run typecheck` (`tsc --noEmit && tsc -p scripts/tsconfig.json`) | **PASS** (0 errores) |
| Unitarias backend | `pnpm run test:ci -- tests/unit` | **PASS** (24/24 suites, 227/227 tests) |
| Typecheck frontend | `npm --prefix anclora-impulso run typecheck` | **PASS** (0 errores) |
| Unitarias frontend | `npm --prefix anclora-impulso run test:ci` | **PASS** (25/25 suites, 163/163 tests) |
| Integración backend (`tests/integration/*.test.ts`) | *(Omitidas en local por `DOCKER_DOWN`)* | **NOT RUN** (requieren PostgreSQL local; separadas de N0 sin BD) |

---

## 7. Incidencias y correcciones en esta auditoría

1. Añadido `tsc -p scripts/tsconfig.json` al script `typecheck` de `backend/package.json` para que CI valide también `backend/scripts/nutrition/*.ts` sin modificar `backend/tsconfig.json` ni `.github/workflows/ci.yml`.
2. Añadido `validate-meal-plan.ts` (`pnpm run nutrition:validate-plan`) con manejo del separador `--` de pnpm.
3. Añadida detección y rechazo (`REJECTED` + `safetyFlags`) de afirmaciones clínicas terapéuticas no justificadas (`CLINICAL_CLAIM_DETECTED`) en `meal-plan-import.validator.ts`.

---

## 8. Limitaciones, publicación, entrada a N1 y evaluación M28

- **Limitaciones pendientes:** ejecución real de la skill declarativa (`SKILL_GENERATION_NOT_VERIFIED`) para los Casos A, B y C; suites de integración Jest en local (`DOCKER_DOWN`, cubiertas por CI con PostgreSQL 16).
- **Recomendación de publicación:** los cambios locales de `TASK-032` y el harness de `TASK-037` son seguros para publicar en `origin/development` tras autorización expresa (`commit y push ok`), ya que no activan protocolos nuevos ni tocan esquemas/producción; si se exige cierre total de N0 antes de publicar, ejecutar primero las 3 generaciones reales en Claude/Antigravity y validarlas con `nutrition:validate-plan`.
- **Condiciones de entrada para N1:** N0 publicado, ejecución del spike de persistencia (`TASK-033`) y tests de caracterización de `nutrition.service.ts` (`TASK-014` previo).
- **Evaluación inicial M28 (`M28_NOT_EXECUTED`):** el esquema actual soporta `MealPlan → Meal → Recipe`, pero `Ingredient.name` `@unique` acopla una sola `unit` global, `RecipeIngredient.quantity` no admite `null` y faltan metadatos de procedencia nutricional, `scheduledTime` y `batchCooking`. Decisión final diferida al spike de `TASK-033`.

