# ANCLORA IDENTITY → IMPULSO — PRODUCTION PILOT ACCEPTANCE

**Fecha:** 2026-11-13  
**Estado global:** `PREFLIGHT_EXECUTED_WITH_BLOCKERS` (**NO** `PRODUCTION_PILOT_ACCEPTED`)  
**Documento maestro:** [`IDENTITY_IMPULSO_INTEGRATION_MASTER.md`](./IDENTITY_IMPULSO_INTEGRATION_MASTER.md)

---

## 1. Resumen de gates productivos

| Gate | Estado | Detalle |
| --- | --- | --- |
| `MIGRATION_STATUS_VERIFIED` | **PASS (PENDING APPLY)** | `npx prisma migrate status` contra Neon `ep-lingering-paper-agjnrga3` confirma 28 aplicadas y `20261113103000_add_identity_links` pendiente |
| `IDENTITY_DISCOVERY_JWKS` | **PASS** | `/.well-known/openid-configuration` y `/jwks` (`RS256`, `kid: 4f12c3ff989620a5`) HTTP 200 en `anclora-identity.anclora.com` |
| `DEPLOYED_SHAS_MATCH_PILOT` | **FAIL / BLOCKED** | `staging`/`production`/`main` siguen en `3a506db8` (Identity) y `b0b28441` (Impulso Vercel) / `fbc2f4d8` (Impulso Render); `f8554dd` y `92dc4cb` solo están en `development` |
| `OIDC_CONFIGURATION_VERIFIED` | **FAIL (VARS ABSENT)** | Faltan `IMPULSO_CLIENT_SECRET` y `IMPULSO_REDIRECT_URIS` en Vercel Identity Prod, `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH` en Vercel Impulso Prod, y variables `ANCLORA_IDENTITY_*` en Render |
| `PILOT_SCOPE_RESTRICTION` | **PASS (LOCAL READY)** | Allowlist backend fail-closed (`ANCLORA_IDENTITY_PILOT_ALLOWED_SUBJECTS` + `ANCLORA_IDENTITY_PILOT_BOOTSTRAP_EMAILS` solo para `/link/init` -> callback) aplicada en inicio, callback, vinculación y sesión |
| `PRODUCTION_E2E` | **NOT_RUN** | Bloqueado hasta ejecutar migración, promoción `PROMOTE=FULL` y carga de variables |

---

## 2. SHAs, CI y estado de servicios

| Repositorio | `development` (CI) | `staging` / `production` / `main` | Servicio productivo |
| --- | --- | --- | --- |
| `anclora-identity` | `f8554dddf61d25fc7cc4f62cf67ffca25e3e674b` (CI `43405035890`: `success`) | `3a506db8f1a754d48f2ed01f7002847c05163c77` | Vercel Prod (`anclora-identity-arbtdd378-...`, hace 14d); Preview (`anclora-identity-7t93ddnx3-...`, hace 11m) |
| `anclora-impulso` | `92dc4cbec2ecab0f709e9578cfb6c69dd36b63e5` (CI `43405316509`: `success`) | `b0b284417861343d5620236335d21a5d260bb97d` | Vercel Prod (`anclora-impulso-xwp1jsqjv-...`, HTTP 302 en `/auth/login`); Render `srv-d6ps41v5r7bs73dvrudg` (`dep-dbrarplg1s2s73fusm7g`, commit `fbc2f4d8`, `/api/health` timeout 10s en cold-start) |

---

## 3. Discovery OIDC y JWKS en vivo (`anclora-identity.anclora.com`)

- **Discovery (`/.well-known/openid-configuration`):** `HTTP 200`
  - `issuer`: `https://anclora-identity.anclora.com`
  - `authorization_endpoint`: `https://anclora-identity.anclora.com/auth`
  - `token_endpoint`: `https://anclora-identity.anclora.com/token`
  - `jwks_uri`: `https://anclora-identity.anclora.com/jwks`
  - `end_session_endpoint`: `https://anclora-identity.anclora.com/session/end`
  - `revocation_endpoint`: `https://anclora-identity.anclora.com/token/revocation`
  - `code_challenge_methods_supported`: `["S256"]`
  - `id_token_signing_alg_values_supported`: `["RS256"]`
- **JWKS (`/jwks`):** `HTTP 200`, clave RSA `use: "sig"`, `alg: "RS256"`, `kid: "4f12c3ff989620a5"`.
- **Registro cliente `anclora-impulso` en producción:** **PENDIENTE** (requiere promover `f8554dddf61d25fc7cc4f62cf67ffca25e3e674b`).

---

## 4. Estado de Neon y migración protegida

- **Proyecto / Rama / Endpoint:** `lucky-hat-25002521` / `br-gentle-bar-ag3slpph` / `ep-lingering-paper-agjnrga3` (`neondb`, schema `public`).
- **Ledger Prisma (`npx prisma migrate status`, solo lectura):** 29 migraciones en árbol, 28 aplicadas, **`20261113103000_add_identity_links` PENDIENTE**.
- **Tablas `identity_links` e `identity_link_audits`:** aún no creadas en producción (incluyen `PRIMARY KEY`, `identity_links_issuer_subject_key` `UNIQUE (issuer, subject)`, FK `user_id -> users(id) ON DELETE CASCADE` e índices de auditoría).
- **Procedimiento protegido requerido antes de promover `anclora-impulso`:**
  1. Crear snapshot/branch de backup verificable en Neon (antigüedad máx. 30 min, política `OD-03`).
  2. Ejecutar `scripts/verifier/operator-preflight.ts` offline y obtener `preflight_report_sha256` (64 hex).
  3. Despachar manualmente `.github/workflows/production-migrations.yml` sobre el SHA de `development` (`92dc4cbec2ecab0f709e9578cfb6c69dd36b63e5`) con aprobación de required reviewers en el Environment `production-migrations` (secret `PRODUCTION_MIGRATION_DATABASE_URL` directa sin `-pooler`).
  4. Verificar manifiesto: `29 migrations`, `20261113103000_add_identity_links`, SHA-256 `32accbc9868acbc70cef3fb427b2e25eb620b27f3f8d21b7c133b5fb54a4adb7`.

