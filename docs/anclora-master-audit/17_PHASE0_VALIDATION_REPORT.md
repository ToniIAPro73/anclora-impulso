# 17 — Informe de validación de Fase 0 y configuración de la identidad de pruebas

> **[HISTÓRICO — FASE 0 CERRADA (2026-11-11)]** Documento conservado como registro histórico del proceso de validación e integración de la Fase 0. Todos los paquetes y controles descritos están ya integrados en `development` (`af5f38d` Paquete A, `662e1e7` Paquete D, `4093beb` Paquete C, `f791d2b` Paquete B y `249d861` Promotion Gate con Auto-Deploy Render).

> **Versión vigente:** la sección 11 (cierre controlado, segunda iteración) sustituye a las secciones 7 y 9 donde se contradicen.

> **Fecha:** 2026-11-10. **Base:** `development` @ `0e0b897`. **Estado de los cambios:** sin commit, en el árbol de trabajo.
> **Continúa:** `16_PHASE0_ACCEPTANCE_REVIEW.md` (revisión de Gemini Argon).
> **Principio aplicado:** reutilizar los contratos vigentes. Los datos de Neon se tratan como **datos de prueba** según declaración del propietario (2026-11-10); no se retira ningún control de seguridad, integridad, backup o autorización de cambios.

---

## 1. Contratos recuperados

| Fuente | Qué establece | Aplicación en este informe |
|---|---|---|
| `.anclora/PRODUCTION_RUNTIME.md` §10 | Identidad QA dedicada `qa.impulso@anclora.local`; `QA_AUTH_MODEL=DEDICATED_USER`, `QA_IS_REAL_USER=false`, `QA_REUSE=true`, `QA_CREATE_IF_MISSING=true`, `QA_CREATION_CONFIRMATION_REQUIRED=false`, `QA_DELETE_AFTER_TEST=false`, `QA_DATA_ISOLATION_MODEL=USER_OWNED_RECORDS` | **Usado**: la cuenta ya existía; se reutiliza y se rota su contraseña. No se borra |
| `anclora-governance/standards/AGENT_OPERATING_STANDARD.md` (QA persistente) | Identidad dedicada, nunca la cuenta personal; sin borrado; aislamiento declarado; un único recurso de BD por producto con el QA aislado dentro | **Aplicado**: sin BD nueva, sin cuenta personal |
| `anclora-governance/knowledge/decisions/D-2026-0041.md` | Contrato primero: un prompt no redefine runtime, BD, QA, Git ni migraciones ya gobernados; identifica `RUNTIME_SOURCE`, `DATABASE_SOURCE`, `QA_SOURCE`, `GIT_SOURCE`, `MIGRATION_SOURCE` | **Aplicado**: ver §8 |
| `anclora-governance/knowledge/decisions/D-2026-0047.md` | Carril de entrega: trabajo en `development`, pruebas en el QA aislado, commit y promoción solo tras validación explícita de Toni | **Aplicado**: sin commit, sin push, sin promoción |
| `anclora-shiftimport/docs/db-environments.md` | Una sola BD Neon por producto; preflight de migraciones solo de lectura; `DATABASE_URL` nunca impresa; teardown verificado de datos sintéticos | **Adoptado** (principios): fingerprint de destino, no imprimir secretos |
| `anclora-shiftimport/scripts/qa/ensure-qa-identity.mjs` | Crea/valida la identidad; genera la contraseña con `randomBytes`; hash con la utilidad oficial de la app; la guarda en `.env.development.local` con modo 0600; nunca la imprime | **Adoptado en principio**. Impulso no tiene ese script; la operación se hizo inline con las mismas garantías |
| `anclora-shiftimport/qa/e2e-acceptance/README.md` | QA persistente con `qa:dev-runtime` y `assertQaOrganization()`; nunca escribir en la organización real | Impulso no tiene equivalente. Pendiente (§9) |

---

## 2. Comparación con el procedimiento de ShiftImport

| Aspecto | ShiftImport | Anclora Impulso | Diferencia y decisión |
|---|---|---|---|
| Base de datos | Neon `main` única; sin ramas nuevas | Neon única (`neondb`, host fingerprint `279c55cc6dbc`) | Coincide |
| Identidad QA | `qa.shiftimport@anclora.test` | `qa.impulso@anclora.local` (contrato §10) | **Divergencia de dominio** (`.local` no enrutable; `.test` es el de ShiftImport). Se mantiene el del contrato propio de Impulso; se documenta |
| Hash | `api/_lib/passwords.js` (algoritmo propio) | `bcryptjs`, 10 rondas (`backend/src/utils/password.ts`) | Impulso usa su algoritmo oficial; se usa ese |
| Contraseña | Generada, rotada y guardada en `.env.development.local` | Igual | Coincide |
| Script de identidad | `ensure-qa-identity.mjs` | No existe | Operación inline; se recomienda crear el script (decisión de Toni) |
| Obtención de la BD | `vercel env pull --environment=development` a directorio temporal | `vercel env run` (fusiona `.env.local`, ver §8) | **Divergencia**: `.env.local` contiene variables de desarrollo que pueden solapar las de Vercel |
| Organización real protegida | `ShiftImport` READ ONLY | No aplica (no hay organizaciones; hay usuarios) | Impulso aísla por `USER_OWNED_RECORDS` |

---

## 3. Configuración de la identidad de pruebas (sin secretos)

| Campo | Valor |
|---|---|
| Email | `qa.impulso@anclora.local` (contrato §10) |
| Estado previo | Existía (1 fila) |
| Acción | Rotación de contraseña: `UPDATE` de `passwordHash` sobre 1 fila |
| Hash | bcrypt, 10 rondas, con la utilidad de la app. Verificado contra el hash almacenado |
| Contraseña | Generada con `randomBytes(24)` en memoria; no impresa; no en el repositorio |
| Cuenta deshabilitada | No (`disabledAt` nulo) |
| Privilegios | Usuario normal. No aparece en `ADMIN_USER_IDS` de la configuración visible. **La lista de Render no se ha podido verificar** |
| Borrado | No. `QA_DELETE_AFTER_TEST=false` |
| Fichero local | `.env.development.local`, modo `0600`, ignorado por Git (`.gitignore:89`, regla `.env*`), contiene solo `QA_EMAIL` y `QA_PASSWORD`. No contiene `DATABASE_URL` |
| Prefijo `NEXT_PUBLIC_` | No. Ninguna referencia a `QA_*` en `app/`, `components/`, `lib/`, `hooks/`, `public/` (0 coincidencias) |
| Lectura por el agente | No se leyó el fichero. Se cargó en el proceso que lo usaba |

---

## 4. Entorno utilizado en cada prueba

| Prueba | Entorno | Datos | Escritura |
|---|---|---|---|
| Fingerprint y consultas de esquema | Neon, `vercel env run -e production` | Lectura | No |
| Rotación de la contraseña QA | Neon (mismo destino) | 1 fila | Sí, contrato §10 |
| API local (`127.0.0.1:3001`) | Código de trabajo + Neon | Identidad QA | Sí: sesiones de QA |
| Frontend local (build de producción, `127.0.0.1:3100`) | Build de trabajo + entorno de producción | Ninguno | No |
| Render (`anclora-impulso.onrender.com`) | Código **desplegado**, anterior a TASK-002 | Identidad QA | Sí: sesiones de QA |
| WebKit, cross-site y same-site | API local + páginas de prueba | Identidad QA | Sí: sesiones de QA |
| Tests unitarios | Sin base de datos | Ninguno | No |

---

## 5. Resultados verificables

### 5.1 Ejecutado y con resultado

| Verificación | Comando (resumido) | Resultado |
|---|---|---|
| Backend unitarios | `npx jest --ci --coverage=false tests/unit` | **16 suites, 157/157 PASS** (incluye el test de dominio que antes no se ejecutaba) |
| Backend typecheck (tras `prisma generate`) | `npx tsc --noEmit` | **Sin errores** (AUD-005 confirmado y resuelto en local) |
| Frontend Jest completo | `npx jest --ci --coverage=false` | **22 suites, 153/153 PASS** |
| Frontend typecheck | `npx tsc --noEmit` | Sin errores |
| Lint (ficheros modificados) | `npx eslint <ficheros>` | Sin errores |
| Build de producción | `npx next build` | **Compilado; 25 páginas generadas** (`backend/logs/next-build.out`) |
| AUD-024 en build local | `next start` con entorno de producción; HTML de `/auth/login` | Bandera activa; **ni contraseña ni email en el HTML** |
| AUD-024 en producción (antes de corregir) | `GET https://impulso.anclora.com/auth/login` | **Contraseña y email presentes en el HTML** (booleanos) |
| Flujo de autenticación contra Neon | API local: login, `me`, refresh por cookie, refresh por cuerpo, refresh sin credenciales, logout | login 200; `me` 200; refresh cookie 200; refresh cuerpo 200; sin credenciales 400; logout 200 con borrado de cookie |
| Atributos de la cookie | `Set-Cookie` del login | `HttpOnly`; `SameSite=Lax`; `Path=/api/auth`; `Secure` solo en producción (`NODE_ENV`) |
| Respuesta del login | Cuerpo JSON | **Sigue incluyendo `refreshToken`** (AUD-001 abierto) |
| Render, endpoints (código desplegado) | `anclora-impulso.onrender.com` | health 200; login 200 con `refreshToken` en el cuerpo y **sin** `Set-Cookie`; refresh por cuerpo 200 |
| Cross-site vs same-site (WebKit) | Página en `localhost:3000` → API `127.0.0.1:3001` vs `127.0.0.1:3000` | **Cross-site: refresh por cookie 400. Same-site: 200.** Confirma el bloqueo de TASK-002 en WebKit |

