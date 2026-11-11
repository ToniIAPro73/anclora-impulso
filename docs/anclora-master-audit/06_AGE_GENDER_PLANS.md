# 06 — Diseño de las diez modalidades por edad y sexo

> **Commit:** `0e0b897`. **Fecha:** 2026-11-09. **Estado:** diseño propuesto, sin implementar.
> Identificadores de modalidad `P01`–`P10` (como en el encargo). Las fases del roadmap se llaman **Fase 0–7** para no confundirlas con el programa Post-UX (P0–P7).

---

## 1. Principios de diseño (obligatorios)

1. **La edad nunca inscribe ni limita.** Solo sugiere una modalidad. La persona elige (opt-in), cambia cuando quiera y puede no elegir ninguna (`SPEC §6.2`, CONFIRMADO).
2. **La edad y el sexo no infieren capacidad, interés, necesidad médica ni limitación.** Las diferencias entre variantes se **justifican** en una tabla con fuente y nivel de evidencia (sección 5) y son **configurables**.
3. **Ninguna modalidad es un diagnóstico.** Las señales de riesgo derivan a revisión profesional (`classifySafety`, CONFIRMADO).
4. **Diez modalidades = una arquitectura.** Son filas de configuración sobre el mismo motor (`06 §6` y `08`).
5. **Sexo ≠ identidad de género.** El sistema actual solo tiene `male | female` (`validators.ts:17`). Se propone separar `sexAtBirth` (opcional, con opción "prefiero no indicarlo") y `genderIdentity` (opcional, solo para texto y tratamiento). Ver `07 §3`.

---

## 2. Segmentos

| Código | Rango de edad (enteros, sin solapes) | Variante | Nota de elegibilidad |
|---|---|---|---|
| **P01** | **18–29** | Hombres | Menores de 30 incluye 14–17: ver §4 |
| **P02** | **18–29** | Mujeres | Igual |
| **P03** | **30–39** | Hombres | — |
| **P04** | **30–39** | Mujeres | — |
| **P05** | **40–49** | Hombres | — |
| **P06** | **40–49** | Mujeres | — |
| **P07** | **50–59** | Hombres | Coincide con Ruta Vital 50–60 (ver §3) |
| **P08** | **50–59** | Mujeres | Igual |
| **P09** | **60 o más** | Hombres | Sin límite superior |
| **P10** | **60 o más** | Mujeres | Igual |

**Límites:** `minAge`/`maxAge` enteros; intervalos `[18,29]`, `[30,39]`, `[40,49]`, `[50,59]`, `[60,∞)`. Ningún solape. Para `<18` ver §4.

---

## 3. Conflicto con la Ruta Vital existente (decisión pendiente de Toni)

| Punto | Estado actual | Propuesta |
|---|---|---|
| Ruta Vital | `minAge 50`, `maxAge 60` (`health-plans.service.ts:34`); `isInCohort` incluye 60 | Mantener la definición v1 (inmutable) |
| Catálogo de 10 | Límites `[50,59]` y `[60,∞)` | Nueva versión de Ruta Vital con `maxAge 59` **o** mantener el 60 como "compatible" (decisión de Toni) |
| Recomendación | — | Si se elige "compatible": a los 60 se muestra P09/P10 como primera sugerencia y Ruta Vital como segunda, sin doble inscripción |

**Recomendación:** `maxAge 59` en una versión 2 de Ruta Vital. Motivo: un único límite inequívoco, sin dobles caminos. Decide Toni.

---

## 4. Menores de edad (requisitos legales, de seguridad y de producto)

**Situación actual (CONFIRMADO):** el perfil acepta edades desde 14 años (`validators.ts:18,289,301`); el registro no pide edad; las páginas legales no contienen cláusula de menores.

| Requisito | Tipo | Estado | Propuesta |
|---|---|---|---|
| Consentimiento de los titulares de la patria potestad para menores de la edad digital de consentimiento | Legal | **HIPÓTESIS**: la edad de 14 años en España se menciona como referencia; **debe verificarse en el texto oficial** de la norma aplicable antes de implementarlo | Bloquear P01/P02 para menores hasta que exista flujo validado |
| Sin perfiles de salud ni planes con datos de salud para menores | Producto/seguridad | Propuesta | Ruta Vital y todas las modalidades quedan bloqueadas para `<18` |
| Edad mínima de la app | Producto | Decisión pendiente | Recomendado 18 años para la plataforma completa; decisión de Toni con asesoría legal |
| Verificación de edad | Técnico | No existe | No se propone verificación documental; se propone declaración de edad + bloqueo por política |

