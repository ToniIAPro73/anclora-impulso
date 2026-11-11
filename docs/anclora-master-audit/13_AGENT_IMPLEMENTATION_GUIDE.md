# 13 — Guía e plantilla para agentes de programación

> **Commit:** `0e0b897`. **Fecha:** 2026-11-09.
> Esta guía se aplica a **cualquier** `TASK-XXX` de `12_AGENT_READY_BACKLOG.md`. Las reglas del repositorio prevalecen sobre cualquier preferencia del agente.

---

## 1. Reglas del repositorio que todo agente debe respetar

| Regla | Fuente | Qué implica |
|---|---|---|
| Trabajar solo en `development` | `AGENTS.md` §Flujo Git; `CLAUDE.md` del workspace | Sin ramas `feat/*`, `fix/*`, `chore/*`, sin worktrees ni PR |
| Cambios **sin commit** hasta validación de Toni | `.anclora/PRODUCTION_RUNTIME.md` (cabecera) | El agente no hace `git commit` ni `git push` |
| Leer `AGENTS.md`, `.anclora/AGENT_PROJECT_CONTEXT.md`, `MEMORY.md` antes de editar | `CLAUDE.md` del repositorio | Obligatorio |
| Spec antes de código | `AGENTS.md` §Ciclo de cambios | `sdd/features/<nombre>/<nombre>-spec-v1.md` |
| Specs cerradas son inmutables | `AGENTS.md` §Reglas obligatorias | Un cambio en una spec cerrada genera una spec nueva |
| Tests primero | `AGENTS.md` §Principios | Test rojo antes de implementar |
| Código y comentarios en inglés | `AGENTS.md` §Principios (5) | Los documentos de producto pueden ir en español |
| No leer ni imprimir `.env*` | Hook de seguridad del workspace | Las variables se cargan en el proceso que las necesita |
| No ejecutar integración contra producción | `PRODUCTION_RUNTIME.md` §3, §9 | Solo CI con base de test |
| No crear base de datos de desarrollo | `PRODUCTION_RUNTIME.md` §3 | `DO_NOT_CREATE_DEVELOPMENT_DATABASE=true` |
| Migraciones versionadas; aplicación solo por el runner protegido | `PRODUCTION_RUNTIME.md` §4 | El agente crea la migración; no la aplica |
| Usuario QA dedicado; nunca la cuenta de Toni | `PRODUCTION_RUNTIME.md` §10 | `qa.impulso@anclora.local`; no borrar |
| Copy público pasa por Hermes | `AGENTS.md` §Reglas obligatorias | Antes de cerrar la tarea |
| Sin secretos en código ni en logs | `AGENTS.md`; `PRODUCTION_RUNTIME.md` | `SECRET_COMMIT_FORBIDDEN=true` |
| Ninguna acción de promoción sin `PROMOTE=FULL` exacto | `PRODUCTION_RUNTIME.md` (cabecera) | El agente no promueve |

---

## 2. Rol técnico recomendado

| Tipo de tarea | Rol |
|---|---|
| Seguridad (TASK-002, 006, 012) | Ingeniero backend senior con revisión de seguridad |
| Datos y migraciones (TASK-017, 018, 019, 023) | Ingeniero backend con experiencia en Prisma |
| Dominio (TASK-008, 020, 026) | Ingeniero backend con tests de propiedades |
| Frontend (TASK-013, 022, 025, 028) | Ingeniero frontend Next.js con accesibilidad |
| Contenido (TASK-009, 021, 024) | Redactor técnico + revisor profesional (no el agente) |
| Investigación (TASK-027) | Analista con fuentes primarias |
| Legal (TASK-003) | Asesoría legal externa; el agente solo implementa el resultado |

---

## 3. Plantilla de prompt (copiar y completar)

