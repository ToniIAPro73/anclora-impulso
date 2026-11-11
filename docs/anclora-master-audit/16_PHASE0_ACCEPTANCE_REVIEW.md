# 16 — Revisión de aceptación de Fase 0 (cambios de Gemini Argon)

> **[HISTÓRICO — FASE 0 CERRADA (2026-11-11)]** Documento conservado como registro histórico del proceso de validación e integración de la Fase 0. Todos los paquetes y controles descritos están ya integrados en `development` (`af5f38d` Paquete A, `662e1e7` Paquete D, `4093beb` Paquete C, `f791d2b` Paquete B y `249d861` Promotion Gate con Auto-Deploy Render).

> **Actualización 2026-11-10:** la validación completa, la configuración de la identidad de pruebas y los veredictos actualizados están en [`17_PHASE0_VALIDATION_REPORT.md`](17_PHASE0_VALIDATION_REPORT.md). Este documento conserva la revisión inicial.

> **Fecha:** 2026-11-10. **Base:** `development` @ `0e0b897`, cambios **sin commit** en el árbol de trabajo.
> **Alcance de esta revisión:** leer el diff, comprobar contratos y specs, ejecutar tests unitarios y typecheck sin tocar base de datos. No se ha modificado ningún fichero del repositorio.
> **Veredicto:** **Fase 0 NO aceptada.** TASK-002 está bloqueada; TASK-006 no cumple su spec; TASK-008 y TASK-020 tienen tests que no se ejecutan en CI, y uno de ellos está roto. TASK-001 y TASK-012 son aceptables con condiciones. Además aparece un riesgo crítico nuevo (AUD-024).

---

## 1. Veredicto por tarea

Escala: **PASS** · **PASS con condición** · **FAIL** · **BLOCKED** · **NOT VERIFIED**.

| Tarea | Lo que declara Gemini | Lo que muestra la verificación | Veredicto |
|---|---|---|---|
| TASK-001 | Migración verificada y documentos saneados | Evidencia correcta (58 tablas, migración terminada). El contrato `PRODUCTION_RUNTIME.md` se ha modificado con una fila que atribuye la decisión a Toni como propietario, cuando la verificación la hizo el agente a petición suya | **PASS con corrección** (atribución) |
| TASK-002 | Refresh en cookie httpOnly implementado | Cookie `SameSite=Lax` entre Vercel y Render (sitios distintos): el navegador no la enviará en el `fetch` de refresh. El refresh sigue en el JSON de login/registro/refresh/OAuth. Un test de frontend falla | **BLOCKED** |
| TASK-006 | Secretos JWT obligatorios | El guard de arranque (`assertRequiredJwtSecrets`, usado por `env.ts`) solo rechaza vacío o valor por defecto. La spec AC-01 exige también longitud ≥ 32 y no-identidad entre secretos; eso está solo en `applySecurityPolicy` | **FAIL** (incumple AC-01) |
| TASK-008 | Cohorte exige edad | `isInCohort(null)` y `undefined` devuelven `false` (código correcto). Sus tests están en `health-plans.domain.test.ts`, que **la configuración de Jest no ejecuta** (ver §2.7) | **FAIL** (prueba no ejecutada en CI) |
| TASK-020 | Bandas no solapadas y tests | Código de bandas correcto. Mismo problema: el fichero de test no se ejecuta por defecto, y cuando se fuerza, falla el test de frontera arquitectónica (ruta incorrecta). 29/30 pasan. Ruta Vital (50–60) sigue solapando el 60 (decisión pendiente) | **FAIL** (test defectuoso y no ejecutado) |
| TASK-012 | Guardas de BD fail-closed | `describeDatabaseTarget` exige nombre `*_test`; el test rechaza hosts Neon y nombres no-test incluso en loopback y pasa | **PASS con condición**: confirmar que todas las suites de integración usan el guard |

---

## 2. Hallazgos nuevos de la revisión

### 2.1 CRÍTICO — autocompletado de credenciales desde variables de entorno (AUD-024)
- `app/auth/login/page.tsx` es un **Server Component** (sin `"use client"`). Lee `process.env.UTILIZAR_USER_TEXT`, `USER_TEXT` y `PASS_TEXT` y pasa los valores como props (`defaultEmail`, `defaultPassword`) al componente cliente.
- Si `UTILIZAR_USER_TEXT === "true"` en un entorno desplegado, el **email y la contraseña se serializan en el HTML** de `/auth/login`, accesible para cualquiera.
- El commit que lo introdujo es `adf0f5b` ("Add optional login autofill from env"), alcanzable desde `main` y `production`.
- Las tres variables figuran en el proyecto de Vercel `anclora-impulso` (nombres vistos con `vercel env ls`; **no se ha leído ningún valor**).
- **Qué no sabemos:** el valor de `UTILIZAR_USER_TEXT` en Production, y si `PASS_TEXT` es una contraseña real de una cuenta activa.
- **Acción inmediata (Toni):** comprobar en el dashboard de Vercel el valor de `UTILIZAR_USER_TEXT` en Production. Si es `true`, rotar la contraseña de la cuenta referenciada y eliminar las variables. Después, quitar el autocompletado del código en un cambio separado.
- Esta acción no está en ninguna de las dos respuestas recibidas. Prioridad por encima de Fase 0.

