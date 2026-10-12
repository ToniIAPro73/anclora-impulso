# 15-D-IA — Pre-evaluación IA documental/técnica del paquete legal L1–L8 (Anclora Impulso)

> **Esto NO es un dictamen jurídico, NO es una aprobación de L1–L8 ni de ninguna tarea AI-xx / G1–G4 / lanzamiento.**
> Es una pre-evaluación de hechos técnicos y de contraste con fuentes oficiales, para que el profesional jurídico (aún sin designar)
> parta de hechos verificados y de preguntas concretas. Ningún texto de términos/privacidad aquí propuesto: no se redactan textos finales.

---

## 1. Encargo y tipo de revisión IA; agente/modelo; relación con la implementación

| Campo | Entrada |
|---|---|
| Encargo | Asignación D, ítems L1–L8 únicamente (`14-assignments/14D-legal-l1-l8.md`, `13-review-requests/13d-legal-l1-l8.md`, `08-packet-legal.md`) |
| Tipo | Pre-evaluación IA (D-IA): verificación de correspondencias código/esquema/textos + contraste con fuentes oficiales ES/UE. Solo análisis. |
| Agente / modelo | Agente "D-IA" del arnés Claude Code; el runtime declara el modelo Sonnet 5.5 (`claude-sonnet-5-5`). No hay credenciales profesionales ni competencia jurídica certificada. |
| Relación con la implementación | Contexto nuevo, no participó en la implementación (hecha por un agente IA trabajando con Toni, modelo desconocido para mí). |
| Fecha de consulta de fuentes | 2026-10-12 (todas las URL citadas) |

## 2. SHA/hash objetivo, fuentes y archivos realmente examinados

**Objetivo:** `ed4bb640a72d5afc9c652829f2c3583b1cb4b1d5` (`git rev-parse HEAD` verificado en el repo; rama `development`). Código, no ZIP.

**Archivos del repo examinados (lectura):**
- Documentos del paquete: `14-assignments/14D-legal-l1-l8.md`, `13-review-requests/13d-legal-l1-l8.md`, `08-packet-legal.md`, `sdd/features/impulso-pilot-data-integrity/retention-and-purge-v1.md`, `.../coach-capability-status-v1.md`.
- Textos legales y banner: `components/legal-document.tsx`, `app/legal|privacy|terms/page.tsx`, `components/legal-footer.tsx`, `components/cookie-consent.tsx`, `app/layout.tsx`.
- UI relacionada: `components/onboarding-dialog.tsx`, `components/workout-generator.tsx`, `components/dashboard-content.tsx`, `app/workouts/[id]/start/page.tsx`, `app/nutrition/page.tsx`, `hooks/use-editorial-content.ts`, `lib/product-events.ts`, `lib/api/index.ts` (socialApi), `app/api/logs/route.ts`, `lib/translations/{es,en}.json` (búsqueda de disclaimers).
- Backend: `backend/prisma/schema.prisma`, `src/config/{logger,env}.ts`, `src/utils/{redact,validators}.ts`, `src/middleware/{errorHandler,httpLogger,idempotency}.ts`, `src/app.ts`, `src/routes/{social,product-events,dashboard,profile}.routes.ts`, `src/services/{social,product-events,idempotency,session,workouts,sessions}.service.ts`, `src/services/llm/*`, `src/services/coach/{coach.service,context,guardrails,types}.ts`, `src/services/coach/providers/*`, `src/services/premium.service.ts` (solo disclaimers), `src/controllers/{auth,product-events}.controller.ts`, `scripts/maintenance/purge-expired.ts`.
- **Divulgación de un desvío de las reglas duras:** en una búsqueda con `grep` sobre el árbol se imprimieron ~8 líneas de plantilla de `backend/.env.example` (claves `LLM_PROVIDER`, `LLM_COACH_ENABLED`, `GROQ_*` con valores de plantilla, sin secretos). No abrí ningún `.env*` real. No he usado ese contenido como evidencia; los valores por defecto citados salen de `src/config/env.ts`.

**Fuentes externas consultadas (WebSearch/Firecrawl, 2026-10-12):** ver §6.

## 3. Método y pruebas realmente ejecutadas, con límites

- Lectura estática del código/esquema/textos a HEAD. Clasificación: **[H] hecho observado** (con ruta:línea), **[I] inferencia**, **[Hip] hipótesis**, **[ND] dato no disponible**.
- Prueba local simulada (Node, sin red, sin proveedor): expresiones regulares de `guardrails.ts` contra frases en español → ver L1/F-L1-6.
- **No ejecutado:** app, contenedores, tests, BD, navegador, proveedor LLM, producción/staging. Sin `.env*` ni datos reales. **Los flujos descritos son por lectura de código; ningún comportamiento runtime se ha demostrado.**
- Cada afirmación jurídica indica su estatus: **[OBLIGACIÓN IDENTIFICADA]** (norma que, tal como está redactada, impone el deber *si* concurre el supuesto de hecho descrito), **[APLICABILIDAD PENDIENTE]** (depende de hechos/cualificación que no puedo cerrar), **[RECOMENDACIÓN]** (buena práctica/guía, no obligación en sentido estricto).
- Límites: fuentes jurídicas leídas vía scraping y fragmentos; las guías EDPB y la jurisprudencia solo por resumen/extracto (marcado). No se han leído versiones de los textos legales anteriores a HEAD, ni contratos con proveedores reales de Impulso.

---

## 4. Matriz L1–L8: hechos, flujos, controles, marco normativo, preguntas

Leyenda de clasificación final por criterio (regla común): EVIDENCIA SUFICIENTE EN EL ALCANCE / REQUIERE CAMBIO / NO EVALUABLE / REQUIERE VALIDACIÓN PROFESIONAL. «REQUIERE CAMBIO» aquí significa *inconsistencia técnico-documental observada que el profesional debe valorar*, no «ilegalidad».

### Hallazgos transversales previos (aplican a varios ítems)

| ID | Hecho | Evidencia | Estado |
|---|---|---|---|
| T-D1 | El consentimiento de cookies solo se guarda en `localStorage` (`anclora-cookie-consent-v1`) y **ningún otro código lee esa preferencia**. | `components/cookie-consent.tsx:15,59,77`; grep en `app components lib hooks`: la clave solo aparece en ese archivo. | [H] |
| T-D2 | `<Analytics />` de `@vercel/analytics` se renderiza **incondicionalmente** en el layout raíz, sin depender del banner. | `app/layout.tsx:3,44`; `package.json` dependencia `@vercel/analytics: latest` | [H] |
| T-D3 | `trackProductEvent` (cliente) y `ProductEvent` (servidor) se envían/guardan **sin comprobar** `analytics` del banner. | `lib/product-events.ts` (sin lectura de consentimiento); `POST /api/events` autenticado `product-events.routes.ts:12-14`; además eventos server-side (`nutrition.service.ts:1087`). | [H] |
| T-D4 | **No hay flujos de exportación, borrado de cuenta ni baja** en backend ni frontend. `disabledAt` solo se *lee* (login/refresh); nada lo escribe. | grep `delete.*account|export|erase|portab|disabledAt` en `backend/src app components lib`; rutas en `app.ts:147-164`; `profile.routes.ts` solo GET/PUT. | [H] |
| T-D5 | **Nada programa la purga** (`purge-expired.ts`) y solo cubre `idempotency_records` y `auth_sessions`. Ninguna purga para `coach_messages`, `coach_conversations`, `coach_usage_windows`, `product_events`, `activity_feed_items`, etc. | `scripts/maintenance/purge-expired.ts:3-5,26-27`; `retention-and-purge-v1.md` («Nothing schedules it… tables simply grow»); grep `deleteMany` en `src`. | [H] |
| T-D6 | Proveedor LLM efectivo: **Groq** (SDK `groq-sdk`), modelo por defecto `llama-3.3-70b-versatile`. Rama `deterministic` solo para el coach en tests/local. | `src/config/env.ts:73-75`; `llm/llm.service.ts`, `coach/providers/index.ts` | [H] |

