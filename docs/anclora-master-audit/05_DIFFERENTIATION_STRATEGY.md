# 05 — Estrategia de diferenciación y oportunidades

> **Commit:** `0e0b897`. **Fecha:** 2026-11-09. Las oportunidades se identifican como `OPP-xxx` en `09_FINDINGS_AND_OPPORTUNITIES.md`.
> Regla: no se recomienda ninguna funcionalidad solo porque la competencia la tenga.

---

## 1. Criterios

| Criterio | Peso | Qué se mide |
|---|---|---|
| Valor para el usuario | 30 % | Problema real con evidencia (repositorio o fuente) |
| Impacto de negocio | 20 % | Retención, conversión o reducción de riesgo |
| Confianza en la evidencia | 20 % | CONFIRMADO > INFERIDO > HIPÓTESIS |
| Dificultad | 15 % | Esfuerzo y dependencias |
| Defensabilidad | 15 % | Dificultad de replicar |

---

## 2. Oportunidades por categoría

### A. Paridad competitiva (necesario para no quedar atrás)

| ID | Oportunidad | Problema | Evidencia | Alternativas | Dificultad | Riesgo | KPI |
|---|---|---|---|---|---|---|---|
| OPP-001 | Mostrar la siguiente acción en un solo lugar | Cada módulo muestra su estado por separado | SPEC UX-07; P5 gate PASS | Dashboard con tarjetas (ya existe) | S–M | Duplicar motores | % de sesiones con una acción completada desde la pantalla de inicio |
| OPP-002 | Ajustar el entrenamiento a recuperación y a días perdidos | Fitbod y Freeletics ajustan por recuperación o feedback | Fitbod (fuente oficial); Anclora tiene `RecoverySample`, `REDUCE/MAINTAIN/PROGRESS` (`health-plans.domain.ts:59`) | Reglas simples (ya en dominio) | M | Sobreajuste sin datos | % de semanas con adaptación aplicada y aceptada |

### B. Mejoras de producto

| ID | Oportunidad | Problema | Evidencia | Dificultad | KPI |
|---|---|---|---|---|---|
| OPP-003 | Ruta de inicio para quien no tiene edad ni objetivo | El registro no recoge nada más que email y nombre (`validators.ts:4-8`) | CONFIRMADO | S | Tasa de onboarding completado |
| OPP-004 | Cambio de modalidad sin perder historial | No existe flujo de cambio | Ausencia en código | M | Cambios de modalidad sin abandono |

### C. Diferenciadores (ventaja reconocible)

#### OPP-005 · Contenido 40+ y 50+ con proveniencia visible
- **Problema:** las personas de 40–60 reciben consejos genéricos o demasiado orientados a jóvenes.
- **Qué la hace diferente:** cada recomendación lleva fuente, nivel de evidencia y fecha de revisión (modelo `HealthPlanContentReference`, CONFIRMADO en `schema.prisma:1027-1045`).
- **Evidencia:** la SPEC exige proveniencia y safety fail-closed; los competidores verificados no anuncian contenido por edad (`04_COMPETITIVE_BENCHMARK.md` §3).
- **Alternativas existentes:** ninguna verificada.
- **Valor:** confianza en el contenido para personas que temen lesionarse o tienen medicación.
- **Impacto:** diferenciación y reducción de riesgo legal.
- **Dificultad:** M–L (contenido + revisión humana).
- **Riesgos:** falsa sensación de autoridad clínica; requiere revisión profesional.
- **KPI:** % de piezas de contenido con fuente y fecha; tasa de inscripción en Ruta Vital; abandono en la semana 1.

#### OPP-006 · Planes por etapa vital como datos, no como ramas de código
- **Problema:** las apps segmentan poco o lo hacen mediante copias de código.
- **Qué la hace diferente:** el catálogo de 10 modalidades se gestiona como filas de `HealthPlanDefinition` con versión e inmutabilidad ([06](06_AGE_GENDER_PLANS.md), [08](08_TARGET_ARCHITECTURE.md)).
- **Evidencia:** el modelo ya existe (`minAge`, `maxAge`, `status`, `version`, CONFIRMADO).
- **Defensabilidad:** media: es un patrón de arquitectura, no un activo.
- **Dificultad:** M.
- **KPI:** tiempo para publicar una nueva modalidad sin cambio de código.

