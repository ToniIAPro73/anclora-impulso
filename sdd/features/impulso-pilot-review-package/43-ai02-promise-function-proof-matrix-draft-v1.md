# 43 — BORRADOR de la matriz promesa → función → prueba de AI-02 (H4) (v1, 2026-10-13)

> **Borrador del agente, no matriz aprobada.** El criterio del plan para AI-02 es «todas las promesas de pago trazan a capacidad
> probada» con «matriz aprobada» como evidencia (`34-…` §«Original acceptance»). Este documento prepara la matriz; **no** la aprueba
> ni acepta AI-02. Hoy **no existe paywall** (`01-…`, AI-15 a AI-17), por lo que las «promesas» son las de la copy pública y del
> producto, no ofertas de pago. Versión de código: `c0333f3` (producción) y `f8e9224` (`development`).

## 1. Método y límites

| Aspecto | Valor |
|---|---|
| Alcance | Afirmaciones sobre capacidades con **IA, personalización, seguimiento y recordatorios** en `lib/translations/es.json`, `components/` y avisos de seguridad. No incluye textos legales ni precios (no existen) |
| Fuente de «función» | Lectura del código (`backend/src/services/*`) |
| Fuente de «prueba» | Tests existentes (`backend/tests/**`, `e2e/`), resultados de Stage D (`32-…`) y revisiones (`36-…`, `42-…`) |
| Veredictos | **Cubierta** (función y prueba directas) · **Parcial** (función sí, prueba o alcance insuficientes) · **Sin evidencia** · **Excede** (la promesa dice más que la función) |
| Límite | No exhaustiva: es una muestra de las promesas más fuertes. Los veredictos son del redactor y no sustituyen la decisión de Toni ni la revisión profesional (AI-03, pendiente) |

## 2. Matriz

