# SPEC — Anclora Impulso: Health Plans + Post UX Re-audit

**Estado:** AUTORITATIVA PARA IMPLEMENTACIÓN FUTURA
**Modo:** DOCUMENTATION AUTHORING ONLY — esta ejecución no implementa P1
**Fecha:** 2026-09-14
**Repositorio:** `ToniIAPro73/anclora-impulso`
**Rama canónica:** `development`
**Baseline:** `c37f068f20de71c9e58079a0b4846de615e1edf2`
**AUDIT_REVISION:** `DEEP_REMEDIATION`
**Previous audit:** `docs/audits/anclora-impulso-ux-reaudit-2026-09-14.pdf`
**Reason:** Insufficient authenticated-product depth versus current methodology benchmark.

La SPEC define la verdad funcional, los límites de seguridad, el modelo de datos, la secuencia de fases y el contrato de release. El detalle de ejecución vive en [`docs/roadmap/ROADMAP-IMPULSO-POST-UX-REAUDIT-HEALTH-PLANS-END-TO-END.md`](../roadmap/ROADMAP-IMPULSO-POST-UX-REAUDIT-HEALTH-PLANS-END-TO-END.md) y en los documentos P0–P7. Un agente posterior debe leer ambos antes de modificar producto.

## 1. Executive summary

Impulso es hoy una aplicación fitness separada en frontend Next.js y backend Express, con JWT, Prisma/PostgreSQL, React Query, generación asistida de workouts, ejecución de sesiones, biblioteca de ejercicios, progreso, nutrición, gamificación y coach. La re-auditoría confirmó una base funcional y una identidad navy/cobre, pero también once oportunidades UX. La principal oportunidad estructural es convertir la acción siguiente en un hilo semanal sin duplicar los motores existentes.

La primera fase funcional obligatoria es **Ruta Vital 50–60**, una familia opt-in de `Health Plans`. No es diagnóstico, tratamiento, dieta ni puntuación clínica. Es una capa de contexto, educación, progresión y apoyo de hábitos que orquesta Workouts, Progress, Nutrition y Gamification.

Orden obligatorio:

1. P0 fija contratos, fuentes, fixtures, límites y observabilidad.
2. P1 entrega Ruta Vital 50–60 end-to-end y persistente.
3. P2 remedia el workspace de entrenamiento.
4. P3 alinea entrada pública y auth.
5. P4 mejora confianza y reversibilidad de IA.
6. P5 conecta progreso, nutrición y motivación alrededor de acciones.
7. P6 mejora descubrimiento y calidad del contenido de ejercicios.
8. P7 endurece calidad premium, PWA, accesibilidad y release.

No se permite saltar P1 para construir primero un nuevo dashboard, ni crear un segundo motor de workouts, progreso o nutrición.

## 2. Baseline

### 2.1 Repository baseline

| Campo | Valor | Evidencia |
|---|---|---|
| `BASELINE_HEAD` | `c37f068f20de71c9e58079a0b4846de615e1edf2` | `git rev-parse HEAD` |
| `ORIGIN_DEVELOPMENT_HEAD` | igual al baseline | `git rev-parse origin/development` |
| `WORKTREE_BEFORE` | limpio antes de authoring | `git status --short` |
| `REMOTE_SYNC` | `development` sincronizada | preflight |
| `REMOTE` | `git@github.com:ToniIAPro73/anclora-impulso.git` | `git remote -v` |
| `BRANCH_MODEL` | `development → staging → production → main` | `AGENTS.md`, contrato ecosistema |
| `PRODUCT_CODE_MODIFIED` | `NO` | scope de esta misión |
| `CURRENT_AUDIT_HEAD` | `65e655e0c435acc1f63f3961b7794a58ae0b3a24` | audit metadata |
| `HISTORICAL_AUDIT_HEAD` | `f32ca59` | audit metadata |

Ramas permanentes estaban sincronizadas en el baseline. El commit de esta SPEC se hará sobre `development`; no se promueve automáticamente porque la documentación no implementa ninguna fase.

### 2.2 Current architecture

| Capa | Estado confirmado |
|---|---|
| Frontend | Next.js 14/App Router, React 18, TypeScript, Tailwind CSS 4, Radix/shadcn |
| Estado servidor | TanStack React Query |
| Validación | Zod + React Hook Form en frontend; validators en backend |
| Backend | Express + TypeScript, separado del frontend |
| Datos | Prisma 5.22 + PostgreSQL/Neon según README/CLAUDE |
| Auth | JWT access/refresh, bcrypt, OAuth Google/GitHub, ownership guards |
| API | `/api/auth`, `/api/workouts`, `/api/sessions`, `/api/progress`, `/api/nutrition`, `/api/gamification`, `/api/profile`, `/api/v1/coach`, más rutas auxiliares |
| Hosting conocido | frontend Vercel; backend Render/Railway según configuración histórica; validar por entorno antes de promover |
| PWA | `public/site.webmanifest`; `start_url` actual `/auth/login`; offline no confirmado |
| i18n | contexto propio ES/EN, `lib/translations/es.json` y `en.json` |
| Themes | light/dark mediante `theme-context` y theme provider |
| Tests | Jest/RTL frontend; Jest/Supertest backend; integración de progreso, nutrición, gamificación, auth, coach y sesiones |

