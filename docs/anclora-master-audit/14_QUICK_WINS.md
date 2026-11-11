# 14 — Quick wins

> **Commit:** `0e0b897`. **Fecha:** 2026-11-09.
> Criterios: esfuerzo reducido (S), impacto apreciable, bajo riesgo, pocas dependencias, validación sencilla.

---

## 1. Diez quick wins

| # | Tarea | Por qué ahora | Impacto | Riesgo | Dependencias | Validación |
|---|---|---|---|---|---|---|
| QW-01 | TASK-006 · Secretos JWT obligatorios | Riesgo de falsificación de tokens si el despliegue no fija `NODE_ENV` | Alto | Bajo | Ninguna | Test de configuración; Toni verifica Render sin ver valores |
| QW-02 | TASK-012 · Guardas de entorno para integración | Evita escrituras accidentales en producción | Alto | Bajo | Ninguna | Test del guard |
| QW-03 | TASK-008 · Cohorte exige edad | Corrige elegibilidad permisiva en una línea de dominio | Medio | Bajo | Ninguna | Test de límites |
| QW-04 | TASK-020 · Bandas no solapadas y tests | Base de todo el catálogo de 10 modalidades | Medio | Bajo | Ninguna | Tests de límites y de no solape |
| QW-05 | TASK-004 · Retirar dependencias sin uso | Reduce superficie y tamaño de instalación | Medio | Bajo | Ninguna | Typecheck y Jest de frontend |
| QW-06 | TASK-005 · Gate de tipos backend | Hace visible un error real | Medio | Bajo | Ninguna | `tsc` en CI |
| QW-07 | TASK-011 · Documentación corregida | Evita decisiones con cifras falsas (tests, GPT-4, dashboard) | Medio | Ninguno | Ninguna | Revisión de Toni |
| QW-08 | TASK-007 · Retirar `/dashboard` público | Reduce superficie sin afectar a la API | Bajo | Bajo | Ninguna | Respuesta 404/401 |
| QW-09 | TASK-019 · Seed de 10 modalidades en borrador | Permite revisar el catálogo sin publicarlo | Medio | Bajo | TASK-017 | Idempotencia |
| QW-10 | TASK-028 · Indicadores de confianza en progreso | Evita que pocos datos parezcan fracaso (UX-06) | Medio | Bajo | Ninguna | Visual QA |

---

## 2. Por qué conviene cada uno

- **QW-01 y QW-02** son seguridad con esfuerzo mínimo. Son prioritarios aunque no sean "funcionalidad".
- **QW-03 y QW-04** preparan el catálogo sin tocar datos. Son los cambios de dominio más pequeños con mayor valor.
- **QW-05 y QW-06** mejoran el pipeline de entrega; sin ellos cualquier cambio posterior se valida peor.
- **QW-07** evita que se tomen decisiones de negocio con datos que el repositorio no sostiene.
- **QW-08** cierra una superficie pública innecesaria.
- **QW-09** permite revisar el catálogo antes de cualquier decisión de producto.
- **QW-10** es el único quick win de cara al usuario; mejora la comprensión del progreso sin cambiar datos.

---

## 3. Qué no es quick win (y por qué)

| Elemento | Motivo |
|---|---|
| TASK-002 (refresh en cookie) | Esfuerzo M y riesgo de cerrar sesiones; va en Fase 0 con tests |
| TASK-003 (legal) | Depende de revisión externa |
| TASK-021 (contenido de 24 semanas) | Esfuerzo L |
| TASK-014 (partir nutrición) | Esfuerzo L con tests previos |