```text
ROL: <rol técnico de la sección 2>

CONTEXTO DEL REPOSITORIO
- Repositorio: anclora-impulso (Next.js 14 + Express + Prisma/PostgreSQL)
- Commit de referencia: 0e0b897 (o el HEAD actual, que debes registrar)
- Rama: development. NO crees ramas. NO hagas commit ni push.
- Lee antes de editar: AGENTS.md, .anclora/AGENT_PROJECT_CONTEXT.md, MEMORY.md.
- Entorno: producción-respaldado. NO ejecutes tests de integración ni migraciones.
- NO leas ni imprimas ficheros .env*.

TAREA
- ID: TASK-XXX
- Título: <título de 12_AGENT_READY_BACKLOG.md>
- Objetivo: <resultado esperado>
- Origen: <AUD-xxx / OPP-xxx>

ALCANCE PERMITIDO
- Archivos permitidos: <lista exacta>
- Fuera de alcance: todo lo demás. NO modifiques funcionalidades fuera del alcance de esta tarea sin autorización explícita de Toni. Si detectas algo fuera de alcance, repórtalo; no lo arregles.

ARCHIVOS RELEVANTES
- <rutas con líneas>

DEPENDENCIAS
- <TASK-XXX ya completadas o pendientes>

PASOS
1. Crear spec en sdd/features/<nombre>/<nombre>-spec-v1.md con criterios de aceptación.
2. Escribir tests que fallan.
3. Implementar el mínimo para pasar.
4. Ejecutar solo los tests afectados (no la suite completa salvo que lo pida Toni).
5. Ejecutar typecheck de la parte tocada.
6. Redactar el informe de cambios.

RESTRICCIONES
- Sin commit ni push.
- Sin migraciones aplicadas.
- Sin secretos en código, logs ni respuestas.
- Sin cambios de límites de IA sin revisión profesional (TASK-010).
- Sin ampliar contenido de salud sin fuente (proveniencia obligatoria).
- Las specs cerradas no se editan.

PRUEBAS REQUERIDAS
- <lista de tests de 12_AGENT_READY_BACKLOG.md>
- Typecheck de la parte tocada.
- Si la tarea toca UI: prueba de accesibilidad básica y comprobación visual (agent-browser) en entorno controlado.

CRITERIOS DE ACEPTACIÓN
- <lista de la tarea>

INFORME DE CAMBIOS (obligatorio al final)
- Commit de referencia y HEAD actual.
- Archivos modificados y motivo de cada uno.
- Tests escritos y resultado real (copiar la salida resumida; nunca inventar).
- Comandos no ejecutados y por qué.
- Riesgos detectados y de regresión.
- Decisiones tomadas y decisiones pendientes para Toni.
- Estado: LISTO PARA VALIDACIÓN DE TONI / BLOQUEADO (motivo).
```

---

## 4. Checklist previo a entregar

- [ ] Rama `development`, sin ramas nuevas, sin commits.
- [ ] Spec creada en `sdd/features/`.
- [ ] Tests escritos primero y ahora en verde.
- [ ] Typecheck de la parte tocada sin errores nuevos.
- [ ] Ningún `.env*` leído ni impreso.
- [ ] Ningún secreto en el diff.
- [ ] Contenido de salud con fuente.
- [ ] Copy público con gate Hermes.
- [ ] Informe de cambios redactado con resultados reales.
- [ ] Ningún cambio fuera de alcance.

---

## 5. Riesgos que el agente debe comunicar siempre

| Riesgo | Señal | Acción |
|---|---|---|
| Migración que altera datos | Cualquier `DROP`, `ALTER` de tipo o `UPDATE` masivo | Parar y consultar a Toni |
| Cambio de sesión | Cambio en `auth.*`, `session.service`, cookies | Tests de auth completos (CI) |
| Dato de salud nuevo | Campo nuevo en `User` o `HealthPlan*` | Revisión de TASK-003 |
| Límite de IA | Cambio en `plan-limits.ts` | Parar; requiere TASK-010 |
| Contenido sin fuente | Texto de salud sin referencia | No publicar; marcar |
| Entorno ambiguo | `DATABASE_URL` no verificable | Parar; no ejecutar |

---

## 6. Qué no debe hacer un agente en este repositorio

- Crear ramas, worktrees o PR para trabajo normal.
- Hacer commit, push o promoción sin instrucción exacta de Toni.
- Leer `.env*` o pegar secretos en el chat.
- Ejecutar `prisma migrate deploy`, `db push` o `migrate reset`.
- Ejecutar integración contra producción.
- Modificar specs cerradas.
- Cambiar límites clínicos o de IA sin revisión.
- Inventar tests, resultados, cobertura o métricas.
- Ampliar alcance "porque ya estaba en el fichero".