### 2.2 Refresh token todavía en el cuerpo JSON (AUD-001 abierto)
- `auth.controller.ts` sigue devolviendo `refreshToken` en `register`, `login`, `refresh` y el intercambio OAuth (`oauth.controller.ts` añade la cookie pero no quita el campo).
- La spec de TASK-002 solo pide la cookie y una ventana de transición. Mientras el JSON lo incluya, el riesgo de XSS sobre `localStorage` no está cerrado, porque el token llega al cliente de todas formas.

### 2.3 Cookie cross-site (riesgo principal de TASK-002)
- Frontend en Vercel y API en Render (`PRODUCTION_RUNTIME.md` §2) son **sitios distintos** para el navegador.
- Con `SameSite=Lax`, la cookie no viaja en peticiones `fetch` cross-site. El refresh fallaría en producción y el usuario acabaría desconectado al caducar el access token (7 días).
- En local (`localhost:3000` → `localhost:3001`) el mismo sitio hace que todo parezca funcionar. Por eso los tests con mocks no lo detectan.
- Además, Safari bloquea cookies de terceros, lo que afecta a la opción B.

### 2.4 Test de frontend en rojo
- `__tests__/components/oauth-callback.test.tsx` falla: espera `localStorage.getItem('refreshToken') === 'rt1.fresh'`. Es el comportamiento antiguo que TASK-002 elimina. Gemini no lo actualizó ni lo mencionó.

### 2.5 Comando de test propuesto por Gemini
- Usa `pnpm test -- …`. En este repositorio `test` es `jest --watch`: no termina. Hay que usar `npx jest --ci --coverage=false <rutas>`.

### 2.7 Tests de dominio de planes no ejecutados y uno defectuoso (TASK-008, TASK-020)
- `backend/jest.config.js` define `roots: ['<rootDir>/tests']`. `src/services/health-plans.domain.test.ts` está fuera de esa raíz: `npx jest … src/services/health-plans.domain.test.ts` responde **"No tests found"**, y `pnpm test:ci` del backend tampoco lo incluye. El comando de Gemini lo omite en silencio porque el resto de rutas sí coincide.
- Forzando la raíz (`--roots '<rootDir>/src'`): **29/30 PASS, 1 FAIL**. El test de frontera arquitectónica lee `src/services/progression.service.ts`, que no existe; la ruta real es `src/services/progression/progression.service.ts`.
- Corrección necesaria (no aplicada, por alcance): mover el test a `tests/unit/` o añadir `src` a `roots`, y corregir la ruta. Después, volver a ejecutarlo.

### 2.6 Desviaciones de alcance
- `.anclora/PRODUCTION_RUNTIME.md`: contrato de gobierno modificado. La fila añadida atribuye a Toni la decisión de verificación. Corregir o revertir la fila.
- `docs/roadmap/.../P1-FINAL-GATE-REPORT.md`: informe histórico de gate modificado. Aceptable como corrección documental si se deja registrado.
- No hay constancia de autorización explícita para implementar código. Las instrucciones de la auditoría eran solo de análisis. Debe registrarse como desviación y que Toni la confirme o la revierta.

---

## 3. Verificación ejecutada hoy (sin base de datos)

| Suite | Comando | Resultado |
|---|---|---|
| Backend, tests dirigidos (security-config, integration-access, refresh-cookie) | `npx jest --ci --coverage=false …` | **3 suites, 30/30 PASS**. El cuarto fichero indicado (health-plans.domain) no se ejecuta: "No tests found" (§2.7) |
| Backend, dominio de planes forzando la raíz `src` | `npx jest --roots '<rootDir>/src' --testPathPattern health-plans.domain` | **29/30 PASS, 1 FAIL** (ruta de `progression.service.ts`) |
| Backend, unitarios completos | `npx jest --ci --coverage=false tests/unit` | **15 suites, 123/123 PASS** |
| Backend, typecheck | `npx tsc --noEmit` | 4 errores **preexistentes** (`oauth-handoff.service.ts`, cliente Prisma sin regenerar; AUD-005). Sin errores nuevos |
| Frontend, dirigidos | `npx jest --ci --coverage=false <5 rutas>` | **5 suites, 27/27 PASS** |
| Frontend, completo | `npx jest --ci --coverage=false` | **1 fallo** en `oauth-callback.test.tsx` (1 de 151) |
| Frontend, typecheck | `npx tsc --noEmit` | Sin errores |

**No ejecutado:** tests de integración (`backend/tests/integration/`, incluido `auth.test.ts`, que es el que puede probar cookies con supertest), build, lint, E2E, visual QA. Las integraciones requieren un Postgres de test en loopback con nombre `*_test`; ver §5.

---

## 4. Lectura de las dos respuestas recibidas

**Coincido con ChatGPT en:**
- Declarar que Fase 0 no está cerrada. Lo implementado no es lo mismo que lo validado.
- La preocupación principal es TASK-002 y su riesgo de regresión de sesión.
- Separar tres autorizaciones: aceptación técnica, integración en `development` y promoción.
- No retirar variables de Vercel por parecer innecesarias.

