# AOS Adoption Declaration

Declaración de adopción AOS para `anclora-impulso`.

## Metadatos

- Repository Name: anclora-impulso
- Repository Owner: ToniIAPro73
- Adoption Status: Adopted
- AOS Version: v0.2.0
- Adoption Date: 2026-09-16
- Last Reviewed: 2026-10-12
- Governance Level: GL-1

## Propósito del repositorio

`anclora-impulso` forma parte del ecosistema Anclora como aplicación operativa Next.js.

## Fuentes AOS referenciadas

- Constitution: [`../../anclora-governance/constitution/`](../../anclora-governance/constitution/)
- MASTER_DECISIONS: [`../../anclora-governance/knowledge/MASTER_DECISIONS.md`](../../anclora-governance/knowledge/MASTER_DECISIONS.md)
- CURRENT_STATE: [`../../anclora-governance/knowledge/CURRENT_STATE.md`](../../anclora-governance/knowledge/CURRENT_STATE.md)
- SOURCE_OF_TRUTH_REGISTRY: [`../../anclora-governance/knowledge/SOURCE_OF_TRUTH_REGISTRY.md`](../../anclora-governance/knowledge/SOURCE_OF_TRUTH_REGISTRY.md)
- Standards: [`../../anclora-governance/standards/`](../../anclora-governance/standards/)
- Playbooks: [`../../anclora-governance/playbooks/`](../../anclora-governance/playbooks/)
- Templates: [`../../anclora-governance/templates/`](../../anclora-governance/templates/)
- Bóveda (Contratos y Censo): [`../../anclora-vault/00-governance/`](../../anclora-vault/00-governance/)

## Fuentes oficiales locales

| Tipo de conocimiento | Ruta local | Owner | Relación con AOS |
| --- | --- | --- | --- |
| Contexto de agente | [`AGENT_PROJECT_CONTEXT.md`](AGENT_PROJECT_CONTEXT.md) | ToniIAPro73 | Fuente local de bootstrap de agentes (v1.0). |
| Guía de runtime | [`PRODUCTION_RUNTIME.md`](PRODUCTION_RUNTIME.md) | ToniIAPro73 | Contrato operativo local canónico (v1.0). |
| Identidad y reglas | [`../AGENTS.md`](../AGENTS.md) | ToniIAPro73 | Reglas locales subordinadas a AOS. |


## Adopción de Gobernanza QA Proporcional y Economía Adaptativa

- PROPORTIONAL_QA_CONTRACT_ADOPTED=true
- BATCHED_VALIDATION_CONTRACT_ADOPTED=true
- QA_MODE_DEFAULT=AUTO
- QA_OVERRIDE_MODEL_ADOPTED=true
- FAST_MINIMUM_SUFFICIENT_TESTING_ADOPTED=true
- FAST_FULL_SUITE_PROHIBITION_ADOPTED=true
- STOP_WHEN_SUFFICIENT_EVIDENCE_ADOPTED=true

- ADAPTIVE_TOKEN_ECONOMY_CONTRACT_ADOPTED=true
- CAVEMAN_MODE_DEFAULT=AUTO
- CAVEMAN_TASK_LEVEL_REEVALUATION=true
- CAVEMAN_OVERRIDE_MODEL_ADOPTED=true

- WORKSPACE_POLICY_AUTHORITY=ANCLORA_WORKSPACE_AGENT_POLICY.md



## Test-environment exception (limited)

- EXCEPTION_ID=IMPULSO-TEST-DB-2026-10-12
- GRANTED_BY=Toni (explicit instruction, mission of 2026-10-12)
- SCOPE=Integration tests of this repository only. Does NOT change `LOCAL_RUNTIME_MODEL=PRODUCTION_BACKED`, the production database contract, or the production migration path.
- ALLOWED=One ephemeral PostgreSQL 16 container `anclora-impulso-test-postgres` (project `anclora-impulso-test`, volume `anclora_impulso_test_pgdata`, published on `127.0.0.1` only), synthetic data, existing Prisma migrations applied to that database only.
- FORBIDDEN=Reusing other projects' containers/volumes, loading operational env files in tests, any access to production.
- GUARDS=`backend/tests/support/*` (loopback + port + name + live `anclora.test_marker`), default jest config blocks integration tests outside the script or CI.
- OPERATION=`backend/docs/TEST_DATABASE.md`.
- LOCAL_MIGRATIONS=Prisma migrations may be created and applied to `anclora_impulso_test` only (authorized 2026-10-12). Production application is NOT covered.
- OPEN_DISCREPANCY=`PRODUCTION_RUNTIME.md` declares Supabase migrations and Vercel serverless backend; the repository uses Prisma on Neon with an Express server. Decision pending for production; the contract is intentionally not rewritten here.

## Decisión de arquitectura de producción y runner de migraciones (2026-10-12)

- DECISION_ID=IMPULSO-ARCH-RUNNER-2026-10-12
- DECIDED_BY=Toni (ToniIAPro73), instrucción explícita de la misión del 2026-10-12
- ARCHITECTURE=Frontend Next.js en Vercel; backend Express en Render; PostgreSQL gestionado en Neon; migraciones con Prisma Migrate
  (`backend/prisma/migrations/`).
