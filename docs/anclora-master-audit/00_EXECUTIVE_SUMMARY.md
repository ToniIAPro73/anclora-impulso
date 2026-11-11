# 00 — Resumen ejecutivo

> **Anclora Impulso · Auditoría integral y hoja de ruta**
> **Commit auditado:** `0e0b897dfca6397f9ca5a5d1e5d30382794f8428` · rama `development` · **Fecha:** 2026-11-09
> **Modo:** solo análisis y documentación. Sin cambios de código, sin dependencias nuevas, sin migraciones, sin tests de integración, sin commits.

---

## 1. Diagnóstico

Anclora Impulso es un SaaS fitness con IA para generar entrenamientos personalizados, con seguimiento de progreso, nutrición, gamificación, coach y una capa reciente para adultos de 50 a 60 años (Ruta Vital). La base técnica es **sólida**: separación clara entre frontend y API, validación Zod, sesiones de servidor, cuotas e idempotencia en IA y una disciplina de migraciones y de gobierno poco común en proyectos de este tamaño.

Los problemas que importan no son de funcionalidad básica, sino de **seguridad de sesión**, **base legal para datos de salud y menores**, **estado real de producción** y **documentación que ya no describe el sistema**.

| Dimensión | Valoración |
|---|---|
| Madurez general | **3 / 5** (funcional con huecos) |
| Arquitectura backend | 4 / 5 |
| Seguridad | 3 / 5 (diseño sólido; refresh en `localStorage`; base legal ausente) |
| Testing | 3 / 5 (unitarios y de integración amplios; sin E2E de planes) |
| Producto 50+ | 2 / 5 (base construida; contenido incompleto) |

Tests **ejecutados hoy**: frontend **150/150**, backend unitario **114/114**. Typecheck frontend limpio; backend con **4 errores** de tipos locales. Integración (31 suites) y build no ejecutados por riesgo de escribir en producción.

---

## 2. Decisiones principales de esta auditoría

1. **Los diez planes por edad y sexo se diseñan sobre el catálogo existente**, no como diez implementaciones (`06`, `08`).
2. **La edad nunca inscribe ni limita.** Solo sugiere. El sexo sirve para variantes de contenido justificadas y configurables; se propone separar `sexAtBirth` de `genderIdentity`.
3. **Recomendación por reglas explicables (Alternativa A).** La IA queda como explicación opcional tras probar las reglas (`07 §4`).
4. **Ruta Vital se mantiene como programa, con decisión pendiente sobre el límite de 60 años.**
5. **Bloqueante antes de lanzar cohortes por edad:** el marco legal de menores y salud (AUD-003). La base contiene datos de salud de prueba (declaración del propietario, 2026-11-10); el requisito legal sigue vigente antes de cualquier cliente. La migración de Health Plans (AUD-006) queda resuelta con evidencia del ledger.
6. **Ningún dato del repositorio ni de usuarios se envió a servicios externos.** Las búsquedas de competidores fueron genéricas.

---

## 3. Cinco fortalezas que conviene conservar

| # | Fortaleza | Evidencia |
|---|---|---|
| S-1 | Backend con capas claras y validación en todas las entradas | `backend/src/routes`, `controllers`, `services`, `utils/validators.ts` |
| S-2 | Autenticación con algoritmo fijado, sesión de servidor y admin por identificador, no por email | `utils/jwt.ts:48-`, `middleware/auth.ts`, `middleware/admin.ts:4-6` |
| S-3 | Idempotencia y cuota de IA con tablas dedicadas | migraciones `20261012030100`, `20261012050000`; `CoachUsageWindow` |
| S-4 | Motores reutilizables (entrenamiento, progresión, nutrición, gamificación) | `services/workouts`, `progression`, `nutrition` |
| S-5 | Health Plans con diseño seguro: clasificación de riesgo fail-closed, opt-in, migraciones aditivas | `health-plans.domain.ts`, `schema.prisma:939-1120` |
| S-6 | Gobierno de cambios y de promoción explícito (SDD, workflow manual de migraciones, token de promoción) | `AGENTS.md`, `.github/workflows/promote.yml`, `production-migrations.yml` |

---

## 4. Cinco debilidades o riesgos principales

| # | Riesgo | ID | Severidad |
|---|---|---|---|
| 1 | Refresh token de 30 días en `localStorage`; el CLAUDE.md dice lo contrario | AUD-001 | Alta |
| 2 | Sin cláusula de menores ni de datos de salud; registro sin edad; perfil acepta 14 años | AUD-003 | Alta |
| 3 | ~~Estado de la migración de Health Plans en producción no demostrado~~ **Resuelto:** las 10 tablas `health_plan_*` existen en producción y la migración figura terminada en el ledger. Queda corregir la descripción del gate P1 | AUD-006 | Baja (cerrado) |
| 4 | Desarrollo local conectado a producción por diseño | AUD-014 | Alta |
| 5 | Contenido 40+ y por sexo sin fuentes, y contenido de Ruta Vital de 4 semanas en lugar de 24 | AUD-012, AUD-021 | Alta / Media |