### L1 — Afirmaciones sobre uso de IA y «no sustituye consejo médico» (`legal-document.tsx`, `/legal`, `/privacy`, `/terms`)

**Qué dicen los textos (ES; EN equivalente, paridad estructural verificada a ojo):**
- Términos «Servicio»: «funciones de fitness, nutrición y progreso asistidas por IA. No sustituye consejo médico, nutricional ni profesional.» (`legal-document.tsx:120`). Aviso legal «Sin consejo médico» (`:137`). Fecha «17 de mayo de 2026» (común) — **anterior** a sesiones/idempotencia/logs R1–R8 (consistente con 13d: texto sin cambios).
- Privacidad: «Datos que tratamos» (`:105`) enumera cuenta, autenticación, preferencias, nutrición, progreso, técnicos de seguridad; **no menciona** datos de salud/limitaciones ni IA ni el proveedor. «Terceros» (`:110`): «encargados de confianza (alojamiento, analítica)»; **no** cita proveedor de modelo ni transferencia internacional. «Cookies» (`:109`): opcionales «desactivadas salvo consentimiento». «Conservación» (`:107`): «vigencia de la cuenta y hasta 12 meses tras su eliminación».
- **Responsable:** «Anclora Group» sin razón social/NIF/domicilio/registro (`:104,:134`). Contacto `hola@anclora.com`.

**Hechos de producto relevantes (frente a lo declarado):**

| ID | Hecho | Evidencia |
|---|---|---|
| F-L1-1 | La política no informa del envío de edad, sexo, objetivo, nivel, adherencia y `limitations` (texto libre) a un proveedor de IA de EE. UU., ni de su finalidad. | `workouts.service.ts:408-426` vs `legal-document.tsx:105,110` |
| F-L1-2 | «Opcionales… desactivadas salvo consentimiento» **no coincide** con T-D2/T-D3 (analítica y eventos activos sin leer el banner). | `legal-document.tsx:109`, `app/layout.tsx:44`, T-D3 |
| F-L1-3 | «hasta 12 meses tras su eliminación» **no tiene soporte técnico**: no existe eliminación (T-D4), no hay job que aplique 12 meses ni bloqueo (LOPDGDD art. 32), `product_events` y `coach_messages` no expiran (T-D5). Retenciones reales de logs 7/14/30 d, idempotencia 24 h, sesiones 30 d. | T-D4, T-D5, `logger.ts:52,61,71` |
| F-L1-4 | La UI de generación marca «Generado con IA»/«Plantilla estándar» (transparencia de origen) pero **no hay aviso médico en el generador ni en la recogida de «limitaciones»**; el único aviso in-app hallado es `healthPlans.safetyNote` (`es.json:417`). | `workout-generator.tsx:492-501`; `onboarding-dialog.tsx:258-290` (sin aviso); grep disclaimers |
| F-L1-5 | Avisos del backend en **inglés fijo** para usuarios ES: `FORM_ANALYSIS_DISCLAIMER`, `VOICE_COACH_DISCLAIMER`, respuesta de guardarraíl del coach. | `premium.service.ts:7-11`; `guardrails.ts:26-34` |
| F-L1-6 | El guardarraíl médico del coach es por regex y **no reconoce vocabulario español habitual**. Prueba local simulada: «me duele la rodilla», «tengo una lesión en el hombro», «necesito un médico», «me duele el pecho y mareo», «tengo diabetes», «estoy embarazada» → **no activan** `medical_or_injury`; «tengo dolor» sí. | `guardrails.ts:3-14` (patrones `\blesion`, `\bmedic` sin acento); sonda Node local, 2026-10-12 |
| F-L1-7 | El coach **no tiene UI** y está apagado por defecto (`LLM_COACH_ENABLED==='true'` requerido); el generador de rutinas sí es producto visible. | `env.ts:76`; `coach-capability-status-v1.md` |
| F-L1-8 | Ni el alta ni el onboarding presentan aceptación/enlace a términos o privacidad en el punto de recogida (no se halló checkbox ni enlace en `signup/page.tsx` ni en el diálogo de onboarding); el enlace a documentos está en el pie del dashboard. | grep `terms|privacy|consent` en `app/auth/signup/page.tsx`, `onboarding-dialog.tsx`; `legal-footer.tsx` usado solo en `app/dashboard/layout.tsx` |

**Marco normativo (consultado 2026-10-12):**
- [OBLIGACIÓN IDENTIFICADA] RGPD art. 13.1(a),(c),(e),(f) y 13.2(a) (identidad del responsable, fines y base, destinatarios, transferencias, plazo de conservación) — EUR-Lex `CELEX:32016R0679`; LOPDGDD art. 11 (información por capas: identidad, finalidad, derechos 15-22) — BOE-A-2018-16673. Aplica si Impulso es responsable de datos recogidos del interesado (lo es según los propios textos).
- [OBLIGACIÓN IDENTIFICADA] LSSI art. 10.1: denominación social, domicilio, correo, datos registrales — BOE-A-2002-13758 (versión consolidada 23/01/2025). TRLGDCU art. 60.1(b): identidad del empresario con razón social y dirección completa (BOE-A-2007-20555, última versión indexada 28/02/2026) — *si* hay relación de consumo (contratación a distancia de servicio, gratuito o de pago: pendiente de cualificar).
- [APLICABILIDAD PENDIENTE] TRLGDCU arts. 82 y 86: cláusulas abusivas; en particular la exclusión/limitación de responsabilidad «por los daños o por la muerte o por las lesiones» (art. 86.2) frente al texto «no responde por daños indirectos» (`:125`) — valoración exclusiva del letrado; no afirmo abusividad.
- [APLICABILIDAD PENDIENTE] Reglamento (UE) 2024/1689 (AI Act) en su versión consolidada a 27/07/2026 (AI Act Service Desk, `article-4`, `article-50`, `article-113`), modificado por **Reglamento (UE) 2026/1744 (Digital Omnibus on AI)**, de 8/07/2026 (EUR-Lex `OJ:L_202601744`): (a) **art. 50(1)** informar de que se interactúa con un sistema de IA — solo para sistemas «destinados a interactuar directamente con personas»; el coach lo sería, pero no tiene UI; (b) **art. 50(2)** marcado legible por máquina de contenido sintético (incl. texto) por *proveedores* de sistemas de IA — aplicabilidad dudosa para Impulso: depende de si es «proveedor» del sistema o solo despliega un modelo de terceros y de si un plan JSON validado/transformado es «contenido sintético»; el considerando (38) del Reg. 2026/1744 prevé 4 meses de transición (hasta 2/12/2026) para quien ya hubiera comercializado antes del 2/08/2026; (c) **art. 4** alfabetización en IA (reformulada por el Omnibus: sin garantizar nivel concreto); (d) Alto riesgo Anexo III: aplazado a 2/12/2027 (art. 113 consolidado); no identifico un caso de uso del Anexo III en Impulso *a nivel de esta revisión técnica*, confirmar. Fecha general de aplicación: 2/08/2026 (art. 113). **No se debe suponer que todo producto con IA queda sujeto a lo mismo.**
- [APLICABILIDAD PENDIENTE] Producto sanitario (MDR 2017/745; MDCG 2019-11): software sin finalidad médica declarada (bienestar/fitness) no es producto sanitario; depende de la «finalidad prevista» (art. 2(12) MDR), incluidas afirmaciones en textos/marketing. Los módulos `health-plans` (señales `PROFESSIONAL_REVIEW_RECOMMENDED`, `knownLimitations`) y coach conviene que se cualifiquen explícitamente. Fuente: `health.ec.europa.eu/.../md_mdcg_2019_11_guidance_en_0.pdf` (extracto; la Rev.1 2025 solo vista vía resumen secundario).

