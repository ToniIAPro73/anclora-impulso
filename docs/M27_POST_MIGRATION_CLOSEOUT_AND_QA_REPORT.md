# Informe Definitivo de Cierre Post-M27 y Aceptación Funcional — `anclora-impulso`

- **Fecha de cierre:** 2026-11-13
- **Repositorio:** `anclora-impulso` (rama `development`)
- **Migración:** `20261111211500_add_modular_health_plan_catalog_and_optional_identity`
- **Estados oficiales:**
  - `M27_APPLIED_ATTESTED_SCHEMA_VERIFIED`
  - `M27_PRODUCTION_FUNCTIONAL_ACCEPTANCE_PASS`
  - `M27_POST_MIGRATION_CLOSEOUT_COMPLETE`
  - `JEST_ISOLATED_INTEGRATION_TESTS_NOT_RUN`
  - `OD03_G39_PRIVATE_PRECOMMERCIAL_UNCHANGED`

## 1. Evidencia verificada de ejecución en producción (M27)

- **Workflow protegido (`production-migrations.yml`):** `43289233813` — `completed` / `success` (`2026-11-12T19:25Z`, commit `9a120a63429234136a3a65d5f77455e4dc1c485e`).
- **Proyecto / Branch Neon:** `lucky-hat-25002521` / `br-gentle-bar-ag3slpph`.
- **Backup pre-M27 validado (OD-03):** `br-odd-fire-agtnhm44` (PASS, antigüedad `364s`).
- **Ledger productivo:** `27` migraciones aplicadas, `8` rollbacks históricos resueltos, `0` pendientes.
- **Attestation (`MigrationAttestationV1`):** emitida correctamente, artefacto GitHub `13977250508`.
- **Esquema PostgreSQL:** columnas e índices de M27 verificados en producción (`cohortKey`, `variantKey`, `maxAge` nullable, campos opcionales de identidad).

## 2. Reconciliación documental AOS (historial preservado)

Se actualizó el estado operativo a `M27_APPLIED_ATTESTED_SCHEMA_VERIFIED` conservando intactas todas las decisiones, bloqueos e incidentes históricos en:

- [PRODUCTION_RUNTIME.md](../.anclora/PRODUCTION_RUNTIME.md)
- [M27_SAFE_PREPARATION_RUNBOOK.md](./M27_SAFE_PREPARATION_RUNBOOK.md)
- [POST_RESTORE_OPERATIONAL_CLOSEOUT_REPORT.md](./POST_RESTORE_OPERATIONAL_CLOSEOUT_REPORT.md)
- [PRODUCTION_DB_IDENTITY_PREFLIGHT_RUNBOOK.md](./PRODUCTION_DB_IDENTITY_PREFLIGHT_RUNBOOK.md)

## 3. Aceptación funcional en producción con cuenta QA dedicada

Conforme a [PRODUCTION_RUNTIME.md](../.anclora/PRODUCTION_RUNTIME.md) (`QA_AUTH_MODEL=DEDICATED_USER`, `QA_REUSE=true`, `QA_DELETE_AFTER_TEST=false`, `QA_WRITE_SCOPE=authenticated QA user records only`), la campaña QA se ejecutó sobre producción utilizando la cuenta dedicada existente:

- **Cuenta QA:** `qa.impulso@anclora.local`
- **Identificador no secreto:** `926a24f0-dff7-4518-9398-14545f9c8455`
- **Manejo de credenciales y datos:** credenciales cargadas únicamente desde `.env.development.local` sin impresión de secretos, tokens ni cookies; cuenta y registro conservados conforme a la política de persistencia vigente.

### Resultados de pruebas productivas (`0` incidencias funcionales)

| Área verificada | Evidencia / Resultado |
| --- | --- |
| Salud de producción (Render / Vercel) | `/health` `200` (`database: "pass"`), `/health/ready` `200`, `/health/live` `200`, Vercel `/` `302` |
| Autenticación API (`scripts/qa/auth-probe.mjs`) | `200` en `login`, `/auth/me`, `/auth/refresh` y `/auth/logout`; cookie `refreshToken` `httpOnly`, `secure`, `sameSite=Lax`, `path=/api/auth` |
| Sesión UI autenticada en Vercel (`scripts/qa/browser-session-probe.mjs chrome ui-session`) | `loginRedirectedToDashboard=true`, `expiredAccessKeepsSession=true`, `refreshTokenInLocalStorage=false`, `logoutStatus=200`, `refreshAfterLogoutStatus=400` |
| Catálogo modular y Ruta Vital v1 (ES/EN) | `GET /api/health-plans/definitions` `200`: `cohortKey="RV-50-60"`, `variantKey="NEUTRAL"`, `minAge=50`, `maxAge=60`, localización ES/EN |
| Campos opcionales de identidad (`sexAtBirth`, `genderIdentity`) | `GET /api/profile` `200` sin exposición de `sexAtBirth` ni `genderIdentity` (`SENSITIVE_PROFILE_COLLECTION_ENABLED=false`) |
| Ciclo de inscripción, onboarding, home y estado | Guardia de cohorte `422` con `age=null`; con `age=54` temporal sobre el propio perfil QA (restaurado a `null` al cierre): `201` inscripción, `200` onboarding (`SELF_MANAGED`), `200` home (`onboardingComplete=true`, `pillarsCount=6`), `200` transición `paused` → `active` |
| Validación de entradas y aislamiento | `400` en `onboarding`/`status` inválidos; `401` sin token o con JWT falsificado; parámetro `?userId=` ajeno ignorado (todos los registros pertenecen exclusivamente al ID QA) |

## 4. Pruebas locales y limitación documentada de suites Jest aisladas

- **Suite de regresión añadida:** [m27-post-migration-qa.test.ts](../backend/tests/unit/m27-post-migration-qa.test.ts) (7 pruebas aisladas con fixtures sintéticos).
- **Suites unitarias backend:** PASS (`23/23` suites, `214/214` tests).
- **Suites frontend:** PASS (`25/25` suites, `163/163` tests).
- **Typechecks (`tsc --noEmit`) backend y frontend:** PASS.
- **Manifiesto de migraciones (`scripts/release/verify-release-manifest.mjs`):** PASS (`27` migraciones; última `20261111211500_add_modular_health_plan_catalog_and_optional_identity`).
- **Controles AOS (`OD-03`, `G39`, `PRIVATE_PRECOMMERCIAL`, `Identity Preflight`):** PASS (`64/64` tests), sin alteración de políticas ni protecciones.
- **Limitación documentada (`JEST_ISOLATED_INTEGRATION_TESTS_NOT_RUN`):** las `31` suites Jest de integración (`backend/tests/integration/*.test.ts`) exigen PostgreSQL local (`anclora-impulso-test-postgres` vía Docker) y sus protecciones impiden ejecutarlas contra producción. Permanecen sin ejecutar en local por `DOCKER_DOWN`; esto constituye una limitación de cobertura de integración aislada local y **no** un fallo de la campaña QA productiva.