### 5.2 No ejecutado (y motivo)

| Suite | Motivo |
|---|---|
| Integración backend (31 ficheros) | El guard solo permite `*_test` en loopback. Un único fichero (`social-community.test.ts`) hace `deleteMany()` sobre tablas compartidas (`kudos`, `activity_feed_items`, `challenge_participants`, `challenges`, `follows`); contra Neon borraría datos ajenos a la prueba. **No se ejecutan contra Neon.** Requiere Postgres local de prueba: Docker está instalado pero no arrancado; decisión de Toni |
| E2E Playwright (`e2e/`) | Requiere navegador Chromium (no instalado) y backend desplegado con el código nuevo |
| Cross-site en Chrome | Chromium no instalado. Solo WebKit verificado |
| Flujo OAuth real | Requiere proveedores; los E2E usan proveedores falsos y no se han ejecutado |
| Visual QA (`agent-browser`) | No ejecutada en esta fase |
| Refresh en el despliegue real de Render | Render sirve código anterior; no valida TASK-002 |

---

## 6. Errores corregidos en esta fase

| Id | Corrección | Verificación |
|---|---|---|
| AUD-024 | `app/auth/login/page.tsx` ya no lee `UTILIZAR_USER_TEXT`, `USER_TEXT` ni `PASS_TEXT` | Test nuevo `login-page-no-env-credentials.test.tsx` (sentinelas en el entorno) + build local (HTML sin credenciales) |
| TASK-006 (AC-01) | `assertRequiredJwtSecrets` exige ≥ 32 caracteres y secretos distintos fuera de `test` | Tests nuevos en `security-config.test.ts` (16 suites verdes) |
| TASK-008 / TASK-020 | Test de dominio movido a `tests/unit/`; ruta corregida a `progression/progression.service.ts` | 157/157 con el comando por defecto (antes: "No tests found") |
| AUD-005 | Causa confirmada: cliente Prisma desactualizado | `prisma generate` + `tsc` sin errores |
| TASK-002 (AC-03) | Test `oauth-callback` actualizado: el refresh no se guarda en `localStorage` | Frontend 153/153 |
| TASK-001 | Fila de `PRODUCTION_RUNTIME.md` reatribuida a "agente, a petición de Toni" | Revisión documental |
| AUD-003 | Afirmación reformulada como declaración del propietario | `09` y `00` |

---

## 7. Riesgos pendientes

| Riesgo | Severidad | Estado |
|---|---|---|
| **AUD-024 sigue activo en producción** hasta desplegar el cambio; la contraseña expuesta debe considerarse comprometida | **Crítica** | Requiere acción de Toni (§10, punto 1) |
| AUD-001: el refresh sigue en el JSON de la respuesta | Alta | Abierto |
| TASK-002: cookie `SameSite=Lax` no funciona cross-site (WebKit confirmado) | Alta | Bloqueada por decisión de arquitectura |
| Secretos de Render más cortos de 32 caracteres → el servicio no arrancará tras desplegar | Alta | Condición previa al despliegue (no verificable desde aquí) |
| Integración backend no ejecutada | Media | Requiere decisión de Toni (Postgres local de prueba) |
| `NEXT_PUBLIC_API_URL` obtenido con `vercel env run -e production` vale `localhost:3001` | Media | **Ambiguo**: el CLI fusiona `.env.local`. Verificar en el dashboard de Vercel |
| Lista de administradores de Render no visible | Baja | No verificado |

---

## 8. Fuentes de runtime, base de datos, QA, Git y migraciones (D-2026-0041)

| Fuente | Valor | Divergencia |
|---|---|---|
| `RUNTIME_SOURCE` | Vercel (frontend) + Render (API) según `PRODUCTION_RUNTIME.md` §2 | Ninguna |
| `DATABASE_SOURCE` | Neon, fingerprint `279c55cc6dbc`, `neondb` | El contrato llama "producción" a una BD que el propietario describe como datos de prueba. **Divergencia de denominación**; no se modifica el contrato sin autorización |
| `QA_SOURCE` | `PRODUCTION_RUNTIME.md` §10 | `qa.impulso@anclora.local` (dominio distinto al de ShiftImport) |
| `GIT_SOURCE` | `AGENTS.md` y D-2026-0047 | Ninguna |
| `MIGRATION_SOURCE` | `backend/prisma/migrations` y runner protegido | Ninguna. Ledger: migraciones hasta `20261012090000` terminadas |

Divergencias a registrar sin cambiarlas:
1. `.env.development.local` no figura en `ENV_FILES` de `PRODUCTION_RUNTIME.md` §8.
2. `.anclora.local` frente a `.anclora.test` de ShiftImport.
3. "Producción" en el contrato frente a "datos de prueba" en la declaración del propietario.
4. `vercel env run` fusiona `.env.local`.

### Texto propuesto para el contrato (no aplicado; requiere confirmación de Toni)

> *Declaración del propietario (2026-11-10): los datos de la base Neon utilizada por Anclora Impulso son datos propios de prueba y no clientes en explotación comercial. Los controles de seguridad, integridad, backup y autorización de cambios de AOS se mantienen. Esta declaración no autoriza migraciones destructivas, borrados globales ni cambios de infraestructura.*

---

## 9. Estado de aceptación por tarea

| Tarea | Estado | Motivo |
|---|---|---|
| TASK-001 | **ACEPTADA** (documental) | Evidencia verificada; atribución corregida |
| TASK-002 | **BLOQUEADA** | Cookie cross-site no enviada (WebKit). AC-03 cumplida en frontend. AC-01 cumplida en backend. AUD-001 abierto. Decisión pendiente (§10) |
| TASK-006 | **ACEPTADA en código** | AC-01 cumplida, tests verdes. Condición previa: verificar secretos de Render |
| TASK-008 | **ACEPTADA** | Tests ejecutados con el comando por defecto |
| TASK-020 | **ACEPTADA** | 157/157; límites 17, 18, 29, 30, 39, 40, 49, 50, 59, 60, null |
| TASK-012 | **ACEPTADA CON CONDICIÓN** | Guard sin cambios; sin ejecución de integración contra Neon. La condición es decidir cómo se ejecutan las suites destructivas |
| AUD-024 | **CORREGIDA EN CÓDIGO, ABIERTA EN PRODUCCIÓN** | Requiere despliegue y rotación |
| AUD-005 | **RESUELTA EN LOCAL** | CI debe ejecutar `prisma generate` antes de `tsc` |

---

## 10. Decisiones y acciones para Toni

| # | Acción | Urgencia |
|---|---|---|
| 1 | En el dashboard de Vercel: poner `UTILIZAR_USER_TEXT` a inexistente o `false`, **rotar la contraseña** de la cuenta asociada a `PASS_TEXT` y retirar `USER_TEXT`, `PASS_TEXT` y `UTILIZAR_USER_TEXT` | **Inmediata** |
| 2 | Autorizar el despliegue de la corrección de AUD-024 (cambio en la rama de trabajo, sin commit hasta validación) | Alta |
| 3 | Elegir arquitectura de cookie para TASK-002: **A** (recomendada) reescritura same-origin en Vercel hacia Render, o **B** `SameSite=None; Secure` más protección CSRF (riesgo en Safari) | Alta |
| 4 | Verificar en Render que `JWT_SECRET` y `JWT_REFRESH_SECRET` tienen ≥ 32 caracteres y son distintos (sin ver valores) | Alta, antes de desplegar |
| 5 | Verificar en Vercel el valor de `NEXT_PUBLIC_API_URL` en Production | Media |
| 6 | Decidir si se autoriza un Postgres local de prueba (Docker) para integración | Media |
| 7 | Confirmar el texto de §8 sobre datos de prueba para el contrato | Media |
| 8 | Decidir si se retiran `POSTGRES_*` y `DATABASE_URL` de Vercel, tras confirmar que nada las usa | Baja |