**Preguntas concretas para el profesional (L1):**
1. ¿Quién es el responsable (persona física/jurídica «Anclora Group»), con qué NIF/domicilio, hay DPO/representante? ¿Qué debe constar en privacidad y aviso legal?
2. ¿Basta una cláusula «asistida por IA… no sustituye consejo médico» o debe constar, en el punto de uso, un aviso específico en el generador y al introducir «limitaciones»? ¿Debe existir versión ES en los mensajes del backend?
3. ¿Debe la política nombrar al proveedor LLM (categoría de destinatarios vs. nombre), transferencia a EE. UU. y garantías?
4. ¿Es Impulso «proveedor» o «desplegador» a efectos del AI Act para el generador de rutinas y el coach? ¿Aplica art. 50(1)/(2) y calendario?
5. ¿Cuál es la finalidad prevista a declarar para evitar la cualificación de producto sanitario? ¿Procede evaluación formal?
6. ¿Cómo se acredita la aceptación de términos (por capas, click-wrap) en el alta?

**Documentos/hechos que necesita:** textos ES/EN a HEAD y fecha de versión, identificación fiscal/mercantil de Anclora Group, modelo de contratación (gratuito/premium, `subscriptionTier`), capturas de UI del alta/onboarding/generador, listado de claims de marketing sobre salud/IA (landing, `app/landing`), contrato/condiciones con Groq y Vercel.

**Clasificación:** textos vs. realidad: **REQUIERE CAMBIO** (inconsistencias F-L1-2, F-L1-3 observadas; texto actualizado antes de R1–R8); suficiencia/exactitud jurídica: **REQUIERE VALIDACIÓN PROFESIONAL**; guardarraíl ES (F-L1-6): hecho técnico → **REQUIERE CAMBIO** (para seguridad de producto; derivar a la revisión técnica/AI-03, fuera del alcance legal estricto).

---

### L2 — Datos personales de respuestas idempotentes (24 h), sesiones (30 d), contadores

**Flujo de datos (por lectura de código):**

| Almacén | Contenido | Finalidad declarada (código/docs) | Retención lógica | Retención física | Controles |
|---|---|---|---|---|---|
| `idempotency_records` (`schema.prisma:1138-1165`) | `userId`, operación, clave, `requestHash` (SHA-256 de parámetros normalizados incl. edad/sexo), `response` JSON (rutina generada o respuesta del coach, que puede aludir a limitaciones), estado, tokens de reserva | Replay seguro / no duplicar efectos | `IDEMPOTENCY_RETENTION_HOURS=24` desde completar (`env.ts:96`; `idempotency.service.ts` `expiresAt`) | +`RETENTION_PURGE_GRACE_SECONDS=3600` **solo si se ejecuta** `purge-expired.ts`; **no programado** (T-D5) | purga por lotes con re-check; cascade al borrar usuario; sin acceso HTTP al ledger |
| `auth_sessions` / `refresh_tokens` (`:1103-1136`) | `userId`, fechas, `revokedReason`; token solo hash SHA-256; **sin IP ni user-agent** | Autenticación y revocación | `AUTH_REFRESH_SESSION_DAYS=30` (`env.ts:45`) | idem purga (no programada); revocadas-no-expiradas se conservan para detección de reutilización | cascade |
| `coach_usage_windows` (`:314-331`) | `userId`, ventana, contadores de peticiones/tokens/llamadas/fallos | Protección operativa (cuota) | sin expiración definida | **ninguna purga** | cascade |
| **`coach_conversations` / `coach_messages` (`:281-312`) — NO listado en L2 del paquete** | Texto íntegro del usuario (≤2000 car., `validators.ts:202`) y respuesta IA, proveedor, modelo, flags; los últimos `LLM_COACH_MEMORY_MESSAGES=8` se reenvían al proveedor en cada turno (`coach.service.ts:92-105,481-485`) | Memoria de conversación | **ninguna** (conservación indefinida mientras exista el usuario) | ninguna | cascade; coach apagado por defecto y sin UI |
| `product_events` (`:793-809`) | `userId` (SetNull al borrar usuario), acción, categoría, fuente, `metadata` JSON libre | Producto/analítica (L8) | ninguna | ninguna | `GET /summary` solo admin; ver L8 |

**Hallazgos:**
- F-L2-1 [H]: el inventario L2 omite `coach_messages` (texto libre potencialmente de salud) y `product_events`; son los almacenes de mayor sensibilidad y sin límite temporal.
- F-L2-2 [H]: «logical vs physical»: la caducidad lógica (24 h/30 d) **no** equivale a borrado físico hoy; mientras no haya planificador, las filas crecen indefinidamente (el propio documento lo reconoce). El «máximo 24 h/30 d» de la pregunta 2 del paquete describe la garantía de replay/sesión, no la retención real.
- F-L2-3 [H]: las claves de idempotencia identifican por `(userId, operation, key)`; no se almacena el cuerpo de la petición, solo su hash (SHA-256 de datos de baja entropía: seudonimización, no anonimización — [I]).
- F-L2-4 [ND]: ventana de copias de seguridad/PITR de Neon, ubicación/región de la BD, cifrado, acceso del personal: no verificables sin inspeccionar producción (`CLAUDE.md` del repo solo afirma «automatic backups»).

**Marco:** [OBLIGACIÓN IDENTIFICADA] RGPD art. 5(1)(e) limitación del plazo de conservación; art. 25(2) (por defecto, también «el periodo de su almacenamiento»); art. 13.2(a) informar del plazo o criterios; art. 32 (seguridad). LOPDGDD art. 32 (bloqueo al rectificar/suprimir; conservación bloqueada solo durante prescripción de responsabilidades; luego destrucción). [RECOMENDACIÓN] la AEPD *Guía de protección de datos por defecto* (oct. 2020) enlaza «periodo de conservación» con «justificable objetivamente»; EDPB Guidelines 4/2019 v2.0 (20/10/2020) (resúmenes). [APLICABILIDAD PENDIENTE] qué plazo concreto es «necesario» para cada finalidad: es juicio del responsable/asesor; no hay plazo legal único para estos registros.

