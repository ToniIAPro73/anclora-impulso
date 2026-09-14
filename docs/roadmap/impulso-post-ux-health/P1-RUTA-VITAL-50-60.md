# P1 — Ruta Vital 50–60

**Status:** MISSING — first functional phase; implementation not started.
**Depends on:** P0-FINAL-GATE.
**Goal:** deliver a voluntary, persistent, non-clinical Health Plan experience integrated with current Impulso capabilities.

## Phase contract

| Field | Contract |
|---|---|
| Feature flag | `HEALTH_PLANS_ENABLED`, default off until final gate |
| Cohort | `50–60` inclusive; age selects context, not capacity |
| Enrollment | explicit `JOIN`, consent/version captured; no auto-enroll |
| Lifecycle | `DISCOVER → REVIEW → JOIN → ONBOARD → SAFETY_REVIEW → ACTIVE → PAUSE/RESUME/LEAVE` |
| Data | additive definitions + enrollment/status; existing workout/progress/nutrition truth reused |
| Primary workspace | weekly action hub: objective, NBA, progress, minimum version, pillars |
| Safety | fail-closed; no diagnosis, treatment, medical clearance or score |
| Required clients | ES/EN, light/dark, 390×844 through 1920×1080, keyboard/a11y |

## Microphase contract matrix

| ID | Objective | Current state | Target state | Dependencies | Affected areas | Main risk | Gate |
|---|---|---|---|---|---|---|---|
| P1-M00 | domain model | no Health Plan entities | versioned definitions/phases/weeks/actions/pillars/enrollment | P0 | Prisma/backend | duplicate truth | G1–G3 |
| P1-M01 | cohort 50–60 | only `User.age` | inclusive definition with boundaries | M00 | domain/API | age treated as ability | G3/G21 |
| P1-M02 | enrollment/onboarding | existing generic profile dialog | explicit opt-in and short plan profile | M00–M01 | routes/UI/data | sensitive overcollection | G4/G5/G23 |
| P1-M03 | safety screen | no health-plan safety state | categories + fail-closed branches | P0-M04, M02 | API/UI/content | unsafe escalation | G18–G20 |
| P1-M04 | personalization | current workout personalization only | explainable non-clinical profile inputs | M00–M03 | service/API | identical plans | G21 |
| P1-M05 | phase/week/action engine | no weekly plan engine | Foundation/Capacity/Consolidation/Maintenance | M00–M04 | domain/service | arbitrary jumps | G3/G5 |
| P1-M06 | minimum version | no continuity contract | full/minimum version per week | M05 | domain/UI | failure framing | G3/G6 |
| P1-M07 | workspace | dashboard is current hub | Ruta Vital focused weekly workspace | M02–M06 | UI/routes | dashboard duplication | G6–G10 |
| P1-M08 | next-best-action | no cross-module NBA | deterministic explainable NBA | M05–M07 | service/UI | opaque recommendation | G5/G6/G22 |
| P1-M09 | pillar cards | no health pillars | qualitative states and evidence | M05–M08 | UI/read model | pseudo-score | G6/G18 |
| P1-M10 | workouts integration | workout engine exists | deep-link in/out, no fork | M07–M09 | routes/hooks | state loss | G5/G13/G22 |
| P1-M11 | progress integration | progress exists | derived signals and confidence | M07–M09 | service/UI | metric duplication | G5/G6/G22 |
| P1-M12 | nutrition integration | nutrition exists | actions link to existing routes | M07–M09 | service/UI | parallel dashboard | G5/G22 |
| P1-M13 | gamification integration | XP/achievements exist | continuity rewards, no unsafe incentives | M07–M09 | service/UI | pressure/weight reward | G5/G19/G22 |
| P1-M14 | educational content | source PDFs external/unstructured | short linked content with provenance | P0-M03, M07 | content/admin | unsupported claim | G18/G20 |
| P1-M15 | ES/EN | existing context | full namespace parity | M07–M14 | translations/UI | raw/mixed copy | G10 |
| P1-M16 | light/dark | existing theme | private route parity | M07–M15 | tokens/UI | contrast loss | G9 |
| P1-M17 | responsive | existing app responsive gaps | mobile-first weekly action | M07–M16 | UI/CSS | desktop shrink | G8 |
| P1-M18 | accessibility | existing Radix/a11y base | semantic/focus/target/state contract | M07–M17 | UI/tests | color-only status | G7 |
| P1-M19 | tests/E2E | no Health Plan tests | unit/integration/E2E HP journeys | M00–M18 | test suites | shallow assertions | G11/G12/G13 |
| P1-M20 | documentation | no feature docs | API/content/privacy/runbook and release notes | M00–M19 | docs/AOS | undocumented behavior | G14/G15 |