### 2.3 Baseline commands for every implementation phase

```text
git status --short --branch
git branch --show-current
git rev-parse HEAD
git rev-parse origin/development
git diff --check
pnpm lint
pnpm typecheck              # si existe en package scripts
pnpm test:ci
cd backend && pnpm test:ci
pnpm build
```

El agente debe registrar el comando no disponible como `NOT_APPLICABLE` y no fabricar resultados. La fase solo pasa cuando los comandos aplicables tienen artefacto o log de evidencia.

## 3. Source inventory and precedence

### 3.1 Sources read

| Fuente | Hash/estado | Uso |
|---|---|---|
| Current audit MD/HTML/JSON/PDF | artifact set at baseline | findings, coverage, evidence, scorecards |
| Historical Impulso audit PDF | SHA-256 `aaf3852161ead1c0c65bfad4675a45bd579b26c023a23d8653a578b64c71c7f0` | historical reconciliation |
| `Guia_salud_53_anos_2026-09-04.pdf` | SHA-256 `82fe9fd93aeaaa5f5c4de9a33f55ac1091ad1969975ef2afd7ec95ef3efac57d` | design principles and safety prompts; external Downloads path |
| `Plan_salud_y_longevidad_50_plus.pdf` | SHA-256 `64b409412829b357201fed73b7c2682b8d79e1c73f24eb453918514bfbce0846` | evidence-oriented roadmap input; external Downloads path |
| `README.md`, `README.en.md`, `AGENTS.md`, `CLAUDE.md`, `MEMORY.md` | current repo | product and operating constraints |
| `.anclora/AGENT_PROJECT_CONTEXT.md` + ecosystem contract | current governance | architecture, Git, privacy and promotion boundaries |
| `backend/prisma/schema.prisma` | current code | current data truth; no Health Plan models yet |
| routes/controllers/services/hooks/pages | current code | current capability boundaries |
| Jest/RTL/Supertest tests | current code | executable contracts |
| ShiftImport/Talent SPEC/roadmap documents | sibling repos | structure, granularity and gate model only |

Las dos guías de salud se encontraron fuera del repositorio. Esto es un riesgo de portabilidad documental: la futura implementación debe incorporar referencias normalizadas y hashes en el contrato, o trasladar copias aprobadas a una ubicación gobernada, sin copiar texto protegido ni claims sin revisión.

### 3.2 Precedence

1. Código actual de `development`.
2. Tests y contratos ejecutables.
3. Prisma schema, migrations y API validators.
4. AOS/gobernanza aplicable.
5. Re-auditoría reconciliada.
6. Auditoría histórica.
7. Guías de salud adjuntas y documentación narrativa.

Si hay conflicto, se registra en `SOURCE_RECONCILIATION_MATRIX` y gana la fuente superior. Las guías son fuentes de diseño/contenido, no autoridad clínica.

## 4. Product truth

| Capability | Estado actual | Fuente | Implicación |
|---|---|---|---|
| AUTH/session | `CONFIRMED` | B01–B05, auth routes | preservar límites y refresh |
| ONBOARDING/profile | `PARTIAL` / readonly audit | onboarding dialog, profile schema | reutilizar campos; no asumir completion segura |
| DASHBOARD | `CONFIRMED` | E13/E19/E29/E36/E55 | posible discovery point |
| WORKOUT_GENERATION | `READONLY_VERIFIED` | E14/E56, routes/service | reutilizar motor; generación futura requiere write fixture |
| WORKOUT_REVIEW | `CONFIRMED` | E26/E35 | target de entrada de Ruta Vital |
| WORKOUT_EXECUTION | `PARTIAL` | E26–E60, session API | P2 debe cerrar completion/resume |
| EXERCISE_LIBRARY | `READONLY_VERIFIED` | E15/E31/E38/E53/E54 | reutilizar búsqueda/detalle |
| PROGRESS | `READONLY_VERIFIED` | E16/E58, progress service | no duplicar métricas |
| NUTRITION | `READONLY_VERIFIED` | E17/E59, nutrition routes | health action debe deep-link al módulo |
| GAMIFICATION | `READONLY_VERIFIED` | E18/E41, gamification routes | recompensar continuidad, no peso |
| AI_COACH | `PARTIAL` | coach service/guardrails | mantener guardrails; no medicalizar |
| PROFILE | `CONFIRMED` schema/API, write not used in audit | profile route/service | extender solo con campos mínimos |
| THEME / LOCALE | `CONFIRMED_READONLY` | contexts, E19/E36 | Ruta Vital debe heredar tokens |
| PWA | `PARTIAL` | manifest only; offline unknown | start/install/recovery in P7 |
| LANDING/PUBLIC_ENTRY | `CONFIRMED` | `/`, `/landing`, auth pages, E01–E08 | P3 define canonical model |

## 5. Audit finding matrix

