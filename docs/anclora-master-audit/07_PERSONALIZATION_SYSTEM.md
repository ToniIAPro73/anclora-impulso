# 07 — Sistema de personalización: onboarding, recomendación y evolución

> **Commit:** `0e0b897`. **Fecha:** 2026-11-09. Diseño propuesto; no implementado.

---

## 1. Situación actual (CONFIRMADO)

| Capacidad | Estado | Evidencia |
|---|---|---|
| Perfil con edad, sexo, objetivo, días, entorno, experiencia, limitaciones | Implementado | `schema.prisma:13-90`, `validators.ts:286-310` |
| Personalización de entrenamiento según perfil y equipo | Implementado | `workouts.service.ts`, `forty-plus-guidance.ts` |
| Respaldo determinista y validador | Implementado | `workouts/deterministic-fallback.ts`, `plan-validator.ts` |
| Recomendaciones 40+ por sexo (textuales) | Implementado sin proveniencia | `forty-plus-guidance.ts:7-30` (AUD-012) |
| Recomendación de modalidad de plan | **No existe** | — |
| Explicación de por qué se recomienda algo | Parcial: P4 muestra entradas y motivo en la propuesta de IA | `P4-FINAL-GATE-REPORT.md` |
| Preferencias y cambio de plan | Preferencias de recordatorio sí (`remindersEnabled` etc.); cambio de modalidad no | `schema.prisma` |
| Registro de preferencias en el tiempo | `ProductEvent`, `MealSwapHistory`, `ExerciseProgressionState` | CONFIRMADO |

---

## 2. Onboarding no clínico (propuesta)

### 2.1 Principios
- **Minimización:** cada pregunta tiene un uso declarado y una alternativa de omisión.
- **Opt-in:** el registro no pide edad ni sexo; se piden tras el primer valor (primer entrenamiento o primera vista de contenido).
- **Sin inferencias automáticas:** la edad solo propone una modalidad; no fija cargas ni limita.
- **Sensibles separados:** salud, sexo biológico e identidad de género se piden en pasos separados, con consentimiento específico y opción "prefiero no indicarlo".

### 2.2 Preguntas

| Paso | Pregunta | Campo | Obligatoria | Uso | Sensible |
|---|---|---|---|---|---|
| 1 | Objetivo principal (fuerza, forma, movilidad, hábito) | `trainingGoal` (existe) | No (valor por defecto) | Plan y tono | No |
| 2 | Días y tiempo disponible | `trainingDaysPerWeek` (existe), tiempo nuevo | No | Cargas y semana mínima | No |
| 3 | Rango de edad (5 tramos) | `ageBand` (derivado de `age`, o declarado) | Recomendada | Sugerir modalidad | Sí |
| 4 | Sexo para variante de contenido (opcional) | `sexAtBirth` (propuesto) | No | Variante de contenido (ver 06 §5) | Sí |
| 5 | Limitaciones o molestias declaradas | `limitations` (existe) | No | Ajuste y derivación | Sí (salud) |
| 6 | Preferencias de contenido (incluir/excluir temas) | `preferences` | No | Módulos opt-in | No |

**Consentimiento:** los pasos 3–5 requieren consentimiento explícito y registrado con versión (`consent version`). Sin consentimiento se usa la modalidad genérica de la franja de edad sin temas de salud.

### 2.3 Lo que no se pide
- Historial médico completo, medicación, diagnósticos, peso de forma obligatoria para el primer entrenamiento.
- Fecha de nacimiento (se usa `age`; suficiente para cohortes y reduce datos).

---

## 3. Sexo, identidad de género y atributos

| Atributo | Hoy | Propuesta | Motivo |
|---|---|---|---|
| `sex` | `male` / `female` (CONFIRMADO) | Renombrar conceptualmente a `sexAtBirth` con valores `male`, `female`, `prefer_not_say` | Claridad y no exclusión |
| `genderIdentity` | No existe | Opcional, texto libre limitado o enumeración abierta, solo para lenguaje y saludos | Respeto; no altera contenido clínico |
| Uso de sexo | Textos 40+ y nutrición | Solo variante de contenido con fuente (06 §5) | Evitar sesgos |
| Uso de identidad | — | Nunca para capacidad, carga o contenido de salud | Principio de no inferencia |

Migración **aditiva** (`TASK-018`); no se altera el valor actual de `sex`.

---

## 4. Motor de recomendación: Alternativa A frente a Alternativa B

