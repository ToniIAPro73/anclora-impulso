# 27 — Procedimiento P1: preflight local del operador y workflow de SHA único (v1, 2026-10-12)

> **PROCEDIMIENTO PROPUESTO — NO EJECUTADO. RELEASE NO AUTORIZADO.** Implementa la elección **P1** de Toni (`IMPULSO-MIGRATION-VERIFICATION-P1-2026-10-12`).
> Nada de lo que sigue conecta a producción desde esta sesión. Los comandos con `<…>` son plantillas: **no pegar secretos en este
> documento ni en el chat**. Ninguna tarea AI-xx, revisión ni gate G1–G4 cambia de estado.

## 1. Qué cambió respecto del diseño anterior (todo local, sin commitear)

| Hallazgo | Corrección implementada | Prueba local |
|---|---|---|
| H2 SHA evaluado ≠ migrado | workflow **sin input `sha`**: se valida y migra `github.sha`; `expected_last_migration` sustituido por manifiesto en el commit | `scripts/support/test-production-migrations-workflow.sh` (26/26) |
| H4 ledger vacío | `evaluatePrismaLedger` falla con ledger vacío o por debajo de la línea base requerida | `scripts/verifier/run-verifier-tests.ts` (24/24) y `run-preflight-tests.ts` (19/19) |
| H8 umbral de backup con default | `evaluateBackupMetadata` falla si no se configura el umbral (sin valor por defecto) | idem |
| Validación testeada por copia | el workflow ejecuta **scripts versionados** (`scripts/release/*`), los mismos que prueban los tests; el validador se lee de la **rama por defecto**, no del candidato | suite 4 con repos sintéticos; rechazos verificados por mensaje |
| H3 / H1 / H5 / H6 / H7 | **diferidos a P2** (GitHub App). H7 resuelto por P1: los revisores requeridos se mantienen | — |

Archivos nuevos: `scripts/release/{validate-candidate.sh,verify-release-manifest.mjs,generate-release-manifest.mjs,mask-and-check-db-url.mjs,release-manifest.json}`,
`scripts/verifier/{preflight.ts,operator-preflight.ts,run-preflight-tests.ts}`. Modificados: el workflow, `ledger-evaluator.ts`,
`backup-evaluator.ts`, las pruebas, `AOS_ADOPTION.md` (añadida decisión P1, sin editar el texto anterior).

## 2. Qué NO resuelve P1 (límites declarados)

- El **YAML del workflow** que ejecuta GitHub es el del ref despachado: P1 no fija su hash (H3). La barrera es: revisores requeridos que ven el
  commit en la ejecución, validador leído de la rama por defecto y exigencia de que `.github/workflows/production-migrations.yml` y
  `scripts/release/` del candidato sean idénticos a los de la rama por defecto (si el validador no se ejecuta, no hay migración).
- Las atestaciones `ledger_reviewed` / `backup_confirmed` y el hash del informe son **declaraciones humanas**: el workflow no lee el ledger
  ni verifica el backup. La evidencia es el informe local del operador, cuyo origen la herramienta **no autentica**.
- Un snapshot `ready` no prueba que se pueda restaurar.
- Requiere un entorno `production-migrations` con revisores (aún inexistente) y un secreto directo (no pooler) sin crear.

## 3. Secuencia para la futura migración (propuesta)

| # | Paso | Responsable | Comando / acción (PROPUESTO — NO EJECUTADO) | Parada si |
|---|---|---|---|---|
| 1 | Crear el entorno `production-migrations` con revisores requeridos (y decidir «prevent self-review») | Toni | GitHub → Settings → Environments (manual) | no se puede verificar la protección |
| 2 | Guardar `PRODUCTION_MIGRATION_DATABASE_URL` solo en ese entorno (conexión **directa**) | Toni/operador | ajuste manual; no por chat | el host contiene `-pooler` |
| 3 | Elegir el commit candidato; regenerar y revisar el manifiesto si hubo migraciones nuevas | agente/ingeniero | `node scripts/release/generate-release-manifest.mjs && git diff scripts/release/release-manifest.json` → commit y PR | diferencias inesperadas |
| 4 | Exportar el ledger (solo lectura, **tres campos autorizados en Q1**) | operador | `psql "<NO PEGAR SECRETOS>" -At -c "select coalesce(json_agg(json_build_object('migration_name',migration_name,'checksum',checksum,'finished_at',finished_at) order by migration_name),'[]') from public._prisma_migrations" > ledger.json` | la consulta devuelve más campos o filas de otras tablas |
| 5 | Exportar metadatos del backup (id, proyecto, rama origen, fecha, estado) desde la consola/API de Neon | operador | copiar a `backup.json` con el esquema de `operator-preflight.ts` | el backup no está en estado `ready` |
| 6 | Ejecutar el preflight local **desde un checkout limpio del candidato** | operador | `npx tsx scripts/verifier/operator-preflight.ts --ledger ledger.json --backup backup.json --project-id <ID> --source-branch <RAMA> --max-backup-age-minutes <N> --baseline-count 20` | estado `NOT_READY` o código de salida ≠ 0 |
| 7 | Adjuntar informe y `report-sha256` a la autorización de Toni; Toni decide umbral `<N>` (OD-03) y `--baseline-count` | Toni | autorización escrita independiente | falta cualquiera |
| 8 | Despachar el workflow **sobre el ref del candidato**, con las atestaciones y el hash del informe | Toni | GitHub → Actions → *Run workflow* (elegir el ref) | `validate` falla |
| 9 | Aprobar el entorno (revisor) tras comprobar commit, hash del informe y ventana | revisor | aprobación en GitHub | cualquier duda |
| 10 | Verificar el ledger de nuevo; solo entonces desplegar el backend (Q2: auto-deploy de `main` controlado) | operador | lectura del ledger (misma consulta) | checksums o estados distintos |

Notas: (a) `rolled_back_at` no está en el alcance autorizado de Q1; si faltara, una migración revertida suele tener `finished_at` nulo y el
evaluador ya la rechaza; si Toni quiere comprobarlo explícitamente debe ampliar la autorización. (b) `--baseline-count` y
`--max-backup-age-minutes` no tienen valor por defecto a propósito.

## 4. Estado

| Elemento | Estado |
|---|---|
| Workflow de SHA único, validadores, manifiesto, preflight local | **IMPLEMENTADO LOCAL**, probado offline |
| Entorno con revisores, secreto directo | **PENDIENTE** |
| Q1 ledger real, backup, migración 5, `ADMIN_USER_IDS`, Q2 | **PENDIENTE / BLOQUEADO** |
| Verificador como GitHub App (P2) | **DIFERIDO** |
| Ejecución del runner | **NO EJECUTADO** |

**RELEASE NO AUTORIZADO.** Sin commit ni push; sin conexión a BD, Neon, Render ni Vercel.