---

## 5. Análisis de necesidades y justificación de diferencias por variante

Cada variante **solo** cambia énfasis de contenido, ejemplos y temas de educación. No cambia el nivel de carga, el número de series ni las limitaciones del usuario. Toda diferencia es configurable y tiene evidencia.

| Tema | Variante hombres | Variante mujeres | Nivel de evidencia | Justificación | Estado |
|---|---|---|---|---|---|
| Fuerza de grandes grupos | Énfasis por defecto | Énfasis por defecto | Alta (consenso general) | Igual para todos; no es diferencia por sexo | Común |
| Salud ósea | Tema opcional | **Tema destacado en 40+** | Media | Densidad ósea varía con la edad y la menopausia; requiere fuente | **HIPÓTESIS** hasta revisar fuente |
| Cambios de composición corporal por perimenopausia | No aplica | Tema opcional 40+ y 50+ | Media | Ya aparece en `forty-plus-guidance.ts:21-23` sin fuente: debe **adquirir proveniencia** (AUD-012) | **HIPÓTESIS** |
| Grasa abdominal / visceral | Tema destacado 40+ | Tema opcional | Media | Ya en `forty-plus-guidance.ts:27-29`; mismo problema de proveniencia | **HIPÓTESIS** |
| Suelo pélvico | No aplica | Tema opcional | Media | Educación, no diagnóstico | **HIPÓTESIS** |
| Ejemplos de ejercicio | Según preferencia del usuario | Según preferencia | Alta | No se impone por sexo | Común |
| Lenguaje | Neutro | Neutro | — | Evitar estereotipos | Común |

**Regla de diseño:** toda diferencia de variante debe tener al menos una fuente revisada y una fecha de revisión (`HealthPlanContentReference`). Si no la tiene, se muestra como **sugerencia genérica**, nunca como consejo específico.

---

## 6. Fichas de las diez modalidades

Campos según el encargo (1–17). Los campos comunes a todas las modalidades (funcionalidades base, motor, progreso, seguridad) están en la matriz de la sección 7 para no repetirlos.

### P01 · Arranque Fuerza · Hombres (18–29)
1. **Identificador:** P01. 2. **Nombre comercial propuesto:** "Arranque Fuerza". 3. **Segmento:** 18–29, hombres. 4. **Perfil orientativo:** persona joven que empieza con fuerza o vuelve tras una pausa. 5. **Necesidades e hipótesis:** técnica, regularidad y progresión; hipótesis: se pierde antes de la semana 4. 6. **Objetivo:** adquirir hábito de fuerza en 12 semanas. 7. **Propuesta de valor:** plan sencillo, progresión clara, sin jerga. 8. **Funcionalidades:** generación con IA, progresión, registro. 9. **Contenido específico:** técnica de básicos; sin temas de salud. 10. **Personalización:** días, equipo, objetivo. 11. **UX:** onboarding corto; primer entrenamiento en < 5 min. 12. **Automatizaciones:** recordatorio de sesión, sugerencia de deload. 13. **Indicadores:** sesiones/semana, progresión de carga, racha. 14. **Diferenciación:** explicación de cada sugerencia. 15. **Dependencias:** motor de workouts y progresión (existentes). 16. **Complejidad:** S. 17. **Riesgos:** **bloqueado para 14–17** hasta §4 resuelto; el contenido es común a P02.

### P02 · Arranque Fuerza · Mujeres (18–29)
1–3 igual que P01 (variante mujeres). 4. Perfil: igual. 5. Hipótesis: adherencia por hábitos y tiempo. 6. Objetivo: igual. 7. Propuesta: igual con ejemplos neutros. 8–9. Igual; **sin** temas de menopausia. 10. Personalización igual. 11. UX igual. 12. Automatizaciones igual. 13. Indicadores igual. 14. Diferenciación: sin diferencia de capacidad. 15. Dependencias igual. 16. S. 17. Riesgo igual que P01 (menores).

