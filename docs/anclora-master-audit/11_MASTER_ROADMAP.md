# 11 — Roadmap maestro por fases

> **Commit:** `0e0b897`. **Fecha:** 2026-11-09.
> Las fases se llaman **Fase 0–7** para distinguirlas del programa Post-UX previo (P0–P7).
> Las fases son una propuesta de orden; se ajustan si cambian las dependencias o la urgencia.
> **No se estiman duraciones en semanas:** el repositorio no tiene datos de velocidad del equipo. Se usa esfuerzo relativo (S/M/L/XL).

---

## 0. Estado de partida

| Programa previo | Estado declarado | Estado verificado hoy |
|---|---|---|
| Post-UX P0 a P7 (`docs/roadmap/impulso-post-ux-health/`) | Gates PASS | Tests frontend y backend unitarios pasan; typecheck backend con 4 errores locales; integración y build no ejecutados; migración `20260914130000_add_health_plans` verificada como aplicada en Neon (`AUD-006` resuelto; pendiente nota documental en gate P1) |
| Ruta Vital 50–60 | Implementada (P1) | Modelo, servicio y 10 tablas `health_plan_*` presentes en Neon (5 inscripciones); contenido de 4 semanas (AUD-021) |

---

## Fase 0 — Riesgos críticos y bloqueantes

| Campo | Contenido |
|---|---|
| **Objetivo** | Eliminar riesgos que impiden desplegar o usar la función de planes con garantías |
| **Justificación** | AUD-006 (cierre documental de migración ya verificada en Neon), AUD-001 (sesión robable), AUD-002 (secretos), AUD-014/AUD-023 (escrituras accidentales y credenciales en Vercel), AUD-003 (legal) |
| **Prioridad** | Bloqueante / crítica |
| **Hallazgos** | AUD-001, AUD-002, AUD-003, AUD-006, AUD-014, AUD-023 |
| **Oportunidades** | OPP-011 (base de gobierno) |
| **Tareas** | TASK-001, TASK-002, TASK-003, TASK-006, TASK-012 |
| **Dependencias** | TASK-003 antes de Fase 3 |
| **Esfuerzo** | 3 S (TASK-001, 006, 012) + 2 M (TASK-002, 003; la parte de TASK-003 que es legal es externa) |
| **Duración orientativa** | No estimada: depende de la revisión legal y de Toni |
| **Riesgos** | Revisión legal lenta; cambio de cookies puede afectar sesiones activas |
| **Entregables** | Cierre documental del gate P1 y contrato; refresh en cookie; secretos obligatorios; guardas de entorno; texto legal aprobado |
| **Criterios de aceptación** | Sesiones válidas tras migrar a cookie; arranque falla sin secretos; ninguna integración escribe en producción desde local |
| **Pruebas** | Integración de login/refresh/logout en CI; unitaria de configuración; comprobación de guardas |
| **KPI** | 0 refresh tokens en `localStorage`; 0 arranques con secretos por defecto; estado de migración documentado sin contradicciones |
| **Condición de salida** | Todas las tareas de la fase con DoD cumplido y verificación de Toni para TASK-003 |
| **Beneficio competitivo** | Confianza de datos de salud, necesaria para diferenciarse en 40+ y 50+ |

---

## Fase 1 — Estabilidad, seguridad y calidad

