# ANCLORA IDENTITY → IMPULSO — PRODUCTION PILOT ACCEPTANCE

**Fecha:** 2026-11-13  
**Estado global:** `IDENTITY_IMPULSO_PRODUCTION_RELEASE_BLOCKED` (**no** `PRODUCTION_PILOT_ACCEPTED`)  
**Documento maestro:** [`IDENTITY_IMPULSO_INTEGRATION_MASTER.md`](./IDENTITY_IMPULSO_INTEGRATION_MASTER.md)

---

## 1. Resumen de gates productivos

| Gate | Estado | Detalle |
| --- | --- | --- |
| `PUBLISH_DEVELOPMENT_CI` | **PASS** | `anclora-identity` `f8554dddf61d25fc7cc4f62cf67ffca25e3e674b` (`CI` PASS) y `anclora-impulso` `1ca4f496aecd77aafe90d5272a8afde6742f97e3` (`test-backend` + `test-frontend` PASS); Previews Ready en Vercel |
| `IDENTITY_DISCOVERY_JWKS` | **PASS** | `/.well-known/openid-configuration` y `/jwks` (`RS256`, `kid: 4f12c3ff989620a5`) HTTP 200 en `anclora-identity.anclora.com` |
| `MIGRATION_ENVIRONMENT_READY` | **PASS** | Environment `production-migrations` (`branch_policy` + `required_reviewers: ToniIAPro73`), secretos `NEON_API_KEY` y `PRODUCTION_MIGRATION_DATABASE_URL`, variable `NEON_PROJECT_ID=lucky-hat-25002521`; manifiesto `29 migrations` OK |
| `PILOT_SCOPE_RESTRICTION` | **PASS (LOCAL READY)** | Allowlist backend fail-closed (`ANCLORA_IDENTITY_PILOT_ALLOWED_SUBJECTS` + `ANCLORA_IDENTITY_PILOT_BOOTSTRAP_EMAILS` solo en `/link/init` -> callback) y `ANCLORA_IDENTITY_AUTO_PROVISION=false` por defecto |
| `MIGRATION_STATUS_VERIFIED` | **BLOCKED (PENDING APPLY)** | `npx prisma migrate status` contra Neon `ep-lingering-paper-agjnrga3`: 28 aplicadas, `20261113103000_add_identity_links` pendiente; requiere backup OD-03 fresco (<=30m) y ejecución manual de `production-migrations.yml` |
| `OIDC_CONFIGURATION_VERIFIED` | **FAIL (VARS ABSENT)** | Faltan `IMPULSO_CLIENT_SECRET` y `IMPULSO_REDIRECT_URIS` en Vercel Identity Prod, `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH` en Vercel Impulso Prod y `ANCLORA_IDENTITY_*` en Render |
| `DEPLOYED_SHAS_MATCH_PILOT` | **FAIL (NOT PROMOTED)** | `staging`/`production`/`main` siguen en `3a506db8` (Identity) y `b0b28441` (Impulso Vercel) / `fbc2f4d8` (Impulso Render) |
| `PRODUCTION_E2E` | **NOT_RUN** | Bloqueado hasta ejecutar configuración, `PROMOTE=FULL` y migración protegida |

---

## 2. SHAs, CI y estado de servicios

| Repositorio | `development` (CI + Preview) | `staging` / `production` / `main` | Servicio productivo |
| --- | --- | --- | --- |
| `anclora-identity` | `f8554dddf61d25fc7cc4f62cf67ffca25e3e674b` (`CI` `43405035890`: `success`; Preview `anclora-identity-7t93ddnx3-...` Ready) | `3a506db8f1a754d48f2ed01f7002847c05163c77` | Vercel Prod (`anclora-identity-arbtdd378-...`, hace 14d). Acumulados `3a506db8..f8554dd`: `ba5faa5`, `c8ed7f8`, `f8554dd` (compatibles con Resend y clientes previos) |
| `anclora-impulso` | `1ca4f496aecd77aafe90d5272a8afde6742f97e3` (`CI` `43409561355`: `success`; Preview `anclora-impulso-4d1g0vov5-...` Ready) | `b0b284417861343d5620236335d21a5d260bb97d` | Vercel Prod (`anclora-impulso-xwp1jsqjv-...`); Render `srv-d6ps41v5r7bs73dvrudg` (`dep-dbrarplg1s2s73fusm7g`, commit `fbc2f4d8`) |

