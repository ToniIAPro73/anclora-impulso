# 01 — Inventario técnico y funcional del repositorio

> **Commit auditado:** `0e0b897dfca6397f9ca5a5d1e5d30382794f8428` (rama `development`, árbol limpio al inicio).
> **Fecha de auditoría:** 2026-11-09.
> **Modo:** solo análisis y documentación. No se modificó código, no se instalaron dependencias, no se ejecutaron migraciones ni tests de integración, no se leyeron ficheros `.env*`.
> Etiquetas: **CONFIRMADO** · **INFERIDO** · **HIPÓTESIS** · **NO VERIFICADO** (ver `README.md`).

---

## 1. Identidad del producto

| Campo | Valor | Estado | Evidencia |
|---|---|---|---|
| Nombre | Anclora Impulso | CONFIRMADO | `package.json` (`anclora-impulso-web`), `README.md` |
| Tipo | SaaS fitness premium, web (PWA parcial) con IA para generación de entrenamientos | CONFIRMADO | `README.md` ("Qué es"), `public/site.webmanifest` |
| Idiomas | Español (por defecto) e inglés, contexto propio | CONFIRMADO | `lib/contexts/language-context.tsx`, `lib/translations/{es,en}.json` |
| Ecosistema | Anclora Group; reglas de gobierno AOS en `.anclora/` y `AGENTS.md` | CONFIRMADO | `AGENTS.md`, `.anclora/AGENT_PROJECT_CONTEXT.md` |
| Usuario objetivo declarado | Adultos que quieren entrenar con planes personalizados y seguimiento | CONFIRMADO (documentado) | `README.md`, `docs/business/EXECUTIVE-SUMMARY.md` |
| Usuario objetivo real del trabajo reciente | Adultos 50–60 (Ruta Vital) con enfoque 40+ | CONFIRMADO | `docs/specs/SPEC-IMPULSO-POST-UX-REAUDIT-HEALTH-PLANS-END-TO-END.md` §1 |

---

## 2. Stack y topología

### 2.1 Frontend

| Elemento | Valor | Evidencia |
|---|---|---|
| Framework | Next.js `14.2.16`, App Router, React 18, TypeScript | `package.json` |
| Estilos | Tailwind CSS 4 (`postcss.config.mjs`), Radix UI + shadcn | `components/ui/` (50 ficheros) |
| Estado servidor | TanStack React Query v5 | `lib/providers/query-client.tsx`, `hooks/` (11 hooks) |
| Formularios | React Hook Form + Zod | `package.json` |
| Rutas | 22 páginas `app/**/page.tsx` (auth, dashboard, workouts, nutrition, progress, health-plans, admin/content, legal) | `app/` |
| Componentes de dominio | `components/dashboard-content.tsx` (875 líneas), `progress-tracker.tsx` (666), `workout-generator.tsx` (567) | `wc -l` |
| Tests | Jest + RTL: **21 suites / 150 tests pasan** (ejecutado) | §6 de `02_TECHNICAL_AUDIT.md` |

### 2.2 Backend

| Elemento | Valor | Evidencia |
|---|---|---|
| Runtime | Node 22 (`engines`), Express 4, TypeScript | `backend/package.json` |
| ORM / BD | Prisma `^5.22.0`, PostgreSQL (Neon en producción) | `backend/prisma/schema.prisma`, `.anclora/PRODUCTION_RUNTIME.md` §3 |
| Estructura | 20 rutas, 19 controladores, 47 servicios (incluye subcarpetas `coach/`, `llm/`, `oauth/`, `progression/`, `workouts/`) | `backend/src/` |
| Modelos Prisma | **57 modelos** | `grep -c '^model '` |
| Migraciones | **26** migraciones versionadas, la última `20261012090000_add_oauth_handoffs` | `backend/prisma/migrations/` |
| Montaje de rutas | `/api/auth`, `/api/exercises`, `/api/workouts`, `/api/sessions`, `/api/progress`, `/api/dashboard`, `/api/nutrition`, `/api/gamification`, `/api/profile`, `/api/events`, `/api/engagement`, `/api/v1/progression`, `/api/v1/coach`, `/api/social`, `/api/wearables`, `/api/premium`, `/api/health-plans` | `backend/src/app.ts:119-136` |
| Seguridad HTTP | Helmet, CORS por lista blanca, rate limit global 100/15 min (1000 en dev) y de auth 5/15 min | `backend/src/app.ts:41-107` |
| Logs | Winston con rotación diaria, Morgan/httpLogger, utilidad de redacción | `backend/src/config/logger.ts`, `backend/src/utils/redact.ts` |
| Documentación API | OpenAPI 3 + Swagger UI en `/api/docs/api` | `backend/src/docs/swagger.ts`, `backend/src/routes/docs.routes.ts` |
| Proveedor de IA | Groq (`llama-3.3-70b-versatile` por defecto) con proveedor determinista de respaldo | `backend/src/config/env.ts:94-96`, `backend/src/services/llm/` |

