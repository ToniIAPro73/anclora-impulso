# ANCLORA IMPULSO — INFORME DE CIERRE DE FASE 2
## Arquitectura Modular de Planes (`TASK-017`, `TASK-018`, `TASK-019`, `TASK-020`)

**Estado global:** `PHASE_2_TECHNICAL_READY`
**Restricciones activas:** `BLOCKED_ENV` (sin PostgreSQL/Docker local para `migrate deploy` y doble seed en vivo) · `BLOCKED_LEGAL` (recolección runtime de `sexAtBirth` / `genderIdentity` inactiva hasta cierre de `TASK-003`)
**Rama de trabajo:** `development` (base HEAD `0b40779336df8468359ae03504e9a109fe78e223`, cambios sin commit/push)

---

## 1. Resumen ejecutivo

La Fase 2 implementa la base modular de datos, dominio e idempotencia para las diez modalidades (`P01`–`P10`) sin activarlas todavía en producción ni alterar la experiencia vigente de **Ruta Vital 50–60**:

- **`TASK-020` (Elegibilidad determinista):** dominio puro completado en [`health-plans.domain.ts`](../../backend/src/services/health-plans.domain.ts) con bandas `A1`–`A5` sin solapes, rechazo de `<18` / `null` / no enteros y motor de sugerencia neutra sin auto-inscripción ni inferencia de sexo (`suggestModalitiesForProfile`).
- **`TASK-017` (Modelo modular retrocompatible):** [`schema.prisma`](../../backend/prisma/schema.prisma) ampliado con `cohortKey`, `variantKey` y `maxAge Int?` reutilizando `HealthPlanDefinition`, más migración SQL aditiva [`20261111211500_add_modular_health_plan_catalog_and_optional_identity/migration.sql`](../../backend/prisma/migrations/20261111211500_add_modular_health_plan_catalog_and_optional_identity/migration.sql) y actualización del manifiesto oficial ([`release-manifest.json`](../../scripts/release/release-manifest.json), 27 migraciones).
- **`TASK-018` (Privacidad e identidad opcional preparada e inactiva):** columnas nulables `User.sexAtBirth` y `User.genderIdentity`, módulo aislado [`sensitive-attributes.ts`](../../backend/src/utils/sensitive-attributes.ts) con `SENSITIVE_PROFILE_COLLECTION_ENABLED = false`, validación Zod (`prefer_not_say`), no-inferencia desde `User.sex` y redacción en logs en [`redact.ts`](../../backend/src/utils/redact.ts).
- **`TASK-019` (Seed idempotente en borrador):** [`seed-health-plans.ts`](../../backend/prisma/seed-health-plans.ts) prepara el catálogo completo `P01`–`P10` estrictamente con `status: 'draft'`, avisos no clínicos marcados `PENDING_PROFESSIONAL_REVIEW`, y `upsert` idempotente sin alterar `ruta-vital-50-60` ni inscripciones existentes.

---

## 2. Reconciliación previa con el estado real del repositorio

Antes de implementar, se auditó el código vigente sobre `development` (`0b40779`):

- **Base ya existente (`TASK-020` parcial):** `health-plans.domain.ts` y `health-plans.domain.test.ts` ya contenían `isInCohort`, `HEALTH_PLAN_MODALITY_BANDS`, `getEligibleModalitiesForAge` y `validateNonOverlappingBands`, además del test de frontera arquitectónica (motores core sin importar `health-plans.*`). Faltaban `AGE_BANDS` (`A1`–`A5`), `resolveAgeBand`, `suggestModalitiesForProfile` (`autoEnroll: false`, modo neutro vs explícito) y pruebas de `61` / no-enteros / `NaN`.
- **`TASK-017` y `TASK-018` ausentes en esquema:** `HealthPlanDefinition` tenía `minAge Int` y `maxAge Int` obligatorio sin `cohortKey` ni `variantKey`; `User` solo tenía `sex String?`.
- **Contrato vigente de release:** el repositorio exige mantener [`scripts/release/release-manifest.json`](../../scripts/release/release-manifest.json) sincronizado con `backend/prisma/migrations/` mediante `generate-release-manifest.mjs` / `verify-release-manifest.mjs`.
- **Entorno local (`BLOCKED_ENV`):** `docker`, `postgres` y `pg_isready` no están disponibles en esta máquina, y `.anclora/PRODUCTION_RUNTIME.md` prohíbe ejecutar migraciones contra Neon producción desde local.

---

## 3. Cambios implementados por tarea

