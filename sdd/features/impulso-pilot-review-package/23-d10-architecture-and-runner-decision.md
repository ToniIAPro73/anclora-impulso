# 23 — Decisión de arquitectura de producción y runner de migraciones (D10 Q3)

> **Q3 DECIDIDA DOCUMENTALMENTE; RUNNER NO EJECUTADO; RELEASE NO AUTORIZADO.**
> Documento de registro (2026-10-12). No autoriza conectar a producción, configurar secretos, migrar, hacer backup, desplegar, promover,
> añadir un `preDeployCommand` en Render ni aprobar el release. No acepta tareas AI-xx, revisiones ni gates G1–G4.
> Etiquetas: **[DECISIÓN DE TONI]** · **[LOCAL]** observado en el repo · **[GITHUB-READONLY]** metadato remoto de solo lectura (2026-10-12) ·
> **[NO VERIFICADO]**.

## 1. Estado Git observado (solo lectura)

`development` @ `0978402`. Sin commitear: contratos `.anclora/*` (actualizados en esta misión), `.github/workflows/production-migrations.yml`
(nuevo), informes 18–23, `INDEX.md`, `backend/tests/unit/admin-user-ids-parser.test.ts`. `.anclora/global` (symlink rastreado) sigue marcado
como borrado; **no se tocó**. [LOCAL]

## 2. Decisiones de Toni registradas [DECISIÓN DE TONI]

| # | Decisión | Dónde queda declarada |
|---|---|---|
| D1 | Arquitectura de producción: frontend Next.js en Vercel; backend Express en Render; PostgreSQL gestionado en Neon; migraciones con Prisma Migrate (`backend/prisma/migrations/`). La declaración previa (backend «Vercel Serverless Functions», migraciones Supabase `SUPABASE_DASHBOARD_OR_CLI`, `MANUAL_OR_CONSOLE`) queda **obsoleta** | `.anclora/PRODUCTION_RUNTIME.md` v2.1 (§2, §4, §7, §12); `.anclora/AOS_ADOPTION.md` (`IMPULSO-ARCH-RUNNER-2026-10-12`); `.anclora/AGENT_PROJECT_CONTEXT.md` (descripción y routing) |
| D2 | `LOCAL_RUNTIME_MODEL=PRODUCTION_BACKED` se mantiene; el uso de Docker fue un fallback temporal reportado durante la interrupción de Neon, no el modelo vigente | `PRODUCTION_RUNTIME.md` §12; `AOS_ADOPTION.md` |
| D3 | Runner de producción aprobado **como diseño**: workflow manual de GitHub Actions con entorno `production-migrations` protegido | `PRODUCTION_RUNTIME.md` §4 (`MIGRATION_RUNNER=GITHUB_ACTIONS_MANUAL_PROTECTED`, `MIGRATION_RUNNER_STATUS=DESIGN_APPROVED_NOT_EXECUTED_PROTECTIONS_NOT_VERIFIED`) |

La excepción `IMPULSO-TEST-DB-2026-10-12` (BD de pruebas aislada) se conserva **sin cambios y sin ampliar**; su `OPEN_DISCREPANCY` queda
resuelta por la decisión D1 (texto histórico no reescrito).

## 3. Viabilidad (Fase 1)

| Comprobación | Resultado | Procedencia |
|---|---|---|
| Rama por defecto del repositorio | `development` | [GITHUB-READONLY] (`gh repo view`) y `origin/HEAD` [LOCAL] |
| Visibilidad | **PÚBLICO** (propietario de tipo usuario) | [GITHUB-READONLY] |
| Disponibilidad de `workflow_dispatch` | un workflow manual debe existir en la rama por defecto: sería `development`, **no** `main`. No hace falta tocar `main` ni Render para habilitarlo | [LOCAL] + inferencia de reglas de GitHub |
| Efecto de subir el archivo a `development` | dispara CI y un *preview* de Vercel como cualquier push; Render solo sigue `main` (reportado) | [OPERADOR]/[INFERIDO]; **no ejecutado** |
| Entornos existentes | `Preview`, `Production`, `rare-happiness / production`; **`production-migrations` no existe** | [GITHUB-READONLY] |
| Reglas de protección / revisores / secretos | **no verificables** con los permisos de lectura disponibles; no se cambió nada | [NO VERIFICADO] |
| Revisores requeridos en repo público de usuario | disponibles según la documentación de GitHub para repos públicos; **no confirmado en este repo** | [INFERIDO] |
| Comando de migración del repo | `prisma migrate deploy` (`backend/package.json: prisma:deploy`; CI: `pnpm exec prisma migrate deploy` en `backend/`) | [LOCAL] |
| Node/pnpm de CI | Node 22, pnpm 10, `--frozen-lockfile` | [LOCAL] (`ci.yml`) |

Consecuencias de diseño por ser **repo público**: los logs de ejecución son públicos. `prisma migrate deploy` imprime el host y la base del
datasource; el workflow enmascara host, usuario, contraseña y base **antes** de ejecutar Prisma, y rechaza hosts con `-pooler`.

## 4. Workflow preparado (local, sin ejecutar)

