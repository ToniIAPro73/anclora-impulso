# Canonical user review and release protocol — workspace policy v2.2
DEVELOPMENT_VALIDATION_REQUIRED=true
CHANGES_REMAIN_UNCOMMITTED_UNTIL_VALIDATED=true
COMMIT_PUSH_REQUIRES_EXPLICIT_USER_VALIDATION=true
AUTO_COMMIT_AFTER_VALIDATION=false
AUTO_PUSH_DEVELOPMENT=false
AUTO_PUSH_WORK_BRANCH=false
PREVIEW_VALIDATION_REQUIRED_BEFORE_PROMOTION=true
PROMOTION_AUTHORIZATION_TOKEN=PROMOTE=FULL
PROMOTION_DISPATCH_FULL_CHAIN_ONCE=true
PROMOTION_REQUIRES_PREVIEW_REVIEWED_SHA=true
PROMOTION_AGENT_WAITS_FOR_SOURCE_CI=false
PROMOTION_WAIT_FOR_WORKFLOW_COMPLETION=false
PROMOTION_AGENT_POLLS_CI_OR_DEPLOYMENT=false
PROMOTION_AGENT_PER_HOP_VERIFICATION=false
PROMOTION_USER_VERIFIES_EACH_BRANCH=true
PROMOTION_DISPATCH_IMMEDIATELY=true
PROMOTION_FORCE_PUSH_ALLOWED=false
PROMOTION_PROTOCOL=Local changes -> explicit Toni validation in development -> commit/push development -> Toni Preview review -> PROMOTE=FULL + exact reviewed SHA -> one asynchronous full-chain workflow

Toni validates every change in the development environment before the agent commits or pushes it. After the push, the agent waits for Toni to review Preview. Only Toni's exact PROMOTE=FULL token authorizes the complete ordered staging -> production -> main chain, using the exact SHA reviewed in Preview. The agent dispatches one full-chain workflow per repository, does not wait for or poll CI/deployment/workflow completion, and does not verify individual target branches. That workflow rejects failed source status and branch divergence, permits pending checks, validates all target branches before writing, and updates all three refs sequentially with fast-forward pushes, and stops if development moved after Preview review. Toni reviews the resulting environments.

# Anclora Impulso — Production Runtime Manifest

PRODUCTION_RUNTIME_MANIFEST_VERSION=2.1
PROMOTION_REPORT=SINGLE_SUMMARY_AT_END
PROMOTION_PARALLEL_ACROSS_REPOS=true
PROMOTION_MULTI_REPO_SCOPE_ALLOWED=true
PROMOTION_STOP_ON_GATE_FAILURE=true
PROMOTION_REQUIRES_PRE_STEP_GATES=true
PROMOTION_MECHANISM=.github/workflows/promote.yml
PROMOTION_FLOW=development->staging->production->main
PROMOTION_SUPPORTED=true
SECRET_COMMIT_FORBIDDEN=true
SECRET_OUTPUT_FORBIDDEN=true
PROMOTION_AUTHORIZATION_CLEAR_ON_UNAUTHORIZED_PROMPT=true
PROMOTION_AUTHORIZATION_CLEAR_ON_NEW_SESSION=true
PROMOTION_AUTHORIZATION_SCOPE=CURRENT_TASK_OR_CONVERSATION
AUTO_PROMOTE=false
TEST_EXECUTION_POLICY=BATCHED
STOP_WHEN_SUFFICIENT_EVIDENCE=true
CAVEMAN_GRANULARITY=TASK
CAVEMAN_MODE_DEFAULT=AUTO
TOKEN_ECONOMY_POLICY=ADAPTIVE
QA_MODE_DEFAULT=AUTO
STOP_AFTER_DEVELOPMENT_PUSH=true
PUSH_TARGET=origin/development
FEATURE_BRANCHES=DISALLOWED
DEFAULT_BRANCH=development
WORKING_BRANCH=development
ANCLORA_FLOW_CONTRACT_VERSION=2.0
ANCLORA_FLOW_VERSION=1
RUNTIME_CONTRACT_AUTHORITY=CANONICAL
STATUS=PRODUCTION_RUNTIME_CONFIRMED
LOCAL_RUNTIME_MODEL=PRODUCTION_BACKED
DO_NOT_CREATE_DEVELOPMENT_DATABASE=true