**Preguntas:** (1) ¿Plazo máximo y justificación para `coach_messages` y `product_events` (hoy indefinido)? (2) ¿Es aceptable 24 h/30 d para idempotencia/sesiones como plazo *lógico* y 1 h de gracia física, con la purga manual/programada pendiente? (3) ¿Cómo declarar en privacidad el plazo de copias de seguridad? (4) ¿Se requiere registro de actividades de tratamiento (art. 30) y evaluación de impacto (art. 35) dado el tratamiento de datos próximos a salud a escala piloto?

**Documentos/hechos:** definición del planificador de purga en producción (D10 §8), política de backups/PITR de Neon, región de la BD, lista completa de tablas con datos personales (hay ≥30 modelos con `userId`), RAT existente (no encontrado en el repo).

**Clasificación:** mecanismo de purga lógico/físico: **EVIDENCIA SUFICIENTE EN EL ALCANCE** (tests `inc04`, no re-ejecutados aquí); inventario L2: **REQUIERE CAMBIO** (incompleto); plazos aceptables: **REQUIERE VALIDACIÓN PROFESIONAL**; backups: **NO EVALUABLE**.

---

### L3 — Logs con user ids, IPs y emails (rotación 14/7/30 d)

**Flujo:** Winston a **ficheros locales** `backend/logs/*.log` (`logger.ts:40-77`), sin consola en producción (`:107-113`); lectura vía `GET /api/dashboard/logs*` solo `authenticate + requireAdmin` (`dashboard.routes.ts:15`, cuentas en `ADMIN_EMAILS`).

| Fichero | Nivel | Rotación (`maxFiles`) | Evidencia |
|---|---|---|---|
| `error-%DATE%` | error | 30 d, 20 MB | `logger.ts:47-54` |
| `combined-%DATE%` | todos los emitidos | 14 d | `:56-63` |
| `http-%DATE%` | ≤http | 7 d | `:65-73` |
| `exceptions-*`, `rejections-*` | — | 30 d | `:87-104` |

**Qué contiene realmente (por código):**
- F-L3-1 [H]: `errorHandler` registra en **cada** error (incluidos 4xx de validación y credenciales inválidas) `ip`, `userAgent`, `userId`, y **`body: redactSensitive(req.body)`** (`errorHandler.ts:30-43`). La redacción solo enmascara claves que casan con `pass|secret|token|authorization|cookie|api[-_]?key|^code$|code_verifier|credential|avatardataurl` (`redact.ts:1`). **Quedan en claro** `email`, `fullName`, `limitations` (texto libre), `message` del coach, entradas de nutrición, medidas, etc. Esto confirma y amplía «email en contexto de error» del paquete: no es solo email.
- F-L3-2 [H]: `logger.ts:140` y `errorHandler.ts:35` leen `req.user?.id`, mientras `httpLogger.ts:16` y los controladores usan `req.user?.userId`. [I] el `userId` puede no aparecer en el contexto de error (no verificado en ejecución; irrelevante para anonimato porque ip+email+body quedan).
- F-L3-3 [Hip]: en producción el nivel del logger es `info` (`logger.ts:79`), por lo que `logger.http()` (Morgan, `httpLogger.ts:7-9`) quedaría **filtrado**; entonces la IP «por petición» no se escribiría en producción, solo en errores. PENDIENTE DE VERIFICACIÓN: arrancar el backend con `NODE_ENV=production`, hacer una petición y comprobar si `http-*.log` se escribe.
- F-L3-4 [H]: `logger.error('Failed to parse Groq JSON response', {content: result.content.substring(0,500)})` (`llm/groq.provider.ts:48-51`) vuelca hasta 500 car. de salida del modelo sin `redactText`; `logger.warn(... error: error.message)` en `workouts.service.ts:487-490` tampoco aplica `redactText` (solo lo aplica `logError`, `logger.ts:123-129`).
- F-L3-5 [H]: `POST /api/logs` del frontend (`app/api/logs/route.ts`) no persiste nada en producción (TODO); el `clientLogger` no se usa con `setUser` en el código revisado.
- F-L3-6 [H]: R4/R8 documentados: redacción de query string, texto libre y `auth.logout` con `reason/origin` (`auth.controller.ts:105-107`) — sin identificadores.
- [ND]: destino real del stdout/stderr de la plataforma (Railway/Render), retención de logs de plataforma, copias de seguridad de volúmenes, quién tiene acceso a ficheros.

**Marco:** [OBLIGACIÓN IDENTIFICADA] RGPD arts. 5(1)(c) minimización y 5(1)(e) conservación; 6 (base: la política declara «interés legítimo: seguridad», `legal-document.tsx:106`; el balance del art. 6(1)(f) debe documentarse — [APLICABILIDAD PENDIENTE]); 32 seguridad. Que una IP es dato personal: jurisprudencia del TJUE sobre IP dinámica (p. ej. C-582/14) **no consultada en esta sesión**; el profesional debe confirmarla. [RECOMENDACIÓN] no registrar cuerpos de petición completos: usar lista blanca de campos en vez de lista negra de claves.

**Preguntas:** (1) ¿Son aceptables 14/7/30 d para seguridad/operación y qué base (art. 6(1)(f)) y balance documentar? (2) ¿Es admisible que cuerpos con `email`, texto libre de salud y mensajes del coach queden 30 d en `error-*.log`? (3) ¿Debe informarse en la política de los logs y de la IP? (4) ¿Qué acceso admin y qué registro de accesos exige el pilot?

**Documentos/hechos:** topología de logs en producción (ficheros vs drain), lista `ADMIN_EMAILS` (cantidad, no valores), proceso de incidencias/brechas (arts. 33-34), ejemplo anonimizado de una línea de `error-*.log` real (a obtener por el titular, no por la IA).

**Clasificación:** redacción de secretos: **EVIDENCIA SUFICIENTE EN EL ALCANCE** (revisión estática; tests no re-ejecutados); contenido personal en logs: **REQUIERE CAMBIO** (F-L3-1 candidato de triage técnico/privacidad); base y plazos: **REQUIERE VALIDACIÓN PROFESIONAL**; F-L3-3 y destino real de logs: **NO EVALUABLE** / PENDIENTE DE VERIFICACIÓN.

---

### L4 — Datos próximos a salud enviados a un proveedor de IA

**Flujo A — generación de rutina (`POST /api/workouts/generate`, producto visible):** `workouts.service.ts:404-451` solo si hay `GROQ_API_KEY`. El *prompt* (`:408-426`) incluye: tipo, duración, dificultad, entorno, músculos, equipo, **edad**, **sexo**, objetivo, nivel, adherencia 4 sem, entrenos 7 d, duración media, grupos musculares, riesgo de estancamiento, **limitaciones o molestias (texto libre, ≤8 ítems×80 car.: `validators.ts:27`)**, reglas de personalización por edad, catálogo de ejercicios. **No** envía nombre, email, `userId`, peso ni altura. Sin consentimiento específico en el punto de recogida (F-L1-8). Respuesta validada (`validateWorkoutPlan`) y si falla → plantilla determinista.