### 2.3 Infraestructura y CI/CD

| Elemento | Valor | Estado | Evidencia |
|---|---|---|---|
| Frontend | Vercel | CONFIRMADO (documentado) | `.anclora/PRODUCTION_RUNTIME.md` §2 |
| Backend | Render (Express, `rootDir=backend`), Auto-Deploy desactivado | CONFIRMADO (documentado) | `.anclora/PRODUCTION_RUNTIME.md` §4 |
| Base de datos | Neon / PostgreSQL, **asociada al proyecto `anclora-impulso` de Vercel** mediante integración; el servicio Render `Anclora-Impulso` (My Workspace) la usa como backend. **Local = producción por diseño** | CONFIRMADO por el propietario (topología) y por contrato (local) | `.anclora/PRODUCTION_RUNTIME.md` §2, §3, §9; `app/api/` sin referencias a BD |
| Vínculo Neon ↔ Vercel | El frontend no referencia la BD (`app/`, `lib/`, `components/`, `hooks/`, `middleware.ts` sin `prisma`/`DATABASE_URL`); `app/api/` solo tiene `csp-report` y `logs` | CONFIRMADO (código); variables de entorno de Vercel NO VERIFICADAS (no se leyeron valores) | AUD-023 |
| Migraciones | Workflow manual protegido `production-migrations.yml` (`workflow_dispatch`) | CONFIRMADO | `.github/workflows/production-migrations.yml` |
| CI | `ci.yml` en push/PR a `development/staging/production/main`, Postgres 16 como servicio | CONFIRMADO | `.github/workflows/ci.yml` |
| Promoción | `promote.yml` (`workflow_dispatch`), requiere token `PROMOTE=FULL` | CONFIRMADO | `.anclora/PRODUCTION_RUNTIME.md` §0, `.github/workflows/promote.yml` |
| Validación de ramas de agente | `validate-agent-branch.yml` | CONFIRMADO | `.github/workflows/` |

### 2.4 Integraciones externas

| Integración | Uso | Estado | Evidencia |
|---|---|---|---|
| Groq | Generación de entrenamiento y coach | CONFIRMADO | `backend/src/services/llm/groq.provider.ts` |
| OAuth Google y GitHub | Login social con handoff | CONFIRMADO | `backend/src/services/oauth/`, tabla `OAuthHandoff` |
| Vercel Analytics | Analítica | CONFIRMADO | `package.json`, `README.md` |
| Email | Notificaciones/recuperación | CONFIRMADO (código `utils/email.ts`, `nodemailer`) | `backend/src/utils/email.ts` |
| Wearables | Conexiones y muestras de recuperación (modelos `WearableConnection`, `RecoverySample`) | CONFIRMADO en esquema; integración real con proveedores **NO VERIFICADO** | `schema.prisma` |
| Supabase, OpenAI SDK, Anthropic SDK, `psycopg2-binary` | Declarados en `package.json` raíz | **Sin uso en código** (`grep` sin coincidencias) | ver `02_TECHNICAL_AUDIT.md` AUD-007 |

---

## 3. Modelo de datos (resumen)