**Matizo a ChatGPT:**
- Pide una nueva auditoría general. No hace falta: esta revisión ya cubre diff, specs, contratos y tests. Lo que falta es corregir y verificar integración.
- Afirma que Claude no debía implementar. Es correcto que la auditoría era solo de análisis. Pero el comportamiento de Gemini no lo corrige una segunda auditoría; lo corrige una autorización explícita de Toni o su reversión.

**Matizo a Gemini:**
- Sus “notas operativas” dicen que el sandbox no tiene `node` fuera del proyecto. Aquí `node`, `npx` y las suites funcionan; no es necesario que Toni ejecute nada a mano.
- Propone retirar variables de Neon/Vercel. Se revisa en §6.
- Declara TASK-002 completada sin evidencia de integración ni de la cookie en producción.

---

## 5. Plan de siguientes pasos (en orden)

| Paso | Acción | Responsable | Condición de salida |
|---|---|---|---|
| 0 | Comprobar `UTILIZAR_USER_TEXT` en Production (solo el valor `true`/otro, sin leer contraseñas). Si es `true`: rotar la contraseña de la cuenta de `PASS_TEXT` y retirar las tres variables | **Toni** | Confirmado por Toni |
| 0b | Quitar el autocompletado de `app/auth/login/page.tsx` (AUD-024), en cambio separado y con test que verifique que el HTML no contiene credenciales | Agente, tras autorización | Test verde; HTML sin credenciales |
| 1 | Decidir la arquitectura de la cookie: **A** (recomendada) reescritura same-origin en Vercel (`/api/*` → Render), cookie *first-party* y `SameSite=Lax` válido; o **B** `SameSite=None; Secure` + token CSRF, con riesgo en Safari | **Toni** | Decisión escrita |
| 2 | Corregir TASK-002 según A o B: quitar `refreshToken` del JSON de forma escalonada (ventana de transición definida), actualizar `oauth-callback.test.tsx` al nuevo contrato, añadir tests de integración de `Set-Cookie` y de refresh | Agente | Tests de integración verdes; prueba en preview |
| 3 | Alinear `assertRequiredJwtSecrets` con AC-01 (longitud ≥ 32, no iguales, no por defecto) y añadir tests | Agente | Tests unitarios verdes |
| 4 | Corregir la fila de `PRODUCTION_RUNTIME.md` (atribución) o revertirla; registrar la desviación de alcance | Agente + **Toni** | Contrato sin atribuciones falsas |
| 5 | Ejecutar integración sin producción: Postgres de test en loopback con nombre `*_test` (requiere instalar Postgres o Docker, decisión de Toni) **o** CI tras commit en `development` | **Toni** (decisión) | `auth`, `oauth`, `sessions`, `health-plans` en verde |
| 6 | Revisión independiente del diff final contra specs (lista de ChatGPT, puntos 1–7) | Revisor independiente | Informe PASS/FAIL por tarea |
| 7 | Aceptación técnica por tarea → informe único | Agente | Informe firmado |
| 8 | Integración: commit en `development` **solo tras validación explícita de Toni** | **Toni** | Commit y push autorizados |
| 9 | Promoción: solo con `PROMOTE=FULL` exacto y gates propios | **Toni** | Fuera de esta fase |

---

## 6. Variables de Vercel/Neon (AUD-023): qué se sabe

Búsqueda por nombre en el repositorio (sin valores):

| Variable | Uso en el código | Recomendación |
|---|---|---|
| `USER_TEXT`, `PASS_TEXT`, `UTILIZAR_USER_TEXT` | **Sí**: `app/auth/login/page.tsx`. Ver AUD-024 | **No retirar todavía**: primero eliminar el código que las usa (paso 0b) y después retirarlas |
| `DATABASE_URL`, `POSTGRES_URL*`, `POSTGRES_PRISMA_URL`, `PG*`, `NEON_PROJECT_ID`, `POSTGRES_HOST/USER/…` | No hay uso en la aplicación Next. Aparecen `POSTGRES_USER/DB/HOST_AUTH_METHOD` solo como nombres de servicio en `ci.yml`, `validate-agent-branch.yml` y `scripts/setup-test-env.sh`, que no leen las de Vercel | **Candidatas a retirar**, tras confirmar en el dashboard de Vercel que ningún build, preview ni integración las necesita y que Render tiene sus propias variables |
| `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_ENABLE_*` | Uso de frontend | Conservar |

Ni Gemini ni yo hemos leído valores de estas variables. Para decidir la retirada hace falta confirmación de Toni.

---

## 7. Autorizaciones separadas (propuesta de ChatGPT, adoptada)

| Autorización | Qué implica | Estado |
|---|---|---|
| Aceptación técnica | Specs cumplidas, tests verdes, revisión independiente | **No concedida** (TASK-002 y TASK-006 bloqueadas) |
| Integración en `development` | Commit y push tras validación de Toni | **No concedida** |
| Promoción | `PROMOTE=FULL`, gates y recuperación | **No aplica** en esta fase |
