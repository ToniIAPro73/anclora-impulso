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

Estado actual comprobado e inventario operativo post-restore (Run #4 [`43133125412`](https://github.com/ToniIAPro73/anclora-impulso/actions/runs/43133125412), `2026-11-12T01:15:10.788Z`, commit `32f07fc92a05e7c4d283ce69b268fa8286a52910`):
- El historial de `.anclora/PRODUCTION_RUNTIME.md` (§12) documenta el patrón histórico inmutable de Run #1 (`backup-pre-migration-20261012` / `br-shy-cloud-agi9o4kv` / branch padre `main`), que se conserva únicamente como evidencia histórica de aquella ejecución (la Neon API actual lo reporta como `state: "archived"`, `parentId: "br-empty-forest-ag9p7l45"`, `createdAt: "2026-10-12T19:48:08Z"`).
- La integración en Vercel `neon-impulso` (`store_R01qkU5iSotmruBW`, plan `Free`) está vinculada al proyecto Vercel `anclora-impulso`; los identificadores operativos confirmados en el plano Neon tras la restauración accidental del snapshot y reconciliación son: proyecto `lucky-hat-25002521` (`regionId: aws-eu-central-1`), branch productivo activo `br-gentle-bar-ag3slpph` (`name: "main"`, `primary: true`, `default: true`, `protected: false`, `currentState: "ready"`), branch anterior conservado `br-empty-forest-ag9p7l45` (ambos branches verificados con `58` tablas, `6.508` registros, `58/58` huellas coincidentes y migración 27 pendiente), endpoint `ep-lingering-paper-agjnrga3` y snapshot `snap-late-bread-agkwpeoh` (`sourceBranchId: "br-empty-forest-ag9p7l45"`, `createdAt: "2026-11-12T00:18:26Z"`, `expiresAt: null`).
- El preflight protegido de Q1 (`43133125412`) verificó `status: "IDENTITY_VERIFIED"` con `render.status = "VERIFIED"`, `neon.status = "VERIFIED"` (`endpointMatchesObserved: true`, `endpointBelongsToProductionBranch: true`, `databaseConfirmedOnBranch: true`), `contractFingerprintMatchesObserved: true` (`sha256:29eb57cb9705d468d83e82fb873f7cc9c40fe0a4fdfad7840def716a538b9cb6`) y `ledger.integrityClean: true` (`26` aplicadas, `9` equivalencias CRLF aceptadas, `8` rollbacks históricos resueltos, `0` discrepancias, `1` migración 27 pendiente).
- **Alcance estricto de Q1:** `IDENTITY_VERIFIED` acredita únicamente la identidad de destino y la integridad read-only del ledger; **NO autoriza la ejecución de la migración 27** ni sustituye las puertas de Fase 2.
- **Evaluación de `snap-late-bread-agkwpeoh` en `scripts/verifier/backup-evaluator.ts`:** `evaluateBackupMetadata` **rechaza** usar `snap-late-bread-agkwpeoh` como backup pre-migración 27 porque pertenece al branch reemplazado `br-empty-forest-ag9p7l45` (`backup source branch mismatch: br-empty-forest-ag9p7l45 != br-gentle-bar-ag3slpph`), no aporta `status: "ready"` en `neon.recoveryOptions.snapshots` y excede la frescura requerida sin configuración de `OD-03` (`backup freshness threshold is not configured (no default: decision OD-03 is open)` / >60 min).
- Para futuros preflights de Fase 2 (`scripts/verifier/operator-preflight.ts --source-branch`), el branch origen de referencia debe corresponder de forma consistente al branch productivo activo (`br-gentle-bar-ag3slpph` o `"main"` según quede registrado en el metadata de backup nuevo), nunca al antiguo branch sustituido (`br-empty-forest-ag9p7l45`).

Cuando se autorice la ventana previa a ejecutar la migración 27:
1. En **Neon Console** (o CLI/API autenticada de Neon sobre `lucky-hat-25002521` y el branch productivo activo `br-gentle-bar-ag3slpph`, nunca desde Vercel proyecto), confirmar que `ep-lingering-paper-agjnrga3` sigue asociado a `br-gentle-bar-ag3slpph` (`main`) y crear un **nuevo snapshot o branch de recuperación** con estado `ready` previo a `production-migrations.yml` anclado específicamente a `br-gentle-bar-ag3slpph` (`snap-late-bread-agkwpeoh` no es apto como backup pre-M27).
2. Registrar los metadatos no secretos requeridos por `scripts/verifier/backup-evaluator.ts` (`id`, `projectId` de Neon, `sourceBranch`, `createdAt` ISO-8601 UTC, `status: "ready"`) y resolver explícitamente el umbral de frescura `OD-03` (`maxAllowedAgeMs`).
3. Ejecutar offline `scripts/verifier/operator-preflight.ts` con la exportación del ledger y esos metadatos de backup para obtener `READY_FOR_HUMAN_AUTHORIZATION` y `preflight_report_sha256`, más el `backup_reference` no secreto requerido por `.github/workflows/production-migrations.yml`, y esperar la aprobación humana de `production-migrations` en GitHub.
4. Ver el cierre operativo post-restore completo en `docs/POST_RESTORE_OPERATIONAL_CLOSEOUT_REPORT.md`.