| Dominio | Modelos principales | Estado |
|---|---|---|
| Identidad | `User` (con `sex` String?, `age` Int?, `limitations` String[]), `AuthSession`, `RefreshToken`, `OAuthAccount`, `OAuthHandoff` | Implementado |
| Entrenamiento | `Exercise`, `Workout`, `WorkoutExercise`, `WorkoutSession`, `SessionExercise`, `SessionSet`, `PersonalRecord`, `MuscleVolume`, `ExerciseProgressionState` | Implementado |
| Coach IA | `CoachConversation`, `CoachMessage`, `CoachUsageWindow` | Implementado |
| Social | `Follow`, `ActivityFeedItem`, `Kudos`, `Challenge`, `ChallengeParticipant` | Implementado |
| Nutrición | `MealPlan`, `Meal`, `Recipe`, `Ingredient`, `RecipeIngredient`, `MealRecipe`, `MealSwapHistory`, `NutritionLog`, `FoodItem`, `MealLog`, `NutritionTarget`, `UserNutritionBalance` | Implementado |
| Salud y wearables | `HealthDataImport`, `WearableConnection`, `RecoverySample`, `FormAnalysisRequest`, `VoiceCueSession` | Implementado (alcance real NO VERIFICADO) |
| Gamificación y eventos | `UserGamification`, `Achievement`, `UserAchievement`, `XPEvent`, `ProductEvent`, `NotificationDelivery` | Implementado |
| Medidas | `BodyMeasurement` | Implementado |
| **Health Plans** | `HealthPlanDefinition`, `HealthPlanPhase`, `HealthPlanWeek`, `HealthPlanAction`, `HealthPlanPillar`, `HealthPlanContentReference`, `HealthPlanEnrollment`, `HealthPlanProfile`, `HealthPlanWeekStatus`, `HealthPlanActionStatus` | Implementado (migración `20260914130000_add_health_plans`; ver AUD-006) |
| Operación | `IdempotencyRecord` | Implementado |

Relación de referencia: `schema.prisma` líneas 939–1120 (Health Plans), 13–90 (`User`).

---

## 4. Inventario funcional

### 4.1 Funcionalidades implementadas (CONFIRMADO en código)

| # | Capacidad | Ruta/Módulo principal | Observación |
|---|---|---|---|
| F-01 | Registro, login, refresh, logout, recuperación de contraseña | `routes/auth.routes.ts`, `controllers/auth.controller.ts`, `app/auth/*` | Refresh token en cuerpo JSON (AUD-001) |
| F-02 | Login social Google / GitHub con handoff | `routes/oauth.routes.ts`, `services/oauth*` | Implementado; ver tests `review-f4-oauth-handoff-and-linking` |
| F-03 | Onboarding y perfil (edad, sexo, altura, peso, objetivo, días, entorno, experiencia, limitaciones) | `components/onboarding-dialog.tsx`, `profile-dialog.tsx`, `profile.service.ts` | Campos de perfil ya existen (ver 07) |
| F-04 | Generación de entrenamiento con IA + validación + respaldo determinista | `services/workouts.service.ts`, `workouts/plan-validator.ts`, `workouts/deterministic-fallback.ts` | Límites pendientes de revisión profesional (AUD-013) |
| F-05 | Ejecución de sesión, series, descanso, cierre | `controllers/sessions.controller.ts`, `services/sessions.service.ts`, `app/workouts/[id]/start` | Ejecución mejorada en P2 del programa Post-UX |
| F-06 | Biblioteca de ejercicios, filtros, detalle, medios | `app/exercises`, `components/exercise-library.tsx`, `exercises.service.ts` | ~143 entradas en el seed (`complete-exercises-database.ts`) |
| F-07 | Progreso, medidas corporales, récords, volumen muscular | `progress.service.ts`, `strength-progress.service.ts` | Implementado |
| F-08 | Progresión de cargas (motor) | `services/progression/engine.ts`, `/api/v1/progression` | Tests unitarios `progression-engine.test.ts` |
| F-09 | Nutrición: planes, recetas, registro, objetivos, intercambios | `nutrition.service.ts` (1749 líneas), `app/nutrition` | Implementado; servicio muy grande (AUD-015) |
| F-10 | Coach IA conversacional con guardrails y cuota | `services/coach/*`, `/api/v1/coach` | Implementado; cuotas en `CoachUsageWindow` |
| F-11 | Gamificación (XP, logros, niveles) | `gamification.service.ts`, `app/achievements` | Implementado |
| F-12 | Social (seguimiento, actividad, kudos, retos) | `social.service.ts`, `app/` (sin página dedicada en la lista) | Implementado en API; UI **NO VERIFICADO** |
| F-13 | Wearables y readiness | `wearables.service.ts`, `/api/wearables` | Esquema y API presentes; integración real NO VERIFICADO |
| F-14 | Premium (formulario/voz) | `premium.service.ts`, `FormAnalysisRequest`, `VoiceCueSession` | Implementado en API; cobro **NO VERIFICADO** |
| F-15 | Ruta Vital 50–60 (Health Plans) | `services/health-plans*.ts`, `app/health-plans`, `components/health-plan-*.tsx` | Implementado P1 (gate PASS); ver AUD-004, AUD-006, AUD-021 |
| F-16 | Dashboard admin de métricas/logs | `routes/dashboard.routes.ts` (`requireAdmin`) | Protegido (ver AUD-011) |
| F-17 | Consentimiento de cookies y páginas legales | `components/cookie-consent.tsx`, `app/legal`, `app/privacy`, `app/terms` | Sin cláusula de menores (AUD-003) |
| F-18 | Administración de contenido editorial | `app/admin/content/page.tsx` | Implementado (UI) |
| F-19 | PWA (manifest, iconos) | `public/site.webmanifest` | Offline **no** anunciado (decisión P7) |

