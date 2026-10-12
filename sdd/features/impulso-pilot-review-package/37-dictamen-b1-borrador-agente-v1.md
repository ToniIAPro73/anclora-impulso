# 37 — BORRADOR de dictamen B1 (seguridad, AI-06 AC10 + delta F-1/F-4) — preparado por el agente para revisión de Toni

> **Esto es un borrador, no un dictamen.** Lo redacta el agente de IA que implementó gran parte del código revisado: **no es
> independiente** y puede tener los mismos puntos ciegos que la implementación. Toni debe leerlo, contrastarlo con el código,
> modificarlo y, solo si lo hace suyo, firmarlo. Hasta entonces no cambia ningún estado ni acepta AI-06, ni gate alguno.
> Plantilla: `33-dictamen-b1-b2-guide-and-template-v1.md` §4 y §6. Pareja: `38-…` (B2).

> **Actualización (2026-10-13):** B1-F7 corregido en código (sin desplegar): `errorHandler.ts` y `httpLogger.ts` leen `req.user.userId`;
> se eliminó el auxiliar sin uso `logHttpRequest` (`config/logger.ts`), que además tenía el mismo defecto y registraba `req.url` con su
> *query string*. Test nuevo `tests/unit/log-user-attribution-b1f7.test.ts` (fase roja observada: fallaban los 2 casos del defecto).

## 0. Alcance real de esta lectura

| Aspecto | Valor |
|---|---|
| Versión | `c0333f3a6e8c7e1a73c9a68c9a24cd5015b3a98d` (código en producción; `HEAD` no difiere en `backend/`, `app/`, `components/`, `lib/`) |
| Método | **Lectura estática** de código (sin ejecutar nada nuevo), más evidencia ya existente: tests locales, Stage D en producción (`32-…`) y verificación funcional de Toni (admin 200 / usuario 403) |
| **Leído** | `session.service.ts`, `middleware/auth.ts`, `middleware/admin.ts`, `utils/jwt.ts`, `utils/security-config.ts`, `config/env.ts`, `server.ts` (arranque), `controllers/auth.controller.ts`, `services/auth.service.ts`, `controllers/oauth.controller.ts`, `services/oauth.service.ts`, `services/oauth-handoff.service.ts`, `utils/pkce.ts`, `services/oauth/*.provider.ts` (parcial), `utils/redact.ts`, `middleware/errorHandler.ts`, `middleware/httpLogger.ts`, `routes/dashboard.routes.ts`, `app.ts` (CORS, limitadores), `lib/auth/oauth.ts`, `middleware.ts` (CSP) |
| **No leído en esta pasada** | `lib/api/client.ts` y `lib/contexts/auth-context.tsx` (solo búsquedas dirigidas de almacenamiento), `app/auth/callback/page.tsx` (ídem), F-2 (`sessions.service.ts`) y F-3 (`progress.service.ts`), `account-lookup.service.ts` en detalle, esquema Prisma, los tests |
| Datos de producción no vistos | Valores de `JWT_SECRET`, `JWT_EXPIRES_IN`, `FRONTEND_URL`, `AUTH_ACCEPT_LEGACY_TOKENS`, `SECURITY_CONFIG_MODE`, `ADMIN_USER_IDS`. Solo se conoce por Toni que `GROQ_API_KEY` y `ADMIN_USER_IDS` existen |

## 1. Respuestas a S1–S9 (propuestas)