| Campo | Contenido |
|---|---|
| **Objetivo** | Base técnica fiable y mantenible antes de añadir el catálogo |
| **Justificación** | Typecheck roto en backend, dependencias innecesarias, `/dashboard` público, elegibilidad permisiva, contenido sin proveniencia, E2E ausente |
| **Prioridad** | Alta / media |
| **Hallazgos** | AUD-004, AUD-005, AUD-007, AUD-008, AUD-009, AUD-010, AUD-011, AUD-012, AUD-013, AUD-018, AUD-019, AUD-020 |
| **Oportunidades** | OPP-005 (inicio: proveniencia), OPP-011 |
| **Tareas** | TASK-004, TASK-005, TASK-007, TASK-008, TASK-009, TASK-010, TASK-011, TASK-013 |
| **Dependencias** | TASK-009 necesita TASK-003; TASK-013 necesita TASK-008 |
| **Esfuerzo** | 5 S (TASK-004, 005, 007, 008, 011) + 3 M (TASK-009, 010, 013) |
| **Duración orientativa** | No estimada |
| **Riesgos** | Revisión profesional de límites puede cambiar la generación de planes |
| **Entregables** | Dependencias limpias; tipado en CI; cohorte exige edad; contenido 40+ con fuentes; documentación corregida; E2E de Ruta Vital |
| **Criterios de aceptación** | `tsc` backend sin errores en CI; 0 `latest`; tests de límites de edad pasan; 100 % de textos 40+ con fuente |
| **Pruebas** | Unitarias de elegibilidad; E2E de la ruta; typecheck en CI |
| **KPI** | 0 errores de tipos; 0 dependencias sin uso; 100 % de contenido con fuente |
| **Condición de salida** | Gate de tipos y E2E en verde; documentación revisada por Toni |
| **Beneficio competitivo** | Calidad de entrega y confianza en el contenido |

---

## Fase 2 — Arquitectura modular de planes

| Campo | Contenido |
|---|---|
| **Objetivo** | Modelo de datos y servicios para catálogo de 10 modalidades sin duplicar motores |
| **Justificación** | OPP-006: planes como datos; cambios aditivos |
| **Prioridad** | Alta |
| **Hallazgos** | AUD-004, AUD-006, AUD-012 |
| **Oportunidades** | OPP-006 |
| **Tareas** | TASK-017, TASK-018, TASK-019, TASK-020 |
| **Dependencias** | TASK-001 (estado de migraciones), TASK-003 (para campos sensibles) |
| **Esfuerzo** | 2 M + 2 S |
| **Duración orientativa** | No estimada |
| **Riesgos** | Migración aditiva mal probada puede afectar datos de Ruta Vital; cambios de límites de `maxAge` |
| **Entregables** | Campos de catálogo; atributos separados; 10 definiciones en borrador; servicio de elegibilidad con tests |
| **Criterios de aceptación** | Migración aplicable y reversible en prueba; elegibilidad correcta en todos los límites; ningún solape |
| **Pruebas** | Migraciones en Postgres de test (CI); unitarias de bandas; test de importaciones (sin dependencia circular) |
| **KPI** | 0 solapes; 100 % de límites cubiertos por tests |
| **Condición de salida** | Revisión de migraciones por Toni; catálogo en borrador sin publicar |
| **Beneficio competitivo** | Base para lanzar modalidades rápido |

---

## Fase 3 — Implementación de las diez modalidades

| Campo | Contenido |
|---|---|
| **Objetivo** | Selección, cambio y contenido por modalidad |
| **Justificación** | Encargo del usuario y OPP-004 |
| **Prioridad** | Media-alta; con piloto P07 |
| **Hallazgos** | AUD-021 |
| **Oportunidades** | OPP-004, OPP-005 |
| **Tareas** | TASK-021, TASK-022, TASK-023, TASK-024 |
| **Dependencias** | Fase 2 completa; TASK-009 para contenido; TASK-024 solo tras experimento |
| **Esfuerzo** | 1 L + 2 M + 1 M (experimento) |
| **Duración orientativa** | No estimada |
| **Riesgos** | Contenido incompleto o sin revisión; sobrecarga de la pantalla de selección |
| **Entregables** | Contenido de 24 semanas para P07 y P08; pantalla de selección; cambio con historial; módulos opt-in |
| **Criterios de aceptación** | Un usuario de prueba puede elegir, cambiar y conservar historial en cada modalidad publicada |
| **Pruebas** | E2E de selección y cambio; revisión de contenido; visual QA |
| **KPI** | Tasa de inscripción; abandono en semana 1; cambios de modalidad |
| **Condición de salida** | Piloto P07 validado con usuarios; decisión de Toni sobre el resto |
| **Beneficio competitivo** | Primera oferta con contenido por etapa vital verificable |

