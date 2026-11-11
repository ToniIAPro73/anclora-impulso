# Production Database Identity Preflight & Recovery Verification (Q1)

## 1. Propósito y separación de responsabilidades

Este procedimiento prepara la verificación reproducible de la identidad de la base de datos productiva antes de autorizar la migración 27 (`20261111211500_add_modular_health_plan_catalog_and_optional_identity`), sin ejecutar migraciones, sin escribir en Neon y sin exponer credenciales en logs o artefactos públicos.

Componentes:
- Workflow protegido de solo lectura: `.github/workflows/production-db-identity-preflight.yml` (Environment `production-migrations`, aprobación humana requerida).
- Módulo determinista de solo lectura: `scripts/release/identity-preflight.mjs`.

Garantías fail-closed:
- Calcula `DATABASE_TARGET_FINGERPRINT` con el algoritmo contractual `computeDatabaseFingerprint` de `scripts/release/emit-migration-attestation.mjs`.
- Consulta `_prisma_migrations` únicamente bajo `PGOPTIONS='-c default_transaction_read_only=on'` y evalúa el ledger con `evaluateLedgerRows` y las 9 equivalencias históricas autorizadas de `scripts/release/release-manifest.json` (sin consultar tablas de usuarios).
- Nunca muta `.anclora/PRODUCTION_RUNTIME.md` ni permite sustituir `DATABASE_TARGET_FINGERPRINT` mediante entradas del workflow.
- Reporta `RENDER_IDENTITY_UNVERIFIED` / `NEON_IDENTITY_UNVERIFIED` de forma explícita si faltan credenciales de lectura autorizadas (`RENDER_API_KEY`, `NEON_API_KEY` + `NEON_PROJECT_ID`), sin inferir identidad desde `.env` locales ni confundir el recurso Vercel `neon-impulso` (`store_R01qkU5iSotmruBW`) con el proyecto o branch real de Neon.

## 2. Cálculo y contraste de identidad

1. Tras publicar y validar CI de este workflow en `development`, Toni dispara manualmente `.github/workflows/production-db-identity-preflight.yml` sobre el commit validado de `development` y aprueba la ejecución en `production-migrations`.
2. El artefacto `identity-preflight-report` (`identity-preflight.json`) entrega:
   - `observedTarget.fingerprint` (`sha256:<64-hex>`), `port`, `isPooler=false`, `endpointSha256` y `databaseSha256`.
   - Comparación contra Render (`srv-d6ps41v5r7bs73dvrudg`, si `RENDER_API_KEY` de solo lectura está disponible; si no, `RENDER_IDENTITY_UNVERIFIED` y contraste manual en memoria del operador entre el servicio Render `Anclora-Impulso` -> `Environment` -> `DATABASE_URL` usando `computeDatabaseFingerprint` local sin imprimir la URL).
   - Comparación contra Neon (`neon-impulso` / `NEON_PROJECT_ID` + `NEON_API_KEY` si está disponible; comprobación de que el endpoint pertenece al branch primario/productivo de Neon).
   - Resumen read-only de `_prisma_migrations` (`integrityClean`, `pendingCount`, `pendingMigrationNames`, `acceptedHistoricalEquivalencesCount`, `resolvedRolledBackCount`).
3. Solo cuando GitHub (`PRODUCTION_MIGRATION_DATABASE_URL`), Render (`srv-d6ps41v5r7bs73dvrudg`) y el branch productivo de Neon coinciden en fingerprint, endpoint normalizado, puerto y base de datos, Toni autoriza registrar `DATABASE_TARGET_FINGERPRINT=<sha256:...>` en `.anclora/PRODUCTION_RUNTIME.md`.

## 3. Inspección de opciones de recuperación y generación futura de evidencia

> Durante Q1 **no se crea ningún backup ni snapshot todavía**.

Estado actual comprobado sin acceso de API Neon directo:
- El historial de `.anclora/PRODUCTION_RUNTIME.md` (§12) documenta el patrón previo de backup en Neon usado en Run #1 (`backup-pre-migration-20261012` / branch padre `main`).
- La integración en Vercel `neon-impulso` (`store_R01qkU5iSotmruBW`, plan `Free`) está vinculada al proyecto Vercel `anclora-impulso`, sin acceso CLI directo de `neonctl`/`neon` ni credencial `NEON_API_KEY` cargada localmente en esta sesión.

Cuando se autorice la ventana previa a ejecutar la migración 27:
1. En **Neon Console** (o CLI/API autenticada de Neon sobre el proyecto y branch productivo confirmado, nunca desde Vercel proyecto), inspeccionar los snapshots / ventana PITR disponible del plan y crear un **snapshot o branch de recuperación** antes de `production-migrations.yml` (por ejemplo, `backup-pre-migration-YYYYMMDD`, anclado al branch productivo y al punto temporal actual).
2. Registrar los metadatos no secretos requeridos por `scripts/verifier/backup-evaluator.ts` (`id`, `projectId` de Neon, `sourceBranch`, `createdAt` ISO-8601 UTC, `status: "ready"`).
3. Ejecutar offline `scripts/verifier/operator-preflight.ts` con la exportación del ledger y esos metadatos de backup para obtener `READY_FOR_HUMAN_AUTHORIZATION` y `preflight_report_sha256`, más el `backup_reference` no secreto requerido por `.github/workflows/production-migrations.yml`.

