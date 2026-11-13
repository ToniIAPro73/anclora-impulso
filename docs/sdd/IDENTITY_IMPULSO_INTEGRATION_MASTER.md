# ANCLORA IDENTITY — IMPULSO OIDC INTEGRATION MASTER

**Fecha:** 2026-11-13  
**Rama de trabajo:** `development`  
**Autoridad:** `anclora-governance` (AOS Lean / SDD + ASDD + ODD)  
**Estados alcanzados:**  
- `IDENTITY_BASELINE_VERIFIED`  
- `IMPULSO_AUTH_AUDITED`  
- `SUPABASE_LEGACY_CLEANUP_VERIFIED`  
- `IMPULSO_OIDC_PILOT_IMPLEMENTED_LOCAL`  
- `IDENTITY_IMPULSO_PREFLIGHT_PASS`  
- `IDENTITY_LINKING_VERIFIED`  
- `AUTHORIZATION_ISOLATION_PASS`  
- `OIDC_E2E_PASS` (local HTTP contra IdP efímero + Prisma en memoria; ver §12 para alcance en vivo)  
- `DEPLOYMENT_PLAN_READY`

---

## 1. Estado real de Anclora Identity

Contrastando documentación (`.anclora/PRODUCTION_RUNTIME.md`, `README.md` desactualizado), código fuente, rama `development` (`c8ed7f8`), `main` (`3a506db`) y endpoints en vivo (`https://anclora-identity.anclora.com/.well-known/openid-configuration` y `/jwks`):

| Capacidad | Estado | Evidencia verificada |
| --- | --- | --- |
| Discovery OIDC, Auth Code + PKCE (`S256`), Token, UserInfo, JWKS (`RS256`) | **DEPLOYED / VERIFIED** | Live HTTP 200 en `.well-known/openid-configuration` y `/jwks` (`kid: 4f12c3ff989620a5`); `src/oidc/provider.ts` |
| Persistencia Postgres (Neon) y migraciones `0001`–`0003` | **DEPLOYED / VERIFIED** | `db/migrations/*.sql`, `.anclora/PRODUCTION_RUNTIME.md` |
| Autenticación por contraseña (`argon2id`, mín. 12 caracteres) | **DEPLOYED / VERIFIED** | `src/security/password.ts`, `src/identity/loginService.ts` |
| Revocación de tokens (`revocation: { enabled: true }`) | **IMPLEMENTED** | `src/oidc/provider.ts` |
| Introspección de tokens | **OBSOLETE / DISABLED** | Deshabilitada por defecto en `oidc-provider` |
| RP-Initiated / Frontchannel Logout | **PARTIAL** | Endpoint `end_session` por defecto; los pilotos limpian cookie local + `prompt=login` |
| TOTP MFA (AES-256-GCM + `step_up_consumed` atómico) | **IMPLEMENTED / VERIFIED** | `src/identity/mfaEnrollmentService.ts`, `postgresRateLimitAndStepUp.test.ts` |
| Passkeys (WebAuthn) | **PARTIAL** | Helpers en `src/security/webauthn.ts` con tests unitarios; sin rutas HTTP ni UI |
| Recuperación de contraseña self-service | **BLOCKED / NOT IMPLEMENTED** | Solo enlace de soporte en `src/oidc/views.ts` y CLI `scripts/set-password.ts` |
| Ciclo de invitaciones y activación atómica | **DEPLOYED / VERIFIED** | `src/identity/invitationService.ts` (`SELECT ... FOR UPDATE`) |
| Envío Resend y endpoint `/resend` (`1edbdd0`) | **IMPLEMENTED** | En `development` (pendiente de promoción a `main`); corrige error silencioso de Resend SDK |
| Roles `qa` por aplicación y aprovisionamiento Nexus | **IMPLEMENTED / VERIFIED** | `f020f54`, `68bc7ab`, `c1aed8a`; atribución QA a `qa.nexus@anclora.local` |
| Verificación de email independiente (`verifyEmail.ts`) | **OBSOLETE / UNUSED** | Sin uso; la verificación ocurre al aceptar invitación |
| Cliente OIDC `anclora-impulso` | **IMPLEMENTED** | Registrado en `development` (`src/oidc/clients.ts`, `src/config/env.ts`, `src/bootstrap.ts`, `src/identity/applicationRoles.ts`) |