### Especificación SDD
- [`sdd/features/phase2-modular-health-plan-catalog/phase2-modular-health-plan-catalog-spec-v1.md`](../../sdd/features/phase2-modular-health-plan-catalog/phase2-modular-health-plan-catalog-spec-v1.md) — contrato de diseño y decisiones arquitectónicas de Fase 2.

### `TASK-020` — Motor de elegibilidad y sugerencias
- Modificado: [`backend/src/services/health-plans.domain.ts`](../../backend/src/services/health-plans.domain.ts) — añade `AGE_BANDS`, `resolveAgeBand`, `validateAgeBands`, `normalizeVariantPreference`, `suggestModalitiesForProfile`, `bandCode` y `slug` en `HEALTH_PLAN_MODALITY_BANDS`.
- Modificado: [`backend/tests/unit/health-plans.domain.test.ts`](../../backend/tests/unit/health-plans.domain.test.ts) — amplía cobertura a `17, 18, 29, 30, 39, 40, 49, 50, 59, 60, 61, null`, `NaN`, decimales, negativos, modo neutro (`NEUTRAL_OPTIONS`), `autoEnroll === false` y ausencia de dependencias circulares.

### `TASK-017` — Modelo de planes modularizado
- Modificado: [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) — añade `cohortKey String?`, `variantKey String?`, cambia `maxAge Int` a `maxAge Int?`, agrega `@@unique([cohortKey, version])` y `@@index([cohortKey, variantKey])` en `HealthPlanDefinition`.
- Modificado: [`backend/src/services/health-plans.service.ts`](../../backend/src/services/health-plans.service.ts) — actualiza `ensureRutaVitalDefinition` para registrar `cohortKey: 'RV-50-60'` y `variantKey: 'NEUTRAL'` preservando `minAge: 50`, `maxAge: 60`, `status: 'published'`, `version: 1`.
- Creado: [`backend/prisma/migrations/20261111211500_add_modular_health_plan_catalog_and_optional_identity/migration.sql`](../../backend/prisma/migrations/20261111211500_add_modular_health_plan_catalog_and_optional_identity/migration.sql)
- Actualizado: [`scripts/release/release-manifest.json`](../../scripts/release/release-manifest.json) (27 migraciones).

### `TASK-018` — Privacidad y atributos opcionales (inactivos)
- Modificado: [`backend/prisma/schema.prisma`](../../backend/prisma/schema.prisma) — añade `sexAtBirth String?` y `genderIdentity String?` nulables en `User`, conservando `sex String?`.
- Creado: [`backend/src/utils/sensitive-attributes.ts`](../../backend/src/utils/sensitive-attributes.ts) — tipos, esquemas Zod (`male | female | prefer_not_say`, `genderIdentity` opcional acotado), `normalizeSensitiveAttributesInput`, `sanitizeLegacyProfileWithoutInference` y flag `SENSITIVE_PROFILE_COLLECTION_ENABLED = false`.
- Modificado: [`backend/src/utils/redact.ts`](../../backend/src/utils/redact.ts) — añade `sex[-_]?at[-_]?birth|gender[-_]?identity` al filtro de redacción de logs.
- Creado: [`backend/tests/unit/sensitive-attributes.test.ts`](../../backend/tests/unit/sensitive-attributes.test.ts) — valida enum/Zod, no-inferencia desde `User.sex`, redacción de logs y ausencia de exposición en `registerSchema`, `updateProfileSchema` y `healthPlanOnboardingSchema`.

### `TASK-019` — Seed idempotente del catálogo `P01`–`P10`
- Creado: [`backend/prisma/seed-health-plans.ts`](../../backend/prisma/seed-health-plans.ts) — exporta `MODULAR_HEALTH_PLAN_CATALOG` y `seedHealthPlanCatalog` con `upsert` idempotente en `draft`, pilares e información de alcance general (`PENDING_PROFESSIONAL_REVIEW`).
- Creado: [`backend/tests/unit/seed-health-plans.test.ts`](../../backend/tests/unit/seed-health-plans.test.ts) — prueba doble ejecución consecutiva con mock estatal de Prisma, estado `draft`, ausencia de afirmaciones clínicas y preservación íntegra de `ruta-vital-50-60` y sus inscripciones.

---

## 4. Matriz de modalidades (`P01`–`P10`) y bandas de edad (`A1`–`A5`)