---

## 3. Entorno de migraciones, backup OD-03 y ledger Neon

- **Proyecto / Rama / Endpoint:** `lucky-hat-25002521` / `br-gentle-bar-ag3slpph` / `ep-lingering-paper-agjnrga3` (`neondb`, schema `public`).
- **Ledger Prisma (`npx prisma migrate status`, solo lectura):** 29 migraciones en `backend/prisma/migrations`, **28 aplicadas**, **`20261113103000_add_identity_links` pendiente** (sin migraciones inesperadas).
- **Manifiesto (`verify-release-manifest.mjs`):** `manifest ok: 29 migrations; newest is 20261113103000_add_identity_links`, SHA-256 `32accbc9868acbc70cef3fb427b2e25eb620b27f3f8d21b7c133b5fb54a4adb7`.
- **GitHub Environment `production-migrations`:**
  - Reglas activas: `branch_policy` + `required_reviewers` (`ToniIAPro73`). `custom_deployment_protection_rules`: `0` (modelo P1 humano vigente; GitHub App diferida a P2).
  - Secretos presentes (solo nombres): `NEON_API_KEY`, `PRODUCTION_MIGRATION_DATABASE_URL`.
  - Variable de entorno: `NEON_PROJECT_ID=lucky-hat-25002521`.
- **Precondiciones de backup OD-03 y preflight de operador:**
  1. Crear snapshot/branch de backup fresco en Neon sobre `br-gentle-bar-ag3slpph` **con antigüedad máxima de 30 minutos** respecto al disparo de `production-migrations.yml` (las referencias históricas como `br-odd-fire-agtnhm44` no son válidas).
  2. Exportar en solo lectura `ledger.json` y `backup.json` y ejecutar localmente `tsx scripts/verifier/operator-preflight.ts --ledger ... --backup ... --project-id lucky-hat-25002521 --source-branch br-gentle-bar-ag3slpph --endpoint-id ep-lingering-paper-agjnrga3 --max-backup-age-minutes 30 --baseline-count 28` sobre el checkout de `1ca4f496aecd77aafe90d5272a8afde6742f97e3` para obtener `READY_FOR_HUMAN_AUTHORIZATION` y su `preflight_report_sha256`.
  3. Despachar `.github/workflows/production-migrations.yml` desde `development` (`1ca4f496aecd77aafe90d5272a8afde6742f97e3`), aprobar como revisor en `production-migrations` y verificar `MigrationAttestationV1` + artefacto `migration-attestation`.

---

## 4. Variables OIDC ausentes / requeridas (sin secretos)

### `anclora-identity` (Vercel Production `prj_MsuRe7VXcrE81WCpGEpl2IXv6Vwi`)
- `IMPULSO_CLIENT_SECRET`: **AUSENTE**
- `IMPULSO_REDIRECT_URIS`: **AUSENTE** (`https://anclora-impulso.onrender.com/api/auth/anclora-identity/callback`)

### `anclora-impulso` (Vercel Production)
- `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH`: **AUSENTE** (default `false`; mantener `false` hasta activar piloto)