### 4.2 Parcialmente desarrollado o con deuda declarada

| Capacidad | Estado | Evidencia |
|---|---|---|
| Revisión profesional de límites de entrenamiento IA | `PENDING_PROFESSIONAL_REVIEW` | `backend/src/services/workouts/plan-limits.ts` |
| Monetización (`subscriptionTier` default `free`) | Campo existe; flujo de pago y límites comerciales **NO VERIFICADOS** | `schema.prisma` `User.subscriptionTier`; `premium.service.ts` |
| Recomendaciones 40+ por sexo | Lógica textual; sin proveniencia de fuentes | `services/forty-plus-guidance.ts` |
| Contenido de Ruta Vital | Plantillas de semana solo para semanas 1, 5, 13 y 25 en la siembra | `services/health-plans.service.ts` (`weekNumber` en `ensureRutaVitalDefinition`) — AUD-021 |

### 4.3 Documentado pero no implementado (o no verificable)

| Intención | Fuente | Estado real |
|---|---|---|
| "Más de 50 variables" de personalización, "100 ejercicios validados por profesionales certificados", GPT-4 | `docs/business/EXECUTIVE-SUMMARY.md` | Contradicho o sin evidencia (AUD-009) |
| Plan Entrenador white-label, planes freemium con precios y límites de 5 entrenamientos | `docs/business/EXECUTIVE-SUMMARY.md` | NO VERIFICADO en código |
| Diez modalidades por edad y sexo | Encargo actual del usuario | No existe; diseño en `06_AGE_GENDER_PLANS.md` |
| Offline en PWA | `docs/specs/...` §2.2 | Explícitamente no anunciado |

### 4.4 Duplicidades y redundancias aparentes

| Elemento | Observación |
|---|---|
| Dos motores de perfil (`profile.service.ts` y `personalization.service.ts`) | Ambos leen `User`; conviene confirmar que no divergen (INFERIDO, no revisado en detalle) |
| Dos rutas de progreso (`/api/progress` y `/api/v1/progression`) | Dominios distintos (histórico vs. motor de cargas); riesgo de confusión de nombres |
| Dos clientes Prisma-like en `services/llm/` y `services/coach/providers/` | Ambos llaman a Groq/determinista; posible duplicación (INFERIDO) |
| Carpeta raíz `RESULTADO-IMPLEMENTACION-D10.md`, `docs/audits/*.pdf|html|json|py` | Artefactos de auditoría mezclados con código fuente (AUD-020) |

---

## 5. Flujos principales de usuario (reconstruidos desde rutas y componentes)