| Banda | Rango inclusivo | Variante M | Variante F | Key base | Estado seed |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `A1` | `18–29` | `P01` (`Arranque Fuerza · Hombres (18–29)`) | `P02` (`Arranque Fuerza · Mujeres (18–29)`) | `p01-arranque-fuerza-m` / `p02-...-f` | `draft` |
| `A2` | `30–39` | `P03` (`Motor 30 · Hombres (30–39)`) | `P04` (`Motor 30 · Mujeres (30–39)`) | `p03-motor-30-m` / `p04-...-f` | `draft` |
| `A3` | `40–49` | `P05` (`Equilibrio 40 · Hombres (40–49)`) | `P06` (`Equilibrio 40 · Mujeres (40–49)`) | `p05-equilibrio-40-m` / `p06-...-f` | `draft` |
| `A4` | `50–59` | `P07` (`Vital 50 · Hombres (50–59)`) | `P08` (`Vital 50 · Mujeres (50–59)`) | `p07-vital-50-m` / `p08-...-f` | `draft` |
| `A5` | `60+` (`maxAge: null`) | `P09` (`Longevidad 60+ · Hombres`) | `P10` (`Longevidad 60+ · Mujeres`) | `p09-longevidad-60-plus-m` / `p10-...-f` | `draft` |

- **Regla de no solape:** dentro de cada variante (`M` y `F`), `A1`–`A5` son contiguas y disjuntas.
- **Conflicto documentado de edad `60`:** `ruta-vital-50-60` (`cohortKey: 'RV-50-60'`, `published`) mantiene temporalmente `minAge: 50, maxAge: 60` por retrocompatibilidad de Fase 0/1, mientras el catálogo modular asigna `50–59` a `A4` y `60+` a `A5`. Antes de publicar `P07`–`P10` en producción, el propietario debe decidir si migra `RV-50-60` a `50–59` o redirige edad `60` a `P09`/`P10`.

---

## 5. Controles de privacidad, no inferencia y seguridad

- **`SENSITIVE_PROFILE_COLLECTION_ENABLED = false`:** la captura, consentimiento explícito, edición de perfil y personalización UI permanecen desactivadas hasta completar `TASK-003`.
- **Aislamiento de rutas:** `registerSchema`, `updateProfileSchema` y `healthPlanOnboardingSchema` no aceptan `sexAtBirth` ni `genderIdentity`; los contratos existentes de `/api/auth/*`, `/api/profile` y `/api/health-plans/*` no cambian.
- **Cero inferencia cruzada:** `sanitizeLegacyProfileWithoutInference` no deduce `sexAtBirth` desde `User.sex`, ni deduce `genderIdentity` desde `sexAtBirth`. En sugerencia de planes, la ausencia de preferencia o `prefer_not_say` devuelve ambas opciones (`M` y `F`) en modo `NEUTRAL_OPTIONS`.
- **Redacción estructurada:** [`redact.ts`](../../backend/src/utils/redact.ts) enmascara `sexAtBirth` / `sex_at_birth` y `genderIdentity` / `gender_identity` con `[REDACTED]`.

---

## 6. Migraciones, backfill e idempotencia

- Migración `20261111211500_add_modular_health_plan_catalog_and_optional_identity`:
  - Usa `ADD COLUMN IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS` y `CREATE INDEX IF NOT EXISTS`.
  - Relaja `"maxAge"` con `DROP NOT NULL` para habilitar `A5` / `P09`–`P10` (`60+`).
  - Backfill acotado y no destructivo: actualiza únicamente la fila `key = 'ruta-vital-50-60'` cuando `"cohortKey" IS NULL` asignando `'RV-50-60'` y `'NEUTRAL'`.
- El seed [`seed-health-plans.ts`](../../backend/prisma/seed-health-plans.ts) usa `upsert` por clave natural (`key`, `planId_key`, `planId_key_locale`) y no ejecuta acciones al ser importado (`require.main === module`), protegiendo ejecuciones repetidas y filas previas.

---

## 7. Verificación ejecutada y resultados exactos

Comandos ejecutados tras la última edición de código:

1. `cd backend && npx prisma validate` → **PASS** (`The schema at prisma/schema.prisma is valid`).
2. `cd backend && ./node_modules/.bin/tsc --noEmit` → **PASS** (0 errores de TypeScript).
3. `node scripts/release/verify-release-manifest.mjs` → **PASS** (`manifest ok: 27 migrations; newest is 20261111211500_add_modular_health_plan_catalog_and_optional_identity`).
4. `cd backend && npx jest --ci --runInBand tests/unit/health-plans.domain.test.ts tests/unit/health-plans.service.test.ts tests/unit/sensitive-attributes.test.ts tests/unit/seed-health-plans.test.ts tests/unit/log-redaction-review-r4.test.ts`:
   - `tests/unit/health-plans.domain.test.ts`: **49 passed, 0 failed**.
   - `tests/unit/health-plans.service.test.ts`: **10 passed, 0 failed**.
   - `tests/unit/sensitive-attributes.test.ts`: **6 passed, 0 failed**.
   - `tests/unit/seed-health-plans.test.ts`: **2 passed, 0 failed**.
   - `tests/unit/log-redaction-review-r4.test.ts`: **4 passed, 0 failed**.
   - **Total Jest focal:** **5 passed suites, 71 passed tests, 0 failed, 0 skipped**.

**Verificación pendiente (`BLOCKED_ENV`):**
- `prisma migrate deploy` y ejecución real de `seed-health-plans.ts` dos veces sobre PostgreSQL 16 (cubierto por `test-backend` en GitHub Actions cuando el propietario autorice commit/push a `origin/development`).

---

## 8. Reglas de retrocompatibilidad y no regresión

- `listDefinitions` en [`health-plans.service.ts`](../../backend/src/services/health-plans.service.ts) filtra estrictamente `where: { status: 'published' }`, manteniendo las 10 modalidades `draft` ocultas en el runtime actual.
- `isInCohort(user.age, definition.minAge, definition.maxAge)` acepta `maxAge: number | null`, conservando la validación de `Ruta Vital 50–60` (`50 <= age <= 60`).
- `User.sex` y los endpoints de perfil/registro/autenticación permanecen sin cambios de contrato.
- Test de frontera arquitectónica confirma que `workouts.service.ts`, `nutrition.service.ts`, `gamification.service.ts` y `progression.service.ts` no importan `health-plans.*`, y `health-plans.domain.ts` no importa Prisma ni motores core.

---

## 9. Riesgos, supuestos y deuda residual

- **Riesgo de estado de migración sin prueba en Postgres real local:** mitigado mediante SQL idempotente (`IF NOT EXISTS`), `prisma validate`, `tsc --noEmit` y verificación del manifiesto; requiere paso verde en `test-backend` de CI (PostgreSQL 16) antes de cualquier promoción.
- **Nombres comerciales (`Vital 50` vs `Ruta Vital 50–60`):** `P07`/`P08` adoptan el nombre modular `Vital 50 · Hombres/Mujeres (50–59)` mientras la ruta v1 publicada conserva `Ruta Vital 50–60` hasta la transición controlada de Fase 3/5.
- **Script CLI de `seed-health-plans.ts`:** listo para invocación bajo `tsx`/`ts-node`, no conectado todavía a `package.json` ni `seed.ts` para evitar alterar flujos automáticos existentes hasta validar su ejecución en CI/staging.

---

## 10. Decisiones pendientes del propietario

1. **Decisión legal/privacidad (`TASK-003`):** aprobar texto legal, base jurídica y consentimiento explícito antes de activar `SENSITIVE_PROFILE_COLLECTION_ENABLED` y UI para `sexAtBirth` / `genderIdentity`.
2. **Decisión de producto sobre edad `60`:** definir si `ruta-vital-50-60` reducirá su límite superior a `59` al publicar `P07`–`P10` o si usuarios con edad `60` recibirán migración/opción explícita hacia `P09`/`P10` (`A5`).
3. **Decisión clínica (`TASK-004`):** ninguna modalidad `P01`–`P10` puede pasar de `'draft'` a `'published'` ni recibir contenido semanal específico sin validación profesional previa.
4. **Autorización Git:** cambios listos en working tree sobre `development`; pendientes de validación del propietario y autorización expresa (`commit y push ok`) para publicar en `origin/development` y validar PostgreSQL 16 en CI.

---

## 11. Recomendación explícita para Fase 3 y criterios de entrada

**Recomendación:** No iniciar Fase 3 en producción hasta que:
1. Los cambios de Fase 2 pasen `test-backend` (con `prisma migrate deploy` en PostgreSQL 16) en CI tras el commit/push autorizado en `development`.
2. Exista resolución documental de `TASK-003` (para recolección opcional de `sexAtBirth` / `genderIdentity`) y `TASK-004` (para contenido clínico de nuevas cohortes).
3. El propietario resuelva la regla de transición para usuarios de `60` años entre `RV-50-60` y `A4`/`A5`.
