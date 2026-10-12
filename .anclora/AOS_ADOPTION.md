# AOS Adoption Declaration

Declaración de adopción AOS para `anclora-impulso`.

## Metadatos

- Repository Name: anclora-impulso
- Repository Owner: ToniIAPro73
- Adoption Status: Adopted
- AOS Version: v0.2.0
- Adoption Date: 2026-09-16
- Last Reviewed: 2026-09-16
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

## Historial de adopción

| Fecha | Versión | Cambio | Owner |
| --- | --- | --- | --- |
| 2026-09-16 | v0.2.0 | Declaración inicial de adopción AOS. | ToniIAPro73 |
| 2026-09-25 | v2.0 | Adopción de política canónica de QA proporcional, cadencia de puertas por lotes (BATCHED) y modelo de overrides explícitos. | ToniIAPro73 |
| 2026-09-25 | v2.1 | Adopción de economía adaptativa (CAVEMAN_MODE=AUTO) y endurecimiento FAST QA (sin suites completas por defecto, mínimo suficiente, detención ante evidencia suficiente). | ToniIAPro73 |

