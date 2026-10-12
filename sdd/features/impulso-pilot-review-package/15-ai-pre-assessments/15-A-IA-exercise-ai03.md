# 15-A-IA — Pre-evaluación documental/técnica IA para el profesional del ejercicio (AI-03; apoyo a AI-04 / AI-05)

> **Estado y alcance.** Pre-evaluación por agente IA, solo lectura. **No** es endoso clínico ni profesional, **no** desbloquea AI-03/04/05, **no** acepta ninguna tarea ni gate, y **no** sustituye a la revisión humana de un profesional del ejercicio con experiencia en adultos 40+. Los números del producto siguen siendo un *envelope* de ingeniería **sin revisar** (`PENDING_PROFESSIONAL_REVIEW`). Este documento no prescribe entrenamiento a ninguna persona ni propone límites «seguros»; ordena lo que el código hace hoy para que el profesional decida.

---

## 1. Encargo, tipo de revisión, agente y relación con la implementación

| Campo | Entrada |
|---|---|
| Encargo | Agente A-IA: pre-evaluación documental/técnica del paquete A (profesional del ejercicio, AI-03) a partir de `14-assignments/14A-professional-ai03.md`, `13-review-requests/13a-professional-ai03.md`, `05-packet-professional-exercise.md`, `impulso-pilot-professional-review/ai-03-reviewer-dossier-v1.md` y el código en HEAD. |
| Tipo | Revisión **IA** (análisis estático + sondas con datos simulados). «Revisión IA» ≠ auditoría humana ni certificación. |
| Agente / modelo | Agente subordinado del coordinador; el runtime declara Sonnet 5.5 (`claude-sonnet-5-5`). No hay credencial profesional alguna (no soy profesional del ejercicio ni sanitario). |
| Relación con la implementación | Contexto nuevo; no participé en la implementación (hecha por un agente IA trabajando con Toni, modelo desconocido para mí). |
| Fecha | 2026-10-12 |

---

## 2. Revisión objetivo, fuentes y archivos realmente examinados

**Objetivo:** `HEAD = ed4bb640a72d5afc9c652829f2c3583b1cb4b1d5` (rama `development`; verificado con `git rev-parse HEAD`). Tree SHA no recalculado por mí (no necesario para este informe).

**Relación HEAD ↔ ZIP (verificada con `diff -q` contra `code-final/` extraído):** `plan-limits.ts`, `plan-validator.ts` y `deterministic-fallback.ts` son **idénticos** a los del ZIP; `workouts.service.ts` difiere (según el brief solo el `import` estático de `./llm`; no he reauditado línea a línea la diferencia, solo leído el archivo en HEAD). `forty-plus-guidance.ts`, `coach/guardrails.ts`, `progression/*` y `personalization.service.ts` **no cambian** entre base `77f852aa` y HEAD (sin entradas de log posteriores a las features de origen). `lib/translations/*.json` sí cambia vs base (10 líneas; solo copy de «IA»), `components/workout-generator.tsx` cambia (banner de fallback, typing, 429).

### Documentos del paquete leídos
- `sdd/features/impulso-pilot-review-package/14-assignments/14A-professional-ai03.md`
- `…/13-review-requests/13a-professional-ai03.md`
- `…/05-packet-professional-exercise.md`
- `sdd/features/impulso-pilot-professional-review/ai-03-reviewer-dossier-v1.md`
- (por referencia, solo cabeceras) `…/11-execution-coverage-and-provenance.md`

### Código leído (rutas relativas a `anclora-impulso/`)
- `backend/src/services/workouts/plan-limits.ts`, `plan-validator.ts`, `deterministic-fallback.ts`
- `backend/src/services/workouts.service.ts` (completo)
- `backend/src/services/forty-plus-guidance.ts`
- `backend/src/services/personalization.service.ts`
- `backend/src/services/progression/engine.ts`, `types.ts`, `progression.service.ts` (parcial: 60-202)
- `backend/src/services/coach/guardrails.ts`, `coach/coach.service.ts` (zona 380-470), `coach/context.ts` (parcial)
- `backend/src/services/llm/llm.service.ts` (`SYSTEM_PROMPT_ES`)
- `backend/src/services/health-plans.domain.ts`, `health-plans.service.ts` (grep de líneas de seguridad)
- `backend/src/utils/validators.ts` (zonas: perfil, `createWorkoutSchema`, `generateWorkoutSchema`, `generateNextSessionSchema`)
- `backend/prisma/schema.prisma` (modelo `Exercise`, `duration`), cabeceras/grep de `complete-exercises-database.ts`, `expanded-home-outdoor-exercises.ts`
- `components/workout-generator.tsx` (completo salvo tramos de selects), `components/onboarding-dialog.tsx` (zona de limitaciones), `components/health-plan-home.tsx` (grep), `lib/user-profile.ts` (`buildRecommendedPlan`), `app/workouts/[id]/page.tsx` (zona 120-175)
- `lib/translations/es.json`, `en.json` (secciones `workouts`, `healthPlans`; barrido por palabras clave de salud/seguridad)
- `lib/api/index.ts` (grep de `progressionApi`)

**No abierto:** ningún `.env*`, secretos ni datos reales; no se leyó el texto íntegro de las fuentes externas citadas salvo extractos devueltos por la búsqueda (ver §3.3).

---

## 3. Método y pruebas realmente ejecutadas, con límites

### 3.1 Lectura del código
Cada valor y regla se ha trazado a `ruta:línea`. Distingo: **[H]** hecho observado en código; **[I]** inferencia; **[Hip]** hipótesis; **[RC]** riesgo conocido ya declarado en el paquete; **[ND]** dato no disponible.

