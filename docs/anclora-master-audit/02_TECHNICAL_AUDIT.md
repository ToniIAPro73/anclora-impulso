# 02 — Auditoría técnica: arquitectura, calidad, seguridad, rendimiento y testing

> **Commit:** `0e0b897dfca6397f9ca5a5d1e5d30382794f8428`. **Fecha:** 2026-11-09.
> Hallazgos con identificador `AUD-xxx`; el registro único está en `09_FINDINGS_AND_OPPORTUNITIES.md`.
> Ningún tiempo de respuesta ni métrica de producción se ha inventado: no se hicieron benchmarks.

---

## 1. Resumen

El backend está bien estructurado y tiene defensas reales (JWT con algoritmo fijado, sesiones de servidor, admin por identificador, cuotas e idempotencia). Los riesgos principales no están en la lógica de negocio sino en **tres puntos**: (1) el refresh token vive en `localStorage`, (2) la separación entre entorno local y producción depende de disciplina operativa, y (3) hay discrepancias documentales y de migraciones que impiden afirmar el estado real de producción sin verificación de Toni.

---

## 2. Arquitectura (4.1)

| Dimensión | Evaluación | Evidencia |
|---|---|---|
| Separación de responsabilidades | **Buena** en backend: rutas delgadas, controladores, servicios, validadores Zod. CONFIRMADO. | `backend/src/routes/*.ts`, `controllers/*.ts`, `utils/validators.ts` |
| Acoplamiento | Medio. Los servicios de nutrición y entrenamiento importan lógica de perfil y de personalización. INFERIDO | `workouts.service.ts:335`, `nutrition.service.ts:1022` (`params.sex ?? snapshot.profile.sex`) |
| Cohesión | Baja en `nutrition.service.ts` (1749 líneas, varias responsabilidades: plan, recetas, registro, intercambios, balance). CONFIRMADO | `wc -l` |
| Modularidad de dominio | Buena en Health Plans: `health-plans.domain.ts` (63 líneas, puro, testeable), servicio y validadores separados. CONFIRMADO | `backend/src/services/health-plans.domain.ts` |
| Dependencias circulares | No detectadas en la revisión realizada (no se ejecutó `madge`). NO VERIFICADO | — |
| Extensibilidad | Buena: el proveedor de IA está detrás de `llm/index.ts` y `coach/providers/index.ts` | `backend/src/services/llm/index.ts` |
| Escalabilidad | Adecuada para la escala actual; un solo proceso Express; rate limiter en memoria (`express-rate-limit`) por defecto. INFERIDO | `backend/src/app.ts:91-107` |
| Complejidad innecesaria | Dependencias sin uso en el `package.json` raíz (AUD-007) | ver §5 |

**Decisiones a conservar:** motores compartidos (workouts, progression, nutrition, gamification), validadores Zod en API, algoritmo JWT fijado, separación `backend/` y frontend, migraciones versionadas.

**Decisiones que requieren revisión:** almacenamiento del refresh token (AUD-001), servicio de nutrición monolítico (AUD-015), componentes de dashboard sobredimensionados (AUD-016).

---

## 3. Calidad y mantenibilidad (4.2)