**Flujo B — coach (`POST /api/v1/coach/messages`, apagado por defecto y sin UI):** `coach.service.ts:412-421,481-485`: *system prompt* con contexto (`context.ts:35-70`: objetivo, nivel, días, **limitaciones**, adherencia, consistencia nutricional, PR recientes, últimas 5 sesiones con fechas y duración) + últimos 8 mensajes + mensaje del usuario (texto libre ≤2000). Timeout 25 s (`env.ts:83`).

**Destinatario/proveedor [H]:** Groq (API `groq-sdk`). **Condiciones públicas de Groq (consultadas 2026-10-12):**
- `console.groq.com/docs/your-data`: por defecto no retiene datos de inferencia, salvo logs de fiabilidad/abuso **hasta 30 días**; **Zero Data Retention** activable por el cliente en la consola; datos retenidos en buckets GCP en EE. UU. («Usage metadata always retained»).
- `console.groq.com/docs/legal/customer-data-processing-addendum` (efectivo 15/10/2025): DPA con SCC (Módulo 2), ley/foro de Irlanda, autoridad DPC; sub-encargados en `trust.groq.com/subprocessors`; borrado a petición en ≤180 días salvo copias de seguridad.
- [ND] si Impulso tiene cuenta con DPA aceptado, ZDR activado, región, o ha firmado algo distinto: **no verificable desde el repo**.

**Calificación de los datos:** [APLICABILIDAD PENDIENTE] «Limitaciones o molestias» (rodillas, lumbar, hombros, cuello, movilidad + texto libre; `onboarding-dialog.tsx:30-36,263-290`) puede revelar información sobre la salud física (RGPD art. 4(15), **art. 9(1)**); edad/sexo/peso/objetivo de peso por sí solos son datos personales, no necesariamente de salud. Si hay categoría especial, se requiere una excepción del art. 9(2) (típicamente consentimiento explícito, 9(2)(a), verificado en texto) además de base del art. 6; no se observa captura de consentimiento explícito (ver F-L1-8). Texto libre permite que el usuario introduzca diagnósticos.

**Marco:** [OBLIGACIÓN IDENTIFICADA] si hay datos de salud: art. 9(1)-(2); art. 13(1)(e)-(f) destinatarios/transferencia; arts. 28 (contrato con encargado), 44-46 (transferencias). [APLICABILIDAD PENDIENTE] Groq como *encargado* (DPA) vs. controlador propio para su política de privacidad: la política de Groq (`groq.com/privacy-policy`) dice que para datos de cliente en GroqCloud actúa como encargado; si es el caso, *no* hace falta consentimiento por el solo hecho de usar un encargado, pero sí base legal del tratamiento y transparencia; la necesidad de consentimiento explícito deriva de art. 9, no del uso de encargado. Transferencia EE. UU.: SCC del DPA y/o **EU-US Data Privacy Framework** (Decisión de adecuación 2023); estado: sentencia T-553/23 (General Court, 3/09/2025) desestimó la impugnación; **apelación C-703/25 P pendiente** (InfoCuria) — fuentes secundarias reportan además una solicitud de noyb tras *Trump v Slaughter* (junio 2026) sin efecto jurídico suspensivo conocido; verificar si Groq está certificado en DPF (no verificado). [RECOMENDACIÓN] EDPB Opinion 28/2024 (dic. 2024) sobre modelos de IA y RGPD (solo resumen consultado): relevante si el proveedor reutiliza/entrena con datos — Groq indica no acceder a datos de cliente para entrenamiento (`terms of sale` archivados; extracto).

**Preguntas:** (1) ¿Las «limitaciones» constituyen datos de salud (art. 9) en este diseño (opciones predefinidas + texto libre)? (2) ¿Consentimiento explícito separado, con qué texto y en qué momento (onboarding), o rediseño para no enviar texto libre al proveedor? (3) ¿Se requiere DPA firmado y ZDR activado como condición del piloto; qué evidencia conservar? (4) ¿Es necesaria EIPD (art. 35) por datos de salud + IA + piloto? (5) ¿Mención nominal de Groq y de la transferencia en la política?

**Documentos/hechos:** capturas de Data Controls de Groq (ZDR), DPA aceptado y fecha, lista de sub-encargados vigente, región; versión de política de Groq; si se usa otro modelo/proveedor (`.env`/secretos de producción → los gestiona Toni); decisión de producto sobre habilitar el coach.

**Clasificación:** descripción del flujo: **EVIDENCIA SUFICIENTE EN EL ALCANCE** (código); calificación como dato de salud y consentimiento: **REQUIERE VALIDACIÓN PROFESIONAL**; estado contractual con Groq y ZDR: **NO EVALUABLE**.

---

### L5 — `socialProfileVisibility` por defecto `"public"`

**Hechos:**
- F-L5-1 [H]: `schema.prisma:37` `@default("public")`; migración `20260714174500_add_social_community` fija `DEFAULT 'public'` (para filas existentes también). `ActivityFeedItem.visibility @default("public")` (`:355`).
- F-L5-2 [H]: al completar una sesión se crea un `ActivityFeedItem` con `content: "Completed <nombre de rutina>"`, `userId`, duración, con la visibilidad del usuario o `'public'` si no es `'private'` (`social.service.ts:270-300`; invocado en `sessions.service.ts:102`).
- F-L5-3 [H]: `GET /api/social/feed` devuelve a **cualquier usuario autenticado** los ítems `visibility='public'` de todos, con `userId` y `fullName` (`social.service.ts:99-137`). Leaderboard: `fullName` de participantes (`:229-243`).
- F-L5-4 [H]: **no existe UI** social: `socialApi` está en `lib/api/index.ts:802` pero ningún componente/página lo importa; por tanto un usuario no ve ni puede cambiar su visibilidad desde la app, aunque sus actividades se publican como públicas y son accesibles por API.
- F-L5-5 [H]: `updatePrivacy` solo actualiza el flag del usuario (`:35-48`); **no** reescribe `ActivityFeedItem` ya creados, así que cambiar a `private` no retira lo ya publicado [I: conclusión por ausencia de `updateMany` — grep confirmado].

**Marco:** [OBLIGACIÓN IDENTIFICADA] RGPD art. 25(2): por defecto los datos no deben ser accesibles «sin la intervención de la persona a un número indefinido de personas físicas» (texto verificado); la finalidad «social» solo existe si hay funcionalidad usable. EDPB Guidelines 4/2019; AEPD Guía de protección de datos por defecto (oct. 2020): configuración por defecto «lo más restrictiva posible». Que «número indefinido» abarque a todos los usuarios autenticados de un piloto cerrado es **cuestión para el profesional** ([APLICABILIDAD PENDIENTE]); el piloto reduce alcance pero no cambia el valor por defecto.

**Preguntas:** (1) ¿El valor por defecto debe ser `private` (o la función apagada) para el piloto? (2) ¿Qué hacer con filas ya existentes? (3) ¿Es admisible publicar nombre completo en el feed/leaderboard sin acción explícita de unirse (el leaderboard sí exige `join`)? (4) ¿Se informa en privacidad de la función social?

**Documentos/hechos:** decisión de producto: ¿la función social forma parte del alcance del piloto? número de usuarios/cohorte; datos reales de filas (a consultar por Toni, no por la IA).