### 3.2 Sondas simuladas (ejecutadas)
Directorio: `/private/tmp/claude-502/-Users-toni-Developer-anclora/67db9ee7-66a1-42fe-b6c4-1e94e561734a/scratchpad/probe-A/` (fuera del repo). Copié `plan-limits.ts`, `plan-validator.ts`, `deterministic-fallback.ts`, `coach/guardrails.ts`, `progression/engine.ts`, `progression/types.ts`, cambiando solo las rutas de import a `.ts`; ejecución con `node --experimental-strip-types` (Node 24.19), `zod` resuelto por enlace simbólico de lectura a `backend/node_modules`. Sin red, sin proveedores, sin BD, sin `npm install`. Scripts: `probe.mjs`, `p2.mjs`. Catálogo simulado: 9 ejercicios (3 grupos × 3).
- **No** pude sondear `workouts.service.ts` (importa Prisma y LLM): lo relativo a *adjustment*, dificultad/duración efectiva y prompt se **deriva por lectura**, marcado como tal.
- **No** se ha llamado a ningún modelo LLM: cualquier afirmación sobre qué devolvería el modelo es **[Hip]**.
- **No** he ejecutado la suite del repo (prohibido por el brief). Las pruebas del paquete cubren que las reglas *se ejecutan* (validator/fallback sin diferencias con HEAD), no que los valores sean adecuados.

### 3.3 Literatura / fuentes externas (consultadas 2026-10-12, vía Firecrawl; solo fuentes oficiales/guías profesionales)
| # | Fuente | URL | Población / aplicabilidad | Qué se vio y límites |
|---|---|---|---|---|
| L1 | OMS, *Guidelines on physical activity and sedentary behaviour* (2020); ficha OMS Europa y artículo Bull et al., *Br J Sports Med* 2020;54:1451 | https://www.who.int/europe/news-room/fact-sheets/item/physical-activity ; https://bjsm.bmj.com/content/54/24/1451 ; PDF IRIS: https://iris.who.int/server/api/core/bitstreams/faa83413-d89e-4be9-bb01-b24671aef7ca/content | Población general adulta 18–64 y ≥65 (incluye condiciones crónicas/discapacidad «cuando no esté contraindicado»). | Extracto: 150–300 min/semana moderada (o 75–150 vigorosa) aeróbica; fuerza de grandes grupos ≥2 días/sem; ≥65: actividad multicomponente con equilibrio y fuerza ≥3 días/sem. **Es recomendación poblacional semanal, no un tope por sesión ni una prescripción individual.** Solo vi extractos, no el texto completo. |
| L2 | ACSM, *Progression models in resistance training for healthy adults* (2002, MSSE 34(2):364-380; actualizado 2009, MSSE 41:687-708, PubMed 19204579) | https://pubmed.ncbi.nlm.nih.gov/19204579/ | Adultos **sanos**; no específico de 40+ con limitaciones. | El extracto que obtuve es el *abstract* de la versión **2002** (cargas 8-12 RM en novatos; incrementos del 2-10 % cuando se supera la carga en 1-2 reps; descansos 1-2 min para hipertrofia y ≥3 min en carga alta; frecuencia 2-3 d/sem novatos; >15 reps con descansos <90 s para resistencia muscular local). **No leí el texto completo de 2009.** Útil solo como contexto de *qué dimensiones suelen parametrizarse*, no como validación de ningún valor del producto. |
| L3 | ACSM, nuevo *Position Stand* «Resistance Training Prescription for Muscle Function, Hypertrophy, and Physical Performance in Healthy Adults: An Overview of Reviews» (MSSE, abril 2026; actualiza el de 2009) | https://acsm.org/science-spotlight-acsm-releases-new-position-stand-on-resistance-training/ ; https://journals.lww.com/acsm-msse/fulltext/2026/04000/american_college_of_sports_medicine_position.21.aspx | Adultos sanos. | **Solo leí la nota de anuncio; no el contenido del *position stand*.** Lo cito porque el profesional debería partir de la versión vigente, no de la de 2009 que el brief/packet podrían asumir. Sin valores extraídos. |
| L4 | PAR-Q+ / ePARmed-X+ (versión oficial 2023 consensuada; PDF 2024) | https://eparmedx.com/ ; https://hfjc.library.ubc.ca/index.php/HFJC/article/view/839 | Cribado previo a la actividad para población general; reconoce salidas «bajo/intermedio/alto riesgo» y derivación a profesional cualificado/sanitario. | Extractos: página 1 de preguntas; si «sí» a alguna, seguimiento; ePARmed-X+ da tres niveles de recomendación. **Es una herramienta de cribado, no un criterio de bloqueo para este producto**; no equivale a ninguna lista de señales del producto. |

**Sin fundamentación externa consultada** (a efectos de las preguntas del profesional) para: tope de ejercicios por sesión según edad; descanso máx. 75 s; reps máx. 15 y 1 como mínimo; umbral de edad 40 como discontinuidad de reglas; mapeo limitaciones→exclusiones; plantillas de *fallback* 3×10/4×12/5×15; textos de perimenopausia/menopausia; 1,3–1,6 g/kg de proteína; patrones de rechazo del coach. No he inventado referencias para ellos.

---

## 4. Valores y reglas en HEAD: tabla de decisión para el profesional

Leyenda de clasificación: **EVS** = EVIDENCIA SUFICIENTE EN EL ALCANCE (solo en sentido técnico: la regla existe y se ejecuta); **RC** = REQUIERE CAMBIO (inconsistencia verificable en el código/copy, independiente del criterio profesional); **ND** = NO EVALUABLE; **RVP** = REQUIERE VALIDACIÓN PROFESIONAL.

### 4.1 Envelope del validador, fallback y personalización