**Nota sobre alias QA y correos transaccionales:** Las cuentas `.local` (`qa.identity@anclora.local`, `qa.nexus@anclora.local`, `qa.advisor@anclora.local`) son identidades internas no entregables gestionadas por CLI. Para pruebas reales de entrega Resend se utiliza `tonipmi.test@gmail.com`.

---

## 2. Estado de Anclora Nexus

- **Login OIDC:** Implementado en `anclora-nexus/frontend/src/lib/anclora-identity/oidcClient.ts` (`openid-client`, `S256` PKCE, `state`, `prompt: 'login'`) y `callback/route.ts` (exige `hasNexusApplicationAccess`).
- **Aprovisionamiento hacia Identity:** `anclora-nexus/backend/services/identity_provisioning_service.py` consume `/api/v1/admin/identities/lookup`, `/invitations`, `/resend` y `/memberships` con `NEXUS_SERVICE_TOKEN` y fail-closed si falta configuración.
- **Impacto en este piloto:** No se ha modificado `anclora-nexus` en esta campaña.

---

## 3. Pilotos existentes

| Aplicación | `client_id` | Librería | Estado | Patrones reutilizados / mejoras aplicadas en Impulso |
| --- | --- | --- | --- | --- |
| `anclora-data-lab` | `data-lab` | `openid-client` `6.8.8` | Producción (`main`), 13/13 unit tests | `discovery(..., { timeout: 8 })`, reconstrucción de `callbackUrl`, fail-closed `404/409` al desactivar legacy |
| `anclora-guesthub` | `guesthub` | `openid-client` `^6.8.8` | Producción (`main`), 10/10 unit tests | `resolveAccess(claims)` (`GROUP_OWNER` o membership explícito), errores sanitizados |
| `anclora-nexus` | `anclora-nexus` | `openid-client` | `development` | Exigencia estricta de `email_verified === true` |
| `anclora-advisor-ai` | `anclora-advisor-ai` | `openid-client` | `development` | Separación de roles de producto vs roles globales |
| `anclora-cleansheet` / `anclora-purgedoc` | `cleansheet` / `purgedoc` | `authlib` (FastAPI) | Implementado tras flag | Callback en el backend donde se emite la sesión/cookie |

---

## 4. Arquitectura actual de Anclora Impulso

```text
[Next.js Frontend (Vercel)]
  ├── /auth/login, /auth/signup ──▶ POST /api/auth/login|register (Express)
  │                                  └── bcryptjs (10 rounds) + AuthSession + RefreshToken (HttpOnly cookie) + JWT HS256 (localStorage)
  ├── Google/GitHub buttons ──────▶ GET /api/auth/google|github?challenge=...
  │                                  └── Cookie PKCE (oauth_*_txn) -> Provider -> Callback -> OAuthHandoff -> /auth/callback#code=...
  │                                  └── POST /api/auth/oauth/exchange -> AuthSession + RefreshToken
  └── Protected routes ───────────▶ Authorization: Bearer <JWT> (localStorage) + refreshSession() single-flight

[Express Backend (Render)] ──▶ Prisma ──▶ [Neon Postgres]
  ├── authenticate: verifyAccessToken(HS256) + isSessionActive(sid, !disabledAt)
  ├── requireAdmin: ADMIN_USER_IDS (UUID allowlist out-of-band; ADMIN_EMAILS ignorado)
  └── Ownership: where: { id, userId } en servicios de workouts, progress, nutrition, sessions
```

**Participación de Supabase:** **0%** en tiempo de ejecución. No existen dependencias `@supabase/*` en `package.json`, `backend/package.json` ni `pnpm-lock.yaml`.

---

## 5. Inventario Supabase

