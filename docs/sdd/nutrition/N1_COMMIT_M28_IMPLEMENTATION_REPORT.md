# Informe de Implementación — N1 Commit + M28 (`TASK-033`, `TASK-034`, `TASK-036`)

**Fecha:** 2026-11-13  
**Repositorio:** `ToniIAPro73/anclora-impulso` (rama `development`)  
**Commit base N1 Preview:** `9468130a723eecbc8af3126221af01213d72e4de` (CI `43364217604` — SUCCESS)  

---

## 1. Resumen ejecutivo

Implementación local completa de la migración aditiva **M28** (`TASK-033`), del endpoint transaccional `POST /api/nutrition/meal-plans/import/commit` (`TASK-034`) y de la interfaz de confirmación/guardado (`TASK-036`), protegidos por el feature flag `NUTRITION_PLAN_IMPORT_COMMIT_ENABLED` (deshabilitado por defecto hasta aplicar M28 en Neon).

---

## 2. Estado inicial y HEAD

- `HEAD`: `9468130a723eecbc8af3126221af01213d72e4de` (`development` sincronizada con `origin/development`).
- Migraciones aplicadas en producción: 27 (`M27`).
- Directorio temporal `Claude outputs/` preservado sin modificar y excluido del paquete.

---

## 3. Decisiones de persistencia

- Se mantiene `Ingredient.name @unique` intacto para no romper el catálogo histórico de recetas.
- Se separa explícitamente el estado de validación (`importValidationStatus`: `VALID`, `VALID_WITH_WARNINGS`, `INCOMPLETE`) del estado de ciclo de vida (`lifecycleStatus`: `MealPlanLifecycleStatus` = `DRAFT` | `ACTIVE` | `ARCHIVED`).
- Un plan `INCOMPLETE` solo puede persistirse como `DRAFT` y nunca como `ACTIVE`.
- Un plan `REJECTED` nunca se persiste.
- `RecipeIngredient.quantity` pasa a nullable (`Float?`) con `unitOverride`, `rawQuantityText` e `isEstimated` para no inventar cantidades ni forzar conversiones masa/volumen inseguras.

---

## 4. Diseño definitivo M28

Migración aditiva versionada: `backend/prisma/migrations/20261113060000_add_meal_plan_import_persistence/migration.sql` (28ª migración en `scripts/release/release-manifest.json`):
- Enum `MealPlanLifecycleStatus` (`DRAFT`, `ACTIVE`, `ARCHIVED`).
- `MealPlan`: `title`, `origin` (`@default("generated")`), `lifecycleStatus` (`@default(ACTIVE)`), `importValidationStatus`, `importSchemaVersion`, `importFingerprint`, `importMetadata` + `@@unique([userId, importFingerprint])`.
- `Meal`: `scheduledTime`, `prepMode`, `notes`.
- `Recipe`: `nutritionSource`, `nutritionCertainty`, `contentFingerprint`, `isIncomplete` (`@default(false)`) + `@@index([userId, contentFingerprint])`.
- `RecipeIngredient`: `quantity Float?`, `unitOverride`, `rawQuantityText`, `isEstimated` (`@default(false)`).
- **Reversión:** `DROP INDEX`, `ALTER TABLE ... DROP COLUMN`, `ALTER COLUMN "quantity" SET NOT NULL` (solo si no existen filas con `quantity IS NULL`) y `DROP TYPE "MealPlanLifecycleStatus"`.

---

## 5. Archivos modificados y creados

- Esquema y migración: `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261113060000_add_meal_plan_import_persistence/migration.sql`, `scripts/release/release-manifest.json`.
- Configuración y backend: `backend/src/config/env.ts`, `backend/src/services/nutrition/plan-import/meal-plan-preview.service.ts`, `backend/src/services/nutrition/plan-import/meal-plan-commit.service.ts`, `backend/src/utils/validators.ts`, `backend/src/controllers/nutrition.controller.ts`, `backend/src/routes/nutrition.routes.ts`.
- Frontend: `lib/api/index.ts`, `components/nutrition/meal-plan-import-panel.tsx`.
- Tests y docs: `backend/tests/unit/meal-plan-import-commit.test.ts`, `backend/tests/unit/nutrition-plan-variety.test.ts`, `__tests__/components/nutrition-plan-import.test.tsx`, `docs/anclora-master-audit/12_AGENT_READY_BACKLOG.md`, `docs/sdd/nutrition/M28_PERSISTENCE_STUDY.md`, `docs/sdd/nutrition/N1_COMMIT_M28_IMPLEMENTATION_REPORT.md`.