| ID | Finding | Scope | Target phase | Root cause to preserve | Acceptance anchor |
|---|---|---|---|---|---|
| UX-01 | Workout execution is a long-form set ledger rather than a focused training workspace | PRODUCT_UX | P2 | no current-exercise focus/compact progression | current set, next action and progress visible without excessive scroll |
| UX-02 | Mobile shell hides navigation behind a hamburger during an active fitness workflow | PRODUCT_UX | P2 | generic shell used during active workout | reachable in-workout controls without accidental exit |
| UX-03 | Repeated workout inputs lack sufficiently specific accessible names | PRODUCT_ACCESS | P2 | labels not bound to exercise/set/metric | unique accessible names and fieldsets |
| UX-04 | Exercise discovery spends image space on unavailable media placeholders | PRODUCT_UX | P6 | media fallback outranks metadata | compact fallback; metadata first |
| UX-05 | AI proposal explains profile rules but not controllable result rationale or reversibility | PRODUCT_UX | P4 | rationale not attached to generation state | inputs, rationale, edit/regenerate/discard |
| UX-06 | Progress low-data KPIs can read as failure despite a useful recommendation | PRODUCT_UX | P5 | absence has more visual weight than confidence/context | period, sufficiency and next action visible |
| UX-07 | Nutrition and gamification do not yet expose a shared next-action loop | PRODUCT_UX | P5/P1 | peer dashboards lack orchestration | one useful contextual next-best-action |
| UX-08 | Public entry model splits login root from marketing landing | PRODUCT_UX | P3 | root, landing and PWA start intent differ | route contract tested for anonymous/authenticated states |
| UX-09 | Login offers more social entry choices than signup | PRODUCT_UX | P3 | provider actions implemented separately | provider parity or explicit explanation |
| UX-10 | Mobile auth card reserves more vertical space than short form needs | PRODUCT_UX | P3 | desktop centering on mobile | compact safe-area layout |
| UX-11 | Landing proof palette dilutes copper fitness identity | PRODUCT_UX | P3/P7 | semantic accents compete with brand token | copper primary emphasis; status colors retained |

Cada finding debe tener fase, microfase, causa, aceptación, tests, gates y `DO_NOT_BREAK` en el roadmap. No se añaden findings por cuota.

## 6. Target architecture

```text
Health Plans
├── 50–60
│   └── Ruta Vital 50–60
├── 60–70 (future definition only)
├── 70+ (future definition only)
└── future cohorts
```

### 6.1 Module boundaries

| Módulo | Responsabilidad | No debe hacer |
|---|---|---|
| `health-plans/domain` | definitions, phases, weeks, actions, pillars, statuses | diagnosis or exercise prescription without existing workout contract |
| `health-plans/application` | enrollment, adaptation, next-best-action, progress projection | bypass auth/ownership or auto-enroll by age |
| `health-plans/content` | localized educational copy and provenance | embed unreviewed health claims |
| `health-plans/api` | Zod request/response contracts and controllers | expose private data cross-user |
| `health-plans/ui` | weekly workspace, enrollment, safety, pillar cards | duplicate dashboard engines |
| existing Workouts/Progress/Nutrition/Gamification | source capabilities | become dependent on a health-plan-specific fork |
| `health-plans/observability` | events, state transitions, audit-safe metrics | log sensitive health details or tokens |

La detección de cohorte solo selecciona una definición elegible. `age` no crea enrolment. El usuario debe elegir `JOIN`.

## 7. Health Plans domain model

Nombres recomendados, adaptables a la convención Prisma actual:

| Entidad | Tipo | Campos mínimos | Invariante |
|---|---|---|---|
| `HealthPlanDefinition` | reference | `key`, `name`, `cohortKey`, `version`, `status`, `defaultLocale` | unique key/version; published definition immutable |
| `HealthPlanPhase` | reference | `definitionId`, `key`, `order`, `startWeek`, `endWeek`, `durationLabel` | ordered, non-overlapping phases |
| `HealthPlanWeek` | reference | `phaseId`, `weekNumber`, `objective`, `minimumVersion`, `fullVersion` | one week per definition/version; minimum exists |
| `HealthPlanAction` | reference | `weekId`, `pillar`, `kind`, `labelKey`, `route`, `priority`, `minimumEligible` | action belongs to one week/pillar |
| `HealthPlanPillar` | reference | `key`, `labelKey`, `descriptionKey`, `stateRulesVersion` | finite known pillar catalog |
| `HealthPlanContentReference` | reference | `contentKey`, `sourceId`, `evidenceLevel`, `lastReviewed`, `owner`, `claimType`, `safetyLevel` | no published health content without provenance |
| `HealthPlanEnrollment` | user aggregate | `userId`, `definitionId`, `version`, `status`, `joinedAt`, `pausedAt`, `leftAt` | one active enrollment per definition; voluntary |
| `HealthPlanProfile` | user aggregate | goal, baseline, time, equipment, preferences, limitations flag, consent version | no unnecessary sensitive medical fields |
| `HealthPlanWeekStatus` | user state | enrollment, week, status, adaptationMode, startedAt, completedAt | status transitions audited and idempotent |
| `HealthPlanActionStatus` | user state | weekStatus, action, status, completedAt, source | completion unique per action/day policy |
| `HealthPlanProgress` | derived/read model | pillar states, signals, confidence, updatedAt | derived from source modules; no duplicate truth |
| `HealthPlanSafetyState` | safety state | category, reasonCode, reviewedAt, copyVersion | fail-closed for red flags |
| `HealthPlanAdaptation` | decision record | trigger, mode (`REDUCE/MAINTAIN/PROGRESS`), rationaleKey, createdAt | non-punitive and explainable |