Riesgos adicionales: secretos JWT por defecto condicionados a `NODE_ENV` (AUD-002); límites de IA sin revisión profesional (AUD-013); dependencias sin uso (AUD-007); errores de tipos locales (AUD-005); documentación desfasada (AUD-008/009/010/020); base Neon de producción integrada en el proyecto de Vercel del frontend, que no la usa (AUD-023).

**Topología confirmada por el propietario:** Neon (PostgreSQL) asociada al proyecto `anclora-impulso` de Vercel; servicio Render `Anclora-Impulso` en My Workspace como backend. Esto encaja con `PRODUCTION_RUNTIME.md`.

---

## 5. Cinco oportunidades competitivas

| # | Oportunidad | Estado | Referencia |
|---|---|---|---|
| 1 | Contenido 40+ y 50+ con **proveniencia visible** (fuente, nivel de evidencia y fecha) | Hueco en los competidores verificados; hipótesis de posicionamiento | OPP-005 |
| 2 | Planes **como datos versionados**: diez modalidades sin fork de código | Modelo existente | OPP-006 |
| 3 | Recomendación **explicable y reversible** con control del usuario | Parcialmente implementada (P4) | OPP-007 |
| 4 | **Gobierno de salud** (safety, consentimiento, revisión) como ventaja difícil de copiar | Parcial | OPP-011 |
| 5 | Ajuste del entrenamiento a **recuperación y días perdidos** (paridad con Fitbod y Freeletics) | Dominio existente; falta integración | OPP-002 |

Competidores verificados: **Fitbod** (directo), **Freeletics** (directo), **Hevy** (indirecto). Fuentes y niveles de confianza en `04`.

---

## 6. Sistema de diez planes

| Código | Segmento | Variante | Nombre propuesto |
|---|---|---|---|
| P01 · P02 | 18–29 | Hombres · Mujeres | Arranque Fuerza |
| P03 · P04 | 30–39 | Hombres · Mujeres | Motor 30 |
| P05 · P06 | 40–49 | Hombres · Mujeres | Equilibrio 40 |
| P07 · P08 | 50–59 | Hombres · Mujeres | Ruta Vital 50–59 |
| P09 · P10 | 60 o más | Hombres · Mujeres | Longevidad 60+ |

- Límites enteros, sin solape. Menores de 18: bloqueados hasta resolver `TASK-003` (`06 §4`).
- Las variantes **solo** cambian énfasis de contenido, nunca carga ni limitaciones. Cada diferencia tiene evidencia y se marca como HIPÓTESIS hasta revisarla.
- Una arquitectura, diez filas de configuración: `08`.

---

## 7. Arquitectura recomendada

1. **Reutilizar** los motores existentes; Health Plans orquesta sin duplicar.
2. **Catálogo versionado** (`HealthPlanDefinition`) con campos aditivos: `cohortKey`, `variantKey`, `ageMin`, `ageMax`.
3. **Elegibilidad pura** por bandas, con tests de límites y de no solape (`TASK-020`).
4. **Motor de reglas** explicable (Alternativa A). IA opcional solo para explicación (`TASK-029`).
5. **Refresh token a cookie httpOnly** (`TASK-002`).
6. **Migraciones aditivas**, aplicadas por el runner protegido tras verificación (`TASK-001`).

---

## 8. Roadmap prioritario

| Fase | Objetivo | Prioridad | Tareas | Dependencias |
|---|---|---|---|---|
| 0 · Riesgos bloqueantes | Sesión, secretos, migraciones, entorno, legal | Bloqueante / crítica | 001, 002, 003, 006, 012 | — |
| 1 · Estabilidad y calidad | Tipos, dependencias, elegibilidad, proveniencia, E2E | Alta / media | 004, 005, 007, 008, 009, 010, 011, 013 | Fase 0 |
| 2 · Arquitectura de planes | Catálogo y elegibilidad | Alta | 017, 018, 019, 020 | 001, 003 |
| 3 · Diez modalidades | Selección, cambio, contenido P07/P08 | Media-alta | 021, 022, 023, 024 | Fases 1–2 |
| 4 · Onboarding y personalización | Onboarding no clínico y reglas | Media | 025, 026 | 003, 018, 020 |
| 5 · Experiencia y diferenciación | Progreso con contexto, investigación, embudo | Media | 027, 028, 030 | — |
| 6 · IA evolutiva | Explicación opcional | Baja (experimento) | 029 | 010, 026 |
| 7 · Escalabilidad | Partir servicios y componentes | Baja | 014, 015, 016 | Tests de caracterización |