Sin cambios en Vercel, Render, migraciones, commits ni despliegues en esta fase.

---

## 11. Cierre controlado (segunda iteración, 2026-11-10)

> **Estado de Fase 0: NO CERRADA.** TASK-002 tiene la implementación verificada en local, pero falta la verificación en Preview y producción. AUD-024 sigue **abierta en producción** hasta el despliegue autorizado. La sección 11 sustituye a las secciones 7 y 9 cuando se contradicen.

### 11.1 Etapa A — seguridad inmediata

| Punto | Resultado |
|---|---|
| Estado efectivo de la exposición (booleanos, sin valores) | `https://impulso.anclora.com/auth/login` **sigue devolviendo la contraseña y el email** de las variables de entorno. **AUD-024 abierta en producción.** |
| Corrección en código | `app/auth/login/page.tsx` ya no lee variables de entorno. Verificada con build local: la página con la bandera activa no contiene credenciales |
| Procedimiento de despliegue de seguridad en Governance | **No existe** una vía de hotfix ni de emergencia. Búsqueda en `anclora-governance` (`hotfix`, `emergenc`, `urgente`, `incidente de seguridad`, `rotaci`): sin resultados normativos. La única vía contractual es: commit en `development` tras validación de Toni → revisión en Preview → `PROMOTE=FULL` con el SHA revisado, cadena completa `development → staging → production → main` (`PRODUCTION_RUNTIME.md`, cabecera) |
| Acciones que sólo puede hacer Toni | (1) poner `UTILIZAR_USER_TEXT` a `false` o retirarla en Vercel; (2) **rotar la contraseña** de la cuenta de `PASS_TEXT`; (3) retirar `USER_TEXT`, `PASS_TEXT` y `UTILIZAR_USER_TEXT` tras el despliegue |
| Acciones ejecutadas por el agente | Ninguna sobre Vercel. No se ha desplegado nada |
| Incidente de registro | Una herramienta de prueba imprimió en el chat una cabecera `Authorization` con un access token válido de la cuenta QA. Se revocaron las **17 sesiones** de esa cuenta (`revokedReason=qa_test_cleanup`). La contraseña QA se rotó en la iteración anterior |

### 11.2 Etapa B — TASK-002, opción A (proxy same-origin)

**Cambios en el working tree (sin commit):**

| Fichero | Cambio |
|---|---|
| `next.config.mjs` | `rewrites()` (`beforeFiles`): `/api/:path*` → `${API_PROXY_TARGET}/api/:path*`. Excluye `logs` y `csp-report`, que son rutas locales de Next (`app/api/*`). Sólo se activa si `API_PROXY_TARGET` está definido; valida que sea un origen sin ruta |
| `lib/api/base-url.ts` (nuevo) | `API_BASE` = `/api` si `NEXT_PUBLIC_API_PROXY=true`; si no, `NEXT_PUBLIC_API_URL` (comportamiento anterior). `DIRECT_API_BASE` para el inicio de OAuth |
| `lib/api/client.ts` | Usa `API_BASE` |
| `lib/auth/oauth.ts` | El **intercambio** (`/auth/oauth/exchange`) usa `API_BASE`. El **inicio** (`/auth/{provider}`) sigue yendo directo a Render, porque la cookie de transacción PKCE se fija en el dominio de Render y la callback también va a Render |
| `__tests__/lib/api-base-url.test.ts` (nuevo) | 3 tests de la resolución de la base |

**Variables necesarias (build time, por entorno):**

| Variable | Dónde | Valor | Estado |
|---|---|---|---|
| `NEXT_PUBLIC_API_PROXY` | Vercel, Preview y Production | `true` | **Pendiente (Toni)** |
| `API_PROXY_TARGET` | Vercel, Preview y Production | `https://anclora-impulso.onrender.com` | **Pendiente (Toni)** |
| `NEXT_PUBLIC_API_URL` | Vercel | Conservar. Su valor en Production **no está verificado** (§7 riesgo) | Verificar |
| `FRONTEND_URL` / `FRONTEND_PREVIEW_HOST_SUFFIXES` | Render | Deben incluir el origen del frontend y los previews | Ya documentado; verificar |

**Verificación local (WebKit, frontend de producción compilado con el proxy, API local contra Neon con la identidad QA, sin CSP en la prueba):**

| Caso | Resultado |
|---|---|
| Login por el formulario real | Redirige a `/dashboard` |
| Cookie `refreshToken` | `HttpOnly`, `Path=/api/auth`, mismo origen |
| Access token caducado (simulado con uno inválido) → 401 → refresh por cookie | **Sesión restaurada**, access token sustituido, sin `refreshToken` en `localStorage` |
| Tres refresh en paralelo con la misma cookie | 200, 200, 200; la sesión sobrevive |
| Logout | 200, cookie borrada, refresh posterior **400** |
| Sin cookie y access token inválido | Termina en `/auth/login` |
| Proxy: `/api/auth/me` sin token | 401 JSON del backend (no 404 de Next) |
| Rutas locales | `/api/logs` responde desde Next, no se proxifica |
| Build por defecto (sin flags) | Compila; ninguna regla de proxy generada |

**Diagnósticos realizados durante la verificación (no son defectos del cambio):**
- Una página con `upgrade-insecure-requests` sobre `http://` local hace que el navegador pida recursos por `https://` y React no hidrata. Es un artefacto del entorno de prueba (producción usa HTTPS). Para la prueba se retiraron las cabeceras CSP de las respuestas, sólo en el contexto de Playwright.
- Un `POST` del mismo origen recibe 500 si el origen no está en `FRONTEND_URL`, porque el CORS del backend lo rechaza también cuando llega por proxy. En producción el origen (`impulso.anclora.com`) y los previews están permitidos.

**Caso cross-site (sin proxy, motivo del cambio):** WebKit, página en `localhost:3000` y API en `127.0.0.1:3001`: refresh por cookie **400**; same-site: **200**. Sólo verificado en WebKit.

**Compatibilidad de clientes (retirada del refresh en JSON, AUD-001):** el refresh **sigue en las respuestas JSON** (login, registro, refresh, OAuth). El frontend ya no lo lee ni lo guarda. Retirada propuesta en tres pasos: (1) desplegar el proxy y confirmar en Preview y Production que el refresh por cookie funciona; (2) registrar en el backend cuántas peticiones usan `req.body.refreshToken` (la ventana de transición); (3) cuando sea cero durante un periodo acordado, quitar `refreshToken` del JSON. **No se ha quitado en esta fase.**

### 11.3 Etapa C — secretos JWT en Render: BLOCKED

- No hay acceso autorizado a la configuración efectiva de Render desde este entorno (no hay conector ni credencial de Render en el contrato consultado).
- Desde la API desplegada no se puede inferir la longitud de un secreto HS256.
- Verificado en local: `backend/.env` tiene secretos de 88 caracteres y distintos.
- **Condición previa al despliegue:** Toni verifica en el dashboard de Render que `JWT_SECRET` y `JWT_REFRESH_SECRET` tienen ≥ 32 caracteres y son distintos, sin ver valores. Si no cumplen, el servicio **no arrancará** tras desplegar el guard de TASK-006.
- Verificado también: `NODE_ENV` efectivo en Render **NO VERIFICADO**. Si no es `production`, la cookie se emite sin `Secure`.

### 11.4 Etapa D — testing

| Verificación | Resultado |
|---|---|
| Backend unitarios | 16 suites, **157/157 PASS** |
| Backend typecheck | Sin errores |
| Frontend Jest | 23 suites, **156/156 PASS** |
| Frontend typecheck | Sin errores |
| Lint (ficheros modificados) | Sin errores |
| Build con proxy | PASS (regla generada hacia `http://127.0.0.1:3001/api/:path*`, solo para la prueba local) |
| Build por defecto | PASS |
| API local contra Neon (identidad QA) | PASS en login, `me`, refresh cookie, refresh cuerpo, logout |
| Playwright WebKit (UI real) | PASS en login, sesión por cookie, logout (ver §11.2) |
| Integración backend (31 ficheros) | **NO EJECUTADA.** El guard sólo admite `*_test` en loopback; la suite `social-community.test.ts` hace `deleteMany()` sobre tablas compartidas. No se ha relajado el guard ni se han ejecutado suites destructivas contra Neon |
| E2E Playwright del repositorio | **NO EJECUTADA.** Requiere Chromium (no instalado) y el backend desplegado con el código nuevo |
| Chrome / Firefox | **NO VERIFICADO.** Sólo WebKit |
| Preview y producción con el código nuevo | **NO VERIFICADO.** No desplegado |
| OAuth extremo a extremo | **NO VERIFICADO.** Sólo el intercambio con un código falso (401 del backend, prueba de ruteo) |
| Multi-pestaña con interfaz | **NO VERIFICADO** en interfaz. Se verificó el comportamiento de la cookie compartida (paralelo) |