**Clasificación:** hechos: **EVIDENCIA SUFICIENTE EN EL ALCANCE**; valor por defecto: **REQUIERE CAMBIO** (candidato; decisión de producto y legal) / **REQUIERE VALIDACIÓN PROFESIONAL**.

---

### L6 — Sin flujos de exportación/borrado

**Hechos:** T-D4 (sin endpoints ni UI de exportación, borrado, baja ni rectificación estructurada más allá de `PUT /profile`). `User` borra en cascada hijos al eliminar fila (`onDelete: Cascade` en la mayoría) pero **nada ejecuta la eliminación**; `product_events` y `recipes`/`foodItems` usan `SetNull` (`schema.prisma:513,627,802`): al borrar un usuario esos registros quedarían con `userId=null`, **conservando `metadata` y contenido**. La política declara derechos por correo a `hola@anclora.com` (`:108`): canal manual, sin procedimiento verificable en el repo (plazos, verificación de identidad, inventario de tablas, copias).

**Inventario aproximado de almacenes con datos personales (no exhaustivo):** `users` (email, nombre, avatar `data:` URL hasta 2 MB, sexo, edad, peso…, limitaciones), `workouts`/`sessions`, `body_measurements`, nutrición (`nutrition_logs`, `meal_*`, `food_items`…), `health_data_imports.payload`, `recovery_samples` (HRV, FC en reposo, sueño), `form_analysis_requests`, `voice_cue_sessions`, `health_plan_*`, `coach_*`, `activity_feed_items`, `kudos`, `follows`, `challenge_participants`, `product_events`, `notification_deliveries`, `oauth_accounts`, `xp_events`, `auth_sessions`, `idempotency_records`; más logs en ficheros (L3) y copias de seguridad.

**Marco:** [OBLIGACIÓN IDENTIFICADA] RGPD art. 12(3): respuesta «sin dilación indebida y, en cualquier caso, en el plazo de un mes» prorrogable dos meses más (texto verificado); art. 15 (acceso), 16, 17 (supresión, motivos 17.1(a)-(d)), 18, 20 (portabilidad, formato estructurado/legible por máquina, para datos *facilitados* con base consentimiento/contrato), 19 (comunicar a destinatarios); LOPDGDD arts. 12, 15 (supresión), 32 (bloqueo). Los derechos existen aunque no haya botón: el requisito de fondo es poder atenderlos; [RECOMENDACIÓN] AEPD y EDPB recomiendan canales sencillos. [APLICABILIDAD PENDIENTE] tratamiento de copias de seguridad: ni el RGPD ni el LOPDGDD art. 32.4 fijan plazo concreto; el art. 32 admite bloqueo/copia segura; el criterio (supresión diferida al ciclo de rotación) debe fijarlo el profesional; no hallé en esta sesión una guía AEPD específica sobre backups (**no verificado**).

**Preguntas:** (1) ¿Basta un procedimiento manual por correo para el piloto (plazo 1 mes, verificación identidad, script interno) o se exige capacidad técnica previa? (2) ¿Qué ocurre con registros `SetNull` que mantienen contenido? (3) Alcance de la supresión sobre idempotencia, logs 30 d, copias Neon y datos enviados a Groq (≤30 d salvo ZDR). (4) ¿Qué datos entran en portabilidad (provistos por el usuario vs. derivados)? (5) ¿«12 meses tras eliminación» tiene sustento legal?

**Documentos/hechos:** procedimiento interno de atención de derechos (no existe en el repo), registro de solicitudes, política de backups.

**Clasificación:** ausencia técnica: **EVIDENCIA SUFICIENTE EN EL ALCANCE** (hecho) y **REQUIERE CAMBIO** (si el piloto trata datos reales; decisión de alcance es de Toni/profesional); plazos y copias: **REQUIERE VALIDACIÓN PROFESIONAL**.

---

### L7 — Banner de cookies/consentimiento

**Observado (`cookie-consent.tsx`):** primera capa con tres botones al mismo nivel («Aceptar todas», «Configuración», «Rechazar opcionales», `:99-101`); segunda capa con casillas desmarcadas por defecto (`defaults` analytics/marketing=false, `:16`); la necesaria no es desactivable; botón flotante para reabrir (`:84`, también desde el pie); la preferencia se guarda en `localStorage` con `updatedAt` y versión `v1` (`:77`); sin caducidad ni re-solicitud (no lee `updatedAt` para expirar, `:59-66`); sin enlace a la política de cookies en el cuerpo del banner; texto: «puede guardar preferencias opcionales de análisis o marketing» (`:26-27`).

**Inventario de almacenamiento/terminal observado:** `accessToken`/`refreshToken`/perfil cacheado en `localStorage` (`lib/api/client.ts`, `auth-context.tsx`), borradores de entreno, nudges descartados, tema, idioma, barra lateral (`localStorage`), **idempotency keys en `sessionStorage`** (`lib/idempotency.ts`), cookie `sidebar` (`components/ui/sidebar.tsx:86`, componente shadcn: [ND] si se usa), cookie de transacción OAuth del backend (`oauth.controller.ts:25`), y **Vercel Web Analytics** sin cookies (identifica por *hash* diario; docs Vercel `analytics/privacy-policy`, 2026-10-12).

**Hallazgos:**
- F-L7-1 [H]: el banner presenta una elección cuyo valor **no gobierna nada** (T-D1). La «opción rechazar» no desactiva `<Analytics />` ni los eventos de producto.
- F-L7-2 [I]: texto «marketing — No activan scripts inexistentes»: no hay scripts de marketing en el código revisado (grep): categoría sin efecto.
- F-L7-3 [H]: el consentimiento no tiene prueba/registro más allá del navegador; no se envía al servidor.

**Marco:** [OBLIGACIÓN IDENTIFICADA] LSSI art. 22.2 (consentimiento para dispositivos de almacenamiento y recuperación de datos, excepto técnico/estrictamente necesario; texto BOE verificado; versión consolidada 23/01/2025; nótese que remite a la LO 15/1999, derogada, por lo que se lee junto con RGPD/LOPDGDD — criterio AEPD). **Guía de cookies de la AEPD** (versión actualizada tras Directrices 03/2022 del CEPD sobre patrones engañosos, `aepd.es/guias/guia-cookies.pdf`): opción de rechazar en la misma capa, mismo nivel y visibilidad; sin casillas premarcadas; sin «cookie walls»; consentimiento no superior a **24 meses** y retirada tan fácil como el otorgamiento; las cookies exentas son las estrictamente necesarias/técnicas. [APLICABILIDAD PENDIENTE] (a) *Medición de audiencia*: la AEPD tiene guía específica (`guia-cookies-analiticas-externas.pdf`) con condiciones de exención (propia, estadística agregada, garantías mínimas); si Vercel Analytics actúa como proveedor multi-editor, cae o no en la exención — depende de sus condiciones y de si se accede/almacena en el terminal (EDPB Guidelines 2/2023, adoptadas 14/11/2023, ámbito técnico del art. 5(3) ePrivacy — solo resumen consultado); (b) los eventos de producto enviados por la propia app autenticada son tratamiento RGPD (art. 6) más que «cookies»: la base (contrato, interés legítimo, consentimiento) es decisión jurídica; (c) tokens en `localStorage`: «estrictamente necesarios» para el servicio solicitado — razonable pero a confirmar.