| # | Promesa (dónde) | Función | Prueba | Veredicto | Acción sugerida |
|---|---|---|---|---|---|
| M1 | «Entrenamientos personalizados, seguimiento inteligente de progreso y análisis completo de fitness» (`home.subtitle`) | `workouts.service` (perfil, entorno, equipo), `progress.service` (indicadores) | Tests de generación y de progreso (ver M2, M3) | **Parcial / Excede** | «Inteligente» y «completo» no son verificables; matizar o retirar |
| M2 | «Planes adaptados a tu nivel, objetivos y equipo, con apoyo de IA cuando está disponible» (`home.smartWorkoutsDesc`) | `generateWorkout`: filtra por entorno/dificultad/equipo; IA solo con `GROQ_API_KEY`; si no, plantilla determinista | `deterministic-fallback` (6 casos: determinismo, cobertura de grupos musculares, tope 5 ejercicios en 40+, valida en cada dificultad), `workout-plan-validator`, E2E de *fallback*; modo `ai` con proveedor simulado en integración | **Cubierta** | Mantener. Límite: el proveedor real (Groq) no se prueba en CI |
| M3 | «Análisis completo que rastrea tus ganancias de fuerza, medidas corporales y récords personales» (`home.progressTrackingDesc`) | `strength-progress.service`, `progress.service` | `strength-progress` (volumen, PR, 1RM estimado), `review-nf-f3` (campos de medidas) | **Parcial** | «Análisis completo» excede; el seguimiento de fuerza, medidas y PR sí está probado |
| M4 | «Progresión inteligente que se adapta a tu rendimiento y ajusta automáticamente la dificultad» (`home.adaptiveProgrammingDesc`) | `services/progression/*` (sube carga, mantiene, *deload* tras 3 estancamientos, esquemas DUP) | `progression-engine` (6 casos), `progression-next-session` | **Parcial** | La carga y las repeticiones se ajustan; no se ajusta «la dificultad» de la rutina generada. **Las reglas no están revisadas por un profesional (AI-03, bloqueada)**: no afirmar seguridad |
| M5 | «La rutina no sale de un generador ciego: usa tu objetivo, adherencia y señales recientes» (`workouts.recommendationSummary`) | `personalization.service` (adherencia 4 semanas, `workoutAdjustment`) → prompt de IA y `reduceLoad` en plantilla | Sin prueba directa de que la adherencia **cambie** la rutina; los tests fijan `reduceLoad: false`. En plantilla solo afecta al descanso (75 s frente a 60 s) | **Parcial** | Añadir una prueba que fije el efecto, o matizar el texto para el modo plantilla |
| M6 | «La pauta nutricional usa tu objetivo, tu constancia reciente y el nivel de ajuste que mejor protege adherencia» (`nutrition.recommendationSummary`) | `nutrition.service`, plan «target-aware» | `smart-nutrition` («creates a target-aware smart meal plan»), `nutrition-plan-variety` | **Parcial** | La prueba cubre objetivo; «constancia reciente» no tiene prueba localizada |
| M7 | «Recordatorios inteligentes» (`dashboard.remindersTitle`) | `notification.service.dispatchDueNotifications` (temporizador en `server.ts`) | **Ninguna.** No hay tests del envío; depende de SMTP, **cuya configuración en producción se desconoce** | **Sin evidencia** | No prometer hasta tener prueba y SMTP verificado, o retirar «inteligentes» |
| M8 | «Orientación educativa y de hábitos; no sustituye una valoración profesional» (`healthPlans.safetyNote`) | Señales `PROFESSIONAL_REVIEW_RECOMMENDED` en `health-plans.domain` | `health-plans.domain.test`, `health-plans` («safety-aware onboarding») | **Cubierta** (el aviso) | Mantener. Su suficiencia legal depende de la revisión D (diferida) y de la aplicabilidad MDR («pendiente») |
| M9 | «Es un plan válido: puedes empezar o regenerarlo cuando quieras» (aviso de plantilla) | Validador semántico + plantilla determinista | `deterministic-fallback` («passes the semantic validator for every difficulty»), `workout-plan-validator`, E2E | **Cubierta técnicamente** | «Válido» significa «supera el validador de ingeniería»; **los límites no tienen respaldo profesional (AI-03)**. Considerar «adaptado» en vez de «válido» |
| M10 | «Generado con IA» (insignia y aviso) | `generationMode` persistido por rutina | E2E (`data-mode`), integración de procedencia | **Cubierta** | Mantener (aprobada por Hermes, ronda 3) |
| M11 | «Podrás generar otra a las {hora}» (aviso de tope) | `windowLimit` en `beginIdempotent` | 9 tests de integración, E2E y sonda D8 en producción | **Cubierta** | Mantener (aprobada por Hermes, ronda 3) |
| M12 | «Onboarding inteligente» (`components/onboarding-dialog.tsx:309`) | Diálogo de recogida de datos | Test de localización | **Excede** | El diálogo no hace nada «inteligente»; es un formulario por pasos. Cambiar |

## 3. Balance

| Veredicto | Nº | IDs |
|---|---|---|
| Cubierta | 5 | M2, M8, M9 (técnica), M10, M11 |
| Parcial | 5 | M1, M3, M4, M5, M6 |
| Sin evidencia | 1 | M7 |
| Excede | 1 | M12 |

**Patrón:** las promesas **de modo y de tope** (lo que la app declara de sí misma) están bien respaldadas; las de **capacidad adaptativa**
(«inteligente», «completo», «ajusta automáticamente») son las débiles. Casi todas las debilidades se resuelven **matizando el texto**,
no construyendo funciones nuevas.

## 4. Qué falta para que sea «matriz aprobada»

| Paso | Quién |
|---|---|
| Revisar y corregir esta matriz, y decidir texto a texto (mantener / matizar / retirar) | Toni |
| Pasar los textos nuevos por el gate Hermes | Hermes |
| Revisión profesional de límites y reglas de progresión (M4, M9) | Profesional (A, diferido) |
| Revisión legal del aviso de salud (M8) | Legal (D, diferido) |
| Aprobación formal de la matriz | Toni |
| Una prueba que fije M5 y, si se mantiene la promesa, una para M7 | Ingeniería (a orden de Toni) |

## 5. Límites

- Es una muestra de 12 promesas, no el inventario completo de la copy.
- Las pruebas citadas son locales sobre PostgreSQL 16; en producción solo están verificados M10 y M11 (Stage D, D8).
- «Cubierta» no equivale a «correcta para el usuario»: no se ha evaluado la calidad de las rutinas ni de las pautas.