---

## Fase 4 — Onboarding y personalización

| Campo | Contenido |
|---|---|
| **Objetivo** | Onboarding no clínico y recomendaciones explicables |
| **Justificación** | OPP-002, OPP-003, OPP-007 |
| **Prioridad** | Media |
| **Hallazgos** | AUD-004, AUD-012 |
| **Oportunidades** | OPP-003, OPP-007 |
| **Tareas** | TASK-025, TASK-026 |
| **Dependencias** | TASK-003 y TASK-018 para el onboarding; TASK-020 para las reglas |
| **Esfuerzo** | 2 M |
| **Duración orientativa** | No estimada |
| **Riesgos** | Preguntas sensibles mal recibidas; reglas simples que no capturan matices |
| **Entregables** | Onboarding de 3 pasos + consentimiento; motor de reglas con explicación y control |
| **Criterios de aceptación** | Cada recomendación muestra motivo y permite cambio; sin edad no hay sugerencia |
| **Pruebas** | Unitarias de reglas; E2E de onboarding; pruebas con usuarios |
| **KPI** | Onboarding completado; % de sugerencias aceptadas o cambiadas; quejas |
| **Condición de salida** | Pruebas con usuarios sin hallazgos de malestar grave |
| **Beneficio competitivo** | Recomendación transparente frente a cajas negras |

---

## Fase 5 — Experiencia y diferenciación competitiva

| Campo | Contenido |
|---|---|
| **Objetivo** | Mostrar progreso con contexto y medir el embudo de planes |
| **Justificación** | UX-06 (documentado), AUD-019, medición de la hipótesis |
| **Prioridad** | Media |
| **Hallazgos** | AUD-019 |
| **Oportunidades** | OPP-001, OPP-013 |
| **Tareas** | TASK-027, TASK-028, TASK-030 |
| **Dependencias** | TASK-027 es investigación independiente; TASK-030 necesita Fase 3 |
| **Esfuerzo** | 1 S + 1 S + 1 M |
| **Duración orientativa** | No estimada |
| **Riesgos** | Investigación de mercado con fuentes débiles |
| **Entregables** | Informe de competidores 40+/50+; indicadores de confianza en progreso; panel de embudo |
| **Criterios de aceptación** | Informe con fuentes y fechas; indicador visible cuando hay pocos datos |
| **Pruebas** | Revisión de informe; visual QA |
| **KPI** | Tiempo hasta primera acción; comprensión del progreso en prueba de usabilidad |
| **Condición de salida** | Informe revisado por Toni |
| **Beneficio competitivo** | Decisiones de diferenciación con evidencia |

---

## Fase 6 — Automatización y evolución inteligente

| Campo | Contenido |
|---|---|
| **Objetivo** | Explicación en lenguaje natural opcional |
| **Justificación** | OPP-008 (HIPÓTESIS); solo con reglas probadas |
| **Prioridad** | Baja; experimento |
| **Hallazgos** | AUD-013, AUD-022 |
| **Oportunidades** | OPP-008 |
| **Tareas** | TASK-029 |
| **Dependencias** | TASK-010, TASK-026 |
| **Esfuerzo** | 1 M |
| **Duración orientativa** | No estimada |
| **Riesgos** | Coste por petición; recomendaciones no reproducibles; lenguaje clínico |
| **Entregables** | Explicación detrás de flag, con límites de uso y registro |
| **Criterios de aceptación** | Sin flag activo no cambia nada; con flag, la explicación no altera la decisión |
| **Pruebas** | Tests de guardrails; prueba de coste |
| **KPI** | Coste por usuario; comprensión declarada |
| **Condición de salida** | Experimento con resultados que justifiquen mantenerlo |
| **Beneficio competitivo** | Explicación cercana, sin ventaja asegurada |

---

## Fase 7 — Escalabilidad y optimización continua