Detalle: `11`. Priorización: `10`. Duraciones: no estimadas, porque el repositorio no tiene datos de velocidad.

---

## 9. Primeras diez tareas recomendadas

| # | Tarea | Por qué primero |
|---|---|---|
| 1 | TASK-001 · Cerrar nota documental del gate P1 sobre migración en Neon | Evidencia de ledger ya verificada; alinea la documentación |
| 2 | TASK-006 · Secretos JWT obligatorios | Seguridad, esfuerzo S |
| 3 | TASK-012 · Guardas de entorno para integración | Evita escrituras en producción |
| 4 | TASK-008 · Cohorte exige edad | Corrección de una línea con tests |
| 5 | TASK-020 · Bandas no solapadas y tests | Base del catálogo |
| 6 | TASK-004 · Retirar dependencias sin uso | Superficie y tamaño |
| 7 | TASK-005 · Gate de tipos backend | Calidad |
| 8 | TASK-011 · Documentación corregida | Evita decisiones falsas |
| 9 | TASK-002 · Refresh token en cookie | Riesgo alto de sesión |
| 10 | TASK-003 · Marco legal (decisión de Toni y asesoría) | Bloqueante para cohortes por edad |

Backlog completo: `12`. Plantilla para agentes: `13`.

---

## 10. Decisiones pendientes de Toni

| # | Decisión | Por qué importa |
|---|---|---|
| D1 | ~~Estado de la migración `add_health_plans`~~ **Cerrado con evidencia:** aplicada en producción y nota documental corregida en gate P1 y contrato | AUD-006 |
| D2 | Edad mínima de la plataforma y tratamiento de 14–17 años (TASK-003) | Requisito legal y de producto |
| D3 | Límite superior de Ruta Vital: ¿59 o 60 compatible? (`06 §3`) | Solape con el grupo 60+ |
| D4 | ¿Se mantiene la escritura local contra producción? (AUD-014) | Riesgo operativo alto |
| D5 | Revisor profesional para límites IA y textos 40+ (TASK-009, TASK-010) | Calidad clínica |
| D6 | Retirada o protección de `/dashboard` (TASK-007) | Superficie pública |
| D7 | Ventana de transición de la cookie de refresh (TASK-002) | Sesiones abiertas |
| D8 | Aprobación de las diferencias por variante (`06 §5`) | Justificación de diferencias |
| D9 | Validar las cifras de negocio antes de usarlas (AUD-009) | Credibilidad externa |
| D10 | Estado de Render: `NODE_ENV` y secretos (sin ver valores) (AUD-002) | Verifica la mitigación de secretos |

---

## 11. Limitaciones de esta auditoría

- No se ejecutaron tests de integración contra la base de producción, ni build completo, ni visual QA en navegador. Motivo: riesgo de escritura en producción y modo de solo análisis.
- No se midió rendimiento en carga ni cobertura global.
- Se verificó en modo solo lectura el esquema y el ledger `_prisma_migrations` de Neon (vía Vercel CLI, sin exponer secretos) y los nombres de variables en Vercel; no se consultó la configuración del servicio en Render.
- Las cifras de precios de competidores proceden de tiendas y de un agregador; ver niveles de confianza en `04`.
- La legislación aplicable se cita como **hipótesis** y debe verificarse con texto oficial.

---

## 12. Documentos generados

Ruta base: `docs/anclora-master-audit/`

| Archivo | Contenido |
|---|---|
| `README.md` | Índice y orden de lectura |
| `00_EXECUTIVE_SUMMARY.md` | Este documento |
| `01_REPOSITORY_INVENTORY.md` | Inventario técnico y funcional |
| `02_TECHNICAL_AUDIT.md` | Arquitectura, calidad, seguridad, rendimiento y testing |
| `03_PRODUCT_AUDIT.md` | Funcional y UX |
| `04_COMPETITIVE_BENCHMARK.md` | Competidores y matriz |
| `05_DIFFERENTIATION_STRATEGY.md` | Oportunidades y diferenciadores |
| `06_AGE_GENDER_PLANS.md` | Diez modalidades |
| `07_PERSONALIZATION_SYSTEM.md` | Onboarding y recomendación |
| `08_TARGET_ARCHITECTURE.md` | Arquitectura objetivo y diagramas |
| `09_FINDINGS_AND_OPPORTUNITIES.md` | Registro `AUD-` y `OPP-` |
| `10_PRIORITIZATION_MATRIX.md` | Método y puntuación |
| `11_MASTER_ROADMAP.md` | Roadmap por fases |
| `12_AGENT_READY_BACKLOG.md` | Backlog `TASK-` |
| `13_AGENT_IMPLEMENTATION_GUIDE.md` | Reglas y plantilla para agentes |
| `14_QUICK_WINS.md` | Diez quick wins |
| `15_VALIDATION_AND_KPIS.md` | Validación y KPIs |