`.github/workflows/production-migrations.yml` — **IMPLEMENTADO LOCAL**, no verificado en GitHub, sin subir.

| Requisito de Toni | Cómo se cumple en el YAML |
|---|---|
| Solo `workflow_dispatch` | único trigger; validado con parser YAML (sin `push`, `pull_request`, `schedule`, `workflow_run`) |
| Entorno `production-migrations` | job `migrate` con `environment: production-migrations`; el secreto `PRODUCTION_MIGRATION_DATABASE_URL` solo debe existir en ese entorno (placeholder: no se crea ni se pide) |
| Aprobación antes de exponer secretos | las validaciones corren en un job previo **sin secretos**; los secretos solo llegan al job con entorno, tras la aprobación de revisores — **protección sin verificar** |
| SHA completo inmutable | regex `^[0-9a-f]{40}$`; rechaza ramas, tags y abreviados; `checkout` por SHA; comprueba `HEAD == sha` |
| SHA candidato válido y no atrasado | debe estar contenido en la rama por defecto; no puede faltarle ninguna migración presente en la rama por defecto; la migración más reciente debe ser la declarada en `expected_last_migration`; si algo no se puede listar, **falla cerrado** |
| Comando Prisma real | `pnpm exec prisma migrate deploy` desde `backend/`; sin `migrate dev`, `db push`, `migrate reset`, `migrate resolve` |
| Concurrencia | `group: production-migrations`, `cancel-in-progress: false` |
| Permisos mínimos | `contents: read`; `persist-credentials: false` |
| Sin despliegue | no hay pasos de deploy ni llamadas a Render/Vercel |
| No imprime URL/credencial | máscaras previas; no se imprimen variables |
| Guardas Q1/backup sin falsear verificaciones | `ledger_reviewed` y `backup_confirmed` son **atestaciones humanas** obligatorias (el workflow no lee el ledger ni verifica el backup) más `backup_reference` (identificador sin URL) |
| `timeout-minutes` | 10 (validación) y 20 (migración) |

Límites explícitos del diseño: no hace preflight remoto del ledger (Q1 sigue pendiente), no comprueba checksums remotos, no verifica que
exista un backup real y no puede comprobar desde dentro que el entorno tenga revisores configurados. **Si el entorno no existe o carece de
revisores, el job no debe usarse**; GitHub crea sin protección un entorno inexistente al que un job apunte, por lo que hay que
crearlo y protegerlo **antes** de subir el workflow o de añadir el secreto.

## 5. Matriz de Q3 y gates

| Elemento | Estado |
|---|---|
| Arquitectura de producción en el contrato canónico | **DECIDIDO** [DECISIÓN DE TONI] e **IMPLEMENTADO LOCAL** (contratos editados, sin commitear) |
| Conflicto `ANCLORA_AUTHORITY_CONFLICT` (Supabase vs Prisma/Neon/Render) | **resuelto documentalmente** por D1; el contrato sustituido se conserva en historial |
| Runner como diseño | **DECIDIDO**; workflow **IMPLEMENTADO LOCAL**; **no VERIFICADO**, **no ejecutado** |
| Entorno `production-migrations` con revisores | **PENDIENTE** (no existe según metadatos) |
| Secreto `PRODUCTION_MIGRATION_DATABASE_URL` (directa, no pooler) | **PENDIENTE** (Toni/operador) |
| Q1 ledger completo | **PENDIENTE** (lectura manual supervisada) |
| Backup verificable (Q6) | **PENDIENTE / BLOQUEADO** |
| Conexión directa frente a pooler | **PENDIENTE** (`schema.prisma` no declara `directUrl`) |
| Revisión de la migración 5 / checksum | **PENDIENTE** |
| Q2 mecanismo para no desplegar el backend antes de migrar (`main` ↔ Render auto-deploy) | **BLOQUEADO** |
| `ADMIN_USER_IDS` (Q4) | **PENDIENTE** |
| Revisiones AI-06-AC10, AI-03, AI-08, Hermes, legal; G1–G4 | **PENDIENTES / BLOQUEADOS** |

## 6. Condiciones para poder ejecutar el runner (todas pendientes)

1. Entorno `production-migrations` creado y **verificado** con revisores requeridos; secreto directo y no pooler solo en ese entorno.
2. Q1 revisado manualmente; backup creado y verificado; migración 5 revisada; compatibilidad de conexión directa confirmada.
3. `ADMIN_USER_IDS` fijado y verificación funcional planificada; mecanismo de despliegue controlado del backend (Q2) decidido.
4. Autorización de ejecución **independiente** de Toni, con SHA y ventana. Tras migrar: verificación del ledger y solo entonces despliegue del backend.

## 7. Confirmación

No hubo conexión remota de BD, lectura de secretos, ejecución de workflow, migración, backup, despliegue, promoción, commit ni push. Las
únicas consultas remotas fueron metadatos de GitHub de solo lectura (visibilidad, rama por defecto, lista de entornos). Render y Vercel no
se modificaron. **Q3 DECIDIDA DOCUMENTALMENTE; RUNNER NO EJECUTADO; RELEASE NO AUTORIZADO.**