| Ruta | Referencia | Categoría | Acción tomada / requerida |
| --- | --- | --- | --- |
| `e2e/auth-oauth.spec.ts` | Título `Supabase OAuth Contract E2E` y ruta inexistente `/login` | `NEEDS_REPLACEMENT` | Actualizado a `Anclora Impulso Auth & OIDC Contract E2E` sobre `/auth/login` |
| `__tests__/supabase-oauth.test.ts` | Nombre de fichero obsoleto | `NEEDS_REPLACEMENT` | Sustituido por `__tests__/oauth-flags.test.ts` (incluye `isAncloraIdentityEnabled`) |
| `docs/operations/DEPLOY.md` (§311–319) | Fallback `Usa Supabase` si Neon se queda sin espacio | `OBSOLETE_REMOVE` | Actualizado a contrato Neon/Prisma vigente |
| `.env.local.example` | Variables obsoletas `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `OBSOLETE_REMOVE` | Limpieza manual realizada por el propietario (junto con `.env.local`, excluido de Git); diff verificado e incluido en el commit de Impulso |
| `sdd/features/**`, `docs/anclora-master-audit/**`, `docs/roadmap/**`, `.anclora/AOS_ADOPTION.md`, `.anclora/PRODUCTION_RUNTIME.md` (§12), `MEMORY.md`, `artifacts/qa/**` | Registro histórico de migración Supabase → Neon | `HISTORICAL_KEEP` | Conservados intactos |

---

## 6. Arquitectura objetivo (Impulso como Relying Party OIDC)

1. El navegador inicia flujo con `beginOAuth('anclora-identity')` generando `verifier` + `challenge` (`S256`) en `sessionStorage`.
2. Express (`GET /api/auth/anclora-identity/login`) genera `state`, `codeVerifier` (`S256`) y `nonce` vía `openid-client` (`^6.8.9`), los guarda en cookie HttpOnly `SameSite=Lax` (`oauth_anclora_identity_txn`, `path: '/api/auth'`, 10m TTL) y redirige a `anclora-identity`.
3. `GET /api/auth/anclora-identity/callback` valida `state`, `PKCE`, `nonce`, firma JWKS criptográfica (`jose` `^6.2.17` `createRemoteJWKSet` + `jwtVerify`), `iss`, `aud`, `exp` y `email_verified === true` vía `authorizationCodeGrant` + `fetchUserInfo` best-effort.
4. `resolveImpulsoIdentityAccess(claims)` exige `GROUP_OWNER` o `application_memberships` con `'anclora-impulso'`.
5. Resuelve o vincula `IdentityLink (issuer + subject) -> User.id`, emite `OAuthHandoff` de un solo uso y redirige a `/auth/callback#code=...&provider=anclora-identity`.
6. El navegador canjea `{ code, verifier, provider }` en `POST /api/auth/oauth/exchange` y recibe la sesión estándar de Impulso (`AuthSession` + cookie `refreshToken` HttpOnly + `accessToken`).

### Correcciones detectadas en el Preflight
- **`ERR_PNPM_IGNORED_BUILDS` y `pnpm-workspace.yaml`:** `pnpm v12` generó `allowBuilds` con placeholder `'set this to true or false'`; corregido a `true` para `@prisma/client`, `@prisma/engines`, `prisma`, `esbuild` y `unrs-resolver`, y validado con `pnpm install --frozen-lockfile`.
- **Verificación JWS explícita en `id_token`:** `openid-client` v6 (`oauth4webapi`) confía en el transporte directo del `token_endpoint` para respuestas `authorization_code`; se añadió `jose` (`jwtVerify` contra `jwks_uri`) para garantizar rechazo ante firmas manipuladas.
- **`http://` local en desarrollo:** `allowInsecureRequests` habilitado **únicamente** cuando `NODE_ENV !== 'production'` y `issuerUrl` empieza por `http://`.
- **Manifiesto de migraciones (`release-manifest.json`):** Añadida `20261113103000_add_identity_links` con su SHA-256; `verify-release-manifest.mjs` pasa (`29 migrations`).
- **Compatibilidad ESM en Jest (`test:ci`):** Añadido `NODE_OPTIONS=--experimental-vm-modules` a `backend/package.json` `test:ci` para ejecutar el E2E HTTP con `openid-client` y `jose` sin mocks de protocolo.

---

## 7. Modelo de identidades y autorización

- **Tablas nuevas (`backend/prisma/schema.prisma`):**
  - `identity_links` (`id`, `user_id`, `issuer`, `subject`, `email_at_link`, `linked_via`, `created_at`, `updated_at`, `revoked_at`) con `@@unique([issuer, subject])`.
  - `identity_link_audits` (`id`, `user_id`, `issuer`, `subject`, `action`, `actor_user_id`, `reason`, `metadata`, `created_at`).
- **Invariantes de seguridad:**
  - `ADMIN_USER_IDS` sigue siendo la única fuente de privilegio `isAdmin` en Impulso.
  - `GROUP_OWNER` o `PLATFORM_ADMIN` en Identity **no** otorgan `isAdmin` en Impulso.
  - Los datos de entrenamiento, nutrición y progreso permanecen ligados a `User.id` sin reescritura de IDs.

---

## 8. Estrategia de vinculación de usuarios

1. **Vínculo existente (`IdentityLink` activo):** login directo al `userId` asociado.
2. **Usuario nuevo sin colisión de email:** si `email_verified === true` y `lookupAccountByCanonicalEmail` devuelve `not_found`, se crea `User` + `IdentityLink` (`oidc_provision`) + `IdentityLinkAudit` (`LINKED`) en transacción atómica (`ANCLORA_IDENTITY_AUTO_PROVISION`).
3. **Usuario existente en Impulso con mismo email pero sin `IdentityLink`:** se **rechaza** la vinculación automática (`link_requires_original_method`) y se registra `LOGIN_DENIED` en `identity_link_audits`.
4. **Vinculación explícita autenticada:** usuario con sesión activa en Impulso solicita `POST /api/auth/anclora-identity/link/init` (recibe `linkToken` HMAC-SHA256 de 5 min ligado a su `userId`), completa OIDC y `linkAuthenticatedUser` crea el `IdentityLink` (`authenticated_link`) + auditoría.
5. **Desvinculación (`DELETE /api/auth/anclora-identity/link`):** exige método alternativo (`passwordHash` u `OAuthAccount`) para evitar bloqueo de cuenta y registra `UNLINKED` en auditoría.

---

## 9. Plan de migración (Fases A–F)

- **Fase A (Compatibilidad):** `ANCLORA_IDENTITY_ENABLED=false` (estado actual en producción).
- **Fase B (Integración OIDC):** Código desplegado con `ANCLORA_IDENTITY_ENABLED=true` y `ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH=true`.
- **Fase C (Pruebas con usuario sintético / QA):** Validar login, callback, PKCE, `nonce`, `state`, vinculación explícita y aislamiento de datos.
- **Fase D (Migración controlada):** Usuarios existentes vinculan su cuenta autenticados o mediante migración explícita autorizada.
- **Fase E (Cutover):** Activar `ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH=false` (endpoints legacy responden `409 ANCLORA_IDENTITY_ENABLED`).
- **Fase F (Retirada heredada):** Solo tras verificar 0 sesiones activas dependientes y sin incidencias.

---

## 10. Riesgos

- **Derivación de entorno:** `anclora-identity` tiene commits de Resend (`1edbdd0`) en `development` aún no promovidos a `main`.
- **Migración pendiente en Neon:** `20261113103000_add_identity_links` debe aplicarse por el runner protegido `production-migrations.yml` antes de activar `ANCLORA_IDENTITY_ENABLED=true` en producción.
- **Bloqueo de cuentas sin método alternativo:** mitigado impidiendo desvincular el último método.

---

## 11. Rollback

- **Rollback instantáneo sin despliegue de código:** establecer `ANCLORA_IDENTITY_ENABLED=false` (o `ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH=true`) en Render y `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH=false` en Vercel.
- **Rollback de esquema:** las tablas `identity_links` e `identity_link_audits` son aditivas y no alteran `users`, `auth_sessions` ni datos deportivos/nutricionales.

---

## 12. Tests y 13. Evidencias (Gates finales)

| Gate | Estado | Evidencia |
| --- | --- | --- |
| `anclora-identity` (`typecheck`, `lint`, `build`, `vitest`) | **PASS** | 19 archivos, **98/98 tests** |
| `anclora-impulso` frontend (`tsc --noEmit`, `next lint`, `jest --ci`, `next build`) | **PASS** | 33 suites, **190/190 tests**; 25 páginas compiladas |
| `anclora-impulso` backend (`typecheck`, `prisma generate && tsc`, `test:ci`) | **PASS** | 29 suites, **258/258 tests** |
| OIDC HTTP E2E local (`anclora-identity-oidc-e2e.test.ts`) | **PASS** | 4/4 tests E2E HTTP contra IdP RS256 efímero + Prisma en memoria (PKCE, `nonce`, `state`, JWKS, `/me`, logout/revocación, negativa, link/unlink) |
| Release manifest (`verify-release-manifest.mjs`) | **PASS** | `manifest ok: 29 migrations; newest is 20261113103000_add_identity_links` |
| Frozen lockfile (`backend/pnpm install --frozen-lockfile`) | **PASS** | 1.4s con `pnpm-workspace.yaml` |
| E2E contra Postgres aislado / Neon / `anclora-identity.anclora.com` | **BLOCKED** | Sin `psql`/Postgres local ni autorización de escritura en Neon / secretos productivos |

---

## 14. Cambios por repositorio

- **`anclora-identity` (`development`, sin commit):**
  - `src/oidc/clients.ts`, `src/config/env.ts`, `src/identity/applicationRoles.ts`, `src/oidc/provider.ts`, `src/server.ts`, `src/bootstrap.ts`, `test/unit/impulsoClientRegistry.test.ts`.
- **`anclora-impulso` (`development`, sin commit):**
  - `backend/package.json`, `backend/pnpm-lock.yaml`, `backend/pnpm-workspace.yaml`, `backend/prisma/schema.prisma`, `backend/prisma/migrations/20261113103000_add_identity_links/migration.sql`, `scripts/release/release-manifest.json`, `backend/src/config/env.ts`, `backend/src/services/oauth/anclora-identity.provider.ts`, `backend/src/services/identity-link.service.ts`, `backend/src/services/oauth.service.ts`, `backend/src/controllers/auth.controller.ts`, `backend/src/controllers/oauth.controller.ts`, `backend/src/routes/oauth.routes.ts`, `backend/tests/unit/anclora-identity-oidc.test.ts`, `backend/tests/unit/anclora-identity-oidc-e2e.test.ts`.
  - `lib/auth/oauth.ts`, `components/login-page-content.tsx`, `components/social-auth-buttons.tsx`, `app/auth/error/page.tsx`, `e2e/auth-oauth.spec.ts`, `__tests__/oauth-flags.test.ts`, `__tests__/components/login.test.tsx`, `__tests__/components/login-page-no-env-credentials.test.tsx`, `docs/operations/DEPLOY.md`.

---

## 15. Variables de entorno pendientes (solo nombres)

- **Vercel (`anclora-identity`):** `IMPULSO_CLIENT_SECRET`, `IMPULSO_REDIRECT_URIS`.
- **Render (`anclora-impulso` backend):** `ANCLORA_IDENTITY_ENABLED`, `ANCLORA_IDENTITY_ISSUER_URL`, `ANCLORA_IDENTITY_CLIENT_ID`, `ANCLORA_IDENTITY_CLIENT_SECRET`, `ANCLORA_IDENTITY_REDIRECT_URI`, `ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH`, `ANCLORA_IDENTITY_AUTO_PROVISION`.
- **Vercel (`anclora-impulso` frontend):** `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH`.

---

## 16. Secuencia de despliegue (compatible con AOS)

1. Validación del propietario en `development` y `commit y push ok` en `anclora-identity` y `anclora-impulso`.
2. CI automática en `origin/development` de ambos repositorios (`CI` en Identity; `test-backend` + `test-frontend` en Impulso).
3. En Vercel (`anclora-identity`), configurar `IMPULSO_CLIENT_SECRET` y `IMPULSO_REDIRECT_URIS` (apuntando al callback del backend Render).
4. `PROMOTE=FULL` en `anclora-identity` (`promote.yml`: `development → staging → production → main`).
5. Verificar discovery en vivo (`https://anclora-identity.anclora.com/.well-known/openid-configuration`).
6. Ejecutar backup de Neon y lanzar `.github/workflows/production-migrations.yml` en `anclora-impulso` para aplicar `20261113103000_add_identity_links` y verificar el ledger `_prisma_migrations`.
7. En Render y Vercel (`anclora-impulso`), mantener inicialmente `ANCLORA_IDENTITY_ENABLED=false` y `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH=false` antes de promocionar el código, o configurar los secretos con `ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH=true`.
8. `PROMOTE=FULL` en `anclora-impulso` (`promote.yml` ejecuta `BACKEND_COMPAT_GATE`, despliega `production` en Render y luego `main` en Vercel).
9. Activar `ANCLORA_IDENTITY_ENABLED=true` (`ANCLORA_IDENTITY_ALLOW_LEGACY_AUTH=true`) y `NEXT_PUBLIC_ENABLE_ANCLORA_IDENTITY_AUTH=true` de forma controlada exclusivamente para el piloto.
10. Ejecutar smoke test productivo con usuario autorizado (`tonipmi.test@gmail.com` / cuenta del propietario) y **verificar explícitamente la vinculación de cuenta (`POST /api/auth/anclora-identity/link/init` → callback → `IdentityLink` y auditoría `LINKED`) y la preservación del `userId` y datos previos** antes de abrir Identity a más usuarios.
11. Si falla cualquier gate o la verificación de vinculación, rollback inmediato poniendo los flags a `false`.