| Campo | Contenido |
|---|---|
| **Objetivo** | Mantenibilidad a largo plazo |
| **Justificación** | AUD-015, AUD-016, AUD-017 |
| **Prioridad** | Baja |
| **Hallazgos** | AUD-015, AUD-016, AUD-017 |
| **Oportunidades** | — |
| **Tareas** | TASK-014, TASK-015, TASK-016 |
| **Dependencias** | Tests de caracterización antes de cada partición |
| **Esfuerzo** | 1 L + 2 M |
| **Duración orientativa** | No estimada |
| **Riesgos** | Regresiones en nutrición |
| **Entregables** | Servicios y componentes partidos; menos `any` |
| **Criterios de aceptación** | Comportamiento idéntico verificado por tests de caracterización |
| **Pruebas** | Caracterización antes y después; suites existentes |
| **KPI** | Líneas por fichero; número de `any` |
| **Condición de salida** | Suites en verde y sin cambios funcionales |
| **Beneficio competitivo** | Velocidad de entrega |

---

## Resumen de fases

| Fase | Prioridad | Tareas | Esfuerzo relativo | Bloquea a |
|---|---|---|---|---|
| 0 | Bloqueante / crítica | 5 | S·M | 2, 3 |
| 1 | Alta / media | 8 | S·M | 3 (contenido) |
| 2 | Alta | 4 | S·M | 3 |
| 3 | Media-alta | 4 | L·M | 4 |
| 4 | Media | 2 | M | — |
| 5 | Media | 3 | S·M | — |
| 6 | Baja (experimento) | 1 | M | — |
| 7 | Baja | 3 | L·M | — |
| N (transversal) | P0 (N0–N1) → P3 (N3) | 8 (`TASK-032`–`039`) | S·M | Subordinada a Fase 3 (`TASK-021`–`024`); `TASK-031` reservada |

---

## Pista transversal N — Planificación nutricional interoperable (Spec v2.0)

Incorporada como **capacidad transversal del roadmap** (no como producto independiente), reutilizable por las modalidades `P01`–`P10` sin duplicar motores ni alterar `MealPlan` / `HealthPlanDefinition`. Mantiene `TASK-001`–`TASK-030` sin renumeración y conserva `TASK-031` reservada para la retirada del `refreshToken` en JSON.

| Entrega | Alcance | Tareas | Estado |
|---|---|---|---|
| **N0 — Contrato y skill** | Contrato `meal-plan-import-v1`, catálogo único de protocolos (sin activar dietas sin soporte), adaptación de skill v2 (`planificador-nutricion-mealprep-50`), fixtures (completas, incompletas ODT y negativas) y evaluación M28 | `TASK-032`, `TASK-037` | En implementación N0 |
| **N1 — Importación** | Spike de persistencia (M28 solo si se justifica y aprueba aparte), importación JSON `preview`/`commit` transaccional e idempotente, conversión estricta de unidades y UI mínima «Nuevo plan» | `TASK-033`, `TASK-034`, `TASK-036` (MVP) | Pendiente |
| **N2 — Experiencia y generación** | Tabs Menú/Preparación/Compra, batch cooking, lista de la compra cuantificada, asistente 5 pasos e IA opcional tras flag | `TASK-036` (UX), `TASK-038` | Pendiente |
| **N3 — Integraciones avanzadas** | Extracción opcional de ODT/DOCX/texto libre y conector seguro desde Claude condicionado a demanda y revisión de seguridad | `TASK-035`, `TASK-039` | Pendiente |

- **Relación con Fase 3–7:** N0 y N1 reducido avanzan en paralelo sin bloquear `TASK-021`–`TASK-024` (P07/P08); `TASK-025`–`TASK-026` (Fase 4) añaden preferencias alimentarias opt-in sin inferir por sexo/edad; `TASK-030` (Fase 5) instrumenta eventos nutricionales sin payload sensible; `TASK-029` (Fase 6) comparte guardrails LLM en N2; `TASK-014` (Fase 7) aporta tests de caracterización previos a N1.
- **Decisiones `D-N1` a `D-N9` y contrato N0:** ver [`NUTRITION_SPEC_V2_N0.md`](../sdd/NUTRITION_SPEC_V2_N0.md).