### 7.1 Data separation

`REFERENCE DATA` = definitions, phases, weeks, actions, pillars, content references.
`PLAN DEFINITION` = immutable versioned plan.
`USER ENROLLMENT` = explicit opt-in and lifecycle.
`USER PROGRESS` = derived/read model from existing sessions, logs and measurements.
`WEEK STATUS` = state machine.
`ACTION STATUS` = idempotent completion links.
`CONTENT PROVENANCE` = governance metadata, never hidden in UI-only strings.

### 7.2 Additive migration rules

- New tables/columns additive first.
- Existing `User`, Workout, WorkoutSession, nutrition and gamification records remain valid.
- No auto-enrollment for users aged 50–60.
- No destructive backfill.
- Health-plan records can be deleted/archived without deleting existing workouts or measurements.
- Every migration has forward check, rollback/restore procedure and zero-downtime compatibility window.

## 8. Ruta Vital 50–60 product contract

### 8.1 Identity and promise

**Name:** Ruta Vital 50–60
**Family:** Health Plans / Planes de Salud
**Positioning:** progressive, adaptive support for strength, movement, nutrition, sleep/recovery and continuity.
**Not:** diet, weight-loss program, gym routine, treatment, diagnosis, anti-aging promise, longevity score or medical clearance.

### 8.2 Pillars

| Key | Name | User signal |
|---|---|---|
| `FORCE` | Fuerza | sessions, technical progression, functional tasks |
| `MOVEMENT` | Cardio/capacidad/movimiento | walking, aerobic minutes, mobility |
| `NUTRITION` | Nutrición | selected actions/log consistency, not clinical adequacy |
| `RECOVERY` | Sueño y recuperación | self-report, rest context, safe adaptation |
| `CONTINUITY` | Adherencia/hábitos/continuidad | returning, minimum-version completion |
| `CAPACITY` | Seguimiento/capacidad funcional | trends and user-reported function |

Mental health, connection, purpose and cognition are optional `ACTION`/`HABIT` types inside weeks. They are not mandatory new modules.

### 8.3 Phases

| Phase | Weeks | Weekly intent |
|---|---:|---|
| `FOUNDATION` | 1–4 | establish safe rhythm and baseline |
| `CAPACITY_BUILDING` | 5–12 | progressive capacity without arbitrary jumps |
| `CONSOLIDATION` | months 4–6 | stabilize a sustainable base |
| `MAINTENANCE` | ongoing | preserve continuity through life changes |

Every phase/week definition must include `WEEKLY_OBJECTIVES`, `PRIMARY_ACTIONS`, `MINIMUM_VERSION`, `OPTIONAL_ACTIONS`, `SAFETY_CONSTRAINTS`, `PROGRESS_SIGNALS`.

### 8.4 Minimum Version

Each week exposes `FULL_VERSION` and `MINIMUM_VERSION`.

Example only, not hardcoded clinical prescription:

```text
FULL_VERSION: 2 strength sessions + 3 walks + nutrition anchor + stable sleep window
MINIMUM_VERSION: 1 short strength session + 10 minutes movement/day + 1 nutrition anchor + stable wake time
```

The UI must say or imply continuity, never “failed week”. Missed actions trigger `REDUCE`, `MAINTAIN` or `PROGRESS`, not punitive XP or restart-from-zero.

### 8.5 Onboarding

Required product inputs:

| Input | Allowed design |
|---|---|
| `GOAL` | fuerza, energía, composición corporal, movilidad, resistencia, salud general |
| `BASELINE_ACTIVITY` | poco activo, algo activo, irregular, activo |
| `AVAILABLE_TIME` | ~15 min, ~30 min, ~45–60 min |
| `PREFERENCES` | preferred activities and days |
| `EQUIPMENT` | none/home/gym/other known equipment |
| `KNOWN_LIMITATIONS` | user-controlled limitation flag and free-text only if justified |

The flow shows purpose, progress, back and consent. Health-sensitive questions are optional only if needed for a safety branch. No diagnosis, medication, laboratory or medical history collection by default.

Lifecycle: `DISCOVER → REVIEW → JOIN → ONBOARD → SAFETY_REVIEW → ACTIVE`. User controls: `JOIN`, `PAUSE`, `RESUME`, `LEAVE`.

### 8.6 Safety model

Categories:

- `SELF_MANAGED`: educational, low-risk habit progression may continue.
- `CAUTION`: reduce/maintain, explain boundary, invite professional review where appropriate.
- `PROFESSIONAL_REVIEW_RECOMMENDED`: no automatic intensity escalation; show concise advice to seek qualified evaluation.

Signals requiring a fail-closed branch include chest pain, syncope, disproportionate dyspnea, important palpitations, known cardiovascular disease, severe/uncontrolled hypertension, complex diabetes, significant renal disease, recent injury, osteoporosis/fracture, severe joint limitation and neurological symptoms.