---

## 5. Inventario de variables OIDC (sin valores secretos)

### `anclora-identity` (Vercel Production)
- `IMPULSO_CLIENT_SECRET`: **AUSENTE**
- `IMPULSO_REDIRECT_URIS`: **AUSENTE** (debe ser la callback URL pública de Impulso backend: `https://<backend-host>/api/auth/anclora-identity/callback`)

### `anclora-impulso` (Vercel Production)
- `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH`: **AUSENTE** (en código default `false`; mantener en `false` hasta activar el piloto)

### `anclora-impulso` (Render `srv-d6ps41v5r7bs73dvrudg`)
- `render env-vars list` no devolvió claves por CLI; verificar/configurar en Render Dashboard:
  - `ANCLORA_IDENTITY_ENABLED` (`false` inicial -> `true` en piloto)
  - `ANCLORA_IDENTITY_ISSUER_URL` (`https://anclora-identity.anclora.com`)
  - `ANCLORA_IDENTITY_CLIENT_ID` (`anclora-impulso`)
  - `ANCLORA_IDENTITY_CLIENT_SECRET` (secreto compartido con Identity)
  - `ANCLORA_IDENTITY_REDIRECT_URI` (`https://anclora-impulso.onrender.com/api/auth/anclora-identity/callback`)
  - `ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH` (`true`)
  - `ANCLORA_IDENTITY_AUTO_PROVISION` (`false` por defecto en código)
  - `ANCLORA_IDENTITY_PILOT_ALLOWED_SUBJECTS` (`<issuer>|<sub>` definitivos tras primera vinculación)
  - `ANCLORA_IDENTITY_PILOT_BOOTSTRAP_EMAILS` (email verificado piloto solo durante primera admisión vía `/link/init`, vaciar después)

---

## 6. Seguridad de vinculación y restricción de alcance piloto

- Vinculación explícita mediante `IdentityLink` (`issuer + subject`), sin vinculación automática por email (`LOGIN_DENIED` + `link_requires_original_method`), conservando `userId` y datos previos, sin escalada desde `GROUP_OWNER`/`PLATFORM_ADMIN` hacia `ADMIN_USER_IDS`.
- **Limitación detectada:** los flags actuales son globales y no restringen el acceso a una única identidad piloto. Con `ANCLORA_IDENTITY_AUTO_PROVISION=false` solo inician sesión cuentas ya vinculadas, pero el botón OIDC y `/link/init` quedarían visibles/accesibles para cualquier usuario autenticado si `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH=true`.
- **Mecanismo mínimo propuesto (pendiente de decisión):** añadir `ANCLORA_IDENTITY_PILOT_ALLOWED_EMAILS` (lista separada por comas) validada en `oauth.controller.ts` / `anclora-identity.provider.ts` para rechazar cualquier identidad fuera de la allowlist durante el piloto cerrado.

---

## 7. Evidencia E2E, autorización y logout en producción

- **Identidad piloto anonimizada:** `NOT_RUN` (pendiente de designación del propietario y prerrequisitos de despliegue).
- **E2E productivo:** `NOT_RUN` (bloqueado por migración pendiente, falta de `PROMOTE=FULL` y variables ausentes).
- **Pruebas de autorización y logout en vivo:** `NOT_RUN` (validadas localmente en `anclora-identity-oidc-e2e.test.ts`).

---

## 8. Plan de rollback inmediato

1. Fijar `ANCLORA_IDENTITY_ENABLED=false` en Render (`srv-d6ps41v5r7bs73dvrudg`) y `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH=false` en Vercel (`anclora-impulso`).
2. Mantener `ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH=true`.
3. **No** borrar filas de `identity_links` ni `identity_link_audits`, y **no** revertir la migración `20261113103000_add_identity_links`.
4. Confirmar que `POST /api/auth/login` (legacy) y `/auth/login` siguen operativos.

---

## 9. Próximas autorizaciones requeridas

1. Decisión del propietario sobre restringir alcance piloto (`ANCLORA_IDENTITY_PILOT_ALLOWED_EMAILS`) antes de activar flags, y confirmación de `ANCLORA_IDENTITY_AUTO_PROVISION=false`.
2. Backup en Neon + ejecución manual de `.github/workflows/production-migrations.yml` en `anclora-impulso` (`92dc4cbec2ecab0f709e9578cfb6c69dd36b63e5`).
3. `PROMOTE=FULL` para `anclora-identity` (`f8554dddf61d25fc7cc4f62cf67ffca25e3e674b`) y `anclora-impulso` (`92dc4cbec2ecab0f709e9578cfb6c69dd36b63e5`).
4. Carga de variables OIDC en Vercel y Render manteniendo flags en `false`, seguida de activación controlada del piloto y E2E real.

