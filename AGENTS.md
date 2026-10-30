
> [!IMPORTANT]
> This repository is governed by the Anclora canonical contracts under `.anclora/`.
> Agent-specific defaults, personal presets, or global agent configurations must NOT override those contracts.
> Read `.anclora/AGENT_PROJECT_CONTEXT.md` before starting substantial work.


<!-- ANCLORA-ECOSYSTEM-CONTEXT-START -->
## Contexto de ecosistema Anclora

Antes de modificar este repositorio, todo agente debe leer:

- `.anclora/AGENT_PROJECT_CONTEXT.md`
- `MEMORY.md`

La arquitectura estable del ecosistema se define en:

`anclora-vault/00-governance/contracts/core/ANCLORA_ECOSYSTEM_ARCHITECTURE_CONTRACT.md` (renombrado desde `Boveda-Anclora`)

No asumir infraestructura compartida entre productos. Validar siempre hosting, backend, base de datos, auth, variables y ramas.
<!-- ANCLORA-ECOSYSTEM-CONTEXT-END -->

<!-- ANCLORA-SDD-STANDARDS-START -->
## Metodología SDD — Estándar Unificado Anclora

Todo desarrollo en este repo sigue la metodología SDD unificada del ecosistema Anclora.

**Referencia canónica**: `agency-agents/docs/guides/SDD_INTEGRATION_GUIDE.md`
**Workflow OpenSpec**: `agency-agents/docs/guides/OPENSPEC_WORKFLOW.md`

### Flujo de trabajo Git

- Rama de trabajo normal: **`development`**; trabajar directamente en la rama existente.
- No crear ramas `feat/*`, `fix/*`, `chore/*`, worktrees ni PR para el trabajo normal, salvo instrucción explícita actual de Toni.
- Al iniciar, comprobar rama y estado. Si hay una rama distinta con cambios sin commit o commits propios, conservarla y detenerse antes de editar; informar y esperar indicaciones. Si está limpia y no tiene commits propios, cambiar a la rama existente `development`; nunca crearla como alternativa.
- Mantener los cambios sin commit hasta que Toni los valide en el entorno de desarrollo. Después, hacer un commit y push a `origin/development` según el contrato del workspace.
- Promoción manual: solo tras la revisión de Preview y la instrucción exacta `PROMOTE=FULL`, mediante `development → staging → production → main`.
- Nunca commitear directamente en `main`, `staging` ni `production`.

### Principios de desarrollo (Specboot)

1. **Small Tasks, One at a Time** — baby steps, nunca saltarse pasos
2. **Test-Driven Development** — escribir tests fallidos antes de implementar
3. **Type Safety** — código completamente tipado (TypeScript)
4. **Clear Naming** — variables y funciones descriptivas
5. **English Only** — código, comentarios y docs técnicos en inglés
6. **90% Test Coverage** — cobertura exhaustiva en todas las capas
7. **Incremental Changes** — modificaciones focalizadas y revisables

### Ciclo de cambios (SDD en este repo)

Toda feature o fix sigue este flujo antes de escribir código:

- Crear spec: `sdd/features/<nombre>/<nombre>-spec-v1.md`
- Crear plan: `sdd/features/<nombre>/<nombre>-plan-v1.md` (cambios complejos)
- Crear tasks: `sdd/features/<nombre>/<nombre>-tasks-v1.md`
- Implementar tarea a tarea (tests primero)
- Validar contra criterios de aceptación de la spec
- Con la spec validada, presentar los cambios en el entorno `development` y esperar la validación expresa de Toni antes del commit/push; no crear un PR para el flujo normal.

### Reglas obligatorias

- **No spec, no code**: toda feature empieza con spec en `sdd/features/`
- **Tests primero**: el agente ejecuta los tests, nunca el usuario
- **Hermes gate**: cambio que afecta copy público → Hermes Copy Curator antes del merge
- **Spec inmutable**: una spec cerrada no se edita; los cambios generan una spec nueva
<!-- ANCLORA-SDD-STANDARDS-END -->

<!-- ANCLORA-IMPULSO-PROMPT-MAESTRO-START -->
## Anclora Impulso — contexto operativo del Prompt Maestro

Rol del agente: actuar como ingeniero full-stack senior y arquitecto de producto para evolucionar Anclora Impulso como SaaS fitness con IA, priorizando funcionalidad estable, testeada y desplegable.

### Stack del producto

| Capa | Tecnología |
|---|---|
| Frontend | Next.js 14, React 18, TypeScript, Tailwind CSS 4 |
| Estado servidor | TanStack React Query |
| Validación | Zod |
| UI | Radix UI + shadcn/ui |
| Backend | Express + TypeScript |
| ORM / BD | Prisma + PostgreSQL |
| Auth | JWT |
| API docs | Swagger / OpenAPI |
| Tests | Jest + RTL frontend; Jest + Supertest backend |

Frontend y backend son servicios separados. Toda funcionalidad con datos debe exponerse como endpoint validado con Zod y consumirse desde frontend via React Query.

### Reglas operativas del Prompt Maestro

- Verificar el código real antes de asumir implementación.
- No fabricar resultados de tests, cobertura o build.
- Usar feature flags para dependencias externas o funcionalidad no lista al 100%.
- No hardcodear secretos; usar variables de entorno y mantener ejemplos sin credenciales reales.
- Usar migraciones Prisma versionadas para cambios de esquema.
- Mantener accesibilidad correcta en UI Radix/shadcn.
- Controlar coste LLM con límites, caché y rate limiting cuando aplique.

### Definición de hecho por fase

- Requisitos funcionales implementados.
- Endpoints documentados y validados con Zod cuando haya API nueva.
- Migraciones Prisma creadas y aplicadas cuando haya cambios de datos.
- Tests nuevos en verde.
- Suite relevante sin regresiones.
- Build de producción sin errores de tipos.
- Sin secretos hardcodeados y `.env.example` actualizado.
- Feature flags configuradas donde correspondan.
- Resumen de tarea generado.

### Resolución de conflicto Git

El Prompt Maestro original pide trabajar sobre `master`; las reglas activas de este repo exigen `development` y PR. En este repositorio prevalece `development`.
<!-- ANCLORA-IMPULSO-PROMPT-MAESTRO-END -->

<!-- ANCLORA-AOS:START -->
## AOS bootstrap

This repository follows AOS (`AUTHORITY=anclora-governance`). Resolve canonical Governance ([AOS Adoption Standard](../anclora-governance/standards/AOS_ADOPTION_STANDARD.md)) and this repository's runtime contract `.anclora/PRODUCTION_RUNTIME.md`. Use `.anclora/AGENT_PROJECT_CONTEXT.md` as the minimal task router and `.anclora/AOS_ADOPTION.md` for adoption and exceptions, loading each only as the task requires. Do not assume generic defaults when a contract exists.
<!-- ANCLORA-AOS:END -->