**Evidencia reproducible:** los logs del build (`backend/logs/next-build-*.out`) y el arranque de la API (`backend/logs/qa-local-api.out`) están en `backend/logs/`, ignorado por Git. Los comandos son los de las secciones 4 y 11.2.

### 11.5 Estado de aceptación por tarea

| Tarea | Estado | Condición que falta |
|---|---|---|
| TASK-001 | **ACEPTADA** (documental) | — |
| TASK-002 | **IMPLEMENTADA Y VERIFICADA EN LOCAL; ACEPTACIÓN TÉCNICA PENDIENTE** | Verificación en Preview y producción; decisión de retirada de `refreshToken` en JSON (AUD-001 abierto); OAuth extremo a extremo |
| TASK-006 | **ACEPTADA EN CÓDIGO; CONDICIONAL** | Verificación de los secretos en Render (BLOCKED) |
| TASK-008 | **ACEPTADA** | — |
| TASK-020 | **ACEPTADA** | — |
| TASK-012 | **ACEPTADA CON CONDICIÓN** | Guard sin cambios. Integración no ejecutada contra Neon. Decisión: cómo ejecutar suites destructivas (Postgres local de prueba, autorizar Docker) |
| AUD-024 | **CORREGIDA EN CÓDIGO; ABIERTA EN PRODUCCIÓN** | Despliegue autorizado + rotación + retirada de variables |
| AUD-005 | **RESUELTA EN LOCAL** | CI debe ejecutar `prisma generate` antes de `tsc` |

**Fase 0: NO DECLARADA COMPLETADA.** Hay tareas bloqueadas (TASK-002 en espera de verificación de despliegue) y AUD-024 expuesta en el entorno desplegado.

### 11.6 Compatibilidad con Vercel, Render y Neon

| Componente | Compatibilidad | Riesgo |
|---|---|---|
| Vercel (frontend, Preview y Production) | El rewrite y `NEXT_PUBLIC_API_PROXY` se fijan en build. Cada entorno necesita sus variables | Un build sin las variables mantiene el comportamiento anterior (cross-site) |
| Render (API) | Sin cambios de código en el backend para el proxy. La cookie ya era `HttpOnly; SameSite=Lax; Path=/api/auth` | Las peticiones proxificadas llegan con IP de Vercel; el rate limit depende de `trust proxy` y de `X-Forwarded-For` (**NO VERIFICADO**) |
| Neon | Sin cambios de esquema ni de datos en esta etapa | Ninguno |

### 11.7 Riesgos residuales

| Riesgo | Severidad | Tratamiento |
|---|---|---|
| AUD-024 abierta en producción | **Crítica** | Toni: variables y rotación; después despliegue |
| AUD-001: refresh en JSON | Alta | Retirada en tres pasos (§11.2) |
| Rotación no estricta bajo concurrencia: dentro de la ventana de gracia (10 s por defecto, `AUTH_REFRESH_REUSE_GRACE_SECONDS`) un mismo token puede producir varios tokens válidos | Media | Aceptado para dos pestañas. Reducir la ventana si se confirma abuso |
| Secretos de Render | Alta | Verificación previa (§11.3) |
| `NODE_ENV` en Render | Media | Verificar; sin `production` la cookie no lleva `Secure` |
| Preview no verificada | Media | Verificar antes de integrar |
| OAuth extremo a extremo | Media | Verificar en Preview |
| Integración backend | Media | Decisión de Toni |

### 11.8 Condiciones

**Aceptación técnica de TASK-002:** (1) refresh por cookie OK en Preview y producción con el proxy activo; (2) login, refresh, logout, OAuth, 401, sesión caducada y multi-pestaña verificados en Preview; (3) integración backend ejecutada en un entorno aislado, o decisión explícita de Toni de aceptar la cobertura unitaria y de navegador.

**Integrar en `development`:** Toni valida los cambios; commit separado para AUD-024 y para TASK-002; sin push hasta esa validación.

**Promover a producción (independiente):** `PROMOTE=FULL` con el SHA revisado en Preview; cadena completa; rotación de la contraseña y retirada de variables confirmadas antes de promover AUD-024.

---

## 12. Paquetes revisables (tercera iteración, 2026-11-10)

> **Fase 0: NO CERRADA.** Este apartado define los paquetes y sus condiciones. No se ha hecho commit, push, despliegue ni promoción.

### 12.1 Separación del cambio (verificada)

Todo el árbol de trabajo (29 rutas, excluido `docs/anclora-master-audit/`) queda repartido en tres paquetes, **cada ruta en exactamente un paquete** (comprobado con script, 0 problemas). Parches en `docs/anclora-master-audit/packages/`.

| Paquete | Contenido | Ficheros | Parche |
|---|---|---|---|
| **A — AUD-024** | Eliminar la lectura de `USER_TEXT`/`PASS_TEXT`/`UTILIZAR_USER_TEXT` en la página de login, y su test | 2 | `A-AUD-024.patch` (`git apply --check` sobre HEAD: OK) |
| **B — TASK-002** | Migración same-origin: refresh por cookie, proxy, base de API, OAuth exchange, test de AC-03 | 16 | `B-TASK-002.patch` (lista en `B-files.txt`) |
| **C — Resto de Fase 0** | TASK-006 (guard), TASK-008/020 (tests de dominio), TASK-012 (guard, sin cambios de lógica), atribución en contrato, informe P1 | 11 | `C-FASE0-RESTO.patch` (lista en `C-files.txt`) |

El paquete C no lo pediste expresamente; lo incluyo para que el árbol quede completamente cubierto. Su contenido incluye un cambio en `PRODUCTION_RUNTIME.md` (atribución de una fila) que requiere tu confirmación.

### 12.2 Aislamiento verificado

Cada paquete se probó en un árbol nuevo construido con `git archive HEAD` más **sólo** sus ficheros (directorios en `backend/logs/`, ignorado por Git).

| Árbol | Verificación | Resultado |
|---|---|---|
| HEAD + A | Frontend Jest completo | **22 suites, 152/152 PASS** |
| HEAD + A | Test AUD-024 | **PASS** |
| HEAD sin cambios (control) | Test AUD-024 | **FAIL** (2 de 2): el test detecta el defecto |
| HEAD + B | Backend unitarios | **15 suites, 117/117 PASS** |
| HEAD + B | Backend typecheck | Sin errores |
| HEAD + B | Frontend Jest completo | **22 suites, 154/154 PASS** |
| HEAD + B | Frontend typecheck | Sin errores |
| HEAD + B | Build con proxy | PASS. Regla generada: `→ http://127.0.0.1:3001/api/:path*` |
| HEAD + B | Build por defecto | PASS. Ninguna regla de proxy |
| Ficheros de A y B | ESLint | Sin errores |

### 12.3 Paquete A — AUD-024: evidencias del HTML (valores centinela, no credenciales)

Se usaron valores **centinela** en el entorno de build, nunca las credenciales reales. Las páginas de login son estáticas, así que el valor se fija al compilar.

| Árbol | `UTILIZAR_USER_TEXT` | Centinela de contraseña en el HTML | Centinela de email en el HTML |
|---|---|---|---|
| HEAD (control) | `true` | **Sí** | **Sí** |
| HEAD | `false` | No | No |
| **A** | `true` | **No** | **No** |
| **A** | `false` | No | No |

**Otros mecanismos de exposición:** búsqueda de cualquier `process.env` que no sea `NEXT_PUBLIC_*` en `app/`, `components/`, `lib/`, `hooks/` y `middleware.ts`. Sólo quedan lecturas de `NODE_ENV`, que no son secretos. No hay otro camino de variables de entorno hacia el HTML.

**Previews:** las tres variables existen también en los entornos **Preview** y **Development** de Vercel. Consulta de los 12 despliegues más recientes (GET de `/auth/login`): 12 accesibles, **0 con la contraseña de producción**. Es **no concluyente**: cada entorno tiene su propio valor y la bandera puede estar en `false`. Pendiente comprobar cada preview con su propio valor, sin imprimirlo.

**Qué necesita redespliegue para aplicar la corrección:**
- **Production** (`impulso.anclora.com`, `anclora-impulso.vercel.app`): un nuevo despliegue de producción, que llega por la cadena de promoción.
- **Cada preview con la bandera activa**: su HTML estático sigue exponiendo la contraseña hasta reconstruirse o eliminarse.
- Quitar las variables no basta: el HTML ya generado no cambia hasta un nuevo build.

