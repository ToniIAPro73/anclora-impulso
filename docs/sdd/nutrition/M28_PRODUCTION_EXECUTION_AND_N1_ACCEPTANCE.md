# Ejecución M28 y Activación N1 Commit — Registro Postmigración y QA Productiva

**Fecha:** 2026-11-13T05:56Z  
**Repositorio:** `/Users/toni/Developer/anclora/anclora-impulso`  
**Commit publicado en `development`:** `e47ebb9c22b6ef41add9a80e5963c06f12d4b186` (CI `43372091152` — `success`)  
**Fix local pendiente de publicación:** `backend/src/services/nutrition/plan-import/meal-plan-commit.service.ts` (`source: 'user'` para cumplir `recipes_source_check`)

---

## 1. Ejecución de M28 (`43374077232`) — VERIFICADA
- **Workflow:** `.github/workflows/production-migrations.yml` · **Run ID:** `43374077232` (`2026-11-13T05:45:19Z` → `05:46:48Z`).
- **Job `Validate inputs and commit (no secrets)` (`131716358613`):** `success`.
- **Job `Apply migrations (requires environment approval)` (`131716413772`):** `success` (incluye verificación OD-03 en vivo, `prisma migrate deploy`, verificación de ledger, artefacto `migration-attestation` `14013742930` y Sigstore build provenance).
- **Backup OD-03:** `br-soft-bar-agodrixj` (`2026-11-13T05:40:09Z`, `4.85` min en el momento de preflight; conservado junto al snapshot `snap-late-bread-agkwpeoh`).

## 2. Verificación directa en Neon (`lucky-hat-25002521` / `br-gentle-bar-ag3slpph`)
- **Ledger (`_prisma_migrations`):** `36` filas totales, `28` aplicadas, `0` pendientes/fallidas; M28 `20261113060000_add_meal_plan_import_persistence` (`finished_at: 2026-11-13T05:46:31.676Z`, `rolled_back_at: null`, checksum `b3bf651283b1fbcbd76b4ffa61c1c3e636bd6eb20379c1e8a651e19b2462356e`).
- **Esquema:** enum `MealPlanLifecycleStatus` (`DRAFT`, `ACTIVE`, `ARCHIVED`), `18` columnas verificadas en `meal_plans`, `meals`, `recipes`, `recipe_ingredients` (`quantity` nullable), índice único `meal_plans_userId_importFingerprint_key` e índice `recipes_userId_contentFingerprint_idx`.
- **Compatibilidad previa:** `meal_plans: 20`, `meals: 14`, `recipes: 468`, `recipe_ingredients: 2687` preservados.

## 3. Despliegue por entorno
- `origin/development`: `e47ebb9c22b6ef41add9a80e5963c06f12d4b186` (+ fix local `source: 'user'` sin commit).
- `origin/staging`, `origin/production` (Render), `origin/main` (Vercel): `561bbc00d7e00a8015a4adcae0bcfbf7cc8bd185` (**pendiente de `PROMOTE=FULL`**).

## 4. QA funcional sobre Neon M28 (`qa.impulso@anclora.local`)
- **Bloque A (Flag OFF `false`):** `unauth 401`, `/meal-plans 200`, `/recipes?limit=5 200`, `/summary 200`, `/logs 200`, `/meal-logs 200`, `preview 200 VALID (canCommitToDatabase=false)`, `commit 503 M28_REQUIRED_FOR_FULL_PERSISTENCE` — **PASS**.
- **Bloque B (Persistencia real en proceso local efímero `PRODUCTION_BACKED` con flag `true`):**
  - Hallazgo inicial detectado y corregido: `tx.recipe.create()` con `source: 'imported'` violaba `recipes_source_check` (`['system','ai','user']`). Cambiado a `source: 'user'`; la transacción fallida hizo rollback limpio sin escrituras parciales.
  - Re-ejecución: `preview 200 VALID`, `commit 201` (`mealPlanId: fdbba3cd-4424-432a-a591-d1ee764e2b51`, `idempotentReplay: false`), `GET /meal-plans/:id 200` (`meals: 1`), verificación directa en Neon (`ownerMatchesQa: true`, `origin: external_skill`, `lifecycleStatus: ACTIVE`, `importValidationStatus: VALID`, `sampleRecipeSource: user`, `sampleNutritionSource: calculated`, `sampleIngredientsCount: 4`) — **PASS**.
- **Bloque C (Idempotencia):** repetición exacta de `commit` devuelve `200`, mismo `mealPlanId`, `idempotentReplay: true`, sin duplicar planes (`countSame: true`) — **PASS**.
- **Bloque D (Seguridad):** `previewHash` manipulado (`409`), payload `REJECTED` (`422`), `INCOMPLETE` con `requestedLifecycleStatus: ACTIVE` (`422 INCOMPLETE_PLAN_CANNOT_BE_ACTIVE`), `INCOMPLETE` con `DRAFT` (`DRAFT`), acceso cruzado a plan ajeno (`404`) — **PASS**.
- **Bloque E (Transacciones/concurrencia):** atomicidad ante error observada en rollback real de `23514`; inyección artificial de fallos SQL y carrera concurrente `P2002` en producción **NOT_RUN** (verificadas solo en tests unitarios mockeados).

## 5. Estados actuales
- `M28_PRODUCTION_APPLIED`
- `M28_LEDGER_VERIFIED`
- `M28_SCHEMA_VERIFIED`
- `N1_COMMIT_FUNCTIONAL_QA_PASS`
- `N1_IDEMPOTENCY_PASS`
- `N1_OWNERSHIP_PASS`
- `PROMOTION_PENDING_AUTHORIZATION`
- `N1_ACTIVATION_PENDING_AUTHORIZATION`
