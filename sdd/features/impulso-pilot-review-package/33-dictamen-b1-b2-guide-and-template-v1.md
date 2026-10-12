# 33 — Guía y plantilla para tus dictámenes B1 (seguridad) y B2 (integridad AI-08) (v1, 2026-10-12)

> Herramienta de trabajo. **No es un dictamen ni lo rellena el agente por ti.** No acepta ninguna tarea AI-xx ni gate.
> Designación: `29-decisions-record-2026-10-12.md` §1 (#4): B1 y B2 = Toni. **No es una revisión independiente** (§0).
> Formato de retorno: el mismo de `14-assignments/14B1-…` y `13-review-requests/13b-…`, ampliado para ser trazable.

## 0. Antes de empezar — qué vale y qué no vale tu dictamen

| Aspecto | Realidad |
|---|---|
| Independencia | No lo eres: dirigiste la implementación. Tu dictamen es un **control adicional del propietario**, no la «revisión competente e independiente» que el plan exige a tareas P0 |
| Competencia | Decláralas tú, con sus límites, en la ficha. Si no tienes formación en seguridad de aplicaciones o en concurrencia de PostgreSQL, di «no evaluable» en lo que no domines. Es una respuesta válida |
| Dos dictámenes | B1 y B2 son documentos **separados**, con alcance y fecha propios |
| Para qué sirve | Dejar por escrito qué comprobaste, con qué evidencia y qué decides tú. Sirve como base para una revisión independiente posterior, no la sustituye |

## 1. Qué versión revisar (importante)

El ZIP `ae3e5575…` y las preevaluaciones IA (`15-…`, sobre el árbol `71151408…`) **son anteriores** a cambios que se hicieron
después y que **nadie ha revisado salvo el propio agente**. Revisa el **código en producción**:

| Elemento | Valor |
|---|---|
| Commit de código desplegado | `c0333f3a6e8c7e1a73c9a68c9a24cd5015b3a98d` (Render, Live) |
| Cambios de código posteriores | **Ninguno**: `git diff c0333f3..HEAD -- backend app components lib` está vacío (solo docs, CI y scripts) |
| Delta no cubierto por el ZIP | 27 ficheros, +666/−156 líneas entre `944eb67` y `c0333f3` (§2) |

Comando para ver el delta completo:
```bash
git diff --stat 944eb67..c0333f3 -- backend/src backend/prisma app components lib middleware.ts
git diff 944eb67..c0333f3 -- backend/src/services/oauth-handoff.service.ts backend/src/middleware/admin.ts
```

## 2. Qué es nuevo y no tiene revisión previa (léelo primero)

| Cambio | Ficheros principales | Descrito en | Qué conviene mirar |
|---|---|---|---|
| **F-1** admin por UUID (`ADMIN_USER_IDS`), no por e-mail | `config/env.ts`, `middleware/admin.ts`, `services/auth.service.ts`, `services/account-lookup.service.ts` | `16-…` §2, §9 | Analizador de la lista (UUID canónico, entradas inválidas descartadas, falla cerrado); `ADMIN_EMAILS` ya no autoriza |
| **F-4** OAuth con handoff de un solo uso | `services/oauth-handoff.service.ts`, `controllers/oauth.controller.ts`, `app/auth/callback/page.tsx`, `lib/auth/oauth.ts`, migración `…090000_add_oauth_handoffs` | `17-…` | Caducidad (60 s por defecto, 10–300), un solo canje, no hay tokens en URL, política de vinculación de cuentas (§3 del doc 17) |
| **F-2** `workoutId` en `POST /api/sessions` | `services/sessions.service.ts` | `16-…` §3 | Propiedad del recurso (un usuario no puede referenciar la rutina de otro) |
| **F-3** medidas corporales | `services/progress.service.ts`, `routes/progress.routes.ts` | `16-…` §4 | Validación y propiedad |
| **NF-1** guard de destino de tests | `backend/scripts/test-db.sh`, `backend/tests/support/*` | `16-…` §1 | Que los tests no puedan apuntar a producción |
| Redacción de logs | `utils/redact.ts`, `middleware/errorHandler.ts` | `10-…` R4 | Que no se registren cuerpos, contraseñas ni `code` OAuth |

## 3. Plan de trabajo sugerido (orden y tiempo orientativo)

| Paso | Qué haces | Dónde | Tiempo orientativo |
|---|---|---|---|
| 1 | Leer §2 y los documentos 16 y 17 | `sdd/features/impulso-pilot-review-package/` | 45–60 min |
| 2 | B1: revisar los ficheros de §4.1 respondiendo las preguntas | repo en `c0333f3` | 1–2 h |
| 3 | B2: revisar los ficheros de §5.1 respondiendo las preguntas | repo en `c0333f3` | 1–2 h |
| 4 | Contrastar con la evidencia: tests locales (23 suites / 141) y Stage D de producción (`32-…`) | `32-…`, `10-…`, `11-…` | 20 min |
| 5 | Rellenar §6 por cada dictamen y firmar | este documento | 30 min |

## 4. B1 — Seguridad (AI-06 AC10 + delta F-1/F-2/F-3/F-4)

### 4.1 Ficheros
`backend/src/services/session.service.ts`, `middleware/auth.ts`, `middleware/admin.ts`, `controllers/auth.controller.ts`,
`services/auth.service.ts`, `utils/jwt.ts`, `utils/security-config.ts`, `config/logger.ts`, `utils/redact.ts`,
`middleware/errorHandler.ts`, `middleware/httpLogger.ts`, `controllers/oauth.controller.ts`,
`services/oauth-handoff.service.ts`, `services/oauth.service.ts`, `routes/dashboard.routes.ts`, `lib/api/client.ts`,
`lib/auth/oauth.ts`, `lib/contexts/auth-context.tsx`, `app/auth/callback/page.tsx`.

### 4.2 Preguntas y qué mirar
| # | Pregunta | Dónde mirar | Evidencia existente | Criterio para decidir |
|---|---|---|---|---|
| S1 | ¿Es aceptable bearer en `localStorage` para el piloto, o hace falta cookie antes del lanzamiento? | `lib/api/client.ts`, `auth-context.tsx` | `06-packet-security.md`; XSS: CSP en `middleware.ts` | Aceptable solo si el riesgo de XSS está mitigado y lo asumes por escrito |
| S2 | ¿Aceptas la ventana de gracia de 10 s en el refresco (un replay dentro se acepta y no se detecta)? | `session.service.ts`, `AUTH_REFRESH_REUSE_GRACE_SECONDS` | `ai06-sessions` (21 tests) | Decide si 10 s es tolerable o se reduce |
| S3 | ¿Duración requerida de tokens? | `utils/jwt.ts`, `AUTH_REFRESH_SESSION_DAYS` | — | Valor concreto o «mantener» |
| S4 | ¿Controles previos a `AUTH_ACCEPT_LEGACY_TOKENS=false`? | `middleware/auth.ts` | `10-…` | Cuándo y con qué señal retirar los tokens antiguos |
| S5 | ¿El canje OAuth de un solo uso (60 s) es suficiente y está bien acotado? | `oauth-handoff.service.ts` | `17-…` §5–§6 | Un canje, no reutilizable, caduca; sin tokens en URL |
| S6 | ¿La vinculación de cuentas impide secuestro de cuenta por e-mail? | `oauth.service.ts`, `account-lookup.service.ts` | `17-…` §3 «cerrada» | Solo vincula con e-mail verificado por el proveedor |
| S7 | ¿Admin sin MFA es aceptable mientras `ADMIN_USER_IDS` tenga pocos IDs? | `middleware/admin.ts` | Producción: admin 200 / usuario 403 (verificado) | Decisión de riesgo tuya |
| S8 | ¿Retención y cobertura de redacción de logs? | `utils/redact.ts`, `errorHandler.ts` | `10-…` R4 | Que no haya contraseñas, tokens ni `code` en logs |
| S9 | ¿`/api/dashboard/*` solo admin? | `routes/dashboard.routes.ts` | `dashboard-authorization` (14 tests) | Anónimo 401, no admin 403 |

## 5. B2 — Integridad e idempotencia (AI-08)

### 5.1 Ficheros
`backend/src/services/idempotency.service.ts`, `middleware/idempotency.ts`, `services/coach/coach.service.ts`,
`services/workouts.service.ts`, `scripts/maintenance/purge-expired.ts`, `prisma/schema.prisma`, migraciones
`20261012030000…20261012050000`, `backend/tests/integration/{inc01…inc04,review-r1-r2,review-r4,review-r7}*`.

### 5.2 Preguntas y qué mirar
| # | Pregunta | Dónde mirar | Evidencia existente | Criterio |
|---|---|---|---|---|
| I1 | ¿Basta compare-and-set con relectura en la toma de un lock caducado, o hace falta bloqueo de fila? | `idempotency.service.ts` | Pruebas de integración inc02/inc03 | Que no exista ventana en la que dos ejecuciones apliquen el efecto |
| I2 | ¿El «fence» de reconciliación (nuevo token + `failed`) es correcto para un dueño lento pero vivo? | `coach.service.ts` (reconciliación) | review-r1-r2 | Liberación de reserva exactamente una vez |
| I3 | ¿Orden de bloqueos (ventana → registro) completo en todas las rutas? | `coach.service.ts`, `workouts.service.ts` | Deadlock previo **no reproducido** | Sin ciclos |
| I4 | ¿La evidencia local + Stage D satisface «tests en staging» según A-08-01? | `02-…` (aprobada por ti), `32-…` | Stage D: D1, D3, D7 OK; **D2 no evaluable** | Tu criterio; D2 sigue sin cubrirse con el coach desactivado |
| I5 | ¿Topes experimentales (3/5/2) aceptables como protección operativa? | `config/env.ts` | — | Valores y justificación |
| I6 | La migración 5 se editó tras una aplicación local: ¿aceptable? | `MIGRATION-5.md`, migración `…050000` | Checksum canónico fijado; aplicada en producción (run #1) | Ya aplicada y verificada; documentar la excepción |

## 6. Plantilla de retorno (rellenar uno por dictamen)

```
DICTAMEN [B1 | B2] — Anclora Impulso
Revisor: Toni (ToniIAPro73), propietario del producto — NO independiente de la implementación
Competencia declarada y límites: ...
Fecha: ...
Versión revisada: commit c0333f3a6e8c7e1a73c9a68c9a24cd5015b3a98d (código en producción)
Evidencia consultada: ... (documentos, tests, resultado Stage D 32-…)
Ficheros realmente leídos: ...
Método: lectura de código / ejecución de tests / consulta a producción (indicar)

Respuestas:
  S1: ...   (o I1: ...)
  ...
Hallazgos (id · ubicación · efecto · evidencia · severidad):
  1. ...
Decisión sobre el alcance de este dictamen (marca una):
  [ ] sin cambios requeridos   [ ] requiere cambios   [ ] no evaluable (indicar qué falta)
Condiciones y pendientes: ...
Límites de la revisión: no independiente; no acepta AI-06 ni AI-08; no sustituye la revisión externa
Firma: ...
```

## 7. Después de redactar

1. Guarda cada dictamen como fichero nuevo en `sdd/features/impulso-pilot-review-package/` (p. ej. `35-dictamen-b1-toni.md`).
2. Dime que están listos: actualizo el registro (`14-…`: B1/B2 → «DICTAMEN RECIBIDO», vinculado a la versión) y el documento 28.
3. **No sustituye** una revisión independiente: sigue pendiente para AI-06 AC10 y AI-08.
