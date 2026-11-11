# 10 — Método y resultado de priorización

> **Commit:** `0e0b897`. **Fecha:** 2026-11-09.

---

## 1. Método

Se usa una **matriz ponderada adaptada** (no RICE puro, porque el alcance y el alcance de impacto son muy desiguales entre seguridad, legal y producto).

### 1.1 Puntuaciones (1 a 5)

| Factor | Significado |
|---|---|
| **V** Valor para el usuario y negocio | Cuánto mejora la experiencia o el ingreso/retención |
| **R** Reducción de riesgo | Cuánto reduce un riesgo identificado (seguridad, legal, operativo, regresión) |
| **U** Urgencia | Cuánto se degrada si se retrasa |

### 1.2 Esfuerzo y confianza

| Esfuerzo | Valor numérico |
|---|---|
| S | 1 |
| M | 2 |
| L | 3 |
| XL | 5 |

| Confianza en la evidencia | Factor |
|---|---|
| CONFIRMADO | 1,0 |
| INFERIDO | 0,7 |
| HIPÓTESIS | 0,4 |
| NO VERIFICADO | 0,3 |

Se aplica el **menor** factor de confianza entre la evidencia de origen y la hipótesis de impacto.

### 1.3 Fórmula

```text
Puntuación = (V + R + U) × Confianza ÷ Esfuerzo
```

Rango teórico: 0,3 a 15. **Esta puntuación no ordena por sí sola.** Se aplican reglas de precedencia (§2).

### 1.4 Límites del método

- Los factores son juicios de la auditoría, no datos de mercado.
- No se asigna precisión falsa: los valores son enteros y la confianza es categórica.
- La puntuación no sustituye la opinión de Toni sobre prioridad de negocio.

---

## 2. Reglas de precedencia

1. **Bloqueante:** una tarea que impide lanzar o desplegar sin riesgo se ejecuta antes que cualquier otra, aunque su puntuación sea baja (TASK-001, TASK-003).
2. **Seguridad crítica:** una vulnerabilidad de severidad Alta o Crítica precede a funcionalidad atractiva (TASK-002, TASK-006, TASK-012).
3. **Dependencia:** una tarea se ejecuta después de su dependencia, aunque tenga mayor puntuación.
4. **Confianza baja:** una oportunidad con impacto alto pero HIPÓTESIS requiere **experimento** antes de desarrollo completo.
5. **Quick win:** esfuerzo S, puntuación ≥ 5 y sin dependencias → se ejecuta pronto.

---

## 3. Puntuación por tarea