```text
Landing (/landing) ── registro/login (/auth/*) ── OAuth Google/GitHub (/auth/callback)
        │
        ▼
Onboarding (onboarding-dialog) ── perfil (profile-dialog)
        │
        ▼
Dashboard (/dashboard) ─┬─ Generar entrenamiento (/workouts/generate) → Revisión (/workouts/[id])
                        │      └─ Ejecutar (/workouts/[id]/start) → Sesión → Progreso (/progress)
                        ├─ Biblioteca (/exercises)
                        ├─ Nutrición (/nutrition, /nutrition/meal-plans/[id])
                        ├─ Logros (/achievements)
                        └─ Ruta Vital 50–60 (/health-plans)  [opt-in]
```

Ruta: `app/**`. Los flujos se reconstruyeron a partir de la estructura de páginas; no se ejecutó el navegador (visual QA no realizada, ver `03_PRODUCT_AUDIT.md` §7).

---

## 6. Estado de madurez por área

Escala: **0** ausente · **1** inicial · **2** parcial · **3** funcional con huecos · **4** funcional con pruebas y gobernanza · **5** maduro y validado en producción con métricas. **N/E** = no evaluable con la evidencia disponible.

| Área | Puntuación | Criterio aplicado y evidencia | Fortalezas | Limitaciones | Oportunidad |
|---|---|---|---|---|---|
| Arquitectura de backend | **4** | Capas `routes → controllers → services`, validación Zod, motores reutilizables (workouts, progression, nutrition, gamification) | Separación clara frontend/API; motores compartidos | `nutrition.service.ts` de 1749 líneas (AUD-015) | Partir servicios grandes con tests de caracterización |
| Arquitectura de frontend | **3** | App Router, hooks de React Query, contextos | Hooks dedicados, i18n propio | Componentes de 600–900 líneas (AUD-016) | Extraer subcomponentes |
| Seguridad de autenticación | **3** | JWT HS256 fijado, sesión de servidor (`isSessionActive`), rotación de refresh, admin por ID y no por email | Diseño sólido en backend (`middleware/auth.ts`, `utils/jwt.ts`, `middleware/admin.ts`) | Refresh token en `localStorage` (AUD-001); fallback de secreto (AUD-002) | Cookie httpOnly para refresh |
| Seguridad de datos personales | **2** | Consentimiento de cookies existe; textos legales sin menores ni salud | Minimización parcial, ownership en rutas | Sin marco de menores ni datos de salud (AUD-003) | Revisión legal antes de Ruta Vital/planes por edad |
| Testing | **3** | Frontend 150 tests, backend unitario 114 tests, 31 suites de integración, 6 specs E2E | Cobertura amplia de auth, OAuth, idempotencia, progresión | Integración solo verificable en CI; E2E sin cubrir planes/entrenamiento (AUD-018) | E2E de Ruta Vital |
| Datos y migraciones | **3** | 26 migraciones versionadas; runner protegido; contrato de migración | Disciplina de migraciones aditivas | Discrepancia de ledger (AUD-006) | Verificación de estado de migraciones |
| CI/CD | **3** | `ci.yml` con Postgres; promoción manual con token | Gates y workflow manual | `tsc` backend con errores locales (AUD-005); sin job de build en esta auditoría | Gate de tipos con cliente regenerado |
| Observabilidad | **3** | Winston rotado, métricas en dashboard admin, eventos de producto | Eventos de producto y logs redactados | Sin trazas distribuidas; alcance de métricas en producción **NO VERIFICADO** | KPIs de producto en dashboard |
| Documentación | **2** | Abundante pero contradictoria (AUD-008/009/010/020) | Gobierno SDD y specs | Deriva entre CLAUDE.md, business, runtime | Fuente única de verdad |
| Producto / personalización | **3** | Perfil, 40+, sexo, nutrición, progresión | Base de personalización real | Sexo binario; sin objetivos evolutivos (ver 07) | Modalidades (ver 06) |
| Producto 50+ / Ruta Vital | **2** | P1 con gate PASS, pero 4 semanas plantilla de 24 | Estructura de safety y proveniencia en esquema | Contenido incompleto (AUD-021) | Completar semanas y contenido revisado |
| Accesibilidad | **3** | Radix, aria, P2–P3 con PASS en fuente | Componentes accesibles | Verificación en navegador pendiente (NO VERIFICADO) | Auditoría axe en E2E |
| Monetización | **N/E** | Campo `subscriptionTier`, sin evidencia de cobro | — | Sin verificación | Validar antes de decidir |