| Aspecto | Hallazgo | Estado | Evidencia |
|---|---|---|---|
| Tamaño de servicios | `nutrition.service.ts` 1749 líneas; `workouts.service.ts` 614; `coach.service.ts` 606 | CONFIRMADO | `wc -l backend/src/services/**/*.ts` |
| Tamaño de componentes | `dashboard-content.tsx` 875; `progress-tracker.tsx` 666; `workout-generator.tsx` 567 | CONFIRMADO | `wc -l components/*.tsx` |
| Tipado | 34 usos de `any` / `as any` en `backend/src`, `app`, `components`, `lib`. Cero `@ts-ignore`. | CONFIRMADO | `grep` |
| Tipado: errores reales | `tsc --noEmit` backend: **4 errores** en `oauth-handoff.service.ts` (líneas 30, 70, 76, 105): propiedad `oAuthHandoff` no existe en `PrismaClient`. Causa probable: cliente Prisma generado antes de la migración `20261012090000`. INFERIDO | `backend/src/services/oauth-handoff.service.ts` | AUD-005 |
| Tipado frontend | `tsc --noEmit` raíz: sin errores | CONFIRMADO (ejecutado) | — |
| Validación de datos | Buena: Zod en todas las entradas de API revisadas (`validators.ts`, `health-plans.validators.ts`) | CONFIRMADO | — |
| Manejo de errores | `AppError` + `errorHandler` + `notFoundHandler` | CONFIRMADO | `backend/src/middleware/errorHandler.ts`, `app.ts:139-142` |
| Configuración frágil | Valores por defecto de secretos JWT (`default-secret-change-in-production`) | CONFIRMADO | `backend/src/config/env.ts:39,41` (AUD-002) |
| Configuración de build | `next.config.mjs` **no** ignora errores de build/lint. El CLAUDE.md dice lo contrario. | CONFIRMADO | `next.config.mjs` (AUD-010) |
| Dependencias | 14 dependencias con `"latest"` y 68 con rango (`^`/`~`) en `package.json` raíz; 5 dependencias sin uso | CONFIRMADO | `grep` (AUD-007) |
| Nomenclatura | Coexisten `*.service.ts`, `*.routes.ts`, y `services/workouts/` con subcarpetas; nombres de rutas mezclan `/api/v1/*` con `/api/*` | CONFIRMADO | `app.ts:131-132` |
| Documentación | Abundante, pero contradictoria (AUD-008, AUD-009, AUD-010, AUD-020) | CONFIRMADO | ver §8 |
| Deuda técnica declarada | `plan-limits.ts` indica explícitamente "NOT professionally reviewed" | CONFIRMADO | `backend/src/services/workouts/plan-limits.ts:1-15` (AUD-013) |

---

## 4. Seguridad (4.3)

Se revisaron autenticación, autorización, sesiones, secretos, validación, exposición, dependencias y datos personales. Severidad = impacto × probabilidad, ajustada por controles existentes.

### 4.1 Controles existentes (fortalezas, CONFIRMADO)

| Control | Evidencia |
|---|---|
| JWT con algoritmo fijado a HS256 (evita confusión de algoritmo) | `backend/src/utils/jwt.ts` (`algorithms: [ALGORITHM]`) |
| Sesión de servidor revisada en cada petición autenticada | `backend/src/middleware/auth.ts` (`isSessionActive`) |
| Administración por identificador de usuario de lista blanca, con nota explícita de que el email no es prueba de privilegio | `backend/src/middleware/admin.ts:4-6` |
| Rutas de dashboard operativo protegidas con `authenticate` + `requireAdmin` | `backend/src/routes/dashboard.routes.ts:13` |
| Rate limit de autenticación 5 intentos fallidos/15 min | `backend/src/app.ts` (`authLimiter`) |
| Helmet, CORS con lista blanca y sin comodines por defecto | `app.ts:41-61`, `env.ts:66` |
| Idempotencia y cuota de generación con tablas dedicadas | migraciones `20261012030100_add_idempotency_records`, `20261012050000_add_idempotency_quota_reservation` |
| Ownership en sesiones de entrenamiento | tests `review-nf-f2-session-workout-ownership.test.ts` |
| `.env.local` y `.env*` ignorados por git | `.gitignore:37-39, 89`; `git ls-files` no lista ficheros de entorno reales (solo `.env.local.example`, `backend/.env.example`) |
| Guardas de arranque para secretos en producción | `backend/src/config/env.ts:132-143` |

### 4.2 Vulnerabilidades y riesgos