### P03 · Motor 30 · Hombres (30–39)
1. P03. 2. "Motor 30". 3. 30–39, hombres. 4. Persona con carga profesional o familiar que quiere mantener forma. 5. Hipótesis: el tiempo es la barrera principal (validar). 6. Objetivo: mantener fuerza y capacidad cardiorrespiratoria con 3 sesiones de 35–45 min. 7. Propuesta: eficiencia y progreso medible. 8. Funcionalidades: plan de 3 sesiones, progresión, nutrición básica. 9. Contenido: recuperación del sueño y estrés (educación, con fuente). 10. Personalización: tiempo disponible, equipo, objetivo. 11. UX: vista semanal y "mínimo viable" de la semana. 12. Automatizaciones: adaptación cuando se pierde una sesión (`getAdaptation`). 13. Indicadores: sesiones completadas, minutos semanales, PR. 14. Diferenciación: plan de "semana mínima". 15. Dependencias: motor existente y `getAdaptation`. 16. S–M. 17. Riesgo: sin diferencias de variante justificadas en salud; contenido de sueño requiere fuente.

### P04 · Motor 30 · Mujeres (30–39)
1–3 igual. 4. Igual. 5. Hipótesis: planificación de la semana con cuidado de otros. 6. Objetivo igual. 7. Igual. 8. Igual. 9. Contenido: ciclo menstrual **solo** como opción informativa y voluntaria, con fuente (**HIPÓTESIS** de utilidad; riesgo de medicalizar). 10. Igual. 11. Igual. 12. Igual. 13. Igual. 14. Igual. 15. Igual. 16. S–M. 17. Riesgo: contenido de ciclo puede resultar invasivo; solo opt-in.

### P05 · Equilibrio 40 · Hombres (40–49)
1–3 igual. 4. Persona con trabajo intenso que nota cambios de recuperación y de composición corporal. 5. Hipótesis: prioridad a fuerza y recuperación. 6. Objetivo: preservar masa muscular y reducir grasa abdominal de forma sostenible. 7. Propuesta: fuerza, movilidad y recuperación. 8. Funcionalidades: plan de fuerza, movimiento diario, nutrición con objetivo de proteína, recuperación. 9. Contenido: masa muscular y grasa visceral con fuentes revisadas (**HIPÓTESIS** de adecuación del mensaje). 10. Personalización: objetivo, días, lesiones declaradas. 11. UX: resumen de recuperación. 12. Automatizaciones: alerta de volumen semanal alto (`MuscleVolume`). 13. Indicadores: volumen por grupo, adherencia, recuperación declarada. 14. Diferenciación: "evitar soluciones cosméticas" (texto existente, a revisar). 15. Dependencias: `MuscleVolume`, nutrición, progreso. 16. M. 17. Riesgo: texto actual en `forty-plus-guidance.ts:27-29` sin fuente.

### P06 · Equilibrio 40 · Mujeres (40–49)
1–3 igual. 4. Persona que quiere fuerza y bienestar óseo con tiempo limitado. 5. Hipótesis: prioridad a fuerza global y salud ósea. 6. Objetivo: fuerza, estabilidad y salud ósea con progresión. 7. Propuesta: técnica y sostenibilidad. 8. Funcionalidades: plan de fuerza, impacto controlado, nutrición con calcio/proteína (**HIPÓTESIS** de contenido). 9. Contenido: salud ósea, perimenopausia **solo como información** (con fuente y fecha, AUD-012). 10. Personalización: objetivo, días, impacto preferido. 11. UX: selector de impacto. 12. Automatizaciones: alerta de carga alta sin recuperación. 13. Indicadores: fuerza en básicos, adherencia. 14. Diferenciación: sin asumir síntomas. 15. Dependencias: contenido revisado (OPP-005). 16. M. 17. Riesgo: confundir información con diagnóstico.

### P07 · Vital 50 · Hombres (50–59)
1. P07. 2. "Ruta Vital · Hombres 50–59" (Ruta Vital como programa). 3. 50–59, hombres. 4. Persona que quiere mantener fuerza y movilidad sin lesiones. 5. Hipótesis: barreras de confianza y de dolor articular. 6. Objetivo: fase 1 de 4 semanas y progresión a 24 semanas (`HEALTH_PLAN_PHASES`). 7. Propuesta: continuidad sin sobrecarga. 8. Funcionalidades: Ruta Vital completa (`P1`). 9. Contenido: fuerza, equilibrio, sueño, nutrición, con proveniencia. 10. Personalización: limitaciones, tiempo, preferencias. 11. UX: semana actual, mínimo viable, pilares. 12. Automatizaciones: ya implementadas (`getAdaptation`). 13. Indicadores: pilares y `safetyCategory`. 14. Diferenciación: safety fail-closed. 15. Dependencias: AUD-006, AUD-021. 16. M. 17. Riesgo: contenido de 4 semanas (AUD-021) — **no lanzar** sin 24 semanas revisadas.

