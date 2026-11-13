# Informe Final de Validación Técnica y Funcional — N1 Commit + M28

**Fecha:** 2026-11-13  
**Repositorio:** `/Users/toni/Developer/anclora/anclora-impulso`  
**Rama:** `development`  
**HEAD base:** `9468130a723eecbc8af3126221af01213d72e4de` (N1 Preview publicada, CI `43364217604` — SUCCESS)  

---

## 1. Contratos AOS consultados y cumplimiento

- [PRODUCTION_RUNTIME.md](file:///Users/toni/Developer/anclora/anclora-impulso/.anclora/PRODUCTION_RUNTIME.md): `LOCAL_RUNTIME_MODEL=PRODUCTION_BACKED`, `DO_NOT_CREATE_DEVELOPMENT_DATABASE=true`, `QA_AUTH_MODEL=DEDICATED_USER`, `QA_PERSISTENT_IDENTITY=qa.impulso@anclora.local`, `QA_REUSE=true`, `QA_DELETE_AFTER_TEST=false`, `QA_WRITE_SCOPE=authenticated QA user records only`.
- Reglas de secreto y entorno: `.env.development.local` cargado únicamente en proceso mediante `set -a; . ./.env.development.local; set +a` sin imprimir credenciales, tokens ni cadenas de conexión.
- Gates OD-03 / G39 y runner protegido de migraciones respetados: **M28 no aplicada sobre Neon**, **sin `commit`/`push`**, **sin `PROMOTE`**.

---

## 2. Identidad QA utilizada

- Cuenta dedicada: `qa.impulso@anclora.local` (reutilizada, conservada sin modificar contraseña ni registros de terceros).

---

## 3. Pruebas funcionales ejecutadas (con `qa.impulso@anclora.local`, runtime `PRODUCTION_BACKED`)

Ejecutado contra servidor local `http://localhost:3001` conectado a Neon M27 con `NUTRITION_PLAN_IMPORT_COMMIT_ENABLED=false` y 0 escrituras BD:
1. **Protección de rutas (`POST /api/nutrition/meal-plans/import/preview` sin auth):** `401` — **PASS**.
2. **Autenticación QA (`POST /api/auth/login`):** `200` (`qa.impulso@anclora.local`) — **PASS**.
3. **Preview válido (`valid-1day-plan.json`):** `200`, `status: VALID`, `canCommitToDatabase: false`, `persistenceBlockedReason: M28_REQUIRED_FOR_FULL_PERSISTENCE`, `shoppingItems: 4`, `duplicates: 0` — **PASS**.
4. **Preview incompleto (`odt-reference-incomplete-plan.json`):** `200`, `status: INCOMPLETE`, `unconvertible: 10` (sin inventar cantidades) — **PASS**.
5. **Preview rechazado (payload inseguro):** `422`, `status: REJECTED`, `canImportPreview: false` — **PASS**.
6. **Bloqueo de Commit con feature flag desactivado (`POST /api/nutrition/meal-plans/import/commit`):** `503 M28_REQUIRED_FOR_FULL_PERSISTENCE` — **PASS**.

### Hallazgo crítico de compatibilidad pre-M28 (RESUELTO)
- Al consultar `GET /api/nutrition/meal-plans` contra Neon M27 usando el cliente Prisma generado con el esquema local **M28**, Prisma devolvía inicialmente `500` (`The column meal_plans.title does not exist in the current database`).
- **Resolución aplicada:** se crearon proyecciones explícitas M27-only en `backend/src/services/nutrition/pre-m28-selects.ts` y se sustituyeron los `include` implícitos y retornos sin `select` en `backend/src/services/nutrition.service.ts` (+ test de regresión `pre-m28-compatibility.test.ts`). Revalidado contra Neon M27 con `qa.impulso@anclora.local`: `GET /api/nutrition/meal-plans → 200`, `GET /api/nutrition/recipes → 200`, `GET /api/nutrition/summary → 200`, `preview → 200`, `commit → 503`. Véase [M28_COMPATIBILITY_AND_RELEASE_READINESS.md](file:///Users/toni/Developer/anclora/anclora-impulso/docs/sdd/nutrition/M28_COMPATIBILITY_AND_RELEASE_READINESS.md).

---

## 4. Pruebas automatizadas e integración en CI

- **`package.json` actualizado:** `"typecheck": "tsc --noEmit && tsc -p __tests__/tsconfig.json --noEmit"` para integrar `__tests__/tsconfig.json` directamente en el gate de CI (`test-frontend`).
- **Prisma:** `prisma validate` **PASS**, `prisma generate` **PASS** (v5.22.0), `verify-release-manifest.mjs` **PASS** (28 migraciones).
- **Backend unit (`tests/unit`):** **26/26 suites, 238/238 tests PASS** (incluyendo `meal-plan-import-commit.test.ts` 6/6, `meal-plan-import-preview.test.ts` 5/5 y `nutrition-plan-variety.test.ts` corregida para los nuevos campos de `Recipe`/`RecipeIngredient`).
- **Frontend (`test:ci`):** **26/26 suites, 168/168 tests PASS** (`nutrition-plan-import.test.tsx` 5/5).
- **Typechecks & Lint:** `backend typecheck` (`tsc --noEmit && tsc -p scripts/tsconfig.json`) **PASS**, `frontend typecheck` (`tsc --noEmit && tsc -p __tests__/tsconfig.json --noEmit`) **PASS**, `next lint` **PASS**.

---

## 5. Auditoría M28 y N1 Commit

- Migración `20261113060000_add_meal_plan_import_persistence`: 100% aditiva, enum `MealPlanLifecycleStatus` (`DRAFT`, `ACTIVE`, `ARCHIVED`), `@@unique([userId, importFingerprint])`, `@@index([userId, contentFingerprint])`, `RecipeIngredient.quantity` nullable con `unitOverride`, `rawQuantityText` e `isEstimated`, sin cambios destructivos ni alteración de `Ingredient.name @unique`.
- `meal-plan-commit.service.ts`: revalidación en servidor, verificación SHA-256 canónica (`previewHash`), `INCOMPLETE` restringido a `DRAFT`, `REJECTED` bloqueado, transacción atómica, idempotencia y manejo de concurrencia `P2002`, aislamiento estricto por `userId`.

---

## 6. Pruebas pendientes de M28 aplicada (NO ejecutadas)

No declaradas como PASS al requerir esquema M28 real en PostgreSQL:
- Persistencia real en Neon / PostgreSQL 16 aislado.
- Concurrencia real `P2002` y rollback SQL real.
- Integridad referencial en BD tras `commit`.
- Guardado/recuperación E2E y reintento idempotente contra Neon.
- Verificación visual en navegador con `commit` habilitado tras aplicar M28.

---

## 7. Inventario Git preparado (sin commit ni push)

- **Incluidos (18 archivos/directorios del paquete M28 + N1 Commit + QA):**
  - `package.json`, `__tests__/tsconfig.json`, `__tests__/components/nutrition-plan-import.test.tsx`, `components/nutrition/meal-plan-import-panel.tsx`, `lib/api/index.ts`
  - `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261113060000_add_meal_plan_import_persistence/migration.sql`, `scripts/release/release-manifest.json`
  - `backend/src/config/env.ts`, `backend/src/services/nutrition/plan-import/meal-plan-preview.service.ts`, `backend/src/services/nutrition/plan-import/meal-plan-commit.service.ts`, `backend/src/utils/validators.ts`, `backend/src/controllers/nutrition.controller.ts`, `backend/src/routes/nutrition.routes.ts`
  - `backend/tests/unit/meal-plan-import-commit.test.ts`, `backend/tests/unit/nutrition-plan-variety.test.ts`
  - `docs/anclora-master-audit/12_AGENT_READY_BACKLOG.md`, `docs/sdd/nutrition/M28_PERSISTENCE_STUDY.md`, `docs/sdd/nutrition/N1_COMMIT_M28_IMPLEMENTATION_REPORT.md`, `docs/sdd/nutrition/N1_COMMIT_M28_QA_FINAL_REPORT.md`
- **Excluidos:** `Claude outputs/`, `.env*`, credenciales.

---

## 8. Estados de salida

- `N1_LOCAL_QA_PASS`
- `N1_PRODUCTION_PREVIEW_QA_PASS`
- `M28_STATIC_VALIDATION_PASS`
- `M28_PRODUCTION_NOT_EXECUTED`
- `N1_COMMIT_INTEGRATION_PENDING_M28`
- `READY_FOR_RELEASE_REVIEW`