### 12.4 Paquete B — TASK-002: compatibilidad y dependencias

| Punto | Estado |
|---|---|
| Rutas locales de Next (`/api/logs`, `/api/csp-report`) | Excluidas del rewrite. Verificadas con el build local: `/api/logs` responde desde Next (400 por validación) |
| Variables | `API_PROXY_TARGET` (servidor, origen sin ruta, validado en build), `NEXT_PUBLIC_API_PROXY` (cliente, build time), `NEXT_PUBLIC_API_URL` (se conserva: lo usan el inicio de OAuth, el CSP y las imágenes de ejercicios) |
| Cookies | `HttpOnly`, `SameSite=Lax`, `Path=/api/auth`; `Secure` cuando `NODE_ENV=production` |
| Refresh | Por cookie. El refresh **sigue** en el JSON de login, registro, refresh y OAuth |
| Logout | Revoca la sesión y borra la cookie |
| OAuth | Inicio directo a Render (la cookie PKCE de transacción vive en el dominio de Render, y la callback también va a Render). **Intercambio** por el mismo origen (verificado: el backend responde 401 JSON al código inválido, no 404) |
| Concurrencia | Tres refresh en paralelo: 200 los tres. Sesión sobrevive |

**Compatibilidad del refresh en JSON (AUD-001):** no se retira. Consumidores pendientes: `e2e/oauth-handoff-*.spec.ts` y `e2e/session-and-fallback.spec.ts`; `backend/tests/integration/` (`auth`, `final-state`, `review-*`, `ai06-sessions`); `__tests__/lib/*` de refresh. El frontend ya no lo lee ni lo guarda. Retirada en tres pasos (§11.2).

### 12.5 Matriz de pruebas pendientes (no ejecutadas aquí)

| Prueba | Preview | Producción | Cómo |
|---|---|---|---|
| AUD-024: HTML del login sin credenciales, con la bandera activa y tras el despliegue | Pendiente | Pendiente | GET de `/auth/login` y comprobación con booleanos |
| AUD-024: rotación de la contraseña de `PASS_TEXT` | — | Pendiente (Toni) | Dashboard de Vercel |
| TASK-002: login por formulario → dashboard | Pendiente | Pendiente | Navegador |
| TASK-002: restauración por cookie tras access caducado | Pendiente | Pendiente | Navegador |
| TASK-002: logout borra cookie y el refresh posterior devuelve 400 | Pendiente | Pendiente | Navegador |
| TASK-002: 401 sin credenciales termina en login | Pendiente | Pendiente | Navegador |
| TASK-002: OAuth Google y GitHub (inicio directo, intercambio por proxy) | Pendiente | Pendiente | Flujo real con cuentas de prueba |
| TASK-002: dos pestañas, sesión compartida, logout en una | Pendiente | Pendiente | Navegador |
| TASK-002: origen del preview permitido por `FRONTEND_PREVIEW_HOST_SUFFIXES` | Pendiente | — | Login desde el preview |
| TASK-002: atributos de `Set-Cookie` en HTTPS (`Secure`, `HttpOnly`, `SameSite`, `Path`) | Pendiente | Pendiente | Herramientas del navegador (booleanos) |
| Rate limit con `X-Forwarded-For` tras el proxy | Pendiente | Pendiente | Prueba de límites |

### 12.6 Riesgos residuales

| Riesgo | Severidad | Tratamiento |
|---|---|---|
| AUD-024 expuesta en producción hasta el despliegue y la rotación | **Crítica** | Paquete A + acción de Toni |
| Previews con la bandera activa y HTML antiguo | **Crítica** | Redeploy o eliminación, verificación por preview |
| AUD-001: refresh en JSON | Alta | Retirada en tres pasos |
| Secretos JWT en Render: sin verificar | Alta | **BLOCKED** (ver 12.7) |
| `NODE_ENV` en Render: no verificado | Media | Inferencia (ver 12.7) |
| Rotación no estricta en la ventana de gracia de 10 s | Media | Aceptado para dos pestañas |
| Rate limit tras el proxy | Media | Pendiente de prueba |
| Integración backend: no ejecutada contra Neon | Media | Ver 12.8 |

### 12.7 Preflight de Render (Etapa 3)

| Comprobación | Resultado | Método |
|---|---|---|
| Servicio `Anclora-Impulso` | Existe. `branch=development`, `autoDeploy=no`, `rootDir=backend`, sin suspender | `render services --output json`, sólo campos de configuración |
| `NODE_ENV=production` | **Inferencia**: la API responde 500 sin campo `stack` ante JSON malformado. Un entorno no productivo lo incluiría | Petición HTTP sin secretos |
| Secretos JWT ≥ 32 y distintos | **BLOCKED.** La CLI de Render no expone variables de entorno (`serviceDetails.env` es el tipo de runtime, `node`) | — |
| Cookies `Secure` en producción | Depende de `NODE_ENV`, ver arriba. **No verificado** | — |
| Despliegue manual | Los cambios de backend requieren que Toni despliegue en el dashboard, porque `autoDeploy=no` | Contrato |

**Comprobación pendiente (Toni, dashboard de Render, sin ver valores):** `NODE_ENV=production`; `JWT_SECRET` y `JWT_REFRESH_SECRET` con ≥ 32 caracteres y distintos; `FRONTEND_URL` con `impulso.anclora.com`; `FRONTEND_PREVIEW_HOST_SUFFIXES` con el sufijo de los previews.

### 12.8 Etapa 4 — CI y pruebas de integración

- `ci.yml` **ya tiene PostgreSQL de pruebas**: servicio `postgres:16` en `localhost:5432`, base `impulso_test`, `prisma migrate deploy` y `pnpm test:ci` en el backend. Coincide con el guard de TASK-012 (loopback, puerto 5432, nombre `*_test`). **No se necesita infraestructura nueva.**
- Las suites destructivas (`social-community.test.ts`, con `deleteMany()`) se ejecutan en esa base aislada, no en Neon.
- CI no ejecuta E2E de Playwright. Esos quedan para Preview.
- **Ejecución:** sólo tras commit y push a `development`, con tu autorización. No he ejecutado integración contra Neon.

### 12.9 Contratos y Governance

| Comprobación | Resultado |
|---|---|
| Identidad QA (§10 del contrato) | Reutilizada. Rotación de contraseña autorizada por el contrato (`QA_REUSE=true`). Sin borrado. Sin privilegios de admin en la configuración visible |
| Datos de prueba en Neon | Declaración tuya, incorporada al análisis. **No está en el contrato:** su inclusión requiere tu confirmación (texto en §8) |
| Procedimiento de integración | D-2026-0047 y `PRODUCTION_RUNTIME.md`: commit y push a `development` sólo tras tu validación explícita |
| Procedimiento de promoción | `promote.yml` (`workflow_dispatch`), entradas `target` y `source_sha`. La cadena completa `development → staging → production → main` exige el SHA revisado en Preview y el token `PROMOTE=FULL` |
| Vía de hotfix | **No existe** en Governance (búsqueda sin resultados normativos) |
| Contratos modificados en este trabajo | `PRODUCTION_RUNTIME.md` (atribución de una fila, en paquete C). Requiere confirmación |
| Atribución en commits | Según la instrucción del entorno, el mensaje debe terminar con `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>` |

### 12.10 Secuencia de integración propuesta

1. **Revisión de los paquetes** (A, B, C y sus parches) por ti.
2. **Commit de A** solo, en `development`, tras tu validación. CI ejecuta lint, typecheck, `test:ci` (con integración en su PostgreSQL) y build.
3. **Rotación de la contraseña de `PASS_TEXT`** y retirada de las variables en Vercel. Puede hacerse en cualquier momento, sin esperar al código.
4. **Preview de `development`**: comprobar AUD-024 en el preview (matriz 12.5).
5. **Commit del backend de B** (la cookie se añade sin quitar el JSON, así que el frontend antiguo sigue funcionando). **Despliegue manual en Render** por ti.
6. **Variables de Vercel** `NEXT_PUBLIC_API_PROXY=true` y `API_PROXY_TARGET` en el entorno Preview, y **commit del frontend de B**. Preview y matriz 12.5 de TASK-002.
7. **Paquete C**: sólo después de verificar los secretos de Render (BLOCKED en §12.7), porque el guard de TASK-006 impide arrancar con secretos cortos.
8. **Promoción**: independiente. `PROMOTE=FULL` con el SHA revisado en Preview, cadena completa. La producción de Render no se promueve (sigue `development`, despliegue manual).

### 12.11 Condiciones de aprobación