Runtime, environment, database, migration, QA and Git rules declared in this
manifest override generic agent defaults or home-directory agent policies.

## 1. Application Identity

APPLICATION_NAME=Anclora Impulso
REPOSITORY=anclora-impulso
APPLICATION_TYPE=fullstack
FRAMEWORK=Next.js

## 2. Runtime Topology

FRONTEND_PROVIDER=Vercel
BACKEND_PROVIDER=Render (Express service, rootDir=backend)
PRODUCTION_DOMAIN=anclora-impulso-p08s2sv2w-pmi140979-6354s-projects.vercel.app
PRODUCTION_DEPLOYMENT_PROVIDER=Vercel

```text
Browser / Client
   ↓
Vercel Frontend (Next.js)
   ↓
Render (Express API, backend/)
   ├── Database: Neon/Postgres (Prisma)
   └── External Integrations
```

## 3. Production Database Contract

DATABASE_PROVIDER=Neon/Postgres
DATABASE_SCOPE=production
LOCAL_DATABASE_SCOPE=production

Local development intentionally connects to the Production database.
This is the Anclora operating model.
Do not create or switch to a Development, Preview, Staging, ephemeral,
local or alternate database unless Toni explicitly requests it.

## 4. Database Migration Contract

MIGRATION_SYSTEM=Prisma Migrate (PostgreSQL on Neon)
MIGRATION_STRATEGY=VERSIONED_PRISMA_MIGRATIONS
MIGRATION_DIRECTORY=backend/prisma/migrations
MIGRATION_RUNNER=GITHUB_ACTIONS_MANUAL_AUTOMATED_RULE_PROTECTED
MIGRATION_RUNNER_STATUS=EXECUTED_ONCE_2026-10-12_P1_MODEL (run #1, commit c0333f3a6e8c7e1a73c9a68c9a24cd5015b3a98d; see section 12)
MIGRATION_RUNNER_WORKFLOW=.github/workflows/production-migrations.yml
MIGRATIONS_PRECEDE_BACKEND_DEPLOY=true

All schema migrations apply strictly against the designated production database.
Destructive drops or resets are strictly prohibited without authorization.

Runner (approved as DESIGN on 2026-10-12, see section 12; automated verifier authorized on 2026-10-12): a manual `workflow_dispatch` GitHub Actions workflow bound to the
GitHub Environment `production-migrations` (protected by an independent automated custom deployment protection rule via GitHub App `anclora-impulso-migration-verifier`,
evaluating SHA, migration tree, read-only ledger and Neon snapshot; secrets exposed ONLY after rule approval; secret scoped to that environment),
running `prisma migrate deploy` for one full immutable commit SHA, serialized, minimum token permissions, no application deploy.
Toni triggers each run manually. The automated verifier cannot start migrations, execute product code or bypass checks.
Executed once on 2026-10-12 under the P1 model (environment with required reviewers + offline operator preflight; the GitHub App rule is deferred, P2).
Run #1 applied the six `20261012*` migrations at commit `c0333f3a6e8c7e1a73c9a68c9a24cd5015b3a98d`; the ledger was re-verified afterwards (section 12).
Environment, reviewers and secret existed at that run; this contract does not re-verify them for future runs.

Coupling: branch `main` is the production branch of Vercel. The Render service `Anclora-Impulso` has Auto-Deploy Off and, since 2026-10-12,
its configured branch is `development` (decision of Toni; deploys are manual from the dashboard). Moving `main` still deploys the frontend.
Before 2026-10-12 the service followed `main`; confirm the branch setting before relying on either assumption. Migrations MUST be applied and verified BEFORE the backend that
needs them is deployed (see `sdd/features/impulso-pilot-review-package/21-d10-production-migration-runbook-v2.md`).

## 5. Storage Contract

STORAGE_PROVIDER=None
STORAGE_SCOPE=production

Local development utilizes production storage buckets/services according to the production-backed model.

## 6. Authentication Contract

AUTH_PROVIDER=Session / JWT
AUTH_SCOPE=production

## 7. External Services & Integrations

EXTERNAL_SERVICES=Vercel, Render, Neon (Production Database), Email/Notifications

## 8. Environment Files & Loading Order

ENV_FILES=.env.local (mode 0600), .env.production.local (fallback)
All local secret variables point to production services. Never commit .env files containing credentials.

## 9. Local vs Production Model

LOCAL_RUNTIME_MODEL=PRODUCTION_BACKED
DO_NOT_CREATE_DEVELOPMENT_DATABASE=true

Runtime, environment, database, migration, QA and Git rules declared in this
manifest override generic agent defaults or home-directory agent policies.

## QA Contract

QA_POLICY=WORKSPACE_PROPORTIONAL
FAST_TARGETED_TESTING_POLICY=MINIMUM_SUFFICIENT_SET
FAST_FULL_TEST_SUITE_ALLOWED=false
FULL_GATES_AFTER_EVERY_EDIT=false
REPEAT_UNCHANGED_SUCCESSFUL_GATES=false
VISUAL_QA_EXECUTION=BY_QA_MODE

QA_MINIMUM_FOR_DATABASE_MIGRATION=FULL
QA_MINIMUM_FOR_AUTH=FULL
QA_MINIMUM_FOR_RELEASE_PROMOTION=FULL


QA_AUTH_MODEL=DEDICATED_USER
QA_IS_DEDICATED=true
QA_IS_REAL_USER=false
REAL_USER_AS_QA_ALLOWED=false
QA_SCOPE=dedicated-user-owned-records
QA_REUSE=true
QA_CREATE_IF_MISSING=true
QA_DELETE_AFTER_TEST=false
QA_CREATION_CONFIRMATION_REQUIRED=false
QA_PERSISTENT_IDENTITY=qa.impulso@anclora.local
QA_DATA_ISOLATION_MODEL=USER_OWNED_RECORDS
QA_WRITE_SCOPE=authenticated QA user records only; never query or mutate another owner's records

For dedicated human QA: Use designated production test identity. Never use Toni's personal account or operational admins as QA accounts. Never delete test account after testing.

## 11. Git Branch & Operational Policy

PROMOTION_POLICY=Default development-only operation; no automatic promotion. Explicit current-task user authorization permits only the repository-supported governed promotion path, subject to all gates.

## 12. Decision History

| Date | Decision | Owner | Scope / limits |
| --- | --- | --- | --- |
| 2026-10-12 | Production architecture declared as Next.js on Vercel + Express on Render + PostgreSQL on Neon + Prisma Migrate (`backend/prisma/migrations`). The earlier declaration (v2.0: backend on Vercel Serverless Functions; `MIGRATION_SYSTEM=Supabase PostgreSQL`, `SUPABASE_DASHBOARD_OR_CLI`, `MANUAL_OR_CONSOLE`) is OBSOLETE; its text is preserved in `AOS_ADOPTION.md` (decision `IMPULSO-ARCH-RUNNER-2026-10-12`) and in Git history. Motive: the contract contradicted the implemented and deployed system. | Toni (ToniIAPro73) | Documentary decision. Does not verify the effective local configuration, the production ledger, secrets, GitHub Environment protections or connectivity. `LOCAL_RUNTIME_MODEL=PRODUCTION_BACKED` is unchanged; Docker PostgreSQL databases used while Neon access was interrupted were a reported temporary fallback, not the current model. |
| 2026-10-12 | Production migration runner approved as DESIGN: manual, protected GitHub Actions workflow (section 4). | Toni (ToniIAPro73) | Not executed. Execution still requires ledger review (Q1), a verified backup, direct-connection compatibility, review of migration 5, a verified GitHub Environment with required reviewers and a separate explicit authorization. |
| 2026-10-12 | Production migration EXECUTED (run #1 of `production-migrations.yml`, P1 model) and backend deployed manually. Migrations `20261012030000`, `030100`, `030200`, `040000`, `050000`, `090000` applied by `prisma migrate deploy` at `c0333f3a6e8c7e1a73c9a68c9a24cd5015b3a98d`; ledger re-read by Toni: six rows finished, none rolled back. Render service deployed manually at the same commit (Q2 option A: service branch switched to `development`, Auto-Deploy Off, `main` not moved, Vercel untouched). Backup: Neon branch `backup-pre-migration-20261012` (`br-shy-cloud-agi9o4kv`, 2026-10-12T19:48:08Z, parent `main`), kept; deletion only by Toni. | Toni (ToniIAPro73) | Functional check by Toni: QA user OK, admin 200, normal user 403. Does NOT accept gates G1–G4, professional/security/legal/Hermes reviews, nor authorize promotion to `staging`/`main`. Legacy baseline anomalies (8 rolled-back rows, CRLF-variant checksums) accepted by the evaluator and reported, never edited in the ledger. |
| 2026-10-13 | Variable de entorno `FRONTEND_PREVIEW_HOST_SUFFIXES=-pmi140979-6354s-projects.vercel.app` creada en el servicio Render `Anclora-Impulso` y despliegue manual de `5a5b05d`; ramas `staging` y `production` promocionadas a `5a5b05d` por `promote.yml` (avance rápido). `main` sin tocar. | Toni (ToniIAPro73) | Configuración de CORS del backend (B1-F1): permite previews del equipo de Vercel con prefijo del proyecto. No acepta gates ni autoriza promoción a `main`. Evidencia: `sdd/features/impulso-pilot-review-package/44-production-branch-preview-verification-v1.md`. |
| 2026-10-13 | **Promoción `production → main` ejecutada** por `promote.yml` (run `38340063885`, avance rápido): `main` pasa de `77f852a` a `7226c5a`; despliegue de **Production** de Vercel en `success`. Frontend en `impulso.anclora.com` y `anclora-impulso.vercel.app` con la copy y la CSP P0/P1 de la sesión. | Toni (ToniIAPro73), orden expresa | Acción sobre producción. Previamente: matriz H4 y gates G1–G4 aceptados por el propietario sin revisiones independientes (`IMPULSO-OWNER-ACCEPTANCE-H4-G1G4-2026-10-13`). Backend sin cambios (Render `5a5b05d`, funcionalmente `0606586`). Verificación: `44-…` §7. |
| 2026-10-12 | Independent automated verifier authorized and designed (`IMPULSO-AUTOMATED-MIGRATION-VERIFIER-2026-10-12`): GitHub App custom deployment protection rule (`anclora-impulso-migration-verifier`) on Environment `production-migrations`. | Toni (ToniIAPro73) | Implemented locally, remote not configured. Replaces routine human reviewer in environment with automated gate. Toni still triggers manually via `workflow_dispatch`. Does not execute migrations or bypass gates. Status: NOT DEPLOYED / NOT CONFIGURED / NOT VERIFIED. |

<!-- ANCLORA-MODS:START -->
ANCLORA_MODS_COMMON_CONTRACT_VERSION=1.0.0
Canonical shared rules: [Anclora Common Agent Contract](../anclora-mods/contracts/ANCLORA_COMMON_AGENT_CONTRACT_V1.md) and [Flow Amendment v2](../anclora-mods/ANCLORA_FLUJO_UNICO_V2.md). Repository-specific facts remain in this repository's `.anclora/` contracts.
<!-- ANCLORA-MODS:END -->
