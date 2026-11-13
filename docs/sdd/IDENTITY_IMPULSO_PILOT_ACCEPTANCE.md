# ANCLORA IDENTITY — IMPULSO OIDC PILOT ACCEPTANCE

**Documento maestro:** [`IDENTITY_IMPULSO_INTEGRATION_MASTER.md`](./IDENTITY_IMPULSO_INTEGRATION_MASTER.md)  
**Última actualización:** 2026-11-13

---

## Estado de gates

| Gate | Estado | Evidencia |
| --- | --- | --- |
| `IDENTITY_BASELINE_VERIFIED` | **PASS** | Discovery + JWKS en vivo (`anclora-identity.anclora.com`), 98/98 tests locales |
| `IMPULSO_AUTH_AUDITED` | **PASS** | Auditoría completa de `auth.routes.ts`, `auth.controller.ts`, `oauth.controller.ts`, `session.service.ts`, Prisma y frontend |
| `SUPABASE_LEGACY_CLEANUP_VERIFIED` | **PASS** | 0 dependencias `@supabase/*`; `e2e/auth-oauth.spec.ts`, `oauth-flags.test.ts` y `DEPLOY.md` saneados (`.env.local.example` pendiente de chequeo manual por guard `.env*`) |
| `IMPULSO_OIDC_PILOT_IMPLEMENTED_LOCAL` | **PASS** | Cliente `anclora-impulso` en Identity + RP OIDC + `IdentityLink` + `release-manifest.json` |
| `IDENTITY_IMPULSO_PREFLIGHT_PASS` | **PASS** | `pnpm install --frozen-lockfile`, `verify-release-manifest.mjs`, typecheck, lint, builds y suites completas PASS |
| `IDENTITY_LINKING_VERIFIED` | **PASS** | Probado en `anclora-identity-oidc.test.ts` y `anclora-identity-oidc-e2e.test.ts` (sin auto-link por email; link/unlink autenticado con auditoría) |
| `AUTHORIZATION_ISOLATION_PASS` | **PASS** | Membership `anclora-impulso` / `GROUP_OWNER` exigido; `isAdmin` aislado en `ADMIN_USER_IDS`; revocación en logout verificada |
| `OIDC_E2E_PASS` | **PASS (LOCAL)** | Tests E2E HTTP locales contra IdP RS256 efímero + Prisma en memoria; **BLOCKED** en vivo contra Neon/prod por falta de autorización de despliegue/migración |
| `IDENTITY_PILOT_ACCESS_CONTROL_READY` | **PASS (LOCAL)** | Allowlist backend fail-closed (`issuer\|sub` + bootstrap email solo en `/link/init`), `ANCLORA_IDENTITY_AUTO_PROVISION=false` por defecto, aplicada en inicio, callback, vinculación y `/oauth/exchange` |
| `DEPLOYMENT_PLAN_READY` | **PASS** | Secuencia de 11 pasos validada contra `promote.yml` y `production-migrations.yml` |
| `IMPULSO_OIDC_PILOT_QA_PASS` | **PENDING** | Requiere variables de entorno en Vercel/Render y migración `20261113103000_add_identity_links` aplicada |
| `IDENTITY_CUTOVER_PENDING` | **PENDING** | Bloqueado hasta `IMPULSO_OIDC_PILOT_QA_PASS` y decisión de modelo de admisión |

---

## Criterios verificables de aceptación

### 1. Dependencias y protocolo OIDC
- [x] `openid-client` `^6.8.9` y `jose` `^6.2.17` verificados con `pnpm install --frozen-lockfile` y `pnpm-workspace.yaml`.
- [x] `anclora-identity` expone discovery `.well-known/openid-configuration` y `/jwks` (`RS256`) en producción.
- [x] Cliente `anclora-impulso` registrado en `anclora-identity` con `authorization_code`, `PKCE` (`S256`) obligatorio y `client_secret_basic` (fail-closed sin `IMPULSO_REDIRECT_URIS`).
- [x] `anclora-impulso` valida `state`, `PKCE`, `nonce`, firma JWKS (`jose.jwtVerify`), `iss`, `aud`, `exp` y `email_verified === true`.

### 2. Vinculación segura y aislamiento de datos
- [x] Modelo `IdentityLink` con restricción `@@unique([issuer, subject])`, migración `20261113103000_add_identity_links` y `release-manifest.json` sincronizado.
- [x] Prohibida la vinculación automática por coincidencia de email (`link_requires_original_method` + auditoría `LOGIN_DENIED`).
- [x] Vinculación explícita autenticada mediante `linkToken` HMAC-SHA256 de 5 minutos y auditoría `LINKED` / `UNLINKED`.
- [x] `GROUP_OWNER` y `PLATFORM_ADMIN` de Identity nunca conceden `isAdmin` local en Impulso (`ADMIN_USER_IDS`).

### 3. Feature flags y rollback
- [x] Rollback inmediato mediante `ANCLORA_IDENTITY_ENABLED=false` o `ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH=true`.
- [x] Modo fail-closed verificado (`409 ANCLORA_IDENTITY_ENABLED`) cuando `ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH=false`.

### 4. QA en entorno desplegado (pendiente de autorización)
- [ ] Migración `20261113103000_add_identity_links` ejecutada en Neon mediante `production-migrations.yml`.
- [ ] Login E2E real contra `https://anclora-identity.anclora.com` con cuenta autorizada.
- [ ] Verificación de denegación para usuario sin membership `anclora-impulso`.
- [ ] Verificación de vinculación y desvinculación sobre cuenta existente sin pérdida de datos deportivos/nutricionales.
