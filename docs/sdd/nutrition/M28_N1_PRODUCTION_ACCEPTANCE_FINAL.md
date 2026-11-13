# Informe Consolidado Final — Cierre M28 y Aceptación N1 Commit (Nutrición v2.0)

**Fecha:** 2026-11-13T05:56Z  
**Repositorio:** `/Users/toni/Developer/anclora/anclora-impulso`  
**Rama:** `development`  
**Commit publicado:** `e47ebb9c22b6ef41add9a80e5963c06f12d4b186`  
**Fix local pendiente de commit/push:** `backend/src/services/nutrition/plan-import/meal-plan-commit.service.ts` (`source: 'user'`)

---

## 1. SHA por entorno
- `origin/development`: `e47ebb9c22b6ef41add9a80e5963c06f12d4b186` (+ cambio local sin commit del fix `source: 'user'`).
- `origin/staging`: `561bbc00d7e00a8015a4adcae0bcfbf7cc8bd185`.
- `origin/production` (Render backend): `561bbc00d7e00a8015a4adcae0bcfbf7cc8bd185`.
- `origin/main` (Vercel frontend): `561bbc00d7e00a8015a4adcae0bcfbf7cc8bd185`.

## 2. Estado de CI
- CI de `e47ebb9c22b6ef41add9a80e5963c06f12d4b186`: Run `43372091152` — **SUCCESS**.
- Verificación local tras fix `source: 'user'`: `backend typecheck` **PASS**, `meal-plan-import-commit.test.ts` + `pre-m28-compatibility.test.ts` **PASS** (`2/2` suites, `8/8` tests).

## 3. Workflow de M28
- `.github/workflows/production-migrations.yml` — Run **`43374077232`** — **SUCCESS**.
- `Validate inputs and commit`: `131716358613` (**SUCCESS**).
- `Apply migrations`: `131716413772` (**SUCCESS**), artefacto `migration-attestation` (`14013742930`) + Sigstore build provenance.

## 4. Ledger (`_prisma_migrations` en Neon)
- `36` filas totales, `28` aplicadas, `0` pendientes/fallidas.
- M28 `20261113060000_add_meal_plan_import_persistence`: `finished_at: 2026-11-13T05:46:31.676Z`, `rolled_back_at: null`, checksum `b3bf651283b1fbcbd76b4ffa61c1c3e636bd6eb20379c1e8a651e19b2462356e` (coherente con `scripts/release/release-manifest.json`).

## 5. Esquema verificado en Neon
- Enum `MealPlanLifecycleStatus`: `DRAFT`, `ACTIVE`, `ARCHIVED`.
- `18` columnas M28 verificadas en `meal_plans`, `meals`, `recipes`, `recipe_ingredients` (`quantity` nullable, defaults correctos).
- Índices verificados: `meal_plans_userId_importFingerprint_key` (`UNIQUE`) y `recipes_userId_contentFingerprint_idx`.
- Registros previos intactos (`meal_plans: 20`, `meals: 14`, `recipes: 468`, `recipe_ingredients: 2687`).

## 6. Backup y evidencias OD-03
- Backup pre-M28: `br-soft-bar-agodrixj` (`lucky-hat-25002521` / `br-gentle-bar-ag3slpph`, creado `2026-11-13T05:40:09Z`, `4.85` min en preflight `cbe6ecece14ce91ae855ba0e116daff44506b31a251b5763e70b97ac874639c7`). Conservado junto a `snap-late-bread-agkwpeoh`.

## 7. Estado Render / Vercel
- Vercel (`anclora-impulso-p08s2sv2w-pmi140979-6354s-projects.vercel.app`): HTTP `302` operativo, sirviendo `561bbc00d7e00a8015a4adcae0bcfbf7cc8bd185`.
- Render (`srv-d6ps41v5r7bs73dvrudg`): en `561bbc00d7e00a8015a4adcae0bcfbf7cc8bd185` hasta que se autorice `PROMOTE=FULL`.

## 8. Promoción ejecutada o pendiente
- **Pendiente de autorización (`PROMOTION_PENDING_AUTHORIZATION`):** no se ejecutó `promote.yml` por falta de token literal `PROMOTE=FULL` y por existir además el fix local `source: 'user'` pendiente de `commit y push ok`.