| ID | Título | Severidad | Probabilidad | Impacto | Estado | Evidencia |
|---|---|---|---|---|---|---|
| **AUD-001** | Refresh token en JSON y en `localStorage` | **Alta** | Media (requiere XSS) | Alto: sesión de 30 días robable | CONFIRMADO | `backend/src/controllers/auth.controller.ts:88`; `lib/api/auth.ts:33,81`; `lib/contexts/auth-context.tsx:135,181,191` |
| **AUD-002** | Secretos JWT con valor por defecto; el bloqueo solo aplica con `NODE_ENV=production` | Media | Baja–media (depende de configuración de Render) | Alto: falsificación de tokens | Código CONFIRMADO; configuración de Render **NO VERIFICADO** | `backend/src/config/env.ts:39,41,138-143` |
| **AUD-003** | Sin cláusula de menores ni de datos de salud en textos legales; registro sin edad | **Alta** | Alta (ausencia) | Alto: incumplimiento regulatorio potencial | Ausencia CONFIRMADA; normativa aplicable = HIPÓTESIS | `components/legal-document.tsx` y `app/privacy|terms|legal/page.tsx` (0 coincidencias de "menor", "minor", "edad"); `backend/src/utils/validators.ts:4-8` (registro sin edad) |
| **AUD-010** | Documentación de seguridad desfasada: CLAUDE.md dice dashboard "sin protección" | Baja | — | Medio (confusión) | CONFIRMADO | `backend/src/routes/dashboard.routes.ts:13` vs. CLAUDE.md |
| **AUD-011** | Carpeta estática `/dashboard` pública (solo HTML/JS; datos detrás de admin) | Baja | Baja | Bajo–medio: reconocimiento de superficie | CONFIRMADO | `backend/src/app.ts:77`; `backend/public/dashboard.html` |
| **AUD-007** | Dependencias innecesarias y versiones no fijadas en el `package.json` raíz | Media | Baja | Medio: superficie de cadena de suministro | CONFIRMADO | `package.json`: `@supabase/*`, `openai`, `anthropic` (`^0.0.0`), `psycopg2-binary` (`^0.0.1`) — **sin importaciones** en `app/ components/ lib/ hooks/ backend/src/ middleware.ts` |
| **AUD-014** | Entorno de desarrollo conectado por diseño a la base de datos de producción | **Alta** | Media | Alto: escrituras accidentales en producción | CONFIRMADO (contrato); mitigación de guardas de tests NO VERIFICADO | `.anclora/PRODUCTION_RUNTIME.md` §3, §9; `backend/tests/support/default-integration-guard.ts` |
| **AUD-023** | Base Neon de producción integrada en el proyecto de Vercel del frontend, que no la usa | Media | Media | Medio: credenciales de BD expuestas en un entorno que no las necesita | INFERIDO (código del frontend sin acceso a BD; contenido de variables de Vercel NO VERIFICADO) | `app/api/` (solo `csp-report`, `logs`); integración Neon en Vercel (declarada por el propietario) |

### 4.3 Revisiones específicas

- **Autorización:** el middleware `requireAdmin` se aplica a todas las rutas de `/api/dashboard` mediante `router.use` (CONFIRMADO). No se verificó exhaustivamente cada ruta de propiedad de usuario; se revisaron las de sesiones (CONFIRMADO).
- **Logs:** existe `utils/redact.ts` y pruebas `log-redaction-review-r4` (CONFIRMADO). El contenido real de los logs en producción **NO VERIFICADO**.
- **Protección de datos de salud:** Ruta Vital guarda `limitations`, `knownLimitations` y `safetyReasonCodes` (CONFIRMADO en `schema.prisma`). No existe base legal documentada para tratarlos (AUD-003).
- **Contenido sensible por sexo:** `forty-plus-guidance.ts:21-29` menciona perimenopausia y menopausia sin fuente ni fecha de revisión (AUD-012).
- **Riesgo de LLM:** cuotas por usuario (`CoachUsageWindow`, `B2-F1`), límites de plan y validador (`plan-validator.ts`). Controles presentes (CONFIRMADO); no se evaluó resistencia a inyección de prompts en profundidad (NO VERIFICADO).
- **Almacenamiento de tokens en el frontend:** `accessToken` y `refreshToken` en `localStorage` (CONFIRMADO: `lib/api/client.ts:49`, `lib/contexts/auth-context.tsx:125,135,181`). Protegido parcialmente por CSP en `middleware.ts` y `lib/security/csp.ts` (CONFIRMADO).

### 4.4 Priorización de seguridad

1. **AUD-001** (refresh a cookie httpOnly) — alta, esfuerzo M.
2. **AUD-003** (base legal, menores, salud) — alta, bloqueante para lanzar cohortes por edad; esfuerzo M (técnico) + revisión legal.
3. **AUD-014** (separación de entornos) — alta; decisión operativa de Toni, no técnica.
4. **AUD-002** (secretos sin defecto en cualquier entorno) — media, esfuerzo S.
5. **AUD-007** (retirar dependencias sin uso, fijar versiones) — media, esfuerzo S.
6. **AUD-011** y **AUD-010** — baja.

---

## 5. Dependencias (4.3, supply chain)

