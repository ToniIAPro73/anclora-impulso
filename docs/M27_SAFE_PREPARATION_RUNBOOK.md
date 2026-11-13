# Runbook de Preparación Segura Pre-Migración 27 (OD-03 + Backup Gate)

- **Migración objetivo:** `20261111211500_add_modular_health_plan_catalog_and_optional_identity`
- **Estado operativo actual:** `M27_APPLIED_ATTESTED_SCHEMA_VERIFIED` *(ejecutada en producción el `2026-11-12T19:25Z`, workflow `43289233813`, commit `9a120a63429234136a3a65d5f77455e4dc1c485e`, proyecto Neon `lucky-hat-25002521` / branch `br-gentle-bar-ag3slpph`, backup `br-odd-fire-agtnhm44` OD-03 PASS 364s, ledger 27 aplicadas / 8 rollbacks históricos resueltos / 0 pendientes, artefacto `13977250508`; **no volver a lanzar**)*.

## 0. Separación estricta de estados (cierre post-M27 e historial previo)

- **Estado operativo actual (post-M27):** **`M27_APPLIED_ATTESTED_SCHEMA_VERIFIED`**.
- **Historial previo preservado (pre-ejecución):**
  - **Política `OD-03` (`D-2026-0056`):** **APROBADA** el `2026-11-12` por `ToniIAPro73` (`MAX_BACKUP_AGE_MINUTES=30`, `MAX_FUTURE_CLOCK_SKEW_MS=60000`).
  - **Implementación local del Backup Gate:** **VALIDADA** en `development` (evaluadores, `verify-production-backup.mjs`, `production-migrations.yml`, `emit-migration-attestation.mjs` y suites locales).
  - **Implementación remota en GitHub (`origin/development`):** **AÚN NO PUBLICADA** (en el momento del cierre previo).
  - **Gate productivo en `.anclora/PRODUCTION_RUNTIME.md`:** **AÚN NO ACTIVADO** en el corte previo (`MIGRATION_BACKUP_GATE_POLICY=OD-03_APPROVED_PENDING_ACTIVATION`).
  - **Backup válido pre-M27 en Neon:** **TODAVÍA NO CREADO** en el corte previo; posteriormente creado y validado (`br-odd-fire-agtnhm44`, antigüedad 364s, OD-03 PASS).
  - **Migración 27:** **TODAVÍA NO AUTORIZADA** en el corte previo; posteriormente autorizada, ejecutada y atestada en `43289233813`.

---

## 1. Identificadores productivos verificados (Q1 Run `43133125412`)

- **Proyecto Neon:** `lucky-hat-25002521` (`DATABASE_NEON_PROJECT_ID`)
- **Branch productivo activo (inmutable):** `br-gentle-bar-ag3slpph` (`name: "main"`, `DATABASE_NEON_PRODUCTION_BRANCH_ID`)
- **Endpoint directo productivo:** `ep-lingering-paper-agjnrga3` (`DATABASE_NEON_ENDPOINT_ID`)
- **Fingerprint contractual:** `sha256:29eb57cb9705d468d83e82fb873f7cc9c40fe0a4fdfad7840def716a538b9cb6`
- **Snapshot rechazado como backup pre-M27:** `snap-late-bread-agkwpeoh` (anclado al branch sustituido `br-empty-forest-ag9p7l45`, sin `status: "ready"` confirmado y caducado)

---

## 2. Reglas de seguridad irrenunciables antes de M27

1. **No mutar `br-gentle-bar-ag3slpph` (`main`) ni `ep-lingering-paper-agjnrga3`** durante la preparación de backup ni en pruebas.
2. **No usar `snap-late-bread-agkwpeoh` ni `br-empty-forest-ag9p7l45`** como punto de recuperación de M27.
3. **No usar el propio `br-gentle-bar-ag3slpph` como `backup_reference`**: debe crearse una evidencia de backup separada e inmutable antes de la ventana.
4. **Simulacros automáticos prohibidos en producción:** no ejecutar restores contra producción ni simulacros automáticos sin proyecto/destino aislado verificado.

---

## 3. Protocolo exacto para preparar y ejecutar M27 (solo tras aprobación expresa)

