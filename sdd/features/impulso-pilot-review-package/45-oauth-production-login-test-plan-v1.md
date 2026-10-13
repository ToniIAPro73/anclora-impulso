# 45 — Plan de prueba del login con Google y GitHub en producción (v1, 2026-10-13)

> Plan para que **Toni** ejecute la prueba con cuentas reales. El agente no puede completarla (exige consentimiento en el proveedor).
> No cambia producción. Contrato del flujo: `17-oauth-f4-handoff-and-linking.md`.

## 1. Lo ya verificado sin cuenta real (2026-10-13, contra `anclora-impulso.onrender.com`)

| Comprobación | Google | GitHub |
|---|---|---|
| `GET /api/auth/<proveedor>?challenge=…` | 302 a `accounts.google.com` | 302 a `github.com` |
| `redirect_uri` enviado | `https://anclora-impulso.onrender.com/api/auth/google/callback` | `https://anclora-impulso.onrender.com/api/auth/github/callback` |
| Alcance | `openid email profile` | `read:user user:email` |
| `state` y PKCE `S256` | presentes | presentes |
| Cookie de transacción | `HttpOnly; Secure; SameSite=Lax; Path=/api/auth; 10 min` | ídem |
| Sin `challenge` | 302 a `https://anclora-impulso.vercel.app/auth/error` | — |

## 2. Hallazgo previo: destino de la vuelta

El backend redirige tras el proveedor a **`FRONTEND_URL` primer elemento** (`oauth.controller.ts`, `frontendUrl()`). En producción ese
elemento es `https://anclora-impulso.vercel.app` (confirmado por la redirección sin `challenge`). El verificador PKCE del navegador vive en
`sessionStorage`, que es **por origen**.

| Si el login se inicia en… | La vuelta aterriza en… | Resultado esperado |
|---|---|---|
| `https://anclora-impulso.vercel.app` | `https://anclora-impulso.vercel.app/auth/callback` | **Funciona** (mismo origen) |
| `https://impulso.anclora.com` | `https://anclora-impulso.vercel.app/auth/callback` | **Falla**: no hay intento pendiente en ese origen → `/auth/error` |

**Es una predicción por lectura de código, no un resultado observado.** La prueba de §4 la confirma o la descarta.

## 3. Antes de probar

| Comprobación | Dónde |
|---|---|
| El proveedor tiene como *redirect URI* autorizada exactamente la de §1 | Google Cloud Console → credenciales; GitHub → OAuth App |
| La pantalla de consentimiento de Google no está restringida a «usuarios de prueba» sin tu cuenta | Google Cloud Console |
| Usa una cuenta cuyo **e-mail no esté registrado ya con contraseña** en la app | Por diseño, un e-mail ya existente es **rechazado** (`link_requires_original_method`), no vinculado. Tu correo personal probablemente ya existe localmente: no lo uses |
| Una ventana privada o un perfil limpio | Evita sesiones previas (la prueba exige que no haya sesión) |

## 4. Prueba

Repite para Google y para GitHub, **en cada uno de los dos dominios**:

| Paso | Qué hacer | Resultado esperado |
|---|---|---|
| 1 | Abrir `https://<dominio>/auth/login` y pulsar el botón del proveedor | Redirección al proveedor |
| 2 | Autenticarse y consentir | Vuelta a `…/auth/callback` (la barra se limpia al instante) |
| 3 | Esperar | Llegada a `/dashboard` con sesión iniciada |
| 4 | Cerrar sesión y repetir con la misma cuenta | Entra en la **misma** cuenta (vinculada por identidad, no por e-mail) |

**Observables:** pestaña Red (`POST /api/auth/oauth/exchange` → 200; después `GET /api/auth/me` → 200) y los logs de Render si falla.

## 5. Si falla: diagnóstico por síntoma

| Síntoma | Causa probable | Qué hacer |
|---|---|---|
| Error del proveedor `redirect_uri_mismatch` | La URI de §1 no está autorizada | Añadirla en la consola del proveedor |
| `/auth/error` justo tras el proveedor; en logs `OAuth callback failed (<código>)` | Código de rechazo: `email_not_verified`, `link_requires_original_method`, `ambiguous_email`, `account_disabled`, `account_conflict` | Interpretar el código; los dos primeros son los habituales |
| Aterriza en `anclora-impulso.vercel.app/auth/callback` y de ahí a `/auth/error?provider=unknown` | **Desajuste de origen de §2** | Ver §6 |
| `503 Login con Google no está configurado en este entorno` | Falta alguna variable `*_OAUTH_*` | Revisar las variables del servicio |
| Botones deshabilitados | `NEXT_PUBLIC_ENABLE_GOOGLE_AUTH` / `…GITHUB_AUTH` ≠ `true` en Vercel Production | Revisar variables de Vercel |

## 6. Si se confirma el desajuste de origen

| Opción | Cambio | Pros / contras |
|---|---|---|
| **A. Dominio canónico** | Poner `https://impulso.anclora.com` el **primero** en `FRONTEND_URL` y redirigir `anclora-impulso.vercel.app` a él en Vercel | Solo configuración; el otro dominio deja de funcionar para OAuth salvo redirección |
| **B. Volver al origen que inició el flujo** | Código: el cliente envía su origen, el backend lo valida contra `FRONTEND_URL` (coincidencia exacta), lo guarda en la cookie de transacción y redirige a él | Robusto con varios dominios; cambio de backend con tests y despliegue |

## 7. Límites

Plan basado en el código a `7226c5a` y en sondeos sin cuenta real; el comportamiento de los proveedores (consentimiento, restricciones de
la app OAuth) no se ha observado. Las cuentas de proveedor no se crean ni se usan desde el agente.