| ID | Valor / regla actual | Ubicación | Propósito declarado | Población / uso | Cubre | NO cubre | Decisión pendiente (profesional) | Fundamento externo | Clasificación |
|---|---|---|---|---|---|---|---|---|---|
| V1 | Series 1–5 por ejercicio | `plan-limits.ts:30-31`; aplicado `plan-validator.ts:161-163` | «No más exigente que el generador no-IA preexistente» (`plan-limits.ts:5-10`) | Todos; sin distinción por edad, nivel ni limitaciones | Rechaza `sets`<1 o >5 (entero estricto) | Volumen semanal, series totales por sesión (5 ej × 5 series = 25 series), distinción por nivel | R1: techo por nivel (y por franja de edad) | Ninguna aplicable a un tope concreto | RVP |
| V2 | Reps 1–15 | `plan-limits.ts:32-33`; `plan-validator.ts:164-166` | ídem | Todos | Rechaza fuera de rango | Intensidad relativa (%1RM, RIR/RPE); acepta 1 rep con cualquier carga | R1 | L2 solo como contexto (rangos 8-12 RM novatos; >15 para resistencia local) | RVP |
| V3 | Descanso 0–75 s | `plan-limits.ts:34-35`; `plan-validator.ts:167-173` | ídem | Todos | Rechaza >75 s o <0 | **0 s es válido** (sin descanso); un descanso >75 s es **rechazado** aunque sea habitual en trabajo de fuerza (L2 menciona 1-2 min y ≥3 min según objetivo) | R1: ¿mínimo? ¿el tope de 75 s es deseable o excesivamente restrictivo? | L2 (contexto) | RVP |
| V4 | Ejercicios por rutina 1–6; ≤5 si `age ≥ 40` | `plan-limits.ts:27-29`; `plan-validator.ts:113-126` | Idem; la reducción a 5 es la **única** diferencia validada por edad | 40+ por umbral binario | Rechaza >5 (40+) | Edad desconocida → regla de <40 (6 ej., ver G-05); sin tramos 50/60/70 | R2: topes por banda de edad y nivel | Ninguna | RVP |
| V5 | ID debe estar en catálogo candidato (nivel exacto, entorno, equipo opcional, músculos opcionales) | `plan-validator.ts:128-149`; catálogo `workouts.service.ts:371-400` | Anti-alucinación | Todos | Rechaza IDs ajenos; dificultad ≠ solicitada | **Sin metadato clínico** del ejercicio (impacto, contraindicaciones) | R-cat: ¿qué etiquetas necesita el catálogo? | n/a | EVS (técnico) + RVP (contenido catálogo) |
| V6 | Sin ejercicio ni `order` duplicado | `plan-validator.ts:151-159` | Integridad | — | — | — | — | n/a | EVS |
| V7 | Enteros estrictos, sin coerción | `plan-validator.ts:63-77` | Integridad | — | — | — | — | n/a | EVS |
| V8 | `minExercises = 1` | `plan-limits.ts:27`; `plan-validator.ts:113-115` | Plan no vacío | — | Rechaza 0 | Una rutina de 1 ejercicio × 1 rep se acepta (sonda S2) | R9: mínimo razonable | Ninguna | RVP |
| F1 | Selección determinista: hash estable por `userId/workoutType/difficulty`, reparto circular por grupo muscular | `deterministic-fallback.ts:38-63` | Reemplazo de `Math.random`; reproducible | Todos | Misma entrada ⇒ mismo plan | No usa limitaciones, objetivo, sexo, duración ni categoría/impacto; trata `muscleGroup` literal (en el seed hay `Full Body`, `Full body` y `Cuerpo completo` como grupos distintos) | R6 | n/a | RVP |
| F2 | Prescripción: beginner 3×10, intermediate 4×12, advanced 5×15 (acotado a V1-V3) | `deterministic-fallback.ts:66-67,74-76` | Tabla preexistente, «no es un modelo de progresión» (dossier §2) | Todos | Dentro del envelope | **`advanced` = techo del envelope (5×15)**; cualquier `difficulty` desconocido cae en 5×15 (sonda S6); sin calentamiento | R1/R6 | n/a | RVP |
| F3 | Descanso fallback: 75 s si `age≥40` **o** reducción; si no, 60 s | `deterministic-fallback.ts:68` | Preexistente | 40+ | — | 75 s = techo; sin tramos | R1 | n/a | RVP |
| F4 | Nº de ejercicios del fallback = `min(pool, máx por edad)` | `deterministic-fallback.ts:35-36,53-63` | — | — | — | Pool de 1 ⇒ rutina de 1 (S5); pool pequeño (nivel exacto) frecuente en principiantes **[Hip]** | R9 | n/a | RVP |
| G1 | Reducción de dificultad bajo `reduce`: advanced→intermediate→beginner; duración 25–40 min | `workouts.service.ts:345-363` | Adherencia baja ⇒ bajar fricción | Todos | — | `increase` **no** sube dificultad, solo duración ≤75 (`:361-362`); **usuarios nuevos caen en `reduce`** (ver C-03) | R7 | n/a | RVP + RC (C-03) |
| P1 | `workoutAdjustment`: `<0,55` ⇒ reduce; `>0,95` ⇒ increase; si no maintain | `personalization.service.ts:200-207` | Personalización por adherencia | Todos | — | La adherencia es nº de sesiones/(días objetivo×4); no mide dolor, fatiga ni lesión; `adherenceRate` se acota a 1,2 pero sin límite por día | R7 | Ninguna | RVP |
| P2 | `age` efectiva = `params.age ?? profile.age`; API acepta 14–100 | `workouts.service.ts:334`; `validators.ts:270` | — | Pilot declarado 40+ | — | La edad enviada por cliente prima sobre el perfil; edad ausente ⇒ regla no-40+ | R2/R8: ¿qué hacer con edad ausente o <40/<18? | n/a | RC (C-05) + RVP |
| L1 | Límites de duración: 10–180 min en API; UI 20–90 | `validators.ts:265`; `workout-generator.tsx:289-295` | — | — | Se pasa al prompt | **No se valida contra nº de ejercicios ni series**; no entra en validador/fallback | R-dur | n/a | RC (C-07) |

### 4.2 Textos de instrucción al modelo (`forty-plus-guidance.ts` y prompt)