## Tasks and microtasks

Each row has one task with the same ID suffix and three microtasks. This is the minimum executable decomposition; subtasks must not be merged into an untraceable “build feature” item.

| Task | `.01` contract/implementation | `.02` tests/evidence | `.03` docs/gate |
|---|---|---|---|
| P1-M00-T01 | additive Prisma models, repository boundaries, feature flag | schema/migration/ownership tests | data dictionary + rollback |
| P1-M01-T01 | inclusive cohort definition and boundaries | 49/50/59/60/61 tests | cohort decision record |
| P1-M02-T01 | discovery, consent, enrollment, onboarding state | join/pause/leave and validation tests | privacy copy + route map |
| P1-M03-T01 | safety categories and transition service | red-flag fail-closed matrix | approved safety copy |
| P1-M04-T01 | profile input normalization and variation rules | HP50_A–E expected outputs | personalization rationale |
| P1-M05-T01 | phases/weeks/actions and state machine | ordering, dates, idempotency tests | phase catalog |
| P1-M06-T01 | full/minimum version schema and evaluator | minimum completion/adaptation tests | continuity contract |
| P1-M07-T01 | weekly workspace route/components | read model and responsive snapshots | UI contract/evidence |
| P1-M08-T01 | NBA resolver and destination links | deterministic priority tests | decision table |
| P1-M09-T01 | pillar read model/cards | state/confidence/empty tests | content/state catalog |
| P1-M10-T01 | workout deep-link and return refresh | HP-J08/J09 | integration contract |
| P1-M11-T01 | progress adapters and period context | derived-vs-source tests | metric provenance |
| P1-M12-T01 | nutrition action adapters | route/return/empty tests | no-duplicate-engine note |
| P1-M13-T01 | continuity-safe XP/milestone mapping | forbidden reward tests | gamification policy |
| P1-M14-T01 | content registry and short education UI | provenance/disallowed-copy tests | source register |
| P1-M15-T01 | ES/EN namespaces and locale plumbing | missing-key/raw-key scan | translation ownership |
| P1-M16-T01 | token/theme integration | contrast/state snapshots | theme evidence |
| P1-M17-T01 | responsive layout and thumb-first hierarchy | seven viewport matrix | responsive evidence |
| P1-M18-T01 | semantics, focus, live regions and targets | keyboard/axe/manual assertions | accessibility record |
| P1-M19-T01 | full HP unit/integration/E2E suite | HP-J01–HP-J16 with fixtures | test report |
| P1-M20-T01 | runbook, API docs, AOS and release notes | docs/link validation | P1 gate dossier |

## P1 acceptance

GIVEN `HP50_A` or `HP50_B` and a clean authenticated environment, WHEN the user discovers Ruta Vital, chooses JOIN, completes non-clinical onboarding, passes or branches through safety, THEN the app shows a versioned phase, current week, objective, primary actions, minimum version and NBA; AND the user can enter an existing workout/nutrition/progress route, return, and observe persisted state.

GIVEN `HP50_D`, WHEN the safety trigger is submitted, THEN no higher-intensity route is generated; AND the UI explains the boundary and offers professional review guidance plus safe educational continuation where allowed.

GIVEN a user aged 49 or 61, WHEN definitions are listed, THEN the 50–60 definition is not eligible; AND no age causes silent enrollment.

## P1 final gate