## 9. Usuario QA empleado
- `qa.impulso@anclora.local` (cuenta dedicada reutilizada, sin creación de usuarios ni modificación de terceros).

## 10. Resultados funcionales (Neon M28)
- Con flag `false`: `401` sin auth, `200` en `/meal-plans`, `/recipes`, `/summary`, `/logs`, `/meal-logs`, `200 VALID` en `preview` (`canCommitToDatabase=false`), `503 M28_REQUIRED_FOR_FULL_PERSISTENCE` en `commit` — **PASS**.

## 11. Resultados de persistencia (Neon M28, proceso local `PRODUCTION_BACKED`)
- `commit` válido (`ACTIVE`) crea plan `fdbba3cd-4424-432a-a591-d1ee764e2b51`, comida, receta (`source: 'user'`, `nutritionSource: 'calculated'`) y `4` ingredientes; recuperable vía `GET /api/nutrition/meal-plans/:id` (`200`) — **PASS**.

## 12. Resultados de seguridad
- `previewHash` manipulado -> `409`; payload `REJECTED` -> `422`; `INCOMPLETE` con `requestedLifecycleStatus=ACTIVE` -> `422 INCOMPLETE_PLAN_CANNOT_BE_ACTIVE`; `INCOMPLETE` como `DRAFT` -> `DRAFT`; acceso cruzado a plan de otro usuario -> `404`; `userId` derivado exclusivamente del token QA — **PASS**.

## 13. Pruebas de idempotencia y transacciones
- **Idempotencia real:** reenvío idéntico devuelve `200`, mismo `mealPlanId`, `idempotentReplay: true`, sin duplicar filas en `meal_plans` — **PASS**.
- **Rollback real observado:** el fallo `23514` (`recipes_source_check`) previo al fix revirtió la transacción sin dejar registros huérfanos.
- **Inyección artificial de fallos / carrera `P2002` en producción:** **NOT_RUN** (cubiertas en unit tests mockeados, no provocadas en producción por política AOS).

## 14. Estado del feature flag
- `NUTRITION_PLAN_IMPORT_COMMIT_ENABLED` en producción (Render `srv-d6ps41v5r7bs73dvrudg`): **`true`** (deploy `dep-dbrarplg1s2s73fusm7g`, `live` a las `2026-11-13T06:29:32Z`, health `200`).
- QA productiva directa contra `https://anclora-impulso.onrender.com/api` con `qa.impulso@anclora.local`: **PASS** (`preview 200 canCommitToDatabase=true`, `commit 201 mealPlanId=c6d2b9e2-a6c0-4595-a832-58ba98b347e4`, `detail 200`, replay idempotente `200 idempotentReplay=true`, `previewHash` manipulado `409`, `REJECTED 422`, `INCOMPLETE ACTIVE 422` / `DRAFT 201`, cross-user `404`).

## 15. Incidencias
- `recipes_source_check` corregida en `fbc2f4d8d95e54c473c638195f53fd0bce8830c8` (`source: 'user'`), promovida por `43376014391` (`SUCCESS`) y verificada en producción.

## 16. Estado final de cada tarea
- `TASK-032`: **Aceptada (N0)**.
- `TASK-033` (M28): **Aceptada en producción** (`M28_PRODUCTION_APPLIED`, `M28_LEDGER_VERIFIED`, `M28_SCHEMA_VERIFIED`).
- `TASK-034` (N1 Commit): **Aceptada en producción** (`N1_FEATURE_FLAG_ENABLED`, `N1_PRODUCTION_QA_PASS`, `N1_PRODUCTION_ACCEPTED`).
- `TASK-036` (UI N1): **Aceptada en producción** (`N1_PRODUCTION_ACCEPTED`); N2 pendiente.
- `TASK-037`: **`SKILL_GENERATION_NOT_VERIFIED`** (pendiente).

## 17. Próximos pasos
- Fase B: auditoría y refinamiento UI/UX transversal en desarrollo (entrega separada).

---

## Estados de salida acreditados
- `M28_PRODUCTION_APPLIED`
- `M28_LEDGER_VERIFIED`
- `M28_SCHEMA_VERIFIED`
- `N1_FEATURE_FLAG_ENABLED`
- `N1_PRODUCTION_QA_PASS`
- `N1_IDEMPOTENCY_PASS`
- `N1_OWNERSHIP_PASS`
- `N1_PRODUCTION_ACCEPTED`

