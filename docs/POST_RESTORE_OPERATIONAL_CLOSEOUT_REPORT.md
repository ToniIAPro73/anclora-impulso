# Informe de Cierre Operativo Post-Restore de Neon (`anclora-impulso`)

- **Fecha:** 2026-11-12
- **Repositorio / Rama:** `anclora-impulso` / `development` (`32f07fc92a05e7c4d283ce69b268fa8286a52910`)
- **CI del commit contractual:** Run [`43126778344`](https://github.com/ToniIAPro73/anclora-impulso/actions/runs/43126778344) (`SUCCESS`)
- **Preflight definitivo de identidad (Q1 #4):** Run [`43133125412`](https://github.com/ToniIAPro73/anclora-impulso/actions/runs/43133125412) (`2026-11-12T01:15:10.788Z`, Environment `production-migrations`) -> **`IDENTITY_VERIFIED`**
- **Estado operativo final (Q1 / Post-Restore):** **`POST_RESTORE_OPERATIONAL_READY`** *(identidad de destino y ledger verificados en solo lectura; la ejecución de la migración 27 permanece **bloqueada** hasta completar los prerrequisitos de Fase 2 y backup fresco sobre `br-gentle-bar-ag3slpph`)*.

---

## 1. Sincronización Git (`development`)

- `git fetch origin` + `git merge --ff-only origin/development`: avance rápido limpio `455b3be..32f07fc` sin conflictos ni pérdida de estado local.
- Commit `32f07fc92a05e7c4d283ce69b268fa8286a52910` registra `DATABASE_TARGET_FINGERPRINT=sha256:29eb57cb9705d468d83e82fb873f7cc9c40fe0a4fdfad7840def716a538b9cb6` en [`.anclora/PRODUCTION_RUNTIME.md`](../.anclora/PRODUCTION_RUNTIME.md#L102-L105).

---

## 2. Salud HTTP pública de Render y Frontend (solo lectura)

Comprobaciones ejecutadas sin mutaciones ni sesiones de usuarios reales:

| Destino / Endpoint | HTTP | Resultado observado |
| --- | --- | --- |
| `https://anclora-impulso.onrender.com/health` | `200` | `status: "healthy"`, `environment: "production"`, `version: "1.0.0"`, `database: pass` (`responseTime: 455ms`), `memory: pass`, `disk: pass` |
| `https://anclora-impulso.onrender.com/health/simple` | `200` | `{"status":"ok"}` |
| `https://anclora-impulso.onrender.com/health/ready` | `200` | `{"ready":true}` |
| `https://anclora-impulso.onrender.com/health/live` | `200` | `{"alive":true}` |
| `https://anclora-impulso.onrender.com/api/exercises` | `200` | Catálogo de ejercicios devuelto desde PostgreSQL |
| `https://anclora-impulso.onrender.com/api/health-plans/catalog` | `401` | `{"error":"Token no proporcionado"}` (protección de autenticación operativa) |
| `https://impulso.anclora.com/landing` | `200` | Entrada pública operativa |

---

## 3. Logs, eventos y métricas de Render (`srv-d6ps41v5r7bs73dvrudg`)

Consultado vía Render API autorizada (`RENDER_API_KEY`):

- **Servicio:** `Anclora-Impulso` (`srv-d6ps41v5r7bs73dvrudg`), `branch: production`, `rootDir: backend`, `region: frankfurt`, `plan: free`, `suspended: not_suspended`, `autoDeploy: yes`.
- **Deploy vivo:** `dep-dbqci0vf3r2c73ev0peg` (`status: live`, `commitId: 0b40779336df8468359ae03504e9a109fe78e223`, finalizado `2026-11-11T20:00:41Z`).
- **Logs recientes de arranque (`2026-11-12T00:51:08Z–00:51:15Z`, instancia `srv-d6ps41v5r7bs73dvrudg-cz9rg`):** arranque limpio con `node dist/server.js` y rutas registradas sin errores de aplicación.
- **Incidencias previas en logs de error (últimas 12 h):** únicamente 2 cierres puntuales de conexión Prisma (`prisma:error Error in PostgreSQL connection: Error { kind: Closed, cause: None }`) a las `2026-11-11T18:59:01.479Z` (instancia `z62r7`) y `2026-11-11T20:05:46.431Z` (instancia `mjhlh`), previos al arranque actual y sin recurrencia posterior.
- **Métricas (`cpu` / `memory`, 12 h):** CPU estable (`~0.00012–0.00116`) y memoria estable (`~109.5–114.8 MB`) dentro del rango operativo del servicio.

---

## 4. Verificación de destino, DB read-only y separación de identidad de branch

### Verificación directa de contrato, Render, Neon Control Plane y PostgreSQL (`43133125412`)
- **Preflight protegido definitivo de Q1 #4 (Run [`43133125412`](https://github.com/ToniIAPro73/anclora-impulso/actions/runs/43133125412), `2026-11-12T01:15:10.788Z`, commit `32f07fc92a05e7c4d283ce69b268fa8286a52910`):**
  - `status`: **`IDENTITY_VERIFIED`** (`mismatches: []`, `unverified: []`). *(Nota histórica: un intento previo en entorno local había fallado por HTTP `401` del token OAuth local y ausencia de `NEON_API_KEY` local; esa verificación quedó resuelta de forma definitiva en GitHub Actions mediante el Environment `production-migrations`.)*
  - **Contrato (`32f07fc`):** `declaredFingerprint: sha256:29eb57cb9705d468d83e82fb873f7cc9c40fe0a4fdfad7840def716a538b9cb6`, `contractFingerprintMatchesObserved: true`, `contractMutatedByPreflight: false`.
  - **Render (`srv-d6ps41v5r7bs73dvrudg`):** `render.status = VERIFIED`, con `fingerprintMatches: true`, `endpointMatches: true`, `portMatches: true`, `databaseMatches: true`. *(Ya verificado previamente en Run `43125137874` sobre `455b3be` y reconfirmado sobre `32f07fc`.)*
  - **Neon Control Plane:** `neon.status = VERIFIED` en proyecto `lucky-hat-25002521` (`projectIdSha256: d162e77c10628bfa46bf96732580a62169896dde4695006eb7e6ff5546c6f863`, `regionId: aws-eu-central-1`), branch productivo activo `br-gentle-bar-ag3slpph` (`idSha256: 66dc396b472ff648e5614724ac5551170bcc60da2f91e31adb2fad4e136c9a53`, `name: "main"`, `primary: true`, `default: true`, `protected: false`, `currentState: "ready"`), con `endpointMatchesObserved: true`, `endpointBelongsToProductionBranch: true` y `databaseConfirmedOnBranch: true`.
  - **Regla de separación (`D-2026-0055`):** aunque `DATABASE_TARGET_FINGERPRINT` por sí solo solo deriva de host/puerto/BD (`ep-lingering-paper-agjnrga3`), la verificación Neon API en `43133125412` demostró que el endpoint `ep-lingering-paper-agjnrga3` pertenece efectivamente al branch `br-gentle-bar-ag3slpph` (`main`) y no al antiguo branch `br-empty-forest-ag9p7l45`.
- **PostgreSQL read-only (`_prisma_migrations` en `43133125412` e inspección previa de contenido):**
  - **Reconciliación post-restore accidental:** tras la restauración del snapshot `snap-late-bread-agkwpeoh` hacia `br-gentle-bar-ag3slpph` conservando `br-empty-forest-ag9p7l45`, ambos branches contienen `58` tablas en `public`, `6.508` registros totales, `58/58` huellas de contenido coincidentes y la migración 27 sin aplicar.
  - `_prisma_migrations`: `integrityClean: true`, `declaredCount: 27`, `appliedCount: 26`, `pendingCount: 1` (`20261111211500_add_modular_health_plan_catalog_and_optional_identity`), `pendingIsContiguousSuffix: true`, `failedCount: 0`, `rolledBackCount: 0`, `resolvedRolledBackCount: 8`, `checksumMismatchCount: 0`, `extraDbCount: 0`, `acceptedHistoricalEquivalencesCount: 9`, `appliedMigrationsDigest: ebf5f9bdeb8b1c0a3a7e53b32fce6cd2cf8f898ded7765f1557ec578fa8f64cf`.

---

## 5. Auditoría de referencias a branch IDs en contratos y runbooks

| Referencia | Ubicación | Clasificación | Acción |
| --- | --- | --- | --- |
| `br-shy-cloud-agi9o4kv` / `backup-pre-migration-20261012` / padre `main` | `.anclora/PRODUCTION_RUNTIME.md` §12, `.anclora/AOS_ADOPTION.md` L153, `28-gates-evidence-checklist-v1.md` L25, `02_TECHNICAL_AUDIT.md` L174 | **Histórica (Run #1, 2026-10-12)** | **Conservar intacta** como registro histórico inmutable de Run #1 (`43133125412` reporta `state: "archived"`, `parentId: "br-empty-forest-ag9p7l45"`, `createdAt: "2026-10-12T19:48:08Z"`) |
| Operativa de backup / preflight Fase 2 (`docs/PRODUCTION_DB_IDENTITY_PREFLIGHT_RUNBOOK.md` §3) | `docs/PRODUCTION_DB_IDENTITY_PREFLIGHT_RUNBOOK.md` | **Operativa** | **Actualizada localmente** con `43133125412` (`lucky-hat-25002521`, `br-gentle-bar-ag3slpph` `main`, `ep-lingering-paper-agjnrga3`), conservación de `br-empty-forest-ag9p7l45` y rechazo de `snap-late-bread-agkwpeoh` en `backup-evaluator.ts` |
| `br-empty-forest-ag9p7l45` | Ninguna referencia previa en el repo | **Operativa reemplazada** | No introducir como destino activo; conservar solo como histórico en este cierre y runbook |

---

## 6. Snapshot, opciones de recuperación y evaluación con `backup-evaluator.ts`

- **Evidencia real devuelta por Neon API en Run `43133125412` (`neon.recoveryOptions`):**
  - **Snapshot:** `id: "snap-late-bread-agkwpeoh"`, `sourceBranchId: "br-empty-forest-ag9p7l45"`, `createdAt: "2026-11-12T00:18:26Z"`, `expiresAt: null`.
  - **Backup branch histórico:** `id: "br-shy-cloud-agi9o4kv"`, `name: "backup-pre-migration-20261012"`, `parentId: "br-empty-forest-ag9p7l45"`, `createdAt: "2026-10-12T19:48:08Z"`, `state: "archived"`.
- **Evaluación fail-closed de `snap-late-bread-agkwpeoh` en `scripts/verifier/backup-evaluator.ts` (`evaluateBackupMetadata`):**
  - **Veredicto:** **NO APTO / RECHAZADO (`valid: false`)** como backup previo a la migración 27 por tres motivos independientes:
    1. **Origen en el branch reemplazado (`sourceBranch` mismatch):** `snap-late-bread-agkwpeoh` tiene `sourceBranchId: "br-empty-forest-ag9p7l45"`, mientras el branch productivo activo actual es `br-gentle-bar-ag3slpph` (`main`) -> `backup source branch mismatch: br-empty-forest-ag9p7l45 != br-gentle-bar-ag3slpph` (y `!= main`).
    2. **Frescura / decisión abierta `OD-03`:** sin umbral explícito `maxAllowedAgeMs`, `evaluateBackupMetadata` falla cerrado con `backup freshness threshold is not configured (no default: decision OD-03 is open)`; incluso evaluado frente a una ventana de 60 minutos, `2026-11-12T00:18:26Z` excede la antigüedad permitida (`backup is too old (exceeds authorized freshness threshold of 60 minutes prior to dispatch)`).
    3. **Ausencia de `status: "ready"` en `recoveryOptions.snapshots`:** el contrato `BackupMetadata` exige `status: "ready"`, dato que el listado de snapshots de Neon API devuelto en el artefacto no aporta explícitamente.
- **Procedimiento estándar de recuperación futuro (sin mutar datos durante Q1):**
  - Antes de la ventana de migración 27 o ante cualquier necesidad futura de rollback: crear un snapshot o branch de recuperación nuevo y verificado en estado `ready` directamente sobre `br-gentle-bar-ag3slpph` (`main`), conservar `br-empty-forest-ag9p7l45` hasta validar estabilidad completa (eliminación manual exclusivamente por el propietario) y revalidar `production-db-identity-preflight.yml` si cambia el endpoint o el branch primario.

---

## 7. Alcance real de `IDENTITY_VERIFIED` y bloqueo vigente para la migración 27

- **Lo que queda cerrado en Q1 (`POST_RESTORE_OPERATIONAL_READY` + `IDENTITY_VERIFIED`):**
  1. Destino único confirmado entre contrato (`32f07fc`), Render (`srv-d6ps41v5r7bs73dvrudg`) y Neon (`lucky-hat-25002521` / `br-gentle-bar-ag3slpph` `main` / `ep-lingering-paper-agjnrga3`).
  2. Salud HTTP pública y métricas/logs de Render sin incidencias activas.
  3. Integridad del ledger `_prisma_migrations` (`26` aplicadas, `9` equivalencias CRLF aceptadas, `8` rollbacks resueltos, `0` discrepancias, `1` migración 27 pendiente).
- **Lo que NO queda autorizado (`IDENTITY_VERIFIED` != autorización de migración 27):**
  - La ejecución de la migración 27 (`20261111211500_add_modular_health_plan_catalog_and_optional_identity`) y cualquier `PROMOTE=FULL` **permanecen bloqueadas** hasta completar:
    1. Generación de un backup/snapshot fresco con `status: "ready"` anclado al branch productivo activo `br-gentle-bar-ag3slpph` (`main`).
    2. Definición explícita del umbral `OD-03` y ejecución de `scripts/verifier/operator-preflight.ts` obteniendo `READY_FOR_HUMAN_AUTHORIZATION`, `preflight_report_sha256` y `backup_reference`.
    3. Disparo manual y aprobación humana de `.github/workflows/production-migrations.yml` en `production-migrations` con emisión de `MigrationAttestationV1` (OIDC/Sigstore).