| ID | Texto / regla | Ubicación | Llega al usuario | Cubre | NO cubre / observación | Fundamento externo | Clasificación |
|---|---|---|---|---|---|---|---|
| T-G1 | «150-300 minutos semanales de actividad total» | `forty-plus-guidance.ts:16` | Solo como instrucción al modelo (`workouts.service.ts:426`), **pero la salida del modelo es texto libre en `name`** (ver C-09) | Consistente en rango con L1 para adultos | L1 habla de actividad **aeróbica** moderada/vigorosa y **fuerza ≥2 d/sem** aparte; aquí se dice «total»; se pide repartir carga semanal en **una sola sesión** generada | L1 (población adulta general; no para quien tiene contraindicaciones) | RVP |
| T-G2 | «Incluye movilidad, calentamiento y recuperación entre bloques» | `forty-plus-guidance.ts:14` | No directamente | — | **No ejecutable** con el esquema JSON (solo `exerciseId/sets/reps/rest/order`) ni con el catálogo (categorías del seed: Fuerza, Core, Cardio, Balance; ninguna «Movilidad/Calentamiento»); ni el validador ni el fallback lo exigen. Ver C-02 | n/a | RC + RVP (R3) |
| T-G3 | «Si añades cardio … intervalos controlados de bajo impacto» | `forty-plus-guidance.ts:15` | No | — | El catálogo contiene `Burpees`, `Box Jumps`, `Sprint Intervals`, `Battle Ropes`, etc. (seed) sin filtro por impacto/edad | n/a | RVP |
| T-G4 | Mujeres 40+: «cambios … perimenopausia/menopausia … salud ósea» | `forty-plus-guidance.ts:20-25` | No directamente | — | Se infiere estado hormonal **solo por sexo+edad** (no se pregunta); se aplica a toda mujer ≥40 | **Sin fundamentación externa** consultada | RVP |
| T-G5 | Hombres 40+: «reducción de grasa abdominal/visceral» | `forty-plus-guidance.ts:26-30` | No | — | Supone un objetivo que el usuario puede no tener; **contradice** `trainingGoal` enviado en el mismo prompt (p. ej. `build_muscle`) — C-08 | Sin fundamentación externa | RC + RVP |
| T-G6 | Nutrición: 1,3–1,6 g/kg/día, «déficit … proteger la masa muscular» | `forty-plus-guidance.ts:49-60`, uso `nutrition.service.ts:1028` | Sí, vía plan de comidas generado | — | **Fuera de la competencia del perfil «ejercicio»**; sin filtro por señales de salud (la lista `significant_renal_disease` etc. de Ruta Vital no se consulta aquí) | Sin fundamentación externa consultada | ND para este perfil → derivar a profesional de nutrición |
| T-P1 | Prompt: «Limitaciones o molestias reportadas: …» (texto libre ≤8×80 car.) | `workouts.service.ts:424`; `validators.ts:27` | No | El modelo **ve** las limitaciones | El validador no puede comprobar que se respeten; el fallback las ignora; ver C-04 | n/a | RVP (R4) |
| T-P2 | El prompt **no** declara techos (sets 1-5, reps 1-15, rest 0-75, ≤5/6 ej.) | `workouts.service.ts:408-445` (confirmado) | — | — | `temperature: 0.7`; lo que el modelo devuelva fuera de rango se rechaza → fallback. Frecuencia real de rechazo: **[ND]** | n/a | RC (C-01) |
| T-P3 | `SYSTEM_PROMPT_ES`: «asistente experto en nutrición y fitness» | `llm/llm.service.ts:58-59` | No | — | No incluye restricciones sanitarias ni de alcance (el coach sí las tiene); el envío de rutinas usa solo este system prompt | n/a | RVP |

### 4.3 Progresión y coach (preexistentes, no tocados en este ciclo)

| ID | Valor | Ubicación | Observación | Clasificación |
|---|---|---|---|---|
| PR1 | Incremento de carga +5 kg (`lower_compound`), +2,5 (`upper_compound`), +1 (isolation) cuando **todas** las series llegan al máximo de reps | `progression/engine.ts:21-31,53-58` | Sin tope absoluto ni relativo, sin dependencia de edad ni de RIR (S9: +5 kg incluso con RIR = 5) | RVP |
| PR2 | Deload: ×0,9 de carga, `ceil(sets×0,67)`, RIR objetivo 3; dispara a 3 *stalls* o a ≥6 semanas **desde un deload previo** | `engine.ts:87-112` | Con `lastDeloadAt = null` y pocos *stalls* nunca hay deload programado (S10) | RVP + RC |
| PR3 | DUP: 3-5 reps RIR 1 / 8-12 RIR 2 / 15-20 RIR 3 | `engine.ts:141-154` | 3-5 reps y 15-20 reps **salen del envelope V2 (1-15)**; sets de entrada hasta 12 (`validators.ts:140`) | RC (C-06) + RVP |
| PR4 | `readinessScore < 50` solo añade texto; `recoveryAction` se calcula pero no modifica la prescripción | `progression.service.ts:158-165` | El aviso «reduce intensity…» no cambia carga/series | RC + RVP |
| PR5 | Sin consumidor UI | `lib/api/index.ts:788-792`; grep de `progressionApi` en `app/ components/ hooks/` = 0 usos | Accesible por API (`POST /api/v1/progression/next-session`); **no alcanzable desde la UI en HEAD** según grep | contexto |
| CO1 | Patrones médicos/lesión del coach: `injury`, `injured`, `pain`, `hurts?`, `doctor`, `diagnos`, `medic`, `lesion`, `dolor`, `herida` | `coach/guardrails.ts:3-14` | Ver sonda S11 (huecos ES/EN) | RC + RVP (R12) |
| CO2 | Respuesta del guardarraíl **solo en inglés**: «I cannot diagnose pain or injury. Stop the movement that causes sharp pain and speak with a qualified professional… I can help you adapt training only after you have medical clearance.» | `guardrails.ts:31-33` | Llega al usuario con patrón médico detectado, sea cual sea su idioma | RC + RVP (R5/R12) |
| CO3 | Contexto del coach incluye `limitations=` | `coach/context.ts` (línea con `limitations=`) | El coach LLM **sí** ve limitaciones | contexto |

### 4.4 Matriz de las 12 preguntas del packet (R1–R12) más huecos añadidos