Safe copy: “Antes de aumentar la intensidad, considera valoración profesional si…”
Forbidden copy: “Estás apto”, “esta rutina es segura para ti”, diagnosis, risk score, medication advice or treatment claim.

Safety state is educational and reversible. It must not block all general education when a safe read-only path exists, but it must prevent unsafe automatic escalation.

### 8.7 Personalization

Decision inputs: baseline fitness, activity history, time available, equipment, preferences, joint limitations flag, body-composition goal, recovery and workout history. Age selects the cohort context only. The route must differ for at least the synthetic profiles in Section 17.

Adaptation events:

| Event | Default mode | User explanation |
|---|---|---|
| missed week | `REDUCE` or `MAINTAIN` | resume at a manageable version |
| low adherence | `REDUCE` | shrink the decision, preserve continuity |
| completed early | `PROGRESS` only if constraints allow | optional next challenge |
| limited time | `REDUCE` | minimum version remains valid |
| poor recovery | `MAINTAIN` or `REDUCE` | protect recovery; no diagnosis |
| temporary interruption | `REDUCE` | return path without punishment |

## 9. Next-best-action and cross-module integration

`NEXT_BEST_ACTION` is a transparent orchestration result, not a medical decision. It has `actionId`, `pillar`, `sourceState`, `destinationRoute`, `reasonKey`, `confidence`, `minimumEligible`, `createdAt`.

Precedence:

1. explicit safety constraint;
2. incomplete current minimum action;
3. return/recovery action after interruption;
4. current week primary action;
5. optional pillar action;
6. educational “learn more”.

Examples:

```text
workout completed → recovery or nutrition anchor
low progress data → consistency action, not a negative score
poor sleep self-report → reduced-intensity version, not clinical advice
nutrition action complete → next weekly action, not a second nutrition dashboard
```

The router must deep-link to existing `/workouts`, `/progress`, `/nutrition`, `/achievements` capabilities and return to Ruta Vital with state refreshed. No duplicated workout/nutrition/progress engine.

## 10. API contract

Recommended namespace: `/api/health-plans`.

| Method | Route | Purpose | Write | Auth |
|---|---|---|---|---|
| GET | `/definitions` | eligible published definitions | no | authenticated |
| GET | `/definitions/:key` | definition metadata and phase outline | no | authenticated |
| POST | `/enrollments` | explicit JOIN + consent version | yes | authenticated |
| GET | `/enrollment` | current user enrollment/read model | no | authenticated |
| PATCH | `/enrollment/status` | pause/resume/leave | yes | authenticated |
| POST | `/onboarding` | save plan profile | yes | authenticated |
| GET | `/home` | current week, pillars, NBA, minimum version | no | authenticated |
| POST | `/actions/:id/complete` | idempotent action completion | yes | authenticated |
| POST | `/adaptations/preview` | readonly adaptation explanation | no | authenticated |
| GET | `/content/:key` | localized content with provenance metadata | no | authenticated |

All request bodies and responses use Zod. Controllers enforce user ownership. Writes use idempotency keys where duplicate taps are possible. API responses never expose raw safety notes, private profile data or model prompts.

## 11. UI contract

Ruta Vital home is a focused weekly workspace:

```text
Ruta Vital 50–60
short subcopy
Esta semana
  primary objective
  next best action
  week progress
  minimum version
pillar state cards
  Force / Movement / Nutrition / Recovery / Continuity
brief WHY_THIS_MATTERS / SABER_MAS
```

Above fold on 390×844: title, objective, NBA and minimum version CTA must be visible or reachable with one deliberate scroll. No `HEALTH SCORE = 82`. States are text + icon + color, never color-only. Light/dark and ES/EN use existing tokens/contexts.

## 12. Health content governance

Every claim or educational unit has:

`SOURCE`, `EVIDENCE_LEVEL`, `LAST_REVIEWED`, `CONTENT_OWNER`, `CLAIM_TYPE`, `SAFETY_LEVEL`, `LOCALE`, `CONTENT_VERSION`.

Allowed claim types:

`GENERAL_GUIDANCE`, `BEHAVIORAL_GUIDANCE`, `FITNESS_GUIDANCE`, `NUTRITION_GUIDANCE`, `SAFETY_NOTICE`.

Disallowed without separate clinical/legal authority: `CLINICAL_DIAGNOSIS`, medication advice, treatment, medical clearance, clinical risk scoring.

Source quality hierarchy for material claims: WHO/institutional guideline, systematic review/meta-analysis, RCT, peer-reviewed longitudinal evidence, then secondary synthesis. Newsletter, ScienceDaily, medRxiv and press are discovery/context only, not equivalent authority. The two attached PDFs are source inputs, with lower-level claims requiring verification before product copy.

## 13. Privacy, security and consent

- Minimize data: no diagnosis, medication, lab results or full medical history by default.
- Store limitation flags only when product behavior needs them; separate free text from structured safety state.
- Explicit opt-in; no auto-enrollment by age.
- JOIN/PAUSE/RESUME/LEAVE are reversible and do not delete existing fitness data.
- Enforce JWT, ownership, rate limits, Zod validation and safe logging.
- Do not send health-plan content to an LLM unless the field is necessary, consented and redacted.
- Safety copy is informational and localized.
- Admin content publishing requires provenance and role guard.