| Paquete | Condiciones para tu aprobación |
|---|---|
| **A** | (a) Revisar el diff de 2 ficheros; (b) autorizar el commit en `development`; (c) comprobar el preview con booleanos; (d) rotar la contraseña y retirar las variables |
| **B** | (a) Revisar el diff de 16 ficheros; (b) confirmar las variables de Vercel en Preview; (c) desplegar el backend en Render; (d) completar la matriz 12.5 en Preview; (e) aprobar el plan de retirada de `refreshToken` en JSON |
| **C** | (a) Revisar el diff, incluida la atribución de `PRODUCTION_RUNTIME.md`; (b) verificar los secretos de Render; (c) aprobar que el guard de arranque entre en producción |

**Fase 0 no se declara cerrada** hasta que B tenga su matriz completa en Preview, C esté aprobado y AUD-024 esté cerrada en producción con la rotación confirmada.

---

## 13. Preparación de integración controlada (cuarta iteración, 2026-11-10)

> **Fase 0: NO CERRADA.** Sin commits, pushes, despliegues ni promociones. Los cuatro paquetes están listos para revisión. El `HEAD` sigue en `0e0b897`.

### 13.1 Incidentes de exposición de tokens: causas y corrección

| Concepto | Detalle |
|---|---|
| **Incidente 1 (identificado con certeza)** | Una prueba con Playwright falló y su mensaje de error, impreso tal cual, incluyó la cabecera `authorization: Bearer …` de una petición. Era un access token de la cuenta QA, sesión `f92f0b45…` |
| **Incidente 2** | Lo mencionas como segundo caso. **No lo he localizado en mi registro de esta sesión.** Búsqueda en disco: ningún JWT en `backend/logs/`, `docs/` ni `scripts/` (conteos, sin contenido). Si es otra salida, indícame cuál para verificarla y revocarla |
| **Causa 1** | Imprimir `error.message` de herramientas externas sin sanitizar. Los mensajes de Playwright incluyen las cabeceras de la petición |
| **Causa 2 (artefacto de método, no fuga)** | Reemitir **todo** el tráfico con `route.fetch()` envía las cookies del contexto fuera de las reglas de `SameSite`. Invalidó mediciones de cookies (ver 13.4). Corregido: sólo se reemiten documentos, o se usa `bypassCSP` |
| **Invalidación** | Revocadas las sesiones QA: 17 en la iteración anterior, 17 en esta. La del token expuesto (`f92f0b45…`) queda `revokedAt` y su usuario es la cuenta QA. El backend rechaza un access token cuya sesión está revocada (`isSessionActive`, `session.service.ts:83`). Activas tras la limpieza: 0 |

**Redacción reutilizable (para todos los agentes AOS):**
1. `backend/src/utils/redact.ts` → `redactText()` ahora redacta **líneas completas** `authorization`, `proxy-authorization`, `cookie` y `set-cookie`, además de Bearer, JWT, `rt1.*` y URLs de BD.
2. `scripts/qa/safe-output.mjs` → `safe(error)` pasa cualquier texto por esos patrones y además por el valor de `QA_PASSWORD`, si está cargado. Todo mensaje de error de los probes pasa por ahí.
3. Los probes sólo imprimen **códigos de estado y booleanos**. Nunca cabeceras, cuerpos ni tokens.
4. Prueba con **credenciales sintéticas**: `backend/tests/unit/redact-credentials-synthetic.test.ts` genera sus propios tokens falsos en tiempo de ejecución. Verificado en aislamiento (13.3, paquete D).

**Reglas para cualquier prueba autenticada:**
- No registrar respuestas HTTP completas.
- No interceptar tráfico de API para probar cookies. Usar `bypassCSP` o reemitir sólo documentos.
- Revocar las sesiones de la cuenta QA al terminar (`authSession.updateMany` con `revokedAt`, sólo sobre sus registros).

### 13.2 Paquetes y verificación de aislamiento

| Paquete | Contenido | Ficheros | Aislado sobre `HEAD` | Dependencias |
|---|---|---|---|---|
| **A — AUD-024** | Quitar la lectura de `USER_TEXT`/`PASS_TEXT`/`UTILIZAR_USER_TEXT` del login | 2 | Frontend 22/152 PASS. Test AUD-024 PASS. Control HEAD: FAIL | Ninguna |
| **B — TASK-002** | Refresh por cookie, proxy same-origin, base de API, OAuth exchange | 16 | Backend 15/117 PASS. Frontend 22/154 PASS. Typecheck y lint OK. Build con proxy y por defecto OK | Ninguna de A ni C |
| **C — Resto Fase 0** | Guard de arranque (TASK-006), tests de dominio (TASK-008/020), guard de BD (TASK-012), atribución del contrato | 11 (1 borrado) | Backend 15/154 PASS. Typecheck OK. Sin migraciones | Ninguna de A ni B |
| **D — Redacción** | `redact.ts`, `safe-output.mjs`, probes y test sintético | 5 | 8/8 PASS. Self-test del guard OK | Ninguna |

**Cobertura:** 34 rutas cambiadas, cada una en exactamente un paquete (0 problemas, comprobado por script). Parches en `docs/anclora-master-audit/packages/`: `A-AUD-024.patch`, `B-TASK-002.patch`, `C-FASE0-RESTO.patch`, `D-CREDENTIAL-REDACTION.patch`. Listas en `*-files.txt`.

**Tests de integración del backend: NO EJECUTADOS en esta iteración.** Ninguna afirmación de que los paquetes «no rompen la integración» está verificada. Ese resultado sólo llegará con el CI tras un commit validado en `development`.

**Combinado (árbol de trabajo):** frontend 23 suites / **156** PASS; backend unitarios 17 suites / **161** PASS; typecheck de ambos lados y lint de los ficheros TypeScript modificados, sin errores.

**Dependencias y estados intermedios:**

| Orden | Estado | Compatibilidad |
|---|---|---|
| A solo | Frontend sin autocompletado | Ninguna dependencia |
| B backend antes que B frontend | La cookie aparece, el JSON no cambia | El frontend antiguo sigue funcionando (el refresh del cuerpo se conserva) |
| B frontend sin backend B | El proxy llama a un backend sin cookie → refresh por cookie falla al caducar el access | **No permitido.** Desplegar el backend primero |
| C backend | Guard de arranque: con secretos cortos o iguales, **el servicio no arranca** | Condición: verificar secretos de Render antes |
| Migraciones | Ningún paquete añade migraciones | Sin impacto en la base |

**Compatibilidad del backend:** el backend desplegado en Render ejecuta el commit `5a5b05d` (live desde 2026-10-13). **No hay commits de backend entre `5a5b05d` y `HEAD`** (0), ni migraciones nuevas. El backend desplegado es, por tanto, el mismo que el de `HEAD`. Lo único nuevo es lo que aún no está en un commit (B y C).

### 13.3 Verificación de navegador (Chrome y WebKit, local)

Entorno: frontend de producción compilado con el proxy (`NEXT_PUBLIC_API_PROXY=true`, `API_PROXY_TARGET=http://127.0.0.1:3001`), API local contra Neon con la identidad QA, orígenes de prueba permitidos en `FRONTEND_URL`. Probe: `scripts/qa/browser-session-probe.mjs`. Sólo booleanos y códigos.

| Prueba | Chrome | WebKit |
|---|---|---|
| Login por formulario → dashboard | ✓ | ✓ |
| Cookie `refreshToken`: `HttpOnly`, `SameSite=Lax`, `Path=/api/auth`, mismo origen | ✓ | ✓ |
| Access token caducado → sesión conservada | ✓ | ✓ |
| `refreshToken` ausente de `localStorage` | ✓ | ✓ |
| Logout (200) y refresh posterior (400) | ✓ | ✓ |
| **Cross-site** (página `localhost:3100`, API `127.0.0.1:3001`), refresh por cookie | **400** | **400** |
| **Same-site** (página y API `127.0.0.1`), refresh por cookie | **200** | **200** |

Método: Chrome con `bypassCSP`, sin interceptación. WebKit con reemisión **sólo de documentos** (`--csp-route`), porque `bypassCSP` no funciona bien en WebKit. Ambos métodos dan el mismo patrón cross/same-site. Lo verificado en el build local **no** sustituye a Preview ni a producción.

**Errores de método corregidos en esta iteración:** (1) reemitir la API con `route.fetch()` envía cookies fuera de las reglas de sitio; (2) la reemisión de documentos rompe Private Network Access en Chrome. Ambos invalidaron mediciones previas. Las cifras de la tabla son las medidas sin esos artefactos.

### 13.4 Matriz de validación en Preview y producción (TASK-002)

