# Estudio definitivo de persistencia M28 — Nutrición v2.0 (`meal-plan-import-v1`)

**Fecha:** 2026-11-13  
**Estado:** Estudio técnico completado (`M28_NOT_EXECUTED`)  
**Alcance:** Evaluación de persistencia para `TASK-033` / `TASK-034` (`meal-plan-import-v1`) respecto al esquema Prisma vigente (`M27`, 27 migraciones aplicadas).

---

## 1. Brechas reales del esquema actual (M27)

Inspección directa de `backend/prisma/schema.prisma`:

1. **`MealPlan` (`meal_plans`):**
   - Campos actuales: `id`, `userId`, `weekStart`, `goal`, `dietType`, `carryoverCaloriesApplied`.
   - Faltan metadatos de importación/plan: `title`, `origin` (e.g. `library` | `imported_skill` | `imported_json`), `importSchemaVersion`, `sourcePayloadHash`, `preferencesSnapshot` (JSON con exclusiones, presupuesto, equipamiento, ayuno), `protocolMeta` (e.g. `intermittent_fasting` configurable), `batchCookingSummary`, `mealPrepMeta`, `status` (`draft_incomplete` vs `active`).
2. **`Meal` (`meals`):**
   - Campos actuales: `id`, `mealPlanId`, `dayOfWeek`, `mealType`, `servingMultiplier`, `adjustmentReason`, `selectedRecipeId`.
   - Faltan: `scheduledTime` (necesario para ventanas horarias configurables, p. ej. ayuno intermitente 16:8), `prepMode` (`fresh` | `batch_prep` | `leftover`), `notes`.
3. **`Recipe` (`recipes`):**
   - Campos actuales: `calories`, `protein`, `carbs`, `fat`, `fiber` son numéricos sin `dataSource` ni `certainty` (`exact` | `estimated` | `missing`); no existe `fingerprint` / `dedupKey` ni `isIncomplete` para recetas importadas con datos nutricionales o cantidades pendientes.
4. **`Ingredient` (`ingredients`) y `RecipeIngredient` (`recipe_ingredients`):**
   - `Ingredient.name` es `@unique` con una única `unit` global (`"g"`, `"ml"`, `"unidad"`, etc.). Un mismo ingrediente usado en gramos en una receta y en unidades/cucharadas en otra colisiona o fuerza conversión implícita insegura.
   - `RecipeIngredient.quantity` es `Float` no nulo. No admite ingredientes con cantidad desconocida (`null` / `"al gusto"` / `"pendiente"`) sin inventar `0` o `1`, lo que corrompería la lista de la compra.
5. **`MealRecipe` (`meal_recipes`) y `MealSwapHistory` (`meal_swap_history`):**
   - No requieren cambios estructurales obligatorios para la importación inicial, aunque `MealSwapHistory` se beneficia de mantener `selectedRecipeId` y `meal_recipes` intactos sin romper el flujo existente de biblioteca/swap.

---

## 2. Comparativa de alternativas

### Alternativa A: N1 sin M28 (solo `preview` + persistencia parcial forzada en M27)
- **Qué permite sin migración:**
  - `POST /api/nutrition/meal-plans/import/preview` (normalización, validación `meal-plan-import-v1`, detección de huecos `INCOMPLETE`, `safetyFlags`, cálculo estricto de lista de la compra solo para unidades canónicas `g`/`ml`/`unidad`, detección de duplicados de recetas del usuario).
  - UI de revisión completa en "Nuevo plan" → "Importar un plan".
- **Qué rompe o degrada si se intenta persistir (commit) sin M28:**
  - Obliga a descartar `title`, `scheduledTime`, `certainty`, `dataSource`, `batchCooking`, `mealPrep`, `preferencesSnapshot` y `origin`.
  - Obliga a inventar `quantity = 0` cuando falta cantidad o forzar una única `unit` global por `Ingredient.name`.
  - Mezcla borradores `INCOMPLETE` con planes `active` sin estado explícito.
- **Veredicto:** Adecuada **únicamente** para la fase de previsualización (`preview` sin escritura en BD). Inaceptable para persistencia completa (`commit`).

### Alternativa B: M28 aditiva mínima (Recomendada para habilitar persistencia completa)
- **Diseño aditivo (100% retrocompatible, nullable/defaulted, zero-downtime):**
  - `MealPlan`: añadir `title String?`, `origin String @default("generated")`, `importStatus String @default("ACTIVE")`, `importSchemaVersion String?`, `importFingerprint String?`, `importMetadata Json?` (almacena `batchCooking`, `mealPrep`, `preferences`, `protocolConfig`, `safetySummary` sin proliferación de tablas).
  - `Meal`: añadir `scheduledTime String?`, `prepMode String?`, `notes String?`.
  - `Recipe`: añadir `nutritionSource String?`, `nutritionCertainty String?`, `contentFingerprint String?`, `isIncomplete Boolean @default(false)`.
  - `RecipeIngredient`: hacer `quantity Float?` (nullable para cantidades pendientes), añadir `unitOverride String?`, `rawQuantityText String?`, `isEstimated Boolean @default(false)` — evitando tocar el `@unique` de `Ingredient.name` y preservando 100% las recetas existentes.
- **Impacto:**
  - 0 breaking changes en `MealRecipe`, `MealSwapHistory`, `Ingredient` o planes generados actuales.
  - Desbloquea `POST /api/nutrition/meal-plans/import/commit` idempotente, persistencia fiel de `INCOMPLETE` como borrador editable, y lista de compra exacta sin inventar cantidades.

---

## 3. Decisión arquitectónica

1. **En N1 local actual (sin M28):** Implementar al 100% el motor **sin escrituras en BD** (`POST /api/nutrition/meal-plans/import/preview` + UI completa de revisión/advertencias/preferencias en Frontend). Mantener la persistencia final (`commit`) explícitamente bloqueada (`N1_PARTIAL_BLOCKED_BY_PERSISTENCE`) hasta aprobar y ejecutar **M28 (Alternativa B)** en un paso dedicado.
2. **Prohibición cumplida:** En este ciclo no se crea ni se ejecuta ningún archivo de migración M28 ni se escribe en Neon.