**Preguntas:** (1) ¿La analítica de Vercel y los `product_events` requieren consentimiento, o se declaran exentos/legítimo interés; entonces el banner ¿es necesario o induce a error? (2) Si se mantiene, ¿cómo vincular la elección a la ejecución y registrar prueba? (3) ¿Caducidad 24 meses y re-solicitud? (4) ¿Política de cookies detallada con inventario y plazos?

**Clasificación:** UX del banner (botones, defaults): **EVIDENCIA SUFICIENTE EN EL ALCANCE** (observado); desvinculación banner/ejecución: **REQUIERE CAMBIO**; suficiencia jurídica y exenciones: **REQUIERE VALIDACIÓN PROFESIONAL**; comportamiento real en navegador (cookies/peticiones previas al consentimiento): **NO EVALUABLE** (no se ejecutó navegador). Receta de verificación (`agent-browser`): abrir `/` en perfil limpio, sin interactuar con el banner, capturar red/almacenamiento y comprobar si `/_vercel/insights/*` o `POST /api/events` se emiten; repetir tras «Rechazar opcionales». PENDIENTE DE VERIFICACIÓN.

---

### L8 — Eventos de producto con `metadata` arbitrario

**Hechos:**
- F-L8-1 [H]: `createProductEventSchema` acepta `metadata: z.record(z.any()).optional()` sin límite de claves ni tamaño específico (solo el límite global de `express.json` 10 MB, `app.ts:91`); `action` ≤80, `category` ≤40, `source` ≤40 (`validators.ts:114-119`).
- F-L8-2 [H]: cualquier usuario autenticado puede escribir `metadata` arbitrario ligado a su `userId` (`product-events.controller.ts:11`); lectura agregada solo admin (`/summary` por `action/category/source`), pero la tabla contiene los JSON íntegros.
- F-L8-3 [H]: los emisores del frontend envían: `trainingGoal`, `trainingEnvironment`, `profileCompletion` (onboarding); **`reminderDraft`** (preferencias de recordatorio) (`dashboard-content.tsx:162-167`); `nudgeId/kind/priority/href`; `workoutId`, tipo, duración, entorno; **`nutrition_logged`: `mealType, calories, date`** y `meal_plan_generated: goal, dietType` (puede aproximar información de salud/dieta, p. ej. dietas médicas) (`app/nutrition/page.tsx:115-153`); `workout_completed: duration, completionRate`. El servidor añade `meal_plan_generated_from_library` (`nutrition.service.ts:1087-1101`).
- F-L8-4 [H]: sin retención ni purga (T-D5); `userId` pasa a `NULL` al borrar usuario pero `metadata` permanece (`schema.prisma:802`).
- F-L8-5 [H]: emitidos independientemente del banner (T-D3).

**Marco:** [OBLIGACIÓN IDENTIFICADA] RGPD art. 5(1)(b) limitación de la finalidad y (c) minimización; art. 25(1)-(2); art. 13 (informar de la analítica y su base: la política solo menciona «analítica» de terceros); art. 6 (base). [APLICABILIDAD PENDIENTE] si `metadata` puede inferir salud/dieta (art. 9) y si la analítica de producto es compatible con la finalidad de prestación del servicio. [RECOMENDACIÓN] esquema cerrado por `action` (lista blanca de claves), sin identificadores directos ni texto libre.

**Preguntas:** (1) ¿Qué campos de `metadata` pueden recogerse bajo analítica y con qué base? (2) ¿Plazo de conservación de eventos y agregación/anonimización posterior? (3) ¿Los eventos (acción de usuario autenticado) quedan cubiertos por contrato/interés legítimo o requieren consentimiento? (4) ¿Se debe poder suprimirlos con el usuario (hoy SetNull)?

**Clasificación:** hechos: **EVIDENCIA SUFICIENTE EN EL ALCANCE**; metadatos abiertos/retención: **REQUIERE CAMBIO** (candidato técnico-legal); base y plazo: **REQUIERE VALIDACIÓN PROFESIONAL**.

---

## 5. Conclusión acotada, riesgos residuales y decisiones reservadas

### Resumen por ítem

| Ítem | Hecho técnico | Estado |
|---|---|---|
| L1 | Textos legales no reflejan IA/proveedor/salud/transferencia/retenciones reales; promesas de cookies y retención no soportadas por el código | REQUIERE CAMBIO (inconsistencia) + REQUIERE VALIDACIÓN PROFESIONAL |
| L2 | Inventario incompleto (omite `coach_messages`, `product_events`); purga no programada | REQUIERE CAMBIO (inventario) / VALIDACIÓN PROFESIONAL (plazos) |
| L3 | Cuerpo de petición completo (sin lista blanca) y IP en logs de error 30 d | REQUIERE CAMBIO (candidato) / VALIDACIÓN PROFESIONAL |
| L4 | Edad, sexo, objetivo, limitaciones (texto libre) a Groq (EE. UU.); sin consentimiento en punto de recogida; contrato/ZDR no verificables | VALIDACIÓN PROFESIONAL; contractual NO EVALUABLE |
| L5 | Default público + función sin UI + no retroactividad | REQUIERE CAMBIO (candidato) / VALIDACIÓN PROFESIONAL |
| L6 | Sin exportación/borrado; `SetNull` conserva contenido | REQUIERE CAMBIO si datos reales / VALIDACIÓN PROFESIONAL |
| L7 | Banner desligado de la ejecución; Analytics y eventos incondicionales | REQUIERE CAMBIO / VALIDACIÓN PROFESIONAL; runtime NO EVALUABLE |
| L8 | `metadata` libre, sin retención | REQUIERE CAMBIO (candidato) / VALIDACIÓN PROFESIONAL |

### Candidatos nuevos no recogidos en el paquete (para triage, no hallazgos confirmados)
1. **C-D1** Banner de cookies sin efecto sobre Analytics/eventos (T-D1…T-D3; severidad media-alta en privacidad, confianza alta en el hecho estático, runtime pendiente).
2. **C-D2** `errorHandler` registra cuerpo completo (email, texto libre de salud, mensajes del coach) 30 d (F-L3-1; media-alta, confianza alta).
3. **C-D3** `coach_messages` y `product_events` sin retención y fuera del inventario L2 (F-L2-1; media, confianza alta).
4. **C-D4** Feed social público por defecto sin UI y sin retroactividad (F-L5-2…5; media, confianza alta).
5. **C-D5** Guardarraíl médico en español ineficaz (F-L1-6; media por seguridad, confianza alta en la sonda; fuera del alcance legal estricto).
6. **C-D6** Avisos en inglés fijo en backend para usuarios ES (F-L1-5; baja).

### Riesgos residuales / no evaluables
Backups y región de BD (Neon); logs de plataforma; contrato y ZDR con Groq; calificación AI Act (proveedor vs. desplegador); calificación como producto sanitario; comportamiento real del banner; base jurídica de analítica; si «Anclora Group» es persona jurídica; número y perfil de usuarios del piloto; si hay menores (la validación de perfil exige ≥14 años en `age`, `validators.ts:18`, pero el registro no verifica edad — LOPDGDD art. 7: consentimiento válido desde 14; RGPD art. 8 admite 13-16).