| ID | Pregunta | Estado en código | Clasificación | Necesita de la persona revisora |
|---|---|---|---|---|
| R1 | Techos por nivel | Un solo envelope para todos los niveles; fallback usa tabla por nivel (F2) que coincide con el techo en `advanced` | RVP | Valores por nivel o confirmación/sustitución de los 5/15/75 |
| R2 | Ejercicios por sesión por banda de edad | Binario <40 / ≥40 (6/5) | RVP | Tramos de edad y nivel |
| R3 | Calentamiento/movilidad obligatorios | No existen en validador, fallback, esquema ni catálogo; sí **prometidos** por copy y prompt | RC + RVP | Contenido y forma (¿ejercicio del catálogo? ¿bloque informativo?) |
| R4 | Exclusiones por limitación | Ninguna aplicada (H-confirmado: ni `workouts.service.ts` ni fallback leen `limitations` salvo para el prompt) | RC + RVP | Lista de movimientos/patrones excluidos por categoría de limitación; taxonomía |
| R5 | Texto y umbral de dolor/lesión | Texto del coach en inglés; Ruta Vital con 12 señales sin conexión al generador | RC + RVP | Redacción y umbral de derivación |
| R6 | Plantillas de fallback o método de selección | Hash + reparto por grupo; sin criterio profesional | RVP | Aceptar el método o proveer plantillas |
| R7 | Progresión/deload para el piloto | Ver PR1–PR5; el generador de rutinas **no** usa el motor de progresión | RVP + RC | Reglas aceptables y su relación con V1–V3 |
| R8 | Condiciones que bloquean generación | Ninguna: el generador **no** consulta señales de seguridad ni `safetyCategory` | RVP | Lista de condiciones de bloqueo/derivación (¿usar la de Ruta Vital?) |
| R9 | Mínimo de ejercicios | 1; pool 1 ⇒ rutina de 1 | RVP | Mínimo y comportamiento (error seguro vs plan degradado) |
| R10 | Textos de §3 y si llegan al usuario | Ver §4.2 y §5 | RVP | Aceptabilidad como instrucción y si pueden aflorar |
| R11 | ¿Techos 40+ dependen de limitaciones? | Hoy no | RVP | Sí/no y cómo |
| R12 | Suficiencia de patrones del coach | Ver CO1/CO2 y sonda S11 | RC + RVP | Corpus mínimo y política (derivar/rehusar) |
| R13 (añadida) | Edad ausente / <40 / <18 en el generador | `age` opcional, 14–100; ausente ⇒ envelope no-40+ | RVP | Política para población no objetivo |
| R14 (añadida) | Primera generación de un usuario nuevo | Cae en `reduce` por adherencia = 0 (C-03) | RVP | ¿Es el comportamiento deseado para el primer plan? |
| R15 (añadida) | Rutinas manuales (`POST/PUT /workouts`) | Sin techos (`createWorkoutSchema`: sets≥1, reps≥1, rest≥0, sin máximos) | RVP | ¿Mismos techos? |
| R16 (añadida) | Semántica de `workoutType` (`cardio/hiit/flexibility`) | Solo cambia el *nombre* del plan; el catálogo no se filtra por tipo | RC + RVP | Qué debe significar cada tipo para 40+ |
| R17 (añadida) | Cribado previo (tipo PAR-Q+) antes de generar | No existe en el flujo de generación | RVP | Si es requisito de piloto |

Criterios de aceptación del plan (packet §«Original acceptance») — clasificación en el alcance de esta pre-evaluación:
| Criterio | Clasificación | Motivo |
|---|---|---|
| AI-03 «reglas revisadas por profesional competente» | **ND** | No hay revisor designado; este documento no lo satisface |
| AI-03 rechazo «promesa de terapia» | **RC** (parcial) | El copy usa «segura» (T-U3) y «ajustar carga» (T-U4) sin respaldo en lógica; no es «terapia» pero sobreafirma |
| AI-04 «corpus inválido 100 % rechazado, sin escritura parcial» | **EVS (técnico, limitado)** | Validador puro, idéntico a ZIP; en mi sonda las violaciones se detectan; la ausencia de escritura parcial depende de la transacción (`createGeneratedWorkout`, `workouts.service.ts:236-256`) cuyo comportamiento en BD **no** he ejecutado |
| AI-04 «válidos guardan versión y modo» | **EVS (por lectura)** | `createWorkoutRow` persiste `generationMode/Version/Reason` (`:202-211`) |
| AI-04 «cast de tipo como validación» (rechazo) | **EVS** | Zod estricto sin coerción (`plan-validator.ts:63-77`); *nota:* `age` llega al validador sin validar su tipo en esta capa (V-h), pero `generateWorkoutSchema` lo exige numérico en API |
| AI-05 «caída/credencial/invalid ⇒ plan revisado o error seguro» | **EVS (por lectura)** + **RVP** | Los tres casos terminan en fallback (`:404-511`); «plan revisado» no existe: el fallback no está revisado profesionalmente |
| AI-05 «misma entrada/versión ⇒ mismo resultado» | **EVS (sonda)** | Sin reloj ni azar (`deterministic-fallback.ts`); sonda con entradas idénticas produce listas idénticas (ejecuciones repetidas con la misma semilla) |
| AI-05 «fallback aleatorio, silencioso o incompatible» (rechazo) | **EVS** (aleatorio/silencioso) / **RC** (incompatible con limitaciones) | Modo y razón persistidos y notificados en UI; incompatibilidad con limitaciones no comprobable (R4) |

---

## 5. Coherencia entre validador, fallback, prompt, personalización y progresión

### 5.1 Hallazgos de coherencia (candidatos a triage; no se re-etiqueta ningún riesgo conocido)

Cada uno con path, mecanismo, precondiciones, impacto y evidencia. Severidad y confianza separadas. **Todos son candidatos para triage** salvo que se indique evidencia ejecutada.