| Área | Local (verificado) | Preview | Producción |
|---|---|---|---|
| Login | ✓ Chrome, WebKit | Pendiente | Pendiente |
| Refresh por cookie | ✓ Chrome, WebKit (same-site) | Pendiente | Pendiente |
| Logout | ✓ | Pendiente | Pendiente |
| OAuth: inicio directo a Render | No ejecutado (requiere proveedor) | Pendiente | Pendiente |
| OAuth: intercambio por proxy | Ruteo verificado (401 JSON del backend ante código inválido) | Pendiente (flujo completo) | Pendiente |
| Caducidad de access token | ✓ Chrome, WebKit | Pendiente | Pendiente |
| Concurrencia (3 refresh en paralelo) | ✓ en curl/WebKit: 200 ×3 | Pendiente | Pendiente |
| Múltiples pestañas (cookie compartida) | Parcial (mismo contexto) | Pendiente | Pendiente |
| Cookies Chrome y WebKit cross-site | ✓ 400 / same-site 200 | Pendiente (HTTPS, dominios reales) | Pendiente |
| Rutas proxy `/api/*` | ✓ (`/api/auth/me` sin token → 401 del backend) | Pendiente | Pendiente |
| Rutas locales de Next `/api/logs`, `/api/csp-report` | ✓ `/api/logs` responde desde Next (400 por validación). `csp-report` no probado individualmente | Pendiente | Pendiente |
| Origen permitido por `FRONTEND_PREVIEW_HOST_SUFFIXES` | No aplicable en local | Pendiente | — |
| Rate limit con `X-Forwarded-For` tras el proxy | No verificado | Pendiente | Pendiente |

**Refresh en JSON:** **no se retira.** Consumidores: `e2e/oauth-handoff-*.spec.ts`, `e2e/session-and-fallback.spec.ts`, `backend/tests/integration/` (auth, final-state, review-*, ai06-sessions) y `__tests__/lib/*` de refresh. El frontend ya no lo lee ni lo guarda.

### 13.5 AUD-024 — procedimiento

**Estado en producción:** abierta. Comprobación con booleanos (`PASS_TEXT` comparado en proceso, nunca impreso): `https://impulso.anclora.com/auth/login` **contiene la contraseña de producción**.

**Comprobación de previews sin revelar credenciales:** `vercel env run -e preview -- node <comprobación>`, que compara el HTML de cada despliegue con el `PASS_TEXT` **de su propio entorno**. Resultado con los 12 despliegues más recientes: 0 con la contraseña de su entorno Preview, y 0 con la de Production. **Es sólo una muestra**: no cubre despliegues antiguos.

**Variables:** `UTILIZAR_USER_TEXT`, `USER_TEXT` y `PASS_TEXT` existen en los tres entornos (`production`, `preview` y `development`).

**Despliegues que necesitan actualización:** el valor se fija en build. Un cambio de variable **no** modifica el HTML ya generado. Hay que reconstruir o eliminar cada despliegue con la bandera activa, y con producción esto llega sólo con el nuevo despliegue.

**Procedimiento de integración y promoción del paquete A (según Governance):**
1. Toni valida el paquete A (diff de 2 ficheros, esta matriz).
2. Commit de A **solo**, en `development`, con el mensaje terminado en `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>`.
3. Push a `origin/development` (sólo tras la validación de Toni, `COMMIT_PUSH_REQUIRES_EXPLICIT_USER_VALIDATION=true`).
4. CI (`ci.yml`): lint, typecheck, `test:ci` con PostgreSQL `impulso_test`, build.
5. Revisión en Preview del commit: login y comprobación de HTML con booleanos.
6. Rotación de la contraseña de `PASS_TEXT` y retirada de las variables (Toni).
7. Promoción: `promote.yml` con `target=full` y `source_sha` = SHA revisado en Preview, token `PROMOTE=FULL`. Cadena `development → staging → production → main`.
8. Verificación de booleanos en producción tras el despliegue.

### 13.6 Render: preflight (sin imprimir valores)

| Comprobación | Resultado | Método |
|---|---|---|
| Servicio `Anclora-Impulso` | `branch=development`, `autoDeploy=no`, `rootDir=backend`, no suspendido | `render services --output json`, sólo campos de configuración |
| Commit en vivo | `5a5b05d`, live desde 2026-10-13. Sin commits de backend desde entonces | `render deploys list`, sólo commit y estado |
| `NODE_ENV=production` | **Inferido**: la API responde 500 sin campo `stack` ante JSON malformado | Petición HTTP |
| Secretos JWT ≥ 32 caracteres y distintos | **BLOCKED.** La CLI no expone variables (`serviceDetails.env` es el runtime, `node`) | — |
| `FRONTEND_URL` con dominio de producción y `FRONTEND_PREVIEW_HOST_SUFFIXES` | **BLOCKED** (mismo motivo) | — |
| Compatibilidad backend anterior/nuevo | El backend en vivo devuelve el refresh en el cuerpo y **no** emite `Set-Cookie`. El backend nuevo mantiene el cuerpo y añade la cookie: compatible con el frontend antiguo | Probe `auth-probe.mjs` contra Render |

**Comprobación manual de Toni (dashboard de Render, sin ver valores):** `NODE_ENV=production`; `JWT_SECRET` y `JWT_REFRESH_SECRET` con ≥ 32 caracteres y distintos; `FRONTEND_URL` con `https://impulso.anclora.com`; `FRONTEND_PREVIEW_HOST_SUFFIXES` con el sufijo de los previews.

**Cambio de configuración de Render:** ninguno en este paquete. Un despliegue manual del backend (B y C) lo hace Toni, porque `autoDeploy=no`.

### 13.7 CI y bases de datos

- `ci.yml` **ya provee** PostgreSQL de pruebas: servicio `postgres:16`, `localhost:5432`, base `impulso_test`, `prisma generate`, `prisma migrate deploy` y `pnpm test:ci` en el backend. El guard de TASK-012 lo admite (loopback, `*_test`). **Sin infraestructura nueva.**
- Las suites destructivas (`social-community.test.ts`, `deleteMany()`) corren sólo ahí.
- **Neon** queda para pruebas funcionales autorizadas con la identidad QA (contrato §10). El guard **sigue bloqueando** suites de integración contra Neon.
- CI **no** ejecuta E2E de Playwright. Esos quedan para Preview.

### 13.8 Matriz final por paquete

| Paquete | Estado de validación | Dependencias | Evidencias | Riesgos residuales | Cambios de configuración | Condiciones de integración | Condiciones de promoción | Aprobación del propietario |
|---|---|---|---|---|---|---|---|---|
| **A — AUD-024** | **Listo para revisión.** Aislado: tests, build y HTML con true/false | Ninguna | `A-AUD-024.patch`; matriz 13.5 | Abierta en producción hasta el despliegue. Previews antiguas | Vercel: `UTILIZAR_USER_TEXT` a false o retirar. Rotar contraseña. Retirar `USER_TEXT`/`PASS_TEXT` tras el despliegue | Commit solo, en `development`, tras validación de Toni. CI verde | `PROMOTE=FULL` con `source_sha` revisado en Preview | Revisar diff; autorizar commit; rotar contraseña; autorizar retirada de variables |
| **B — TASK-002** | **Listo para revisión.** Aislado. Local en Chrome y WebKit. **Preview pendiente** | A (independiente). Backend B antes que frontend B | `B-TASK-002.patch`; 13.3; 13.4 | Refresh en JSON. OAuth E2E. Rate limit tras proxy. Rotación en ventana de 10 s | Vercel Preview y Production: `NEXT_PUBLIC_API_PROXY=true`, `API_PROXY_TARGET=https://anclora-impulso.onrender.com`. Render: despliegue manual del backend | Backend B desplegado primero. Matriz 13.4 en Preview | Promoción aparte. Matriz completa en Preview y en producción tras promover | Revisar diff; autorizar variables; autorizar despliegue backend; aprobar plan de retirada del refresh en JSON |
| **C — Resto Fase 0** | **Listo para revisión.** Aislado. Backend verde | Ninguna (independiente de B) | `C-FASE0-RESTO.patch`; 13.2 | **Secretos de Render: BLOCKED.** Arranque falla si son cortos o iguales | Render: verificar secretos y `NODE_ENV` antes del despliegue manual | Tras verificar secretos de Render. CI verde | Promoción aparte | Revisar diff; atribución del contrato; aprobar entrada del guard en producción |
| **D — Redacción** | **Listo para revisión.** Aislado: 8/8 | Ninguna | `D-CREDENTIAL-REDACTION.patch`; 13.1 | Ninguno funcional. Depende de disciplina de los agentes | Ninguna | Commit separado en `development` | Ninguna (sólo herramientas QA) | Revisar; autorizar commit |

### 13.9 Acciones que requieren tu aprobación