- SUPERSEDES=declaración previa de `PRODUCTION_RUNTIME.md` v2.0 (backend «Vercel Serverless Functions»; `MIGRATION_SYSTEM=Supabase
  PostgreSQL`, `MIGRATION_STRATEGY=SUPABASE_DASHBOARD_OR_CLI`, `MIGRATION_RUNNER=MANUAL_OR_CONSOLE`). Texto previo conservado aquí y en el
  historial Git; la discrepancia figuraba como `OPEN_DISCREPANCY` en la excepción de pruebas (más abajo), que **no** se modifica.
- RUNNER=workflow manual `workflow_dispatch` de GitHub Actions con entorno `production-migrations` (aprobadores requeridos antes de exponer
  el secreto), SHA completo inmutable, concurrencia serializada, permisos mínimos, sin despliegue de aplicación. **Aprobado como diseño;
  no ejecutado.**
- NO_VERIFICADO=configuración local efectiva (`PRODUCTION_BACKED`), existencia y protecciones del entorno de GitHub, secretos, conexión
  directa frente a pooler, conexión del runner, ledger remoto (Q1).
- LIMITES=no autoriza conectar a producción, configurar secretos, migrar, hacer backup, desplegar, promover, `preDeployCommand` en Render ni
  aprobar el release. La excepción `IMPULSO-TEST-DB-2026-10-12` permanece tal como está y no se amplía.
- LOCAL_RUNTIME_MODEL=PRODUCTION_BACKED (sin cambios). Docker PostgreSQL: fallback temporal reportado durante la interrupción de Neon, no el
  modelo vigente.

## Historial de adopción

