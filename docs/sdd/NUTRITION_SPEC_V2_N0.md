# SDD — Ampliación Nutrición v2.0: Entrega N0 (`TASK-032` y `TASK-037`) y Evaluación M28

- **Fecha:** 2026-11-13
- **Referencia base:** `561bbc00d7e00a8015a4adcae0bcfbf7cc8bd185` (`M27_APPLIED_ATTESTED_SCHEMA_VERIFIED`)
- **Alcance:** Exclusivamente **N0** (contrato `meal-plan-import-v1`, catálogo único de protocolos, validadores, adaptación de skill v2, fixtures, pruebas unitarias y análisis de solo lectura para M28). **N1–N3 y M28 NO están autorizados ni ejecutados.**

## 1. Decisiones de diseño (`D-N1` a `D-N9`)

- **D-N1:** N0 y N1 sin LLM en runtime; comparación de proveedor solo en N2.
- **D-N2:** Evidencia editorial versionada en repo; sin dependencia runtime de NotebookLM.
- **D-N3:** `cetogenica_controlada`, `low_carb_moderada` y `bajo_indice_glucemico` permanecen **deshabilitados** en producción (`publishedInGenerator: false`, `supportedInImport: false`, `reviewStatus: PENDING_PROFESSIONAL_REVIEW`).
- **D-N4:** No acoplar la app a hombres 50+ ni inferir necesidades desde `sex`, `sexAtBirth`, `genderIdentity` o `age`.
- **D-N5:** N0 y N1 reducido en paralelo sin bloquear Fase 3 (`TASK-021`–`TASK-024`).
- **D-N6:** Estados explícitos `VALID`, `VALID_WITH_WARNINGS`, `INCOMPLETE`, `REJECTED`; riesgos graves o restricciones incumplidas no se activan con un clic.
- **D-N7:** `PRIVATE_PRECOMMERCIAL` no convierte umbrales sin revisión en evidencia clínica.
- **D-N8:** M28 condicional tras spike de persistencia en N1 y gates AOS (`OD-03`, `G39`, preflight).
- **D-N9:** JSON `meal-plan-import-v1` como salida primaria de la skill; `.odt` opcional.

## 2. Catálogo único de protocolos (`shared/nutrition-protocols.json`)

- **Publicados (`publishedInGenerator: true`, `supportedInImport: true`):** `ninguna`, `mediterranea`, `dash`, `ayuno_intermitente`, `alta_proteina`.
- **Catalogados sin activación productiva (`publishedInGenerator: false`, `supportedInImport: false`):** `low_carb_moderada`, `bajo_indice_glucemico`, `cetogenica_controlada`.

## 3. Evaluación de persistencia para M28 (Solo análisis — `M28_NOT_EXECUTED`)

Comparación de `meal-plan-import-v1` frente al esquema Prisma vigente (`MealPlan`, `Meal`, `Recipe`, `Ingredient`, `RecipeIngredient` en `backend/prisma/schema.prisma`):

| Concepto de `meal-plan-import-v1` | ¿Cabe en el esquema actual? | Limitación real detectada |
|---|---|---|
| Plan semanal, objetivo y protocolo (`userId`, `weekStart`, `goal`, `dietType`) | **Sí** (`MealPlan`) | Falta `title`, `origin` (procedencia/versión) y `budgetTier`/`preferences` snapshot si se requiere re-edición fiel tras guardar. |
| Días (`0..6`) y comidas (`mealType`) | **Sí** (`Meal.dayOfWeek`, `Meal.mealType`) | No persiste `scheduledTime` (`"14:30"`) ni `eatingWindow` por plan. |
| Recetas, pasos, raciones, tiempos, macros | **Sí** (`Recipe`) | `Recipe` no distingue `nutritionDataSource` / `certainty` (`calculated` vs `estimated` vs `not_provided`). |
| Ingredientes y cantidades | **Parcial** (`Ingredient` + `RecipeIngredient`) | **`Ingredient.name` es `@unique` con un único `unit` global**: si un ingrediente existe en `g` y otra receta lo importa en `cucharada` o `lata`, hay colisión de unidad o requiere normalización previa. Además `RecipeIngredient.quantity` es `Float` no nullable (no admite `quantity: null` para planes `INCOMPLETE`). |
| `batchCooking`, conservación y recalentado | **No** | No existen columnas/tablas dedicadas en `MealPlan`/`Recipe`. |
| Idempotencia de importación | **Parcial** | Puede reutilizarse `idempotency.service.ts` antes de considerar índices únicos en `meal_plans`. |

### Recomendación razonada sobre M28
1. **No crear ni ejecutar M28 en N0.** El esquema actual soporta `MealPlan → Meal → Recipe` para planes completos con unidades canónicas compatibilizadas (`g`, `ml`, `unidad`) y sin guardar borradores `INCOMPLETE`.
2. **En N1 (`TASK-033`):** ejecutar primero un spike de persistencia sobre `RecipeIngredient` y `MealPlan`; si se confirma persistencia de metadatos (`title`, `origin`, `nutritionSource`, `mealPrep` / `batchCooking`, `scheduledTime`) o unidades por relación (`RecipeIngredient.unit`), proponer entonces una **M28 aditiva mínima y reversible** (columnas nullable en `meal_plans`, `meals`, `recipes`, `recipe_ingredients` + tabla opcional de `meal_plan_prep_blocks`), sujeta a backup fresco `OD-03`, `identity-preflight`, `MigrationAttestationV1` y autorización expresa.