## 14. i18n, theme, responsive and accessibility

### i18n

All Ruta Vital strings use ES/EN translation namespaces from the first commit. Coverage includes onboarding, safety branches, phase/week labels, minimum version, NBA rationale, loading/error/empty states, buttons, tooltips, confirmation dialogs and accessible names. Tests fail on missing keys and visible raw keys.

### Theme

Reuse navy + copper/orange. Recovery/wellbeing accent is secondary and tokenized only if contrast passes. Test dashboard/workout/progress/nutrition/Ruta Vital in light and dark. Disabled, focus, dialogs, charts and safety states must remain legible.

### Responsive

Required matrix: `390×844`, `430×932`, `768×1024`, `1024×768`, `1366×768`, `1440×900`, `1920×1080`. Weekly action is prioritized on mobile. No desktop card grid simply shrunk below breakpoint.

### Accessibility

Semantic headings/landmarks; labeled controls; fieldsets for repeated inputs; keyboard tab/Shift+Tab/Escape; visible focus; 44×44 target where practical; dialog focus trap/restoration; non-color-only pillar states; reduced motion; appropriate live regions only for action/result changes; charts with text alternatives; errors preserve input.

## 15. Observability

Safe events, no secrets or sensitive free text:

`health_plan_discovered`, `health_plan_joined`, `health_plan_onboarding_completed`, `health_plan_safety_branch`, `health_plan_week_viewed`, `health_plan_action_started`, `health_plan_action_completed`, `health_plan_minimum_completed`, `health_plan_paused`, `health_plan_resumed`, `health_plan_left`, `health_plan_adaptation_applied`, `health_plan_next_action_shown`.

Every event includes plan version, phase/week, pillar, locale, theme and source route where non-sensitive. Do not use health-plan analytics as clinical outcome measurement.

## 16. Testing contract

### Unit/integration

- definition versioning and phase ordering;
- cohort boundary 49/50/59/60/61;
- minimum/full version invariants;
- safety branch fail-closed;
- REDUCE/MAINTAIN/PROGRESS adaptation;
- NBA precedence and deterministic tie-break;
- ownership and idempotency;
- content provenance completeness;
- privacy field allow-list;
- existing workout/progress/nutrition/gamification regression.

### E2E journeys

`HP-J01` discover, `HP-J02` enroll, `HP-J03` onboarding, `HP-J04` safety branch, `HP-J05` route generation, `HP-J06` current week, `HP-J07` complete action, `HP-J08` open workout, `HP-J09` return from workout, `HP-J10` nutrition action, `HP-J11` progress action, `HP-J12` minimum version, `HP-J13` missed-week recovery, `HP-J14` pause, `HP-J15` resume, `HP-J16` leave.

### Existing product regression

Auth/session/dashboard, workout review/execution, exercise search/detail, progress, nutrition, achievements, theme, locale, PWA entry and public/legal routes remain required. No phase can claim pass only from new Health Plan tests.

## 17. Synthetic fixtures

| Fixture | Profile | Expected design behavior |
|---|---|---|
| `HP50_A` | 55, sedentary, 15 min/day, no limitation | foundation + minimum-first |
| `HP50_B` | 52, active, 45 min/day, gym | fuller options; no forced intensity |
| `HP50_C` | 58, irregular, 30 min/day, joint limitation flag | caution/reduced alternatives |
| `HP50_D` | 50, safety review trigger | professional-review branch; no escalation |
| `HP50_E` | 60 boundary | included in cohort; same safety rules |
| boundary | 49/50/59/60/61 | only 50–60 eligible by definition; no auto-enroll |

Fixtures are synthetic, isolated, resettable and never mapped to a real user.

## 18. Release and promotion contract

Every phase starts from current `development` and follows:

1. final phase gate;
2. `git diff --check`;
3. lint, typecheck, tests, build and E2E/a11y/responsive/theme/i18n checks;
4. documentation and AOS checks;
5. commit on implementation branch, merge/PR to `development`;
6. CI green;
7. manual promote `development → staging`;
8. validate staging with synthetic data and safe writes;
9. promote `staging → production`;
10. production smoke;
11. promote `production → main`;
12. verify branch sync.

No force push. No promotion with failed health-content, safety, privacy, no-diagnosis, cross-module or data-integrity gate. If staging shares production data, `USE_SYNTHETIC_DATA_ONLY=true` and write guards are mandatory.

## 19. Rollback contract

- Feature flag Health Plans off leaves current app unchanged.
- Additive schema remains backwards compatible.
- Route unavailable state falls back to dashboard; never breaks auth or existing modules.
- Revert application commit and disable flag before destructive data action.
- Do not delete enrollments or source workout/progress/nutrition data during rollback.
- Content version can be unpublished independently.
- Health safety regression requires immediate fail-closed behavior and incident record.

## 20. DO_NOT_BREAK