1. **Publicación previa y activación contractual del gate (solo cuando Toni lo autorice):**
   - Publicar `anclora-governance`, `anclora-infrastructure` y `anclora-impulso` en `origin/development` tras autorización de `commit y push ok` (y sincronizar `G39` en `promote.yml` cuando se autorice paridad multirepo).
   - En `.anclora/PRODUCTION_RUNTIME.md` de `anclora-impulso`, activar `MIGRATION_MAX_BACKUP_AGE_MINUTES=30` y actualizar `MIGRATION_BACKUP_GATE_POLICY=OD-03_ENFORCED_MAX_30M`, publicándolo en `origin/development` con CI verde.
2. **Preflight read-only de identidad actualizado (si hubo cambios previos):**
   - Confirmar `.github/workflows/production-db-identity-preflight.yml` en `IDENTITY_VERIFIED`, `ep-lingering-paper-agjnrga3` ligado a `br-gentle-bar-ag3slpph`, y migración 27 única pendiente.
3. **Creación controlada del backup inmutable (justo antes de despachar M27):**
   - En **Neon Console** (o CLI autenticada con permiso específico del operador, fuera de CI), crear un **branch de recuperación inmutable `br-...`** cuyo branch padre sea explícitamente `br-gentle-bar-ag3slpph` (p. ej. `backup-pre-m27-YYYYMMDD-HHMM`), sin mover `main` ni reasignar endpoints.
   - Comprobar en Neon que el nuevo `br-...` alcanza `current_state: "ready"`, `parent_id === "br-gentle-bar-ag3slpph"`, y anotar su `id` y `created_at` UTC exacto (recomendado **sin endpoint propio o en estado inmutable solo-lectura**, conservando evidencia).
   - **Nota sobre `/snapshots`:** si se intentase usar un `snap-...`, solo pasará el gate si Neon devuelve estado explícito `"ready"`; dado que Neon `/snapshots` omitió `status` en Q1, **el mecanismo recomendado y verificado es el branch inmutable `br-...` con `current_state: "ready"`**.
4. **Preflight offline del operador (`operator-preflight.ts`):**
   - Ejecutar en un checkout limpio del commit candidato:
     ```bash
     ./backend/node_modules/.bin/tsx scripts/verifier/operator-preflight.ts \
       --ledger <ledger.json> --backup <backup.json> \
       --project-id lucky-hat-25002521 \
       --source-branch br-gentle-bar-ag3slpph \
       --endpoint-id ep-lingering-paper-agjnrga3 \
       --max-backup-age-minutes 30 \
       --baseline-count 26
     ```
   - Verificar salida `READY_FOR_HUMAN_AUTHORIZATION` y copiar `report-sha256`.
5. **Dispatch manual de `production-migrations.yml` dentro de los 30 minutos:**
   - Disparar `.github/workflows/production-migrations.yml` sobre el commit publicado de `development` con `backup_confirmed=true`, `ledger_reviewed=true`, `backup_reference=<nuevo br-...>`, `preflight_report_sha256=<64-hex>`.
   - Aprobar el Environment `production-migrations` **con margen suficiente dentro de los 30 minutos desde `created_at` del backup**.
   - El step `Verify live Neon target identity and backup freshness (OD-03, read-only)` validará automáticamente en el runner, **antes** de `prisma migrate deploy`, la identidad `DATABASE_URL` + endpoint + proyecto + branch `br-gentle-bar-ag3slpph` + estado `"ready"` en Neon + edad `<= 30m` frente al reloj UTC actual, emitiendo `backup-verification.json` e integrándolo en `MigrationAttestationV1`.

---

## 4. Condiciones de parada inmediata (`ABORT` / `BLOCKED`)

Detener de inmediato el despliegue y **NO reintentar sin nueva evidencia** si ocurre cualquiera de estas condiciones:
- `verify-production-backup.mjs` falla con `BACKUP_GATE_BLOCKED_OD03_UNAPPROVED`, `BACKUP_GATE_ENDPOINT_BRANCH_SWAP_DETECTED`, `BACKUP_STALE` (>30 min entre creación y aprobación/ejecución) o `BACKUP_STATUS_UNVERIFIABLE_FROM_PROVIDER`.
- El Environment tarda más de 30 minutos en aprobarse -> **rechazar/cancelar el run pendiente** si expiró la ventana, crear un backup `br-...` fresco y repetir pasos 4–5.
- Si `prisma migrate deploy` fallara por cualquier motivo: inspeccionar `_prisma_migrations` en read-only, validar integridad y escalar al propietario usando el branch `br-...` recién creado como punto de referencia humano (nunca restaurar automáticamente).