| # | Pregunta | Respuesta propuesta | Evidencia (fichero:línea) |
|---|---|---|---|
| S1 | ¿Bearer en `localStorage` aceptable para el piloto? | **Aceptable solo con condiciones** (ver hallazgo B1-F2): los tokens de acceso y de refresco están en `localStorage` (`lib/api/client.ts:49,75,109`; `auth-context.tsx:125,135`), y la CSP de producción permite `'unsafe-inline'` y scripts de `cdn.jsdelivr.net` y `unpkg.com` (`middleware.ts:43`), que sirven código arbitrario de npm. Un XSS robaría la sesión | `middleware.ts:39-55` |
| S2 | ¿Gracia de 10 s en el refresco? | **Aceptable.** Dentro de la gracia, un token ya usado entrega **un token nuevo válido** a quien lo presente (`session.service.ts:177-191`): un atacante que lo robe y lo reproduzca en <10 s obtiene sesión. Coste/beneficio razonable (dos pestañas legítimas) | `session.service.ts:181` |
| S3 | ¿Duración de tokens? | Por defecto acceso **7 días** y refresco **30 días** (`env.ts:40,42`). Como `authenticate` consulta la sesión del servidor en cada petición (`auth.ts:38`), la revocación es efectiva y la duración del JWT importa menos. Recomendación: fijar `JWT_EXPIRES_IN` ≤ 1 h (el aviso `ACCESS_TOKEN_LIFETIME_LONG` ya lo señala) | `security-config.ts:50-53` |
| S4 | ¿Controles previos a `AUTH_ACCEPT_LEGACY_TOKENS=false`? | **Fecha, no contador:** los JWT de refresco antiguos caducan a los 30 días de emitirse (defecto). Los emitidos hasta el 2026-10-12 dejan de ser válidos como muy tarde el **2026-11-11** y los de acceso el 2026-10-19. Pasada esa fecha puede ponerse a `false` sin impacto (si la configuración usa los valores por defecto: **no verificado**). El contador `legacyTokenUsage` (`dashboard.controller.ts:82`) vive en memoria y se reinicia con cada arranque, y el plan Free duerme: **no es fiable** | `session.service.ts:29-51` |
| S5 | ¿El canje OAuth de un solo uso es suficiente? | **Sí, sólido en lectura:** código aleatorio de 32 bytes guardado como hash, ligado al *challenge* del navegador que inició el flujo; canje por UPDATE condicional dentro de la misma transacción que crea la sesión; quemado si el verificador falla; sin tokens en la URL (solo `#code`) | `oauth-handoff.service.ts:55-101`, `oauth.controller.ts:91` |
| S6 | ¿La vinculación impide secuestro por e-mail? | **Sí.** Nunca vincula una identidad nueva a una cuenta existente por e-mail (`oauth.service.ts:70-72`: `link_requires_original_method`); solo crea cuentas con e-mail **verificado por el proveedor** (`google.provider.ts:92-93`, `github.provider.ts:99-103`). Efecto secundario: ver B1-F5 | `oauth.service.ts:59-72` |
| S7 | ¿Admin sin MFA aceptable? | **Aceptable con pocos IDs** si la lista `ADMIN_USER_IDS` es mínima; falla cerrada (UUID canónico, entradas inválidas descartadas) y `ADMIN_EMAILS` no concede nada. Verificado en producción por Toni | `admin.ts:8-14`, `env.ts:68-71` |
| S8 | ¿Retención y redacción de logs? | **Redacción estructural y de texto correcta** (`redact.ts`), sin cuerpos en errores si `omitBody`. **Pero** los logs HTTP de producción incluyen IP y *user-agent* (`httpLogger.ts:28-37`) y no hay purga programada (B1-F6) | `redact.ts:1`, `httpLogger.ts:36` |
| S9 | ¿`/api/dashboard/*` solo admin? | **Sí por construcción:** `router.use(authenticate, requireAdmin)` antes de cualquier ruta (`dashboard.routes.ts:15`). Los comentarios de la ruta aún dicen `ADMIN_EMAILS` (documentación obsoleta) | `dashboard.routes.ts:15` |

## 2. Hallazgos