| Tarea | Título corto | V | R | U | Confianza | Esfuerzo | Puntuación | Clase final | Justificación de la clase |
|---|---|---|---|---|---|---|---|---|---|
| TASK-001 | Cerrar discrepancia documental de migración P1 | 2 | 2 | 2 | 1,0 | S (1) | 6,0 | Media (quick win) | Migración verificada en Neon; queda alinear gate P1 y contrato |
| TASK-002 | Refresh a cookie httpOnly | 4 | 5 | 4 | 1,0 | M (2) | 6,5 | **Crítica** | Regla 2: sesión robable 30 días |
| TASK-003 | Marco legal de menores y salud | 4 | 5 | 4 | 0,7 | M (2) | 4,6 | **Bloqueante** | Regla 1: prerequisito de cualquier cohorte por edad |
| TASK-004 | Retirar dependencias sin uso | 2 | 3 | 2 | 1,0 | S (1) | 7,0 | Alta (quick win) | Puntuación ≥ 5, S, sin dependencias |
| TASK-005 | Tipos backend en CI | 2 | 3 | 3 | 0,7 | S (1) | 5,6 | Alta (quick win) | Evita regresiones de tipos |
| TASK-006 | Secretos JWT obligatorios | 3 | 5 | 4 | 0,7 | S (1) | 8,4 | **Crítica** | Regla 2 |
| TASK-007 | Retirar `/dashboard` público | 1 | 2 | 2 | 1,0 | S (1) | 5,0 | Media (quick win) | Superficie menor |
| TASK-008 | Cohorte exige edad | 3 | 3 | 3 | 1,0 | S (1) | 9,0 | Alta (quick win) | Corrige elegibilidad |
| TASK-009 | Proveniencia de textos 40+/sexo | 4 | 4 | 4 | 1,0 | M (2) | 6,0 | Alta | Riesgo de contenido; prerequisito de OPP-005 |
| TASK-010 | Revisión profesional de límites IA | 4 | 5 | 3 | 1,0 | M (2) | 6,0 | Alta | Seguridad clínica |
| TASK-011 | Corregir documentación desfasada | 2 | 2 | 2 | 1,0 | S (1) | 6,0 | Media (quick win) | Evita decisiones con datos falsos |
| TASK-012 | Guardas de entorno para integración | 3 | 5 | 4 | 0,7 | S (1) | 8,4 | **Crítica** | Regla 2: escrituras accidentales en producción |
| TASK-013 | E2E de Ruta Vital y QA visual | 3 | 3 | 3 | 0,7 | M (2) | 3,2 | Media | Necesaria antes de Fase 3 |
| TASK-014 | Partir `nutrition.service.ts` | 2 | 3 | 1 | 1,0 | L (3) | 2,0 | Baja | Sin urgencia; con tests previos |
| TASK-015 | Partir componentes grandes | 2 | 1 | 1 | 1,0 | M (2) | 2,0 | Baja | Mantenibilidad |
| TASK-016 | Reducir `any` | 1 | 2 | 1 | 1,0 | M (2) | 2,0 | Baja | Calidad |
| TASK-017 | Campos de catálogo (cohorte, variante, bandas) | 4 | 3 | 3 | 1,0 | M (2) | 5,0 | Alta | Prerequisito del catálogo |
| TASK-018 | `sexAtBirth` y `genderIdentity` | 3 | 4 | 2 | 0,7 | M (2) | 3,2 | Media | Depende de TASK-003 |
| TASK-019 | Seed de 10 modalidades en borrador | 3 | 1 | 3 | 1,0 | S (1) | 7,0 | Media (quick win) | Sin publicar hasta TASK-021 |
| TASK-020 | Elegibilidad por bandas y tests | 3 | 3 | 3 | 1,0 | S (1) | 9,0 | Alta (quick win) | Base de todo el catálogo |
| TASK-021 | Contenido de 24 semanas (Ruta Vital) | 5 | 3 | 3 | 0,7 | L (3) | 2,6 | Alta | Mayor valor, mayor esfuerzo; depende de TASK-009 |
| TASK-022 | Selección de modalidad | 4 | 1 | 2 | 0,7 | M (2) | 2,5 | Media | Depende de TASK-019/020 |
| TASK-023 | Cambio de modalidad con historial | 3 | 2 | 2 | 0,7 | M (2) | 2,5 | Media | Depende de TASK-022 |
| TASK-024 | Módulos opcionales de salud ósea y ciclo | 3 | 3 | 1 | 0,4 | M (2) | 1,4 | **Experimento** | HIPÓTESIS; validar antes |
| TASK-025 | Onboarding no clínico | 4 | 3 | 2 | 0,7 | M (2) | 3,2 | Media | Depende de TASK-003 y TASK-018 |
| TASK-026 | Motor de reglas explicable | 4 | 2 | 2 | 0,7 | M (2) | 2,8 | Media | Depende de TASK-020 y TASK-025 |
| TASK-027 | Investigación de competidores 40+/50+ | 2 | 1 | 2 | 0,4 | S (1) | 2,0 | **Experimento** | Dato faltante |
| TASK-028 | Confianza en progreso con pocos datos | 3 | 1 | 2 | 0,7 | S (1) | 4,2 | Media (quick win) | UX-06 |
| TASK-029 | Explicación con IA opcional | 2 | 1 | 1 | 0,4 | M (2) | 0,8 | **Experimento** | HIPÓTESIS; depende de TASK-010 y TASK-026 |
| TASK-030 | Eventos del embudo de planes | 3 | 2 | 2 | 0,7 | M (2) | 2,5 | Media | Medir antes de escalar |

---

## 4. Clasificación final

| Clase | Tareas | Justificación resumida |
|---|---|---|
| **Bloqueantes** | TASK-003 | Sin marco legal de menores y datos de salud no se puede inscribir por edad |
| **Prioridad crítica** | TASK-002, TASK-006, TASK-012 | Seguridad de sesión, secretos y entorno |
| **Prioridad alta** | TASK-004, TASK-005, TASK-008, TASK-009, TASK-010, TASK-017, TASK-020, TASK-021 | Calidad, elegibilidad, contenido y catálogo |
| **Prioridad media** | TASK-001, TASK-007, TASK-011, TASK-013, TASK-018, TASK-019, TASK-022, TASK-023, TASK-025, TASK-026, TASK-028, TASK-030 | Necesarias, con dependencias o menor urgencia (TASK-001 reducida a cierre documental tras verificar Neon) |
| **Prioridad baja** | TASK-014, TASK-015, TASK-016 | Mantenibilidad sin urgencia |
| **Experimentos pendientes** | TASK-024, TASK-027, TASK-029; OPP-008, OPP-010, OPP-013 | Confianza baja; validar antes |
| **Aplazadas o descartadas** | Motor de recomendación con ML (descartado: sin datos); panel administrativo de planes (aplazado); wearables reales (aplazado hasta verificar proveedores, OPP-009); PWA offline (aplazado, no anunciado); vista familiar (aplazada, OPP-010) | Ver justificación |

---

## 5. Lectura de la matriz

- La mayor puntuación está en **TASK-008** y **TASK-020** (9,0), cambios pequeños con base sólida. Son quick wins, no los riesgos más graves.
- **TASK-002** (6,5) queda por debajo de **TASK-004** (7,0) en puntuación pura. **No se ejecuta antes** porque la regla 2 lo sitúa como crítico. Es el ejemplo del principio de que la puntuación no ordena sola.
- **TASK-021** (contenido de 24 semanas) tiene el mayor valor (5) pero baja puntuación por esfuerzo L y confianza media. Se ejecuta tras TASK-009, no antes.
- Las tareas de experimento no se desarrollan completas hasta validar la hipótesis (`15`).

---

## 6. Revisión de la matriz

La matriz se actualizó tras verificar `AUD-006` en Neon (que redujo `TASK-001` a ajuste documental). Debe volver a revisarse cuando:
- Toni decida la edad mínima (TASK-003).
- Se cambie la confianza de un hallazgo (por ejemplo, tras verificar AUD-002 en Render).