### `anclora-impulso` (Render `srv-d6ps41v5r7bs73dvrudg`)
- Configurar antes o junto al despliegue manteniendo Identity deshabilitado inicialmente:
  - `ANCLORA_IDENTITY_ENABLED=false` (subir a `true` solo en activación piloto)
  - `ANCLORA_IDENTITY_ISSUER_URL=https://anclora-identity.anclora.com`
  - `ANCLORA_IDENTITY_CLIENT_ID=anclora-impulso`
  - `ANCLORA_IDENTITY_CLIENT_SECRET=<secreto compartido>`
  - `ANCLORA_IDENTITY_REDIRECT_URI=https://anclora-impulso.onrender.com/api/auth/anclora-identity/callback`
  - `ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH=true`
  - `ANCLORA_IDENTITY_AUTO_PROVISION=false`
  - `ANCLORA_IDENTITY_PILOT_BOOTSTRAP_EMAILS=<email verificado piloto para primera admisión>`
  - `ANCLORA_IDENTITY_PILOT_ALLOWED_SUBJECTS=` (completar con `<issuer>|<sub>` tras la primera vinculación y vaciar `BOOTSTRAP_EMAILS`)

---

## 5. Secuencia operativa definitiva (alineada con contratos AOS)

1. **Configuración previa de Identity:** cargar `IMPULSO_CLIENT_SECRET` e `IMPULSO_REDIRECT_URIS` en Vercel Production de `anclora-identity`.
2. **Promoción protegida de Identity:** autorización `PROMOTE=FULL` para `anclora-identity` (`f8554dddf61d25fc7cc4f62cf67ffca25e3e674b`).
3. **Verificación del proveedor en producción:** comprobar `/.well-known/openid-configuration`, `/jwks` y que `anclora-identity.anclora.com` atiende el cliente `anclora-impulso`.
4. **Backup fresco de Neon y migración Impulso:** crear snapshot Neon OD-03 (`<=30m`), ejecutar `operator-preflight.ts` y despachar `.github/workflows/production-migrations.yml` sobre `1ca4f496aecd77aafe90d5272a8afde6742f97e3` (**obligatorio antes de promover Impulso**, por `MIGRATIONS_PRECEDE_BACKEND_DEPLOY=true`).
5. **Verificación del ledger y `MigrationAttestationV1`:** confirmar `29 applied / 0 pending` en `npx prisma migrate status` y artefacto `migration-attestation`.
6. **Configuración previa de Impulso (flags en `false`):** cargar variables `ANCLORA_IDENTITY_*` en Render con `ANCLORA_IDENTITY_ENABLED=false`, `ANCLORA_IDENTITY_AUTO_PROVISION=false`, `ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH=true` y `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH=false` en Vercel.
7. **Promoción protegida de Impulso:** autorización `PROMOTE=FULL` para `anclora-impulso` (`1ca4f496aecd77aafe90d5272a8afde6742f97e3`).
8. **Activación restringida del piloto:** fijar `ANCLORA_IDENTITY_PILOT_BOOTSTRAP_EMAILS=<email_piloto>`, `ANCLORA_IDENTITY_ENABLED=true` en Render y `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH=true` en Vercel.
9. **E2E productivo y primera admisión:** iniciar sesión con cuenta QA/propietario por método actual → `POST /api/auth/anclora-identity/link/init` → callback OIDC → comprobar `IdentityLink` + `LINKED` + sesión/navegación/permisos/logout → fijar `ANCLORA_IDENTITY_PILOT_ALLOWED_SUBJECTS=<issuer>|<sub>` y vaciar `ANCLORA_IDENTITY_PILOT_BOOTSTRAP_EMAILS`.
10. **Cierre o rollback:** si todo pasa, emitir aceptación productiva; ante cualquier incidencia, poner `ANCLORA_IDENTITY_ENABLED=false` y `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH=false` manteniendo `ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH=true`.

---

## 6. Evidencia E2E productivo y rollback

- **Identidad piloto anonimizada / E2E productivo / Logout:** `NOT_RUN` (bloqueado hasta pasos 1–8).
- **Plan de rollback:** desactivar flags `ANCLORA_IDENTITY_ENABLED=false` y `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH=false`; conservar `identity_links`, `identity_link_audits` y migración aplicada.
