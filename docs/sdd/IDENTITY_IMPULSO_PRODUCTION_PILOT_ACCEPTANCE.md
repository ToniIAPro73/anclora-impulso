# ANCLORA IDENTITY → IMPULSO — PRODUCTION PILOT ACCEPTANCE

**Fecha:** 2026-11-22  
**Estado global:** `PRODUCTION_PILOT_ACCEPTED`  
**Documento maestro:** [`IDENTITY_IMPULSO_INTEGRATION_MASTER.md`](./IDENTITY_IMPULSO_INTEGRATION_MASTER.md)

---

## 1. Resumen de gates productivos

| Gate | Estado | Detalle |
| --- | --- | --- |
| `PUBLISH_DEVELOPMENT_CI` | **PASS** | `anclora-identity` `3424edce4d1ca56b2d336343f9558bf9e80546f6` (`CI` PASS) y `anclora-impulso` `3ff9475f59d4eab462472cc2e1b580bbf79af32e` (`test-backend` + `test-frontend` PASS) |
| `IDENTITY_DISCOVERY_JWKS` | **PASS** | `/.well-known/openid-configuration` y `/jwks` (`RS256`) operativos en `anclora-identity.anclora.com` |
| `MIGRATION_ENVIRONMENT_READY` | **PASS** | Environment `production-migrations` con `required_reviewers: ToniIAPro73`, `NEON_API_KEY`, `PRODUCTION_MIGRATION_DATABASE_URL`, `NEON_PROJECT_ID=lucky-hat-25002521` |
| `PILOT_SCOPE_RESTRICTION` | **PASS** | Allowlist fail-closed (`ANCLORA_IDENTITY_PILOT_ALLOWED_SUBJECTS=https://anclora-identity.anclora.com|a1af8bcc-ac83-4f28-8f03-c8accbba75d3`), `ANCLORA_IDENTITY_AUTO_PROVISION=false` y cierre precomercial de registro público (`PUBLIC_SIGNUP_ENABLED=false` / `NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED=false`) |
| `MIGRATION_STATUS_VERIFIED` | **PASS** | Backup OD-03 Neon `br-red-moon-ag4fbqlw`, preflight `READY_FOR_HUMAN_AUTHORIZATION` y `.github/workflows/production-migrations.yml` ejecutado y aprobado en `3ff9475f59d4eab462472cc2e1b580bbf79af32e` (`20261113103000_add_identity_links` aplicada, 29/29) |
| `OIDC_CONFIGURATION_VERIFIED` | **PASS** | `IMPULSO_CLIENT_SECRET` e `IMPULSO_REDIRECT_URIS` cargados en Vercel Identity Prod; `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH=true` en Vercel Impulso Prod; `ANCLORA_IDENTITY_*` activos en Render |
| `DEPLOYED_SHAS_MATCH_PILOT` | **PASS** | `anclora-identity` (`3424edce`) y `anclora-impulso` (`3ff9475f`) promovidos vía `promote.yml` (`development → staging → production → main`) |
| `PRODUCTION_E2E` | **PASS** | Autenticación OIDC en `anclora-identity.anclora.com`, vinculación explícita (`IdentityLink`) y acceso autenticado verificados en vivo con el sujeto piloto autorizado (`a1af8bcc-ac83-4f28-8f03-c8accbba75d3`) |

---

## 2. SHAs, CI y servicios productivos

| Repositorio | SHA promovido (`development` → `main`) | Servicio productivo |
| --- | --- | --- |
| `anclora-identity` | `3424edce4d1ca56b2d336343f9558bf9e80546f6` | Vercel Prod (`https://anclora-identity.anclora.com`) |
| `anclora-impulso` | `3ff9475f59d4eab462472cc2e1b580bbf79af32e` | Vercel Prod (`https://anclora-impulso.vercel.app`) + Render `srv-d6ps41v5r7bs73dvrudg` (`https://anclora-impulso.onrender.com`) |

---

## 3. Migración y backup OD-03 ejecutados

- **Proyecto / Rama / Endpoint:** `lucky-hat-25002521` / `br-gentle-bar-ag3slpph` / `ep-lingering-paper-agjnrga3` (`neondb`).
- **Backup OD-03 utilizado:** rama Neon `br-red-moon-ag4fbqlw`.
- **Migración aplicada:** `20261113103000_add_identity_links` (`identity_links` + `identity_link_audits`) mediante `.github/workflows/production-migrations.yml` con aprobación humana en `production-migrations`.

---

## 4. Configuración operativa vigente (sin secretos)

- **`anclora-identity` (Vercel Prod):** `IMPULSO_CLIENT_SECRET` y `IMPULSO_REDIRECT_URIS=https://anclora-impulso.onrender.com/api/auth/anclora-identity/callback`.
- **`anclora-impulso` (Vercel Prod):** `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH=true`; `NEXT_PUBLIC_PUBLIC_SIGNUP_ENABLED` sin activar (registro público cerrado).
- **`anclora-impulso` (Render Prod):**
  - `ANCLORA_IDENTITY_ENABLED=true`
  - `ANCLORA_IDENTITY_ISSUER_URL=https://anclora-identity.anclora.com`
  - `ANCLORA_IDENTITY_CLIENT_ID=anclora-impulso`
  - `ANCLORA_IDENTITY_REDIRECT_URI=https://anclora-impulso.onrender.com/api/auth/anclora-identity/callback`
  - `ANCLORA_IDENTITY_AUTO_PROVISION=false`
  - `ANCLORA_IDENTITY_PILOT_ALLOWED_SUBJECTS=https://anclora-identity.anclora.com|a1af8bcc-ac83-4f28-8f03-c8accbba75d3`
  - `PUBLIC_SIGNUP_ENABLED` sin activar (`403 PUBLIC_SIGNUP_DISABLED`).
  - *Nota de dominio:* El retorno OAuth usa `FRONTEND_URL` (`anclora-impulso.vercel.app`); mantener alineado el origen de inicio y retorno para conservar `sessionStorage` PKCE.

---

## 5. Plan de rollback

1. Fijar `ANCLORA_IDENTITY_ENABLED=false` en Render y `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH=false` en Vercel.
2. Mantener `ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH=true` solo si se requiere acceso de emergencia previo al cutover final.
3. Conservar `identity_links`, `identity_link_audits` y la migración aplicada.