1. **Ahora:** poner `UTILIZAR_USER_TEXT` a `false` (o retirarla) en Vercel, y **rotar la contraseña** de la cuenta de `PASS_TEXT`.
2. Revisar y aprobar el commit de **A**.
3. Verificar en Render los secretos JWT y `NODE_ENV`, y `FRONTEND_URL` y `FRONTEND_PREVIEW_HOST_SUFFIXES`.
4. Aprobar el commit de **D** (herramientas de redacción).
5. Aprobar el commit del backend de **B** y su despliegue manual en Render.
6. Aprobar las variables `NEXT_PUBLIC_API_PROXY` y `API_PROXY_TARGET` en Preview, y el commit del frontend de **B**.
7. Aprobar el commit de **C** tras la verificación de Render.
8. Decidir la retirada del refresh en JSON (AUD-001), tras la matriz en Preview y en producción.
9. Decidir si el segundo incidente de exposición que mencionas es otro caso, para verificarlo.
10. Confirmar el texto de la declaración de datos de prueba para el contrato (§8).

**Fase 0 no se declara cerrada.** Las condiciones de cierre son: AUD-024 cerrada en producción con la rotación confirmada; B con su matriz completa en Preview y producción; C aprobado tras la verificación de Render; y decisión sobre el refresh en JSON.

---

## 14. AUD-024: estado de contención (2026-11-10, verificación de solo lectura)

> **Estado: CONTENIDA en producción, NO CERRADA.** Tres niveles distintos: **contención** (hecha y verificada en lo público), **rotación** (pendiente, no verificable en solo lectura) y **cierre definitivo** (requiere el Paquete A desplegado). Ninguna prueba muestra secretos, HTML completo ni valores de variables.

### 14.1 Acciones ejecutadas por el propietario

| Acción | Entorno | Verificación del agente |
|---|---|---|
| Eliminar `USER_TEXT`, `PASS_TEXT` y `UTILIZAR_USER_TEXT` | Vercel: Production, Preview, Development | **Verificado por nombre**: 0 variables con esos nombres en los tres entornos (`vercel env ls`, sólo nombres) |
| Eliminar las mismas variables | Render | **No verificable** con la CLI (no lista variables). Declaración del propietario. El backend no las lee (§13 y `19`), así que no afectan a la API |
| Reconstruir Production desde el mismo commit | Vercel | Declaración del propietario. El agente **no** ha verificado el identificador del despliegue reconstruido |

### 14.2 Pruebas de contención (solo lectura, sin valores)

**Metodología:** detector estructural sobre el HTML de `/auth/login`. Comprueba, sin imprimir contenido: (a) campos `<input>` con atributo `value` no vacío; (b) props serializadas `defaultPassword` y `defaultEmail` con contenido no vacío. No compara contra el valor antiguo, que ya no existe en ningún entorno.

**Control positivo (obligatorio para que el negativo valga):** HEAD compilado con `UTILIZAR_USER_TEXT=true` y un centinela falso. El detector lo **detecta**: 2 campos con valor y ambas props no vacías.

| Prueba | Resultado |
|---|---|
| Alias públicos: `https://impulso.anclora.com` y `https://anclora-impulso.vercel.app` | HTTP 200. Campos con valor: **0**. `defaultPassword` no vacío: **no**. `defaultEmail` no vacío: **no** |
| Despliegues listados por la CLI (20) | **Todos responden 302** a un host de Vercel: protección de acceso. **No son accesibles públicamente**, y no se ha analizado su HTML |
| Total de URL comprobadas | 22 (2 públicas + 20 protegidas) |
| Login real en producción, Chrome | Redirige a `/dashboard`. Sesión conservada con access token caducado |
| Login real en producción, WebKit | Igual que Chrome |
| Endpoints reales de Render (identidad QA) | login 200 · `me` 200 · logout 200 · refresh con cookie 400 (esperado: el backend desplegado es anterior a B) |

**Matices de la prueba de login:**
- El probe reporta `refreshTokenInLocalStorage=true` y logout/refresh `404`. Es el comportamiento **del código comprometido en producción** (refresh en `localStorage`, llamada directa a Render). La medida de logout del probe llama al origen del frontend, así que no es la medida válida; la válida es la de Render (arriba).
- Estos resultados **no son un fallo de login**.

**Sesiones QA:** las abiertas por estas pruebas (3) están revocadas (`revokedReason=aud024_containment_check_cleanup`). Activas tras la limpieza: 0.

### 14.3 Distinciones

| Nivel | Qué significa | Estado |
|---|---|---|
| **Contención** | La versión pública no contiene credenciales precargadas, y las variables ya no existen en Vercel | **Verificada** en los 2 alias públicos y por nombre en los 3 entornos. Render: declaración del propietario |
| **Rotación** | La contraseña de la cuenta de `PASS_TEXT` deja de ser válida | **PENDIENTE.** No verificable en solo lectura, y el valor antiguo ya no está en el entorno. Hay que confirmar con el propietario que se rotó y qué cuenta era |
| **Cierre definitivo** | El código de producción ya no lee las variables, y no puede volver a exponer nada | **PENDIENTE.** El código comprometido (`main` = `0e0b897`) todavía contiene la lectura: es inerte sin las variables, pero si se vuelven a crear con `true`, **vuelve a exponer**. Requiere el Paquete A integrado y desplegado |

### 14.4 Otros despliegues que podrían mantener la exposición

- Los 20 despliegues protegidos **no son públicos** hoy. Su HTML podría contener la contraseña si se construyó con la bandera en `true`. Si alguien desactivara la protección, quedarían expuestos.
- **Pendiente (Toni):** decidir si esos despliegues se eliminan o se dejan protegidos. Recomendación: eliminar los que se construyeron antes de la retirada de las variables.
- Las previews protegidas no se han comprobado por contenido: no son accesibles sin autenticación de Vercel.

### 14.5 Pendientes

| # | Pendiente | Responsable | Bloquea el cierre |
|---|---|---|---|
| P1 | **ACEPTADO POR EL PROPIETARIO** (ver §14.6): riesgo residual de la contraseña expuesta; no se exige rotación. Condiciones: cuenta sólo de pruebas, sin reutilización en otros servicios y sin privilegios sensibles | Toni | No (decisión tomada) |
| P2 | Confirmar en Render que las tres variables están eliminadas (sólo nombres, en el dashboard) | Toni | No (sin efecto en la API), pero sí para la declaración |
| P3 | Confirmar el identificador del despliegue de Production reconstruido y que procede del commit esperado | Toni (dashboard) | No |
| P4 | Decidir sobre los despliegues protegidos antiguos (§14.4) | Toni | No |
| P5 | Integrar y desplegar el Paquete A (commit validado, Preview, promoción según `18`/`19`) | Toni (aprobación) + agente | **Sí** |
| P6 | Tras P5: booleanos en producción y previews, y comprobación de que el código ya no lee las variables | Agente (lectura) | **Sí** |
| P7 | Actualizar `backend/docs/TEST_DATABASE.md` y el documento `44-…` que describen las variables como de uso | Agente, tras P5 | No |

**AUD-024 no se declara cerrada.** Queda contenida en el entorno público. El cierre definitivo depende sólo de desplegar el Paquete A (P5 y P6).

### 14.6 Decisión del propietario sobre el riesgo residual (2026-11-10)

El propietario **acepta expresamente el riesgo residual** de la contraseña expuesta, por tratarse de una cuenta utilizada exclusivamente para pruebas, sin usuarios reales ni datos de clientes. **No se exige su rotación como condición de cierre**, con dos condiciones:

1. La contraseña no se reutiliza en otros servicios.
2. La cuenta no concede privilegios sensibles.

**Estado de cada condición en este informe:**

| Condición | Qué se ha podido verificar | Qué no se puede verificar |
|---|---|---|
| Cuenta sólo de pruebas, sin datos de clientes | La cuenta `qa.impulso@anclora.local` es de prueba. Los dominios de email de la base son mayoritariamente `example.com` (declaración del propietario, conteos en §12) | Que la cuenta de `PASS_TEXT` sea la misma que la QA. El propietario lo declara |
| Sin reutilización en otros servicios | Nada | Es una declaración del propietario. No es verificable desde el repositorio |
| Sin privilegios sensibles | La cuenta QA no aparece en la lista de administradores visible en el entorno local (§13) | La lista de administradores de Render no se ha podido leer |

**Consecuencia:** el riesgo residual queda aceptado y registrado. Se mantiene la vigilancia de las dos condiciones. Si cambia alguna (por ejemplo, si la contraseña se usara en otro servicio o la cuenta recibiera privilegios), la aceptación deja de ser válida y se reabre la rotación.

**Lo que la decisión no cambia:** el cierre definitivo de AUD-024 sigue requiriendo que el código sin lectura de variables esté desplegado (Paquete A, P5 y P6). La aceptación del riesgo residual no sustituye a esa corrección.