| Criterio | A · Reglas configurables | B · Personalización asistida por IA |
|---|---|---|
| Complejidad | Baja: tablas y funciones puras (`health-plans.domain.ts` ya es un ejemplo) | Alta: datos, evaluación, prompts, cuotas |
| Coste | Cero marginal por usuario | Coste por petición (Groq) y por evaluación |
| Mantenibilidad | Alta: reglas en tests | Media: depende de prompts y modelos |
| Interpretabilidad | Total: cada regla tiene motivo | Baja–media: requiere explicación generada |
| Riesgos | Reglas simples que no capturan matices | Recomendaciones no reproducibles; sesgos; salud |
| Calidad esperada | Suficiente para sugerir modalidad y semana | Mayor solo si hay datos suficientes (no hay hoy) |
| Requisitos de datos | Perfil básico | Historial de progreso y feedback en volumen |
| Escalabilidad | Alta | Media; coste crece con uso |

**Recomendación:** **Alternativa A** para la recomendación inicial y la adaptación semanal. La IA (B) se reserva para **explicar** en lenguaje natural una decisión ya tomada por reglas (`TASK-029`), detrás de flag y con límites. Motivo: la SPEC exige explicabilidad y el repositorio no tiene volumen de datos para justificar un modelo.

### 4.1 Reglas iniciales propuestas (ejemplos)

| Regla | Entrada | Salida | Nota |
|---|---|---|---|
| R1 Cohorte | `age` (entero) | Modalidad P01–P10 sugerida | Si `age` es nulo: no sugerir cohorte, pedir edad (corrige AUD-004) |
| R2 Variante | `sexAtBirth` o elección | Variante de contenido | Siempre reversible |
| R3 Safety | Señales de `limitations` | `SELF_MANAGED` / `CAUTION` / `PROFESSIONAL_REVIEW_RECOMMENDED` | `classifySafety` existente |
| R4 Adaptación | Semana perdida o recuperación pobre | `REDUCE` | `getAdaptation` existente |
| R5 Progreso | Semana completada antes de plazo | `PROGRESS` | `getAdaptation` existente |
| R6 Tiempo | `availableTime` | Semana mínima | Propuesta nueva |

---

## 5. Recomendación explicable (contrato)

Cada recomendación debe incluir:
1. **Qué** se recomienda (modalidad, semana, acción).
2. **Por qué** (regla aplicada y entradas usadas, en lenguaje claro).
3. **Qué puedes cambiar** (botón de editar, cambiar modalidad, descartar).
4. **Cuándo se revisa** (fecha o evento).

Ejemplo de texto (sin diagnóstico):
> "Te sugerimos la modalidad de 50–59 porque indicaste tu rango de edad. Puedes elegir otra o no seguir ninguna. Esta sugerencia no evalúa tu salud."

---

## 6. Personalización evolutiva

| Fuente de señal | Tipo | Uso | Control del usuario |
|---|---|---|---|
| Preferencias explícitas | Declarada | Ajustes iniciales | Editar en perfil |
| Objetivos | Declarada | Progresión y mensajes | Cambiar objetivo |
| Progreso (sesiones, cargas, semanas) | Observada | Adaptación | Ver historial, desactivar adaptación |
| Interacciones (descartes, ediciones) | Observada | Ajuste de sugerencias | Reiniciar preferencias |
| Cambios de necesidades | Declarada | Cambio de modalidad | Cambio manual y reversible |
| Recuperación (wearables) | Observada, **NO VERIFICADO** | Carga | Desconectar fuente |

**Transparencia:** cada cambio automático aparece en el historial con motivo.
**Control:** el usuario puede pausar la adaptación, ver y borrar señales y cambiar de modalidad sin pérdida de datos.
**Prevención de sesgos:**
- Ninguna regla usa edad o sexo como sustituto de capacidad.
- Auditoría periódica de sugerencias por franja de edad y variante (ver `15`).
- Contenido de variantes con proveniencia y revisión.
- Lenguaje neutro por defecto; sin estereotipos de género en ejemplos.

---

## 7. Modalidad y preferencias: qué puede cambiar el usuario

| Acción | Permitida | Efecto |
|---|---|---|
| Elegir modalidad inicial | Sí | Crea inscripción |
| Cambiar de modalidad | Sí (`TASK-023`) | Conserva historial; nueva versión de perfil |
| Pausar | Sí (ya existe `pausedAt`) | Sin pérdida |
| Salir | Sí (`leftAt`) | Conserva datos de entrenamiento |
| Cambiar sexo/variante | Sí | Cambia contenido, no cargas |
| Borrar señales | Sí (propuesta) | Reinicia adaptación |

---

## 8. Dependencias y orden

`TASK-003` (marco legal) → `TASK-018` (campos) → `TASK-025` (onboarding) → `TASK-026` (reglas) → `TASK-029` (explicación IA, opcional).
Ningún paso de esta cadena se activa sin el anterior en producción.