1. Canonical JWT auth/session, refresh, dashboard and logout.
2. Workout persistence and draft/recovery behavior.
3. Exercise search, filters and detail route.
4. Honest low-data progress states and recommendations.
5. Nutrition routes, meal plans and existing logs.
6. Gamification XP/achievements without unsafe weight/overtraining incentives.
7. Theme and ES/EN locale contexts.
8. Navy/copper Impulso identity.
9. AI guardrails and no medical claims.
10. Public/legal routes, ownership boundaries and data minimization.
11. Existing PWA/auth entry contract until P3 explicitly changes it with regression evidence.

## 21. Out of scope

60–70 and 70+ functional plans; medical device integration; lab interpretation; medication recommendations; diagnosis; clinical treatment; insurance; clinician portal; remote monitoring; emergency services; real clinical risk scoring; product implementation in this authoring mission.

## 22. Final acceptance

The documentation authoring gate is PASS only when:

```text
SPEC_EXISTS = PASS
ROADMAP_EXISTS = PASS
P0_P7_DEFINED = PASS
P1_IS_RUTA_VITAL = PASS
ALL_FINDINGS_TRACED = PASS
HEALTH_SOURCES_TRACED = PASS
SAFETY_MODEL_DEFINED = PASS
PRIVACY_DEFINED = PASS
DATA_MODEL_DEFINED = PASS
CROSS_MODULE_INTEGRATION_DEFINED = PASS
MICROPHASES_DEFINED = PASS
TASKS_DEFINED = PASS
MICROTASKS_DEFINED = PASS
GATES_DEFINED = PASS
TESTS_DEFINED = PASS
DO_NOT_BREAK_DEFINED = PASS
PROMOTION_CONTRACT_DEFINED = PASS
NO_PRODUCT_CODE_CHANGED = PASS
IMPLEMENTATION_STARTED = NO
```

**Autoridad final:** código y tests actuales prevalecen sobre esta propuesta si descubren una incompatibilidad. La incompatibilidad debe generar una nueva decisión/spec, no una interpretación silenciosa.

## 23. Traceability matrices

### 23.1 AUDIT_FINDING_TO_PHASE_MATRIX

| Finding | Root cause | Phase | Microphases | Acceptance/test anchor |
|---|---|---|---|---|
| UX-01 | long-form ledger lacks focus | P2 | M00–M05, M08–M09 | current exercise, set progression, scroll/target E2E |
| UX-02 | generic mobile shell in active workflow | P2 | M04–M05, M08 | one-hand reach, safe exit, mobile E2E |
| UX-03 | repeated inputs lack unique semantics | P2 | M06, M09 | AX names/fieldsets/keyboard |
| UX-04 | unavailable media dominates cards | P6 | M00–M04, M06 | metadata-first/no-image card tests |
| UX-05 | rationale not result-bound/reversible | P4 | M00–M07 | input/rationale/regenerate/discard/retry |
| UX-06 | low-data numerics lack context | P5 | M00–M03, M07–M08 | period/confidence/next action |
| UX-07 | peer modules lack shared action | P1/P5 | P1 M08–M13; P5 M03–M08 | one NBA with deep links |
| UX-08 | root/landing/PWA intent differs | P3 | M00–M03, M08 | anonymous/authenticated/manifest matrix |
| UX-09 | login/signup provider divergence | P3 | M04, M08 | provider parity/callback tests |
| UX-10 | mobile auth vertical centering | P3 | M05, M08 | 390/430 form ergonomics |
| UX-11 | competing landing accent tokens | P3/P7 | P3 M06–M08; P7 M00–M01 | token/contrast/brand review |

### 23.2 HEALTH_REQUIREMENT_TO_PHASE_MATRIX

| Requirement | Contract | Phase path | Proof |
|---|---|---|---|
| extensible Health Plans | definitions not age conditionals | P0-M03, P1-M00/M01 | schema/domain tests |
| Ruta Vital 50–60 | inclusive cohort, opt-in | P1-M01–M03 | boundary + enrollment E2E |
| six pillars | qualitative, source-backed | P1-M09/M14 | state/content tests |
| four time phases | ordered weeks and maintenance | P1-M05 | phase ordering tests |
| full/minimum version | minimum preserves continuity | P1-M06 | evaluator/adaptation tests |
| safety screen | fail closed, three categories | P0-M04, P1-M03 | red-flag matrix |
| personalization | non-clinical variation | P1-M04 | HP50_A–E |
| weekly workspace | objective/NBA/progress/minimum | P1-M07/M08 | responsive E2E |
| workouts reuse | no second engine | P1-M10, P2-M07 | route/return tests |
| progress reuse | derived read model | P1-M11, P5 | source/period tests |
| nutrition reuse | action link, no duplicate | P1-M12, P5-M04 | deep-link tests |
| safe gamification | continuity only | P1-M13, P5-M05 | forbidden reward tests |
| provenance | every claim governed | P0-M03, P1-M14, P7-M08 | registry validator |
| ES/EN | all strings localized | P1-M15, P7-M01 | missing-key scan |
| light/dark | existing tokens | P1-M16, P7-M00 | contrast snapshots |
| mobile-first | required viewport matrix | P1-M17, P7-M07 | Playwright matrix |
| accessibility | semantics/focus/targets | P1-M18, P7-M04 | keyboard/AX review |
| privacy | minimum collection | P0-M04, P1-M02 | allow-list/negative tests |
| voluntary lifecycle | join/pause/resume/leave | P1-M02 | state transition E2E |

