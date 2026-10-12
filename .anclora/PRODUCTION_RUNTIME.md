# Anclora Impulso — Production Runtime Manifest

PRODUCTION_RUNTIME_MANIFEST_VERSION=2.1
RUNTIME_CONTRACT_AUTHORITY=CANONICAL
STATUS=PRODUCTION_RUNTIME_CONFIRMED
LOCAL_RUNTIME_MODEL=PRODUCTION_BACKED
DO_NOT_CREATE_DEVELOPMENT_DATABASE=true

Runtime, environment, database, migration, QA and Git rules declared in this
manifest override generic agent defaults or home-directory agent policies.

## 1. Application Identity

APPLICATION_NAME=Anclora Impulso
REPOSITORY=anclora-impulso
APPLICATION_TYPE=fullstack_or_application
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
MIGRATION_RUNNER_STATUS=DESIGN_APPROVED_LOCAL_IMPLEMENTED_REMOTE_NOT_CONFIGURED
MIGRATION_RUNNER_WORKFLOW=.github/workflows/production-migrations.yml
MIGRATIONS_PRECEDE_BACKEND_DEPLOY=true

All schema migrations apply strictly against the designated production database.
Destructive drops or resets are strictly prohibited without authorization.

Runner (approved as DESIGN on 2026-10-12, see section 12; automated verifier authorized on 2026-10-12): a manual `workflow_dispatch` GitHub Actions workflow bound to the
GitHub Environment `production-migrations` (protected by an independent automated custom deployment protection rule via GitHub App `anclora-impulso-migration-verifier`,
evaluating SHA, migration tree, read-only ledger and Neon snapshot; secrets exposed ONLY after rule approval; secret scoped to that environment),
running `prisma migrate deploy` for one full immutable commit SHA, serialized, minimum token permissions, no application deploy.
Toni triggers each run manually. The automated verifier cannot start migrations, execute product code or bypass checks.
Not executed. The environment, protection rule, GitHub App and secret are NOT verified by this contract (status: LOCAL IMPLEMENTED / REMOTE NOT CONFIGURED).

Coupling: branch `main` is the production branch of Vercel and is followed by the Render service (auto-deploy reported).
A move of `main` can therefore deploy frontend and backend. Migrations MUST be applied and verified BEFORE the backend that
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
QA_MODE_DEFAULT=AUTO
FAST_TARGETED_TESTING_POLICY=MINIMUM_SUFFICIENT_SET
FAST_FULL_TEST_SUITE_ALLOWED=false
STOP_WHEN_SUFFICIENT_EVIDENCE=true
TEST_EXECUTION_POLICY=BATCHED
FULL_GATES_AFTER_EVERY_EDIT=false
REPEAT_UNCHANGED_SUCCESSFUL_GATES=false
VISUAL_QA_EXECUTION=BY_QA_MODE

TOKEN_ECONOMY_POLICY=ADAPTIVE
CAVEMAN_MODE_DEFAULT=AUTO
CAVEMAN_GRANULARITY=TASK
QA_MINIMUM_FOR_DATABASE_MIGRATION=FULL
QA_MINIMUM_FOR_AUTH=FULL
QA_MINIMUM_FOR_RELEASE_PROMOTION=FULL


QA_AUTH_MODEL=DEDICATED_USER
QA_IS_DEDICATED=true
QA_IS_REAL_USER=false
REAL_USER_AS_QA_ALLOWED=false
QA_SCOPE=production
QA_REUSE=true
QA_CREATE_IF_MISSING=true
QA_DELETE_AFTER_TEST=false
QA_CREATION_CONFIRMATION_REQUIRED=false
QA_PERSISTENT_IDENTITY=qa.impulso@anclora.local

For dedicated human QA: Use designated production test identity. Never use Toni's personal account or operational admins as QA accounts. Never delete test account after testing.

## 11. Git Branch & Operational Policy

DEFAULT_BRANCH=development
PROMOTION_POLICY=Default development-only operation; no automatic promotion. Explicit current-task user authorization permits only the repository-supported governed promotion path, subject to all gates.

## 12. Decision History

| Date | Decision | Owner | Scope / limits |
| --- | --- | --- | --- |
| 2026-10-12 | Production architecture declared as Next.js on Vercel + Express on Render + PostgreSQL on Neon + Prisma Migrate (`backend/prisma/migrations`). The earlier declaration (v2.0: backend on Vercel Serverless Functions; `MIGRATION_SYSTEM=Supabase PostgreSQL`, `SUPABASE_DASHBOARD_OR_CLI`, `MANUAL_OR_CONSOLE`) is OBSOLETE; its text is preserved in `AOS_ADOPTION.md` (decision `IMPULSO-ARCH-RUNNER-2026-10-12`) and in Git history. Motive: the contract contradicted the implemented and deployed system. | Toni (ToniIAPro73) | Documentary decision. Does not verify the effective local configuration, the production ledger, secrets, GitHub Environment protections or connectivity. `LOCAL_RUNTIME_MODEL=PRODUCTION_BACKED` is unchanged; Docker PostgreSQL databases used while Neon access was interrupted were a reported temporary fallback, not the current model. |
| 2026-10-12 | Production migration runner approved as DESIGN: manual, protected GitHub Actions workflow (section 4). | Toni (ToniIAPro73) | Not executed. Execution still requires ledger review (Q1), a verified backup, direct-connection compatibility, review of migration 5, a verified GitHub Environment with required reviewers and a separate explicit authorization. |
| 2026-10-12 | Independent automated verifier authorized and designed (`IMPULSO-AUTOMATED-MIGRATION-VERIFIER-2026-10-12`): GitHub App custom deployment protection rule (`anclora-impulso-migration-verifier`) on Environment `production-migrations`. | Toni (ToniIAPro73) | Implemented locally, remote not configured. Replaces routine human reviewer in environment with automated gate. Toni still triggers manually via `workflow_dispatch`. Does not execute migrations or bypass gates. Status: NOT DEPLOYED / NOT CONFIGURED / NOT VERIFIED. |