### P08 · Vital 50 · Mujeres (50–59)
1–3 igual. 4. Persona en etapa posmenopáusica o perimenopáusica que quiere fuerza y salud ósea (**hipótesis de perfil**, no dato). 5. Hipótesis: prioridad a densidad ósea y equilibrio. 6. Objetivo igual. 7. Igual. 8. Ruta Vital + módulo de salud ósea (opt-in). 9. Contenido: salud ósea y fuerza (fuente revisada). 10. Personalización igual, impacto controlado. 11. UX igual. 12. Igual. 13. Igual. 14. Igual. 15. Igual + revisión de contenido. 16. M. 17. Riesgo: contenido de menopausia sin fuente hoy.

### P09 · Longevidad 60+ · Hombres
1. P09. 2. "Longevidad 60+ · Hombres". 3. ≥ 60, hombres. 4. Persona que quiere autonomía funcional. 5. Hipótesis: equilibrio, caídas y tolerancia a la carga. 6. Objetivo: capacidad funcional y movilidad, progresión lenta. 7. Propuesta: autonomía. 8. Funcionalidades: plan de fuerza básica, equilibrio, movilidad, caminar. 9. Contenido: prevención de caídas y fragilidad (con revisión profesional, **HIPÓTESIS**). 10. Personalización: limitaciones, dispositivos de apoyo. 11. UX: letra grande, objetivos de 1 acción. 12. Automatizaciones: pausa automática tras señal de riesgo. 13. Indicadores: sesiones tolerables, progreso de equilibrio, adherencia. 14. Diferenciación: lenguaje sin estigma. 15. Dependencias: safety, accesibilidad (AUD-019). 16. M–L. 17. Riesgo: alto; requiere profesional en contenido.

### P10 · Longevidad 60+ · Mujeres
1–3 igual. 4. Persona en la misma etapa con enfoque en salud ósea. 5. Hipótesis: densidad ósea y equilibrio. 6. Objetivo igual a P09 con énfasis óseo. 7. Igual. 8. Igual + módulo de salud ósea. 9. Contenido de salud ósea revisado. 10. Igual. 11. Igual. 12. Igual. 13. Igual. 14. Igual. 15. Igual. 16. L. 17. Riesgo alto: osteoporosis está en la lista de señales de revisión profesional (`health-plans.domain.ts:22-35`, `osteoporosis_or_fracture`).

---

## 7. Matriz comparativa de las diez modalidades

| Capacidad | P01 | P02 | P03 | P04 | P05 | P06 | P07 | P08 | P09 | P10 |
|---|---|---|---|---|---|---|---|---|---|---|
| Generación con IA | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Progresión y adaptación | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |
| Nutrición con objetivo | ○ | ○ | ● | ● | ● | ● | ● | ● | ○ | ○ |
| Módulo de salud ósea | — | — | — | — | — | ● | — | ● | — | ● |
| Tema de ciclo (opt-in) | — | — | — | ○ | — | — | — | — | — | — |
| Safety fail-closed | ○ | ○ | ○ | ○ | ● | ● | ● | ● | ● | ● |
| Ruta Vital (pilares y 24 semanas) | — | — | — | — | ● | ● | ● | ● | ○ | ○ |
| Lenguaje sin estigma | ○ | ○ | ○ | ○ | ● | ● | ● | ● | ● | ● |
| Cambio de modalidad | ● | ● | ● | ● | ● | ● | ● | ● | ● | ● |

● obligatorio · ○ opcional · — no aplica. **Todas** las variantes usan los mismos motores.

---

## 8. Riesgos y supuestos pendientes

| Supuesto | Estado | Cómo validar |
|---|---|---|
| Las diferencias por sexo son útiles para el usuario | HIPÓTESIS | Pruebas de preferencia (15) |
| 40–49 y 50–59 necesitan contenido diferenciado | HIPÓTESIS | Investigación y revisión profesional |
| Menores de 18 pueden usar la plataforma | NO VERIFICADO / decisión legal | Asesoría legal |
| Edad de consentimiento digital aplicable | HIPÓTESIS (no citar sin texto oficial) | Texto oficial de la norma aplicable |
| Contenido por edad no genera rechazo | HIPÓTESIS | Estudio con usuarios 40+ |
