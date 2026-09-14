# P0 — Baseline, contracts & spec foundation

**Status:** DONE (documentary gate only)
**Depends on:** none
**Output:** authority for implementation; no product behavior changed.

## Objective

Convert the current audit, repository, health sources and test model into executable implementation contracts. Freeze the boundaries before schema or UI work begins.

## Microphase contract

| ID | Objective | Source drivers | Scope | Out of scope | Dependencies | Risks | Gate |
|---|---|---|---|---|---|---|---|
| P0-M00 | record repo/deployment baseline | current branch and audit | Git, routes, env inventory, test commands | deploy changes | none | stale baseline | G0 |
| P0-M01 | reconcile current product truth | current code/tests/audit | capability matrix and ownership | new features | M00 | doc/code drift | G1 |
| P0-M02 | freeze audit traceability | UX-01..UX-11 | finding→phase acceptance map | new findings | M01 | lost driver | G14 |
| P0-M03 | define content/provenance model | two health PDFs | claim taxonomy and review metadata | clinical validation | M01 | unsupported claim | G18 |
| P0-M04 | define safety/privacy contract | health guides + legal copy | fail-closed categories, minimization | diagnosis/treatment | M03 | unsafe escalation | G19/G20/G23 |
| P0-M05 | define test/evidence architecture | existing Jest/RTL/Supertest/E2E | fixtures, IDs, environments, reset | product test implementation | M00–M04 | fake coverage | G11/G12 |

Every microphase uses this mandatory contract: `CURRENT_STATE`, `TARGET_STATE`, `PREREQUISITES`, `AFFECTED_ROUTES`, `AFFECTED_COMPONENTS`, `AFFECTED_API`, `AFFECTED_DATA`, `MIGRATION_IMPACT`, `AFFECTED_TESTS`, `OBSERVABILITY`, `ROLLBACK`, `DOCUMENTATION`.

## Tasks and microtasks

### P0-M00-T01 — Repository preflight

- `.01` record HEAD, remote sync, branch model, frontend/backend hosting, env names without values, current test scripts and deployment workflows.
- `.02` add a machine-readable preflight fixture/log template; assert no credential or token is captured.
- `.03` attach baseline evidence to the phase record and mark unknown hosting/database claims `NEEDS_VERIFICATION`.

**Acceptance:** GIVEN a clean `development` baseline WHEN preflight runs THEN HEAD, remote, worktree, routes, tests and environment names are recorded AND secret values are absent.

### P0-M01-T01 — Product truth matrix

- `.01` map current capability to route, API, schema, UI and status.
- `.02` test that every declared capability has either executable evidence or `UNKNOWN` status.
- `.03` reconcile README/audit/code conflicts in the SPEC.

**Acceptance:** GIVEN current code WHEN the matrix is reviewed THEN no route-only claim is labeled `CONFIRMED` without behavior evidence.

### P0-M02-T01 — Finding traceability

- `.01` map UX-01..UX-11 to phase/microphase/root cause.
- `.02` create acceptance/test IDs for every finding.
- `.03` preserve `DO_NOT_BREAK` and historical links in phase docs.

**Acceptance:** GIVEN any UX finding WHEN an implementer opens the roadmap THEN phase, cause, acceptance, tests, gates and preservation contract are unambiguous.

### P0-M03-T01 — Health content model

- `.01` define `HealthPlanContentReference`, claim types, evidence levels and review lifecycle.
- `.02` add validator test cases for missing source, stale review and disallowed claim type.
- `.03` record source hashes and provenance limitations for both external PDFs.

**Acceptance:** GIVEN a new health copy unit WHEN it enters the content registry THEN source, evidence level, owner, review date, claim type, safety level and locale are required.

### P0-M04-T01 — Safety and privacy contract

- `.01` define `SELF_MANAGED`, `CAUTION`, `PROFESSIONAL_REVIEW_RECOMMENDED`, fail-closed transitions and minimum data allow-list.
- `.02` test red-flag inputs never produce `PROGRESS` intensity escalation; test forbidden medical copy.
- `.03` publish copy and privacy decision record; route unresolved clinical questions to independent review.

**Acceptance:** GIVEN any red-flag signal WHEN adaptation is calculated THEN it cannot return an escalation and it exposes a concise professional-review action.

### P0-M05-T01 — Test/evidence architecture

- `.01` define fixture IDs HP50_A–E and boundary ages 49/50/59/60/61.
- `.02` define E2E journey IDs HP-J01–HP-J16, environment labels, reset policy and evidence schema.
- `.03` define coverage rules: executed ≠ covered; no real users; no destructive writes.

**Acceptance:** GIVEN a test or screenshot WHEN stored THEN fixture, environment, viewport, theme, locale and route are traceable.

## P0 final gate

Required: G0, G1, G3, G11, G14, G15, G18, G19, G20, G23. Evidence: baseline log, product truth matrix, source hashes, content schema, safety contract, fixture registry, traceability map and rollback record.

**Rollback:** documentation commit revert only; no database or product state exists to roll back.
**DO_NOT_BREAK:** current auth/session, existing routes, source precedence, legal boundaries and no-product-code scope.

## Microtask registry

Concrete IDs for execution and evidence tracking:

| Task | Microtasks |
|---|---|
| P0-M00-T01 | P0-M00-T01.01 contract/implementation · P0-M00-T01.02 tests/evidence · P0-M00-T01.03 docs/gate |
| P0-M01-T01 | P0-M01-T01.01 contract/implementation · P0-M01-T01.02 tests/evidence · P0-M01-T01.03 docs/gate |
| P0-M02-T01 | P0-M02-T01.01 contract/implementation · P0-M02-T01.02 tests/evidence · P0-M02-T01.03 docs/gate |
| P0-M03-T01 | P0-M03-T01.01 contract/implementation · P0-M03-T01.02 tests/evidence · P0-M03-T01.03 docs/gate |
| P0-M04-T01 | P0-M04-T01.01 contract/implementation · P0-M04-T01.02 tests/evidence · P0-M04-T01.03 docs/gate |
| P0-M05-T01 | P0-M05-T01.01 contract/implementation · P0-M05-T01.02 tests/evidence · P0-M05-T01.03 docs/gate |
