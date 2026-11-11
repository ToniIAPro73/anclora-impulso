# 15 — Validación, métricas y criterios de éxito

> **Commit:** `0e0b897`. **Fecha:** 2026-11-09.
> **Ninguna cifra de esta página es un dato medido en producción.** Son objetivos propuestos o líneas base a medir.

---

## 1. Línea base verificada hoy

| Métrica | Valor | Cómo se obtuvo | Estado |
|---|---|---|---|
| Suites y tests frontend | 21 suites / 150 tests pasan | `npx jest --ci --coverage=false` | CONFIRMADO |
| Suites y tests backend unitarios | 14 suites / 114 tests pasan | `npx jest --ci --coverage=false tests/unit` | CONFIRMADO |
| Suites de integración backend | 31 ficheros | conteo de `backend/tests/integration/` | CONFIRMADO (no ejecutadas) |
| Errores de tipos frontend | 0 | `npx tsc --noEmit` | CONFIRMADO |
| Errores de tipos backend | 4 | `npx tsc --noEmit` en `backend/` | CONFIRMADO |
| Modelos Prisma | 57 | conteo | CONFIRMADO |
| Migraciones | 26 | conteo | CONFIRMADO |
| Dependencias sin uso | 4 (+ 14 `latest`) | `grep` de importaciones | CONFIRMADO |
| Usos de `any` | 34 | `grep` | CONFIRMADO |
| Cobertura | NO MEDIDA en esta auditoría | — | NO VERIFICADO |
| Tiempos de respuesta, carga, conversión, retención | NO MEDIDOS | — | NO VERIFICADO |

---

## 2. KPIs de producto para planes

| KPI | Definición | Objetivo inicial propuesto | Fuente de datos | Fase |
|---|---|---|---|---|
| Tasa de inscripción | Inscritos / usuarios con edad declarada en la franja | Línea base en la primera medición; sin objetivo fijado | `ProductEvent` (TASK-030) | 3 |
| Tasa de aceptación de la sugerencia | Usuarios que eligen la modalidad sugerida / sugeridos | Línea base | Eventos | 3 |
| Abandono en la semana 1 | Inscritos sin semana completada a los 7 días | Reducir frente a la línea base | `HealthPlanWeekStatus` | 3 |
| Semanas completadas | Semanas con estado completado / inscripciones | Línea base | `HealthPlanWeekStatus` | 3 |
| Cambios de modalidad | Cambios / inscritos | Línea base; vigilar picos | `HealthPlanEnrollment.previousPlanId` | 3 |
| Uso de acciones de la semana | Acciones completadas / propuestas | Línea base | `HealthPlanActionStatus` | 3 |
| Eventos de seguridad | Sesiones marcadas `PROFESSIONAL_REVIEW_RECOMMENDED` / inscritos | Vigilar; sin objetivo | `HealthPlanEnrollment.safetyCategory` | 1–3 |

**Regla de privacidad:** los KPI se calculan con agregados. Ningún informe muestra datos de salud de una persona.

---

## 3. KPIs de calidad técnica

| KPI | Objetivo | Cuándo se mide |
|---|---|---|
| Errores de tipos backend en CI | 0 | Cada PR |
| Tests de integración en CI | Verdes | Cada PR |
| Dependencias sin uso | 0 | Trimestral |
| Dependencias con `latest` | 0 | Cada cambio de `package.json` |
| Secretos con valor por defecto en arranque | 0 | Cada despliegue |
| Refresh tokens en `localStorage` | 0 | Tras TASK-002 |
| Servicios > 800 líneas | 0 | Trimestral |
| `any` en código de producto | Tendencia a 0 | Trimestral |

---

## 4. Validación de contenido

| Criterio | Cómo se valida | Responsable |
|---|---|---|
| Cada afirmación de salud tiene fuente | Test que falla si falta referencia | Agente + revisor |
| Nivel de evidencia declarado | Revisión humana | Revisor profesional |
| Fecha de revisión < 12 meses | Test de caducidad | Agente |
| Lenguaje sin diagnóstico | Revisión de copy | Hermes + revisor |
| Lenguaje neutro sin estereotipos | Revisión de copy | Hermes |

---

## 5. Validación de experiencia (pruebas con usuarios)

| Prueba | Participantes | Pregunta | Criterio de aceptación |
|---|---|---|---|
| Comprensión de "Ruta Vital" | 8–10 personas de 50–59 | ¿Qué entiendes que es? | ≥ 7 de 10 lo describen correctamente sin ayuda |
| Malestar con preguntas de edad y sexo | 8–10 personas de 40–60 | ¿Te resultan adecuadas? | Ningún patrón de rechazo grave; cambios de redacción si hace falta |
| Elección de modalidad | 10 personas | ¿Eliges la sugerencia? ¿Por qué? | Entienden el motivo en la mayoría de casos |
| Primer entrenamiento | 10 personas | Tiempo hasta primera acción | Sin objetivo fijado; se mide para línea base |
| Confianza en contenido | 10 personas | ¿Confías en la fuente? | Declarada por la mayoría; se revisa si no |

**Reglas de las pruebas:** consentimiento informado; sin datos reales de salud; participantes voluntarios; sin incentivos que sesguen.

---

## 6. Validación de experimentos (hipótesis)

| Experimento | Hipótesis | Métrica | Parada si | Duración |
|---|---|---|---|---|
| TASK-024 · módulo de salud ósea | El módulo mejora la retención en P08/P10 | Retención a 4 semanas | Abandono > +10 % | Según diseño |
| TASK-029 · explicación IA | La explicación mejora la comprensión sin cambiar decisiones | Comprensión declarada | Coste > límite o cambios de decisión | Según diseño |
| TASK-027 · investigación 40+/50+ | Hay apps que segmentan por edad | Número de fuentes primarias | Menos de 2 fuentes | Única |

---

## 7. Definición de terminado (general)

Una tarea está terminada cuando:
1. Los criterios de aceptación de la tarea se cumplen y se demuestran con tests o evidencia.
2. Los tests afectados pasan en CI (integración solo en CI).
3. El typecheck de la parte tocada no tiene errores nuevos.
4. No hay secretos ni `.env*` en el diff.
5. El informe de cambios está escrito con resultados reales.
6. Toni valida el cambio en `development` antes de cualquier commit.

---

## 8. Criterios de éxito del programa

| Criterio | Señal de éxito | Señal de alarma |
|---|---|---|
| Seguridad | 0 secretos por defecto; 0 refresh en `localStorage` | Cualquier incidente de sesión |
| Legal | Texto aprobado antes de inscripción por edad | Inscripciones de menores |
| Calidad | CI con tipos y tests verdes | Regresiones repetidas |
| Producto | Línea base medida; abandono en semana 1 reducido | Abandono creciente |
| Contenido | 100 % con fuente | Afirmación sin fuente en producción |

---

## 9. Lo que no se puede validar con este repositorio

- Eficacia de los planes sobre salud o rendimiento: requiere estudio con seguimiento.
- Comparación real con competidores: requiere pruebas de uso con cuentas.
- Coste de infraestructura por usuario: requiere datos de facturación verificados.
- Estado real de producción: requiere verificación de Toni (TASK-001).