| Paquete | Declarado en | Uso real | Acción |
|---|---|---|---|
| `@supabase/ssr`, `@supabase/supabase-js` | `package.json` raíz | Ninguno (sin importaciones). El contrato de runtime declara Express + Neon + JWT, no Supabase | Eliminar (AUD-007) |
| `openai` `^6.29.0` | raíz | Ninguno. La variable `OPENAI_API_KEY` solo figura como legado en `env.ts:129` | Eliminar tras confirmar |
| `anthropic` `^0.0.0` | raíz | Ninguno | Eliminar |
| `psycopg2-binary` `^0.0.1` | raíz | Paquete de **Python** declarado en un proyecto npm; sin uso | Eliminar; revisar el registro antes de cualquier otra referencia (INFERIDO: origen de un copiado accidental) |
| `groq-sdk` | `backend/package.json` | Sí | Conservar |
| 14 paquetes `"latest"` | raíz | Build no reproducible | Fijar versiones exactas |

Ejecución de `pnpm audit`: **no realizada** en esta auditoría (requiere red y no es necesaria para los hallazgos actuales). NO VERIFICADO.

---

## 6. Rendimiento y fiabilidad (4.4)

| Aspecto | Observación | Estado |
|---|---|---|
| Carga de dependencias | Root `package.json` arrastra SDKs sin uso (AUD-007) → instalaciones más pesadas | CONFIRMADO |
| Servicio de nutrición | 1749 líneas → riesgo de consultas N+1 no revisadas | NO VERIFICADO (no se revisó cada consulta) |
| Consultas Prisma | `ensureRutaVitalDefinition` ejecuta `upsert` dentro de bucles sobre pilares y fases (varias idas a BD en la primera llamada). Optimizable en lote; no medido | CONFIRMADO (lectura de código) |
| Caché | React Query con `staleTime` de 5 min (`lib/providers/query-client.tsx`); el backend no tiene caché propia (`runtime cache`) | CONFIRMADO |
| Concurrencia | Idempotencia y reserva de cuota (`idempotency.service.ts`, migración `050000`) | CONFIRMADO |
| Tratamiento de fallos de IA | Proveedor determinista de respaldo (`deterministic-fallback.ts`) | CONFIRMADO |
| Observabilidad | Logs rotados, métricas de request, dashboard admin, `/health`, `/health/ready`, `/health/live` | CONFIRMADO |
| Bajo carga | **No medido.** No se ejecutaron pruebas de carga ni se inventan cifras | — |

---

## 7. Testing y calidad de entrega (4.5)

### 7.1 Ejecuciones realizadas (no destructivas)

| Comando | Resultado | Límite |
|---|---|---|
| `npx tsc --noEmit` (raíz) | Sin errores de tipos | — |
| `npx tsc --noEmit` (`backend/`) | **4 errores** en `oauth-handoff.service.ts` (AUD-005) | Cliente Prisma no regenerado en local; no se ejecutó `prisma generate` (escribe en `node_modules`) |
| `npx jest --ci --coverage=false` (raíz) | **21 suites, 150 tests: PASS** | Sin cobertura (`coverage/` no regenerado) |
| `npx jest --ci --coverage=false tests/unit` (`backend/`) | **14 suites, 114 tests: PASS** | Solo unitarios |

### 7.2 No ejecutados (y por qué)

| Suite | Motivo |
|---|---|
| 31 ficheros en `backend/tests/integration/` | El entorno local apunta a la base de datos de **producción** (`PRODUCTION_RUNTIME.md` §3). No se ejecutaron por riesgo de escritura |
| `pnpm build` | `prisma generate` y `next build` escriben en `node_modules` y `.next` |
| `pnpm lint` | No es parte del conjunto verificado; sin ejecución |
| `playwright test` (6 specs E2E) | Requiere navegador y entorno; no ejecutado |
| Visual QA con `agent-browser` | No ejecutada: fuera del modo de solo análisis |

### 7.3 Análisis de cobertura estructural