### Decisiones reservadas a Toni / profesionales (no tomadas aquí)
- Designar profesional con competencia declarada en protección de datos, consumo y, en su caso, producto sanitario/IA.
- Decidir alcance del piloto: ¿con datos reales de terceros? ¿función social? ¿coach?
- Decidir plazos de retención, base jurídica de analítica/logs, necesidad de consentimiento explícito/EIPD, y textos finales (no redactados aquí).
- Ejecutar (con mandato aparte) las verificaciones PENDIENTES: producción-mode logs, banner en navegador, auditoría de tablas con datos reales, estado de DPA/ZDR en Groq.

**Esto es D-IA: no es aprobación de L1–L8 ni sustituye revisión humana jurídica.**

---

## 6. Fuentes oficiales consultadas (todas consultadas el 2026-10-12)

| Fuente | URL | Artículos/párrafos usados | Vigencia/transición |
|---|---|---|---|
| RGPD — Reglamento (UE) 2016/679 | https://eur-lex.europa.eu/legal-content/EN/TXT/HTML/?uri=CELEX:32016R0679 | 4(15) (def.), 5(1)(c),(e), 6, 8, 9(1)-(2)(a), 12(3), 13(1)(a)-(f) y 13(2)(a)-(b), 15-20, 25(1)-(2), 28, 32, 35, 44-46 | En vigor desde 25/05/2018. Textos 5(1)(e), 8, 9, 12, 13, 17, 19, 25 leídos en texto; 28/32/35/44-46 citados sin releer |
| LOPDGDD — LO 3/2018 | https://www.boe.es/buscar/act.php?id=BOE-A-2018-16673 | arts. 7, 11, 12, 15, 32 (leídos) | BOE-A-2018-16673, texto consolidado |
| LSSI-CE — Ley 34/2002 | https://www.boe.es/buscar/act.php?id=BOE-A-2002-13758 | arts. 10.1, 22.2 (leídos) | Última actualización 23/01/2025 (según BOE); art. 22.2 aún remite a la LO 15/1999 |
| TRLGDCU — RDLeg 1/2007 | https://www.boe.es/buscar/act.php?id=BOE-A-2007-20555 | arts. 60.1, 82, 86 (leídos, primera parte de la página) | Última versión indexada 2026-02-28 (metadatos BOE) |
| AEPD — Guía sobre el uso de las cookies | https://www.aepd.es/guias/guia-cookies.pdf ; nota de prensa de actualización: https://www.aepd.es/prensa-y-comunicacion/notas-de-prensa/aepd-actualiza-guia-cookies-para-adaptarla-a-nuevas-directrices-cepd | apartados 3.1-3.2 (rechazo al mismo nivel; casillas; cookie walls; 24 meses; consentimiento en alta separado de T&C) | Versión adaptada a Directrices 03/2022 CEPD (fecha exacta a confirmar en el PDF) |
| AEPD — Cookies para medición de audiencia | https://www.aepd.es/guias/guia-cookies-analiticas-externas.pdf | condiciones de exención (extracto) | — |
| AEPD — Guía de protección de datos por defecto | https://www.aepd.es/guias/guia-proteccion-datos-por-defecto.pdf | restricción por defecto, periodo de conservación, accesibilidad | Octubre 2020 (extracto) |
| EDPB — Guidelines 2/2023 (art. 5(3) ePrivacy) | https://www.edpb.europa.eu/documents/guideline/guidelines-22023-on-technical-scope-of-art-53-of-eprivacy-directive_en | ámbito técnico | Adoptadas 14/11/2023 (versión final; solo resumen consultado) |
| EDPB — Guidelines 4/2019 (art. 25) | https://www.edpb.europa.eu/documents/guideline/guidelines-42019-on-article-25-data-protection-by-design-and-by-default_en | por defecto | v2.0, 20/10/2020 (solo resumen) |
| EDPB — Opinion 28/2024 (modelos de IA) | https://www.edpb.europa.eu/documents/opinion-of-the-board-art-64/opinion-282024-on-certain-data-protection-aspects-related-to_en | anonimato, interés legítimo, ilicitud | Dic. 2024 (solo extracto) |
| AI Act consolidado (a 27/07/2026) | https://ai-act-service-desk.ec.europa.eu/en/ai-act/article-50 ; /article-4 ; /article-113 | arts. 4, 50(1)-(7), 113 (leídos) | Aplicación general 2/08/2026; Anexo III 2/12/2027; Anexo I 2/08/2028 |
| Reglamento (UE) 2026/1744 «Digital Omnibus on AI» (8/07/2026) | https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=OJ:L_202601744 | considerandos (38)-(40); título/fecha | En vigor 27/07/2026 según fuentes secundarias (law firms); considerando (38): transición 4 meses art. 50(2) |
| MDCG 2019-11 | https://health.ec.europa.eu/system/files/2020-09/md_mdcg_2019_11_guidance_en_0.pdf | cualificación del software | Rev.1 (jun. 2025) solo por resumen secundario |
| Latombe v Commission T-553/23; apelación C-703/25 P | https://infocuria.curia.europa.eu/tabs/redirect/juris/liste.jsf?num=T-553/23 | desestimación 3/09/2025; apelación pendiente | Estado a jul. 2026 según fuente secundaria; verificar |
| Groq — Your Data / DPA / Privacy | https://console.groq.com/docs/your-data ; https://console.groq.com/docs/legal/customer-data-processing-addendum ; https://groq.com/privacy-policy | retención ≤30 d, ZDR, SCC Módulo 2, subencargados | DPA efectivo 15/10/2025 |
| Vercel Web Analytics — Privacy | https://vercel.com/docs/analytics/privacy-policy ; https://vercel.com/docs/analytics | sin cookies; hash diario | Documentación del proveedor, no norma |

*Nota de cautela:* los resúmenes de bufetes/proveedores (Jones Walker, Gibson Dunn, Mayer Brown, Usercentrics, Cookiebot, secureprivacy.ai) sirvieron solo para localizar la fecha y los primarios; **no** se citan como autoridad.

## 7. Lista de hechos y documentos que el profesional necesita (consolidada)

1. Identidad completa del responsable (denominación, NIF, domicilio, registro, DPO si procede).
2. Textos legales vigentes ES/EN a HEAD (`components/legal-document.tsx`) y fechas de versión.
3. Descripción del pilot: número/perfil de usuarios, ¿terceros reales?, ¿menores?, ¿gratuito/pago?, canales de alta.
4. Mapa de flujos de datos (este informe §4) y modelo `schema.prisma` completo.
5. Contratos/DPA y configuración de cuenta con Groq, Vercel (Analytics/hosting), Neon, plataforma del backend; subencargados; regiones; ZDR.
6. Política de backups/PITR y de logs de plataforma en producción; planificación de `purge-expired`.
7. Capturas UI (alta, onboarding, generador, banner, pie legal) y claims de marketing sobre IA/salud.
8. Procedimiento de ejercicio de derechos y de gestión de brechas (inexistentes en el repo).
9. Decisión de producto sobre función social y coach.

*(Fin del informe 15-D-IA; archivos de apoyo temporales fuera del repo, en el scratchpad de la sesión.)*