Required: G1–G24 as applicable, all HP journeys, migration rollback rehearsal, ES/EN, light/dark, responsive matrix, accessibility, no-diagnosis review, provenance review, privacy review and production-disabled smoke.
**Rollback:** disable flag, revert application commit, keep additive tables, preserve existing source data, restore only Health Plan test fixtures.
**DO_NOT_BREAK:** current dashboard, workout engine/session persistence, progress honesty, nutrition routes, XP rules, auth boundaries and navy/copper identity.

## Microtask registry

Concrete IDs for execution and evidence tracking:

| Task | Microtasks |
|---|---|
| P1-M00-T01 | P1-M00-T01.01 contract/implementation · P1-M00-T01.02 tests/evidence · P1-M00-T01.03 docs/gate |
| P1-M01-T01 | P1-M01-T01.01 contract/implementation · P1-M01-T01.02 tests/evidence · P1-M01-T01.03 docs/gate |
| P1-M02-T01 | P1-M02-T01.01 contract/implementation · P1-M02-T01.02 tests/evidence · P1-M02-T01.03 docs/gate |
| P1-M03-T01 | P1-M03-T01.01 contract/implementation · P1-M03-T01.02 tests/evidence · P1-M03-T01.03 docs/gate |
| P1-M04-T01 | P1-M04-T01.01 contract/implementation · P1-M04-T01.02 tests/evidence · P1-M04-T01.03 docs/gate |
| P1-M05-T01 | P1-M05-T01.01 contract/implementation · P1-M05-T01.02 tests/evidence · P1-M05-T01.03 docs/gate |
| P1-M06-T01 | P1-M06-T01.01 contract/implementation · P1-M06-T01.02 tests/evidence · P1-M06-T01.03 docs/gate |
| P1-M07-T01 | P1-M07-T01.01 contract/implementation · P1-M07-T01.02 tests/evidence · P1-M07-T01.03 docs/gate |
| P1-M08-T01 | P1-M08-T01.01 contract/implementation · P1-M08-T01.02 tests/evidence · P1-M08-T01.03 docs/gate |
| P1-M09-T01 | P1-M09-T01.01 contract/implementation · P1-M09-T01.02 tests/evidence · P1-M09-T01.03 docs/gate |
| P1-M10-T01 | P1-M10-T01.01 contract/implementation · P1-M10-T01.02 tests/evidence · P1-M10-T01.03 docs/gate |
| P1-M11-T01 | P1-M11-T01.01 contract/implementation · P1-M11-T01.02 tests/evidence · P1-M11-T01.03 docs/gate |
| P1-M12-T01 | P1-M12-T01.01 contract/implementation · P1-M12-T01.02 tests/evidence · P1-M12-T01.03 docs/gate |
| P1-M13-T01 | P1-M13-T01.01 contract/implementation · P1-M13-T01.02 tests/evidence · P1-M13-T01.03 docs/gate |
| P1-M14-T01 | P1-M14-T01.01 contract/implementation · P1-M14-T01.02 tests/evidence · P1-M14-T01.03 docs/gate |
| P1-M15-T01 | P1-M15-T01.01 contract/implementation · P1-M15-T01.02 tests/evidence · P1-M15-T01.03 docs/gate |
| P1-M16-T01 | P1-M16-T01.01 contract/implementation · P1-M16-T01.02 tests/evidence · P1-M16-T01.03 docs/gate |
| P1-M17-T01 | P1-M17-T01.01 contract/implementation · P1-M17-T01.02 tests/evidence · P1-M17-T01.03 docs/gate |
| P1-M18-T01 | P1-M18-T01.01 contract/implementation · P1-M18-T01.02 tests/evidence · P1-M18-T01.03 docs/gate |
| P1-M19-T01 | P1-M19-T01.01 contract/implementation · P1-M19-T01.02 tests/evidence · P1-M19-T01.03 docs/gate |
| P1-M20-T01 | P1-M20-T01.01 contract/implementation · P1-M20-T01.02 tests/evidence · P1-M20-T01.03 docs/gate |