| Capa | Evidencia | Valoración |
|---|---|---|
| Autenticación y OAuth | `auth.test.ts`, `oauth-providers.test.ts`, `review-f4-oauth-handoff-and-linking.test.ts`, `e2e/oauth-handoff-*.spec.ts` | Buena |
| Idempotencia y cuota | `inc02`, `inc03`, `inc04`, `review-r1-r2-quota-and-admission.test.ts`, `idempotency.test.ts` | Buena |
| Entrenamiento y validador | `workout-plan-validator.test.ts`, `workouts-service-integrity.test.ts`, `deterministic-fallback.test.ts` | Buena |
| Progresión | `progression-engine.test.ts`, `progression-next-session.test.ts` | Buena |
| Health Plans | `health-plans.domain.test.ts` (dominio) y `health-plans.test.ts` (integración, no ejecutado) | Dominio sí; flujo E2E **no** (AUD-018) |
| Frontend UX de planes | No hay test de la página `app/health-plans` ni de los componentes `health-plan-*` | Ausente (AUD-018) |
| Nutrición | `smart-nutrition.test.ts`, `nutrition-plan-variety.test.ts` | Parcial |

### 7.4 Pipeline y riesgos de despliegue

- `ci.yml` ejecuta backend con Postgres 16 y tests en `impulso_test` (CONFIRMADO). Es el lugar correcto para integración.
- El despliegue de backend es **manual** en Render; el de frontend en Vercel con producción ligada a `main` (CONFIRMADO en `PRODUCTION_RUNTIME.md` §4).
- **Riesgo de orden:** las migraciones deben aplicarse antes que el backend que las necesita (CONFIRMADO en el contrato). Sin embargo, el estado de la migración `20260914130000_add_health_plans` en producción no está documentado en el ledger de 2026-10-12 (**AUD-006**, HIPÓTESIS).
- **Rollback:** no existe un procedimiento de rollback de migraciones; se depende de backup en Neon (`backup-pre-migration-20261012`, CONFIRMADO en contrato).

---

## 8. Deriva documental (AUD-008, 009, 010, 020)

| Afirmación | Dónde | Realidad verificada | Estado |
|---|---|---|---|
| "23+ tests" | CLAUDE.md | 150 frontend + 114 backend unitarios + 31 suites de integración | Desfasada (AUD-008) |
| "78 tests" frontend | Gates P0/P2/P7 | 150 tests ejecutados hoy | Desfasada (AUD-008) |
| GPT-4 como motor | `docs/business/EXECUTIVE-SUMMARY.md` | Groq (`env.ts:94-96`); sin referencias a `gpt-4` en código | Falsa (AUD-009) |
| "ESLint/TS desactivados en build" | CLAUDE.md | `next.config.mjs` sin esas flags | Desfasada (AUD-010) |
| Backend en "Railway/Render" | SPEC §2.2 | Render (`PRODUCTION_RUNTIME.md` §2) | Ambigua (AUD-020) |
| Refresh en cookie httpOnly | CLAUDE.md | Refresh en JSON y `localStorage` (AUD-001) | Falsa para login estándar |

---

## 9. Experiencia de usuario (4.6), evaluación desde el repositorio

Los hallazgos de UX del programa Post-UX (UX-01 a UX-11, `docs/specs/...` §5) se documentan y los gates P2–P7 declaran PASS. **No se ha verificado en navegador en esta auditoría**; por tanto se distinguen:

- **Defectos observables en código:** fricción en la página de salud con elementos de estado sin test (AUD-018); campos de perfil sin etiqueta visible de sexo distinta de "male/female" (AUD-012).
- **Problemas que requieren usuarios reales:** comprensión del concepto "Ruta Vital", carga percibida de planes por edad, sensibilidad a preguntas de sexo y salud. Ver `15_VALIDATION_AND_KPIS.md`.

---

## 10. Recomendaciones técnicas priorizadas (resumen)

| Orden | Acción | ID |
|---|---|---|
| 1 | Verificar, con Toni y sin tocar datos, el estado de la migración de Health Plans en producción | AUD-006 |
| 2 | Mover refresh token a cookie httpOnly con rotación existente | AUD-001 |
| 3 | Exigir `JWT_SECRET` y `JWT_REFRESH_SECRET` en cualquier arranque que no sea `test` | AUD-002 |
| 4 | Revisión legal de menores, salud y sexo antes de lanzar cohortes por edad | AUD-003 |
| 5 | Retirar dependencias sin uso y fijar versiones | AUD-007 |
| 6 | Regenerar cliente Prisma y convertir `tsc` backend en gate de CI | AUD-005 |
| 7 | Partir `nutrition.service.ts` con tests de caracterización | AUD-015 |
| 8 | Corregir documentación de CLAUDE.md y business | AUD-008/009/010 |