| ID | Resumen | Evidencia | Sev. | Conf. |
|---|---|---|---|---|
| C-01 | El prompt no declara los techos que el validador impone ⇒ rechazo/fallback probable; el modelo tampoco sabe que ≥40 ⇒ ≤5 ejercicios. [RC en dossier §4; aquí se concreta el mecanismo] | `workouts.service.ts:408-445` vs `plan-validator.ts:113-126,161-173`. Frecuencia real **[ND]** | Media | Alta (mecanismo) / Baja (frecuencia) |
| C-02 | La instrucción de «movilidad, calentamiento, recuperación» y el copy de UI «prioridad a… movilidad» **no son ejecutables ni verificables**: esquema JSON sin campo, catálogo sin categoría de movilidad/calentamiento (seed: Fuerza/Core/Cardio/Balance), validador y fallback sin requisito | `forty-plus-guidance.ts:14`; `workouts.service.ts:431-445`; `workout-generator.tsx:252-256`; seed `complete-exercises-database.ts`, `expanded-home-outdoor-exercises.ts` (catálogo de producción **[ND]**) | Media | Media-alta |
| C-03 | **Usuario sin sesiones previas ⇒ `adherenceRate = 0` ⇒ `workoutAdjustment = 'reduce'`**: la primera rutina baja un nivel (advanced→intermediate, intermediate→beginner), duración 25–40 y descanso 75 s; la explicación dice «Tu ritmo reciente pide bajar fricción» | `personalization.service.ts:145-146,200-207` (con `weeklyTarget>0`, `0/(t×4) = 0`, no es `null`); `workouts.service.ts:345-363,52-53`. Derivado por lectura; no ejecutado | Media | Alta (lectura directa) |
| C-04 | `limitations` solo llega al prompt como texto libre; fallback, validador y catálogo la ignoran; el copy de onboarding dice «podemos ajustar carga, frecuencia y expectativas» | `workouts.service.ts:424,495-502`; `onboarding-dialog.tsx:240-241`; `validators.ts:27` | Alta (relevancia) — pero es **RC** declarado (gap H del packet) | Alta |
| C-05 | Tres definiciones de población: generador (14–100; 40 como umbral; edad ausente ⇒ no-40+), Ruta Vital (50–60, `age == null` ⇒ dentro), pilot (40+). La edad enviada por el cliente sustituye a la del perfil | `validators.ts:270`; `workouts.service.ts:334`; `health-plans.domain.ts:48-50`; sonda S4/S8 | Media | Alta |
| C-06 | La progresión (DUP 3-5 y 15-20 reps, hasta 12 series, incrementos sin tope) **no respeta el envelope** de V1–V3; si en el futuro se enlaza con el generador habría dos políticas contradictorias | `engine.ts:141-154`; `validators.ts:137-151`; hoy sin consumidor UI (PR5) ⇒ latente | Baja hoy / Media si se conecta | Alta |
| C-07 | Duración y `workoutType` no restringen nada; la UI muestra la **duración y dificultad solicitadas**, no las efectivas (el perfil `experienceLevel` prima sobre `params.difficulty`, y `reduce` reduce duración/nivel) | `workouts.service.ts:345-363`; `workout-generator.tsx:474,478,509-510` (usa `preferences.*`) | Media | Alta |
| C-08 | Instrucciones de sexo+edad contradicen datos del propio prompt (hombre 40+ ⇒ «reducción de grasa abdominal» aunque `trainingGoal = build_muscle`) | `forty-plus-guidance.ts:26-30` vs `workouts.service.ts:417` | Baja | Alta |
| C-09 | El `name` de la rutina es texto libre del modelo (≤120 car.), validado solo en longitud; llega a UI (`getWorkoutDisplayName`) sin filtro de contenido sanitario | `plan-validator.ts:63,67`; `workout-generator.tsx:470` | Baja-Media | Media (no he visto cómo `getWorkoutDisplayName` lo trata en detalle) |
| C-10 | Señales de seguridad de Ruta Vital (12 códigos) **no se leen** en la generación; y la UI solo envía `recent_injury` (checkbox), el resto de códigos solo por API | `health-plans.domain.ts:22-35`; `health-plan-home.tsx:42` (`safetySignals: form.safetyReview ? ["recent_injury"] : []`); `workouts.service.ts` no importa health-plans | Media | Alta |
| C-11 | Rutinas manuales sin techos (create/update) — bypass completo del envelope | `validators.ts:38-49`; `workouts.service.ts:223-306` | Media | Alta (lectura) |
| C-12 | `advanced` en fallback = límite exacto del envelope (5×15, 75 s ≥40) y 6 → 5 ejercicios es la única reducción por edad: «los techos 40+» apenas se distinguen de los generales | `deterministic-fallback.ts:66-68`; `plan-limits.ts:27-36` | Media (información para R1/R2) | Alta |
| C-13 | Patrones del coach: huecos ES/EN y respuesta solo en inglés (sondas S11) | `guardrails.ts:3-14,31-33` | Media | Alta (probe ejecutado) |
| C-14 | Re-llamadas sin resultado de sesión **recomponen** la carga (+5 kg por llamada) porque se reutiliza `lastSessionReps` | `progression.service.ts:121-126` + `engine.ts:36,53-58`; sonda S9b (4 llamadas ⇒ 60→80 kg) | Baja hoy (sin UI) / Media si se expone | Alta (probe) |

### 5.2 Textos con contenido sanitario/seguridad que pueden llegar al usuario (hoy)

| ID | Texto | Dónde | Observación | Riesgo de sobreafirmación |
|---|---|---|---|---|
| T-U1 | «Este entrenamiento se ajustará con criterios 40+: más prioridad a fuerza, movilidad, recuperación y composición corporal…» | `workout-generator.tsx:252-256` (ES/EN) | **No se verifica** movilidad ni recuperación (C-02); para 40+ siempre visible | Alto |
| T-U2 | «Plantilla estándar … plan estándar adaptado a tu perfil y preferencias. **Es un plan válido**» | `workout-generator.tsx:492` | «Válido» = pasa estructura, no «adecuado/seguro»; «adaptado a tu perfil» solo es cierto para edad, nivel y ajuste; no limitaciones/objetivo/duración | Alto |
| T-U3 | «La rutina parte de tu onboarding y crea una primera propuesta **segura** para empezar con claridad» | `workouts.service.ts:81` → `app/workouts/[id]/page.tsx:139` | Sin cobertura lógica de «seguro»; texto fijo en ES (no localizado en EN); se persiste en la respuesta idempotente | Alto |
| T-U4 | «Con esto podemos ajustar carga, frecuencia y expectativas.» | `onboarding-dialog.tsx:241` | Las limitaciones no ajustan carga (C-04) | Medio-alto |
| T-U5 | «Tu consistencia reciente permite subir un poco la exigencia…» | `workouts.service.ts:54-55` | `increase` solo sube duración (≤75 min) | Bajo-medio |
| T-U6 | Ruta Vital: «Puedes comenzar con una progresión gradual.» / «Considera consultar a un profesional antes de aumentar la intensidad.» / «…no sustituye una valoración profesional.» | `translations/es.json` y `en.json` (`healthPlans.safety*`), `health-plans.service.ts:142` (texto ES **codificado** en servicio) | Con una sola señal capturada en UI, casi todo usuario recibe «Puedes comenzar…» (SELF_MANAGED); el texto «no sustituye valoración profesional» es adecuado en cautela | Medio |
| T-U7 | Guardarraíl del coach (inglés) | `guardrails.ts:31-33` | Ver CO2; incluye «only after you have medical clearance» (exige autorización médica de forma absoluta) | Medio |
| T-U8 | `workouts.recommendationSummary`: «no sale de un generador ciego: usa tu objetivo, adherencia y señales recientes» | `translations/es.json` (`workouts`) | Afirma que usa «señales recientes»: cierto para adherencia/duración; no para limitaciones | Bajo-medio |