#### OPP-007 · Recomendación explicable y reversible
- **Problema:** las recomendaciones de IA parecen cajas negras.
- **Qué la hace diferente:** cada sugerencia muestra entradas, motivo y botón de cambio. P4 ya lo declara PASS (`P4-FINAL-GATE-REPORT.md`).
- **Evidencia:** UX-05 (SPEC §5).
- **KPI:** % de sugerencias descartadas o editadas; confianza declarada en encuesta.

### D. Innovación (con cautela)

| ID | Oportunidad | Hipótesis | Evidencia | Estado |
|---|---|---|---|---|
| OPP-008 | Explicación en lenguaje natural de la recomendación (IA opcional) | Mejora la comprensión sin cambiar la decisión | Coach ya existe (`services/coach/`) | **HIPÓTESIS**: solo tras reglas probadas |
| OPP-009 | Readiness desde wearables | Ajustar carga a la recuperación real | Modelos `WearableConnection`, `RecoverySample` (CONFIRMADO en esquema) | **NO VERIFICADO**: proveedores reales |
| OPP-010 | Vista de familia o pareja | Fitbod lo ofrece | Fuente oficial Fitbod | **HIPÓTESIS**: sin demanda verificada en Anclora |

### E. Ventajas sostenibles

| ID | Ventaja | Por qué es difícil de copiar | Estado |
|---|---|---|---|
| OPP-011 | Gobierno de contenido y de salud (safety, proveniencia, revisión) | Requiere procesos, no solo código | Parcialmente implementado (P1) |
| OPP-012 | Ecosistema Anclora (marca, otros productos) | Depende de la estrategia del grupo | NO VERIFICADO |
| OPP-013 | Mercado hispanohablante con contenido en español nativo | Competidores grandes son anglo-céntricos (afirmación de la documentación de negocio, **NO VERIFICADO**) | HIPÓTESIS |

---

## 3. Los cinco diferenciadores con más potencial

| # | Diferenciador | Problema que resuelve | Qué lo hace diferente | Evidencia | Qué necesita Anclora | Dificultad | Cómo comprobarlo | Riesgo de copia |
|---|---|---|---|---|---|---|---|---|
| 1 | OPP-005 Contenido 40+/50+ con proveniencia | Consejo genérico para cuerpos de 40–60 | Fuente y fecha visibles | SPEC; esquema | Revisor profesional y proceso | M–L | Medir entendimiento y confianza en pruebas con 10–15 usuarios | Media (requiere proceso) |
| 2 | OPP-006 Planes como datos | Escalar modalidades sin fork | Versionado e inmutabilidad | Esquema | Migraciones aditivas | M | Publicar una modalidad nueva sin deploy de código | Baja |
| 3 | OPP-007 Recomendación explicable y reversible | Desconfianza en IA | Motivo, entradas, cambio | P4 PASS | Mantener el contrato de UI | S | % de cambios y descartes; encuesta | Media |
| 4 | OPP-011 Gobierno de salud (safety fail-closed) | Miedo a lesiones y a consejos clínicos | Derivación a profesional por señales | `classifySafety` (CONFIRMADO) | Lista de señales revisada | M | Auditoría de casos de prueba | Alta |
| 5 | OPP-013 Español nativo y 50+ | Mercado desatendido (HIPÓTESIS) | Idioma y tono | `es.json` | Validación de mercado | M | Test de preferencia con hablantes nativos | Media |

---

## 4. Lo que no se recomienda

- Copiar la comunidad social de Hevy como prioridad: el repositorio ya tiene API social; su uso real no está verificado.
- Ampliar el catálogo de ejercicios para igualar a Freeletics antes de validar contenido.
- Lanzar "IA clínica": contradice el principio de no diagnóstico de la SPEC.

---

## 5. Relación con los hallazgos

- OPP-005 depende de **AUD-012** (sexo y contenido sin proveniencia) y **AUD-021** (contenido incompleto).
- OPP-006 depende de **AUD-006** (estado de migraciones) y **AUD-004** (elegibilidad).
- OPP-011 depende de **AUD-003** (base legal).

---

## 6. Modelo comercial (solo lo verificable)

- Fitbod y Freeletics cobran por suscripción (CONFIRMADO, fuentes públicas).
- Anclora tiene `subscriptionTier` y rutas `premium`, pero **no hay evidencia de cobro** (NO VERIFICADO).
- Los importes de la documentación de negocio (plan a 9,99 y 19,99 €) **no** se incorporan a esta estrategia hasta verificarlos.