| ID | Severidad | Hallazgo | Evidencia | Efecto | Propuesta |
|---|---|---|---|---|---|
| B1-F1 | **Media** | La regla CORS que acepta «previews» de Vercel permite con `credentials: true` cualquier origen `*.vercel.app` cuyo nombre **empiece por** `<proyecto permitido>-`. Si `FRONTEND_URL` es `https://<proyecto>.vercel.app`, un tercero puede crear un proyecto `<proyecto>-x` y ser aceptado | `app.ts:36-60,77-87` | Hoy el impacto está acotado porque la autenticación va por *bearer* en `localStorage` (un origen ajeno no puede leerlo) y las únicas cookies del backend son las del flujo OAuth (`path=/api/auth`; verificado con búsqueda de `res.cookie`/`req.cookies`). Si algún día se usan cookies de sesión, pasa a ser grave | En producción, aceptar solo los orígenes exactos de `FRONTEND_URL`; o exigir además el sufijo del equipo de Vercel. Verificar el valor real de `FRONTEND_URL` |
| B1-F2 | **Media** | CSP débil frente a XSS: `'unsafe-inline'` y CDNs públicos (`jsdelivr`, `unpkg`) en `script-src` (producción) | `middleware.ts:43` | Un punto de inyección permitiría cargar cualquier script y robar los tokens de `localStorage` | Eliminar `unsafe-inline` (nonces) y los CDNs públicos, o fijar integridad (SRI). `dangerouslySetInnerHTML` aparece solo en `components/ui/chart.tsx:83` (revisar su entrada) |
| B1-F3 | **Baja-media** | El refresco JWT antiguo **no es de un solo uso**: cada presentación crea una sesión nueva y sigue válido hasta caducar; revocar las sesiones no lo invalida | `session.service.ts:201-219` | Mientras `AUTH_ACCEPT_LEGACY_TOKENS` sea `true`, un JWT de refresco robado genera sesiones ilimitadas hasta su caducidad (≤ 30 días) | Poner `AUTH_ACCEPT_LEGACY_TOKENS=false` a partir del 2026-11-11 (S4) |
| B1-F4 | **Baja-media** | La política `SECURITY_CONFIG_MODE` es `warn` por defecto: una configuración con secretos cortos (<32) o idénticos arranca igualmente. Solo los **valores por defecto públicos** bloquean el arranque en producción | `env.ts:127-133`, `server.ts:13-18`, `security-config.ts:75-88` | Una mala configuración no impide el servicio; solo registra `SECURITY_CONFIG_NOT_ACCEPTABLE` | Buscar esa línea en los logs de arranque de Render; si no hay hallazgos de severidad `error`, pasar a `enforce` |
| B1-F5 | **Baja** | **Sin verificación de e-mail en el registro** y contraseña mínima de **6** caracteres. Un tercero puede registrar el e-mail de otra persona; si esa persona intenta entrar con Google, queda **rechazada** (`link_requires_original_method`) | `validators.ts:6`, `auth.service.ts:24-63`, `oauth.service.ts:72` | No hay secuestro (bien), pero sí «ocupación» del e-mail y enumeración (409 «ya registrado»; el login no ejecuta *hash* si el usuario no existe: diferencia de tiempo) | Decidir: verificación de e-mail y contraseña ≥ 10, o aceptar el riesgo en el piloto |
| B1-F6 | **Baja** | Datos personales en logs de producción (IP, *user-agent*, `userId`); las purgas de sesiones, *handoffs* e idempotencia existen pero **no están programadas** | `httpLogger.ts:28-37`, `oauth-handoff.service.ts:103` | Retención sin definir (AI-07) y crecimiento de tablas | Definir retención y programar el trabajo de purga |
| B1-F7 | **Baja** | `userId` **nunca se registra** en errores ni en avisos de petición lenta: se lee `req.user?.id`, pero el JWT lleva `userId` | `errorHandler.ts:40`, `httpLogger.ts:65` | Pérdida de trazabilidad forense | Usar `req.user?.userId` (el token de Morgan ya lo hace bien: `httpLogger.ts:16`) |
| B1-F8 | Info | Documentación contradictoria: `CLAUDE.md` afirma refresco en cookie *httpOnly* y límite de IA de 5/hora por usuario; el código usa `localStorage` y **no tiene** limitador por usuario de IA (ver B2-F1) | `CLAUDE.md`, `app.ts:119-141` | Riesgo de decisiones sobre premisas falsas | Corregir la documentación |

## 3. Qué parece correcto (con la cautela de una lectura estática)

- Algoritmo JWT fijado a HS256 (sin confusión de algoritmo) y comprobación de sesión del servidor en cada petición (`jwt.ts:11,38`, `auth.ts:38`).
- Rotación de refresco con reclamación atómica y detección de reutilización fuera de la gracia que revoca la sesión (`session.service.ts:159-186`).
- Cuenta desactivada invalida acceso y refresco (`session.service.ts:93,154`).
- Cierre de sesión idempotente que revoca por refresco y por `sid`, aunque el acceso esté caducado (`auth.controller.ts:97-128`).
- Cookie de transacción OAuth: `httpOnly`, `sameSite=lax`, `secure` en producción, `path=/api/auth`, 10 min (`oauth.controller.ts:25-33`); comparación de `state` en tiempo constante (`pkce.ts:23-32`); redirección solo a `frontendUrls[0]` (sin redirección abierta).
- `trust proxy` fijado a 1 para los limitadores tras Render (`app.ts:66`).

## 4. Límites y decisión propuesta

- **No evaluable** en esta lectura: F-2 (`workoutId` en `POST /api/sessions`), F-3 (medidas), el cliente completo de sesión entre pestañas, y cualquier valor de configuración real de producción.
- Pasada **sin ejecutar** nada; las conclusiones sobre tests se apoyan en resultados previos, no re-ejecutados.

**Decisión propuesta para tu alcance (a confirmar por ti):** `requiere cambios (menores)` para **B1-F1, B1-F2 y B1-F3/F4**; el
resto, «sin cambios requeridos en el alcance local». **No** aceptes AC10 con este documento: sigue pendiente la revisión
independiente.

## 5. Antes de firmar, comprueba tú

1. En Render → Logs (arranque): busca `SECURITY_CONFIG_NOT_ACCEPTABLE` y anota los códigos (no son secretos).
2. En Render → Environment: ¿existen `FRONTEND_URL`, `JWT_EXPIRES_IN`, `AUTH_ACCEPT_LEGACY_TOKENS`, `SECURITY_CONFIG_MODE`? (solo nombres).
3. Abre `app.ts:36-60` y `middleware.ts:39-55` y confirma B1-F1/F2 con tus ojos.

Firma: ______________________   Fecha: __________   (sin firma, este documento no tiene valor de dictamen)