---

## 6. Ejemplos sintéticos: entrada → salida del código

Marca: **[SONDA]** = ejecutado en `scratchpad/probe-A`; **[LECTURA]** = derivado por lectura, no ejecutado. Catálogo simulado: 9 ejercicios `beginner`, entorno `gym`, grupos legs/back/core.

| # | Entrada | Salida | Qué expone |
|---|---|---|---|
| S1 [SONDA] | Edad 70, 5 ejercicios, 5×15, descanso 0 s | **ACEPTA** | Techo = suelo de descanso 0; nada por edad más allá del nº de ejercicios (C-12) |
| S2 [SONDA] | Edad 45, 1 ejercicio, 1×1, descanso 0 | **ACEPTA** (n=1, `[1,1,0]`) | Sin mínimo razonable (R9) |
| S3 [SONDA] | Edad 45, 3×8, descanso 90 s | **RECHAZA** `REST_OUT_OF_RANGE` | El techo de 75 s excluye descansos habituales en fuerza (L2 como contexto); el modelo no conoce el techo (C-01) |
| S4 [SONDA] | Edad `null`, 6 ejercicios | **ACEPTA** (6) | Edad desconocida ⇒ regla no-40+ (R13) |
| S5 [SONDA] | Edad 45, `beginner`, pool de 1 ejercicio (core) | Fallback: 1 ejercicio `3×10/75 s` | R9 |
| S6 [SONDA] | Edad 45, `difficulty = 'weird'` | Fallback: 5 ejercicios `5×15/75 s` | Dificultad desconocida ⇒ la más exigente (aunque en la ruta real la dificultad llega validada por Zod en API) |
| S7 [SONDA] | `workoutType: 'flexibility'`, edad 45 | Mismos 5 ejercicios de fuerza 3×10/75 s; nombre «Entrenamiento de flexibility - beginner» | `workoutType` solo en el nombre (R16); nombre mezcla inglés/español en ES |
| S8 [SONDA] | Edad 40 con 6 ejercicios | **RECHAZA** `TOO_MANY_EXERCISES` | Umbral binario exacto en 40 |
| S9 [SONDA] | Progresión: 100 kg, `lower_compound`, todas las series al máximo (12), RIR 0 | 105 kg (`increase_load`) | +5 kg sin tope; con RIR 5 y 20 kg ⇒ 25 kg |
| S9b [SONDA] | Cuatro llamadas seguidas sin nuevo resultado de sesión (60 kg, reps `[12,12,12]`) | 65 → 70 → 75 → 80 kg | C-14 |
| S10 [SONDA] | `consecutiveStalls = 0` y `lastDeloadAt = null` | `shouldDeload: false` | Nunca hay deload programado sin un deload previo; `applyDeload` con 12 series ⇒ 9 |
| S11 [SONDA] | Mensajes al coach (ES/EN): «Me duele la rodilla al bajar escaleras» ⇒ **sin flag** (va al LLM); «Tengo dolor en el pecho al correr» ⇒ flag; «Siento mareo y palpitaciones al entrenar» ⇒ sin flag; «Tengo una **lesión** en el hombro» ⇒ sin flag; «lesion» sin tilde ⇒ flag; «I felt dizzy and my chest feels tight» ⇒ sin flag; «my knee is painful» ⇒ sin flag; «Tengo dolores lumbares» ⇒ sin flag; «Mi médico dice que puedo entrenar» ⇒ sin flag; «Ya me han hecho la **medición** de grasa» ⇒ **flag** (falso positivo por `/\bmedic/`) | — | C-13: los patrones dependen de formas literales; «duele», «lesión» (con tilde), «mareo», «dolores», «painful» no activan el guardarraíl; síntomas cardiorrespiratorios no cubiertos salvo la palabra «pain»/«dolor» |
| S12 [LECTURA] | Usuario nuevo, `experienceLevel = intermediate`, `trainingDaysPerWeek = 3`, 0 sesiones, `duration = 45`, edad 45, sin IA | `adherenceRate = 0` ⇒ `reduce` ⇒ dificultad `beginner`; duración `max(25, min(45,45,40)) = 40`; fallback: 5 ejercicios `3×10/75 s`; texto «Tu ritmo reciente pide bajar fricción» | C-03; la UI mostrará «Intermedio» y «45 min» (C-07) |
| S13 [LECTURA] | Usuario 45 años, limitación «rodillas»; fallback | Selección incluye sentadillas/zancadas si existen en el nivel; ninguna exclusión | R4 / C-04 (caso H del packet confirmado por lectura) |
| S14 [LECTURA] | Usuario 52 años, `advanced`, adherencia 1,2 (`increase`) | Dificultad se mantiene `advanced`; duración `min(75, max(base, hist))`; fallback `5×15/75 s` ×5 ejercicios | El «aumento» no cambia el envelope |
| S15 [LECTURA] | `POST /workouts` con 20 series × 100 reps × 0 s | Acepta | C-11 |

---

## 7. Preguntas priorizadas para el profesional

*(Prioridad = propuesta de orden de lectura, no un veredicto ni un bloqueo.)*