| Fecha | Versión | Cambio | Owner |
| --- | --- | --- | --- |
| 2026-09-16 | v0.2.0 | Declaración inicial de adopción AOS. | ToniIAPro73 |
| 2026-09-25 | v2.0 | Adopción de política canónica de QA proporcional, cadencia de puertas por lotes (BATCHED) y modelo de overrides explícitos. | ToniIAPro73 |
| 2026-09-25 | v2.1 | Adopción de economía adaptativa (CAVEMAN_MODE=AUTO) y endurecimiento FAST QA (sin suites completas por defecto, mínimo suficiente, detención ante evidencia suficiente). | ToniIAPro73 |
| 2026-10-12 | decisión | Arquitectura de producción Vercel + Render/Express + Neon + Prisma Migrate; runner manual protegido aprobado como diseño, no ejecutado (`IMPULSO-ARCH-RUNNER-2026-10-12`). | ToniIAPro73 |
| 2026-10-12 | ejecución | Migración de producción ejecutada (run #1, P1) y backend desplegado manualmente en `c0333f3`; rama del servicio Render permanece en `development` (`IMPULSO-PRODUCTION-MIGRATION-EXECUTED-2026-10-12`). | ToniIAPro73 |
| 2026-10-12 | decisión | Stage D de A-08-01 en producción con identidad QA, sin crear staging (`IMPULSO-STAGE-D-ON-PRODUCTION-2026-10-12`); procedimiento definido, no ejecutado. | ToniIAPro73 |
| 2026-10-12 | decisión | Verificador automatizado independiente autorizado y diseñado (`IMPULSO-AUTOMATED-MIGRATION-VERIFIER-2026-10-12`): GitHub App custom deployment protection rule (`anclora-impulso-migration-verifier`) para `production-migrations`. Toni mantiene el trigger manual; estado: local implementado, remoto no configurado. | ToniIAPro73 |

## Decisión de verificador automatizado de migraciones (2026-10-12)

- DECISION_ID=IMPULSO-AUTOMATED-MIGRATION-VERIFIER-2026-10-12
- DECIDED_BY=Toni (ToniIAPro73), instrucción explícita del 2026-10-12
- VERIFIER_TYPE=GitHub App Custom Deployment Protection Rule (`anclora-impulso-migration-verifier`)
- ENVIRONMENT_TARGET=production-migrations
- MECHANISM=Regla de protección automática que evalúa deterministamente firma de webhook, ancestría git de SHA, integridad de `_prisma_migrations` (solo lectura) y backup verificado de Neon.
- STATUS=LOCAL_IMPLEMENTED_REMOTE_NOT_CONFIGURED (no desplegado, no configurado en GitHub, no verificado en sandbox).
- AUTONOMIA=Sustituye la revisión rutinaria humana del entorno por una puerta determinista automatizada; no permite omitir gates ni iniciar migraciones sin invocación manual de Toni.


## Decisión P1: verificación del runner con revisores y preflight local (2026-10-12)

- DECISION_ID=IMPULSO-MIGRATION-VERIFICATION-P1-2026-10-12
- DECIDED_BY=Toni (ToniIAPro73), instrucción explícita del 2026-10-12 («elijo P1»)
- MODELO=Entorno `production-migrations` con **revisores requeridos** (la aprobación humana se mantiene) + **preflight local del operador**
  (`scripts/verifier/operator-preflight.ts`, sin red ni BD ni secretos) sobre metadatos exportados a mano (ledger y backup). El resultado
  es evidencia para una autorización humana, nunca una aprobación.
- AFECTA_A=la decisión `IMPULSO-AUTOMATED-MIGRATION-VERIFIER-2026-10-12`: el verificador como GitHub App (regla de protección personalizada)
  queda **diferido (P2)**, no descartado; **no sustituye la revisión humana**. La frase «sustituye la revisión rutinaria humana» de esa
  decisión queda sin efecto mientras P1 sea el modelo vigente.
- MODELO_DE_SHA=SHA único: el commit validado y migrado es el commit sobre el que se despacha el workflow (`github.sha`); no hay input
  `sha`. Manifiesto de release en el propio commit (`scripts/release/release-manifest.json`).
- NO_VERIFICADO=entorno y revisores en GitHub, secreto, runner remoto, backup, ledger remoto. Nada ejecutado.
- LIMITES=no autoriza migrar, desplegar, promover ni crear credenciales de producción.

## Ejecución de la migración de producción y despliegue del backend (2026-10-12)

- DECISION_ID=IMPULSO-PRODUCTION-MIGRATION-EXECUTED-2026-10-12
- EXECUTED_BY=Toni (ToniIAPro73), lanzamiento y aprobación manuales bajo el modelo P1
- RUN=GitHub Actions `Production migrations (manual, protected)` #1, SHA `c0333f3a6e8c7e1a73c9a68c9a24cd5015b3a98d`, rama `development`, entorno `production-migrations` aprobado por Toni
- RESULTADO=Seis migraciones `20261012*` aplicadas con `prisma migrate deploy`; ledger re-leído por Toni (seis filas terminadas, ninguna revertida).
- BACKUP=Rama Neon `backup-pre-migration-20261012` (`br-shy-cloud-agi9o4kv`, 2026-10-12T19:48:08Z, padre `main`); conservada, sin auto-borrado.
- PREFLIGHT=`operator-preflight.ts` READY_FOR_HUMAN_AUTHORIZATION (umbral de antigüedad del backup 60 min, baseline 20); informe sha256 `9b8581cf08febd4ff2192b7940c2fad6dc3cfdfa0539751c8e04286011bfca68`.
- DESPLIEGUE_BACKEND=Render `Anclora-Impulso` desplegado manualmente en `c0333f3` (mecanismo Q2 opción A: rama del servicio cambiada a `development`, Auto-Deploy Off). `main` y Vercel no se tocaron. Decisión de Toni: el servicio permanece en `development`.
- VERIFICACION_FUNCIONAL=Toni: usuario QA OK, admin 200, usuario normal 403. Cobertura limitada a esos tres casos.
- BASELINE_LEGADO=8 filas sin terminar con `rolled_back_at` y checksums de variante CRLF en 9 migraciones: aceptadas por el evaluador (commit c0333f3) y reportadas; el ledger no se modifica a mano.
- NO_CAMBIA=gates G1–G4, revisiones profesional, de seguridad, legal y Hermes siguen sin aceptarse; no autoriza promoción a staging/main. `.anclora/global` fue un enlace simbólico roto, eliminado por Toni en `bc29075`.

## Decisión de Stage D en producción con identidad QA (2026-10-12)

- DECISION_ID=IMPULSO-STAGE-D-ON-PRODUCTION-2026-10-12
- DECIDED_BY=Toni (ToniIAPro73), mensaje del 2026-10-12 (opción C del plan `30-staging-plan-stage-d-v1.md`)
- DECISION=Las comprobaciones de Stage D de A-08-01 (D1–D7) se ejecutan sobre el entorno de producción con la identidad QA dedicada
  (`qa.impulso@anclora.local`). **No se crea** staging, ni proyecto Neon, ni servicio Render nuevos.
- EXCEPCION_DE_CONTRATO=Ninguna: no se crea ninguna BD de desarrollo/preview/staging, por lo que no hay excepción a
  `DO_NOT_CREATE_DEVELOPMENT_DATABASE`. La excepción `IMPULSO-STAGING-2026-10-12` que se planteó para la opción A **no se registra**
  (quedaría sin objeto); puede registrarse más adelante si Toni elige crear staging.
- REGLAS=Solo identidad QA; sin datos personales reales; ráfagas de 5–10 peticiones; ventana acotada y registrada; sin cambiar
  configuración de producción; parada ante 5xx inesperado; evidencia con manifiesto; el uso de IA consume coste real (`30-…` §11.2).
- ENTRADAS=Producción usa pooler (declarado por Toni, no verificado por el agente). Backend Render en plan Free, una instancia (observado en captura de Toni, 2026-10-12): D5/D6 no aplican a la topología actual.
- ESTADO=Procedimiento definido, **no ejecutado**. Las sondas HTTP de Stage D aún no existen.
- LIMITES=No acepta AI-08 ni ningún gate. No sustituye la revisión independiente. No autoriza promoción.