---

## 6. Endpoint y contratos implementados

- `POST /api/nutrition/meal-plans/import/commit` (autenticado vía `authenticate`, validado con `commitImportedMealPlanSchema`).
- Comprueba `env.nutritionPlanImportCommitEnabled` (`503 M28_REQUIRED_FOR_FULL_PERSISTENCE` si está desactivado).
- Revalida en servidor con `adaptSkillOutputToMealPlanImport`, verifica coincidencia canónica con `previewHash` (`409 PREVIEW_HASH_MISMATCH`), ejecuta `prisma.$transaction` atómica y devuelve `201` (creación) o `200` (`idempotentReplay: true`).

---

## 7. Estados de validación y persistencia

- `VALID` / `VALID_WITH_WARNINGS` → persistible como `ACTIVE` o `DRAFT`.
- `INCOMPLETE` → persistible únicamente como `DRAFT` (`422 INCOMPLETE_PLAN_CANNOT_BE_ACTIVE` si se solicita `ACTIVE`).
- `REJECTED` → bloqueado (`422 IMPORT_VALIDATION_REJECTED`).

---

## 8. Comportamiento idempotente

- Clave única compuesta `@@unique([userId, importFingerprint])` sobre el SHA-256 canónico del payload normalizado.
- Reintentos secuenciales devuelven el plan existente con `idempotentReplay: true`.
- Condiciones de carrera concurrentes (`P2002`) recuperan el registro ganador del mismo `(userId, importFingerprint)` y devuelven `idempotentReplay: true`.

---

## 9. Modelo de aislamiento por usuario

- `userId` se obtiene exclusivamente de `req.user.userId`.
- La reutilización de recetas consulta únicamente `{ userId, contentFingerprint }`.
- Las recetas importadas se crean como privadas del usuario (`userId`, `isPublic: false`, `source: 'imported'`), sin modificar recetas globales ni de otros usuarios.

---

## 10. Resultados de QA

- `prisma validate`: **PASS**.
- `prisma generate`: **PASS** (Prisma Client v5.22.0).
- `verify-release-manifest.mjs`: **PASS** (28 migraciones).
- Backend unit (`tests/unit`): **26/26 suites, 238/238 tests PASS** (`meal-plan-import-commit.test.ts` **6/6 PASS**, `meal-plan-import-preview.test.ts` **5/5 PASS**, `nutrition-plan-variety.test.ts` **PASS**).
- Frontend unit (`test:ci`): **26/26 suites, 168/168 tests PASS** (`nutrition-plan-import.test.tsx` **5/5 PASS**).
- Backend `typecheck`, Frontend `typecheck` y Frontend `lint`: **PASS**.

---

## 11. Tests omitidos o bloqueados

- **Integración PostgreSQL aislado (`psql` / BD local):** `N1_INTEGRATION_TESTS_BLOCKED` — no existe servidor/cliente PostgreSQL local en este entorno (`NO_PSQL_CLI`); la verificación transaccional SQL real queda diferida al contenedor PostgreSQL 16 de CI o entorno aislado autorizado.

---

## 12. Riesgos de despliegue

- Desplegar código antes de aplicar M28 en Neon está mitigado por `NUTRITION_PLAN_IMPORT_COMMIT_ENABLED=false` por defecto: ni el backend acepta escrituras ni el frontend muestra el botón de guardado.

---

## 13. Condiciones de autorización de M28

1. Revisión y publicación en `development` (`commit y push ok para anclora-impulso`).
2. CI verde en GitHub Actions (incluyendo migración en PostgreSQL 16 y `verify-release-manifest.mjs`).
3. Backup OD-03 verificado, ejecución del workflow protegido de migración (sin `prisma migrate deploy` ad-hoc), ledger/attestation actualizados y posterior activación de `NUTRITION_PLAN_IMPORT_COMMIT_ENABLED=true`.

---

## 14. Estado del working tree

Cambios locales listos para revisión sin `commit`, `push` ni `PROMOTE`; `Claude outputs/` intacto y excluido.

---

## 15. Siguiente acción concreta

Revisar el diff local y, cuando corresponda, autorizar `commit y push ok para anclora-impulso` para validar M28 en el contenedor PostgreSQL 16 de CI.