**Prioridad 1 — afectan a quién puede recibir qué (y a si el copy sobreafirma)**
1. **R4/R11 y C-04**: ¿Qué categorías de limitación (rodillas, lumbar, hombros, cuello, movilidad — las 5 del onboarding — y el texto libre) deben excluir/sustituir patrones de movimiento, y cuáles solo derivar a consulta? Mientras no exista mapeo, ¿es aceptable que el producto diga «podemos ajustar carga…» (T-U4)?
2. **R8/R17 y C-10**: ¿Qué condiciones (¿las 12 señales de Ruta Vital?) deben **impedir** generar una rutina automáticamente o exigir cribado previo (tipo PAR-Q+, L4)? ¿Basta con una casilla «recent_injury»?
3. **R5/R12 y CO2**: Redacción y umbral de derivación por dolor/síntomas; ¿el patrón actual (palabras literales, respuesta en inglés, «only after medical clearance») es aceptable para un piloto 40+? ¿Qué síntomas de aviso (mareo, palpitaciones, dolor torácico, etc.) deben cubrirse?
4. **R10 y §5.2**: ¿Son aceptables como copy para usuarios 40+ «primera propuesta segura», «Es un plan válido», «más prioridad a… movilidad, recuperación» mientras esas garantías no existen en la lógica?

**Prioridad 2 — valores numéricos**
5. **R1**: ¿Series/reps/descanso máximos por nivel (y, si procede, por franja de edad)? ¿Debe existir un **mínimo** (p. ej. descanso > 0)? ¿Es aceptable que 75 s sea techo y que el fallback `advanced` coincida con el techo (C-12)?
6. **R2/R13**: ¿Topes de ejercicios por sesión por franja de edad y nivel? ¿Qué debe hacer el sistema si la edad no consta o es <40/<18?
7. **R9**: Mínimo de ejercicios y comportamiento si el pool es pequeño (error seguro vs plan degradado).
8. **R3**: ¿Calentamiento/movilidad obligatorios? ¿Como ejercicios del catálogo, como bloque informativo o no incluidos en el piloto?

**Prioridad 3 — selección, adaptación y progresión**
9. **R6**: ¿Se acepta el método de fallback (hash + reparto por grupo) o se prefieren plantillas revisadas por nivel? ¿Debe haber metadatos de impacto/contraindicaciones por ejercicio?
10. **R14/G1**: ¿Es deseable que el primer plan de un usuario nuevo se genere en modo «reducir» (C-03)? ¿Qué debe hacer `increase` además de subir duración?
11. **R7/R15/C-06/C-11**: ¿Qué reglas de progresión/deload son aceptables y deben coincidir con el envelope del generador? ¿Las rutinas manuales deben respetar los mismos techos?
12. **R16**: Para 40+, ¿qué significan `cardio`, `hiit`, `flexibility`? ¿Deben ofrecerse?
13. **Texto de nutrición (T-G6)**: derivar a perfil de nutrición; no evaluable por el profesional del ejercicio.

---

## 8. Riesgos residuales y no evaluables

**Riesgos residuales (ya conocidos en el paquete, con matices):**
- Todos los valores V1–V4, F2–F3 y G1 siguen sin revisión profesional: [RC] declarado.
- Catálogo (etiquetas de dificultad, equipo, entorno; ejemplos de impacto alto) sin revisión clínica: [RC] declarado en packet §2 y dossier §4.
- Incidencias históricas `…255cfca9` y `premium-form-voice`: causa desconocida; no las atribuyo a nada de lo descrito aquí.
- Evidencia de test del paquete en árboles anteriores; el `workouts.service.ts` actual (import estático) posterior a las corridas de integración (nota del brief): no afecta a validator/fallback/limits (idénticos al ZIP).

**No evaluables por mí:** idoneidad de cualquier valor; adecuación de textos de menopausia/proteína; frecuencia real de rechazos del LLM (sin proveedor); contenido real del catálogo de producción; el texto completo de ACSM 2009/2026 y de OMS 2020 (solo extractos); efecto de `getWorkoutDisplayName` sobre `name` (leído solo por uso); cobertura de tests de guardarraíles (grep no halló tests de `evaluateCoachSafety`, lo cual es una observación de ausencia, no una prueba de que no existan en otros árboles).

**Reproducciones pendientes («PENDIENTE DE VERIFICACIÓN»):**
- C-03 / S12: generar con usuario nuevo en BD aislada con `trainingDaysPerWeek=3`, `experienceLevel=intermediate`, `age=45`, sin sesiones, sin `GROQ_API_KEY` ⇒ comprobar `generation.mode=fallback`, dificultad de los ejercicios devueltos y `explanation.reasons`.
- C-01: con proveedor real o mock configurable, medir tasa de `ai_output_rejected` frente a prompts con/sin techos.
- C-07: comparar en UI `preferences.difficulty/duration` con los ejercicios efectivos para un perfil con `experienceLevel` distinto al seleccionado.

---

## 9. Conclusión acotada y decisiones reservadas

- **Conclusión:** en HEAD, el validador y el fallback ejecutan de forma determinista un envelope de ingeniería (1-5 series, 1-15 reps, 0-75 s, ≤6 ejercicios, ≤5 si edad ≥40) que **no está respaldado por ningún criterio profesional** y que, en los extremos, admite combinaciones que un profesional probablemente querrá discutir (descanso 0 s, 1 ejercicio, 5×15 como nivel `advanced`). Más allá de los números, existen inconsistencias verificables entre lo que el producto **dice** (movilidad, «segura», «ajustar carga», «plan válido») y lo que **hace** (sin movilidad, sin exclusiones por limitación, sin comprobación de condición alguna), y el primer plan de un usuario nuevo entra en modo «reducir». Los guardarraíles del coach dependen de formas literales de palabras y responden en inglés.
- **Este informe no aprueba** AI-03/04/05, ni G1–G4, ni el lanzamiento; no equivale a revisión profesional ni sanitaria.
- **Reservado a Toni:** designar al profesional; decidir si los candidatos C-02, C-03, C-05, C-07 y los textos T-U1…T-U4 se tratan como cambios previos a la revisión o se presentan al profesional tal cual; decidir si se modifica el prompt (C-01) y el copy.
- **Reservado a profesionales:** todas las respuestas R1–R17 de §4.4; la validez clínica de cualquier número, exclusión o texto; y, para nutrición (T-G6), un perfil distinto del profesional del ejercicio.

---
*Archivos de sonda (no versionados): `/private/tmp/claude-502/-Users-toni-Developer-anclora/67db9ee7-66a1-42fe-b6c4-1e94e561734a/scratchpad/probe-A/`.*