### 23.3 SOURCE_TO_REQUIREMENT_MATRIX

| Source | Design input | Constraint | Required treatment |
|---|---|---|---|
| Guia salud 53 | capability, strength, movement, sleep, adherence, minimum version | synthesis; not clinical authority | tag as contextual source; verify material claims |
| Plan salud 50+ | 80/20, 6-month phases, personalization, measurements | mixed evidence quality and some secondary links | use as design hypothesis; institutional/primary verification before copy |
| WHO guidance cited by sources | activity structure | public guideline, still needs contextual wording | provenance + review date |
| existing legal copy | no medical advice boundary | current product contract | reuse and extend; do not weaken |
| current code/schema/tests | actual capability and boundaries | highest precedence | adapt design to actual APIs and migrations |
| current audit | UX friction and DO_NOT_BREAK | browser evidence is time-bound | trace to phase; retest during implementation |

### 23.4 ROUTE_TO_TEST_MATRIX

| Route/surface | Existing contract | Health Plan/UX tests |
|---|---|---|
| `/` `/landing` | public entry | P3 route matrix, HP-J01 |
| `/auth/login` `/auth/signup` `/auth/callback` | JWT/OAuth | P3 auth regression |
| `/dashboard` | action hub | HP-J01, HP-J06, P5 return |
| `/health-plans` (proposed) | feature-flagged discovery | HP-J01–J07, P1 responsive/a11y |
| `/health-plans/ruta-vital-50-60` (proposed) | weekly workspace | HP-J06, HP-J07, HP-J12–J15 |
| `/workouts/generate` | existing generator | HP-J05/HP-J08, P4 |
| `/workouts/:id` | workout review | HP-J08, P2 |
| `/workouts/:id/start` | execution | HP-J08/HP-J09, P2 |
| `/exercises` and detail | library | P6 and HP action links |
| `/progress` | progress source | HP-J11, P5 |
| `/nutrition` and meal plan | nutrition source | HP-J10, P5 |
| `/achievements` | motivation source | HP-J07, P5 |
| profile/settings | source preferences | P1 onboarding/profile tests |
| manifest/start URL | PWA entry | P3-M03, P7-M02 |

### 23.5 HEALTH_SAFETY_TRACEABILITY_MATRIX

| Signal/category | UI response | Domain response | Forbidden response | Gate |
|---|---|---|---|---|
| no red flag / `SELF_MANAGED` | educational next action | normal route | no medical assurance | G19/G20 |
| caution signal / `CAUTION` | brief boundary + reduce/maintain option | no intensity escalation by default | “safe for you” | G19 |
| chest pain, syncope, disproportionate dyspnea | professional review notice | fail closed; no progression | generated high intensity | G19/G20 |
| important palpitations/neuro symptoms | professional review notice | fail closed | diagnosis/risk score | G19/G20 |
| cardiovascular disease/severe BP/complex diabetes/renal disease | caution/review copy | constrained route; preserve education | treatment/clearance | G19/G20 |
| recent injury/osteoporosis/fracture/severe joint limitation | caution/review copy | reduced or paused route | generic high-impact plan | G19 |
| poor recovery/self-report | empathetic adjustment explanation | `REDUCE` or `MAINTAIN` | infer disease | G18–G20 |
| unknown or malformed safety input | ask only necessary clarification | safest non-escalating state | default `PROGRESS` | G3/G19 |

## 24. Documentation authoring gate record

| Gate | Result | Evidence |
|---|---|---|
| `SPEC_EXISTS` | PASS | this file |
| `ROADMAP_EXISTS` | PASS | root roadmap + master + P0–P7 |
| `P0_P7_DEFINED` | PASS | phase files |
| `P1_IS_RUTA_VITAL` | PASS | P1 file and Section 8 |
| `ALL_FINDINGS_TRACED` | PASS | Section 5 + 23.1 |
| `HEALTH_SOURCES_TRACED` | PASS | Section 3 + 23.3 |
| `SAFETY_MODEL_DEFINED` | PASS | Sections 8.6 + 23.5 |
| `PRIVACY_DEFINED` | PASS | Section 13 |
| `DATA_MODEL_DEFINED` | PASS | Section 7 |
| `CROSS_MODULE_INTEGRATION_DEFINED` | PASS | Section 9 + 23.4 |
| `MICROPHASES_DEFINED` | PASS | P0–P7 |
| `TASKS_DEFINED` | PASS | one task per microphase |
| `MICROTASKS_DEFINED` | PASS | `.01`/`.02`/`.03` contract per task |
| `GATES_DEFINED` | PASS | master gate catalog + final gates |
| `TESTS_DEFINED` | PASS | Sections 16–17 and phase files |
| `DO_NOT_BREAK_DEFINED` | PASS | Section 20 + phase contracts |
| `PROMOTION_CONTRACT_DEFINED` | PASS | Section 18 |
| `NO_PRODUCT_CODE_CHANGED` | PASS | authoring scope |
| `IMPLEMENTATION_STARTED` | NO | explicit mission boundary |
