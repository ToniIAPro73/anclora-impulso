# P4 — AI trust, explainability & reversibility

**Status:** MISSING
**Driver:** UX-05
**Depends on:** P0 guardrails; P1 context integration; existing coach/generation services.

## Microphase contract

| ID | Objective | Current → target | Scope | Out of scope | Dependencies | Risk | Gate |
|---|---|---|---|---|---|---|---|
| P4-M00 | input summary | profile rules hidden → explicit inputs used | summary UI/API | collecting new medical data | P0 | over-disclosure | G4/G6 |
| P4-M01 | result rationale | generic rationale → plan-specific rationale | deterministic explanation | clinical explanation | M00 | false causality | G18/G20 |
| P4-M02 | generation state | CTA only → loading/success/error states | pending/idempotency | model replacement | M00–M01 | duplicate jobs | G5/G16 |
| P4-M03 | edit/regenerate | fixed result → controlled variation | editable preferences/regenerate | arbitrary prompt exposure | M01–M02 | unsafe output | G19 |
| P4-M04 | discard/undo | irreversible feeling → reversible proposal state | draft lifecycle | deleting saved history | M02–M03 | lost plan | G5 |
| P4-M05 | error/retry | generic error → human recovery | retry/preserved input | provider SLA | M02 | retry storm | G16 |
| P4-M06 | Ruta Vital context | generic generation → weekly context | plan context payload | new engine | P1 | duplicate logic | G21/G22 |
| P4-M07 | tests/gate | readonly evidence → safe contract | unit/integration/E2E | real production generation | M00–M06 | fake trust | G11–G13 |

## Tasks

| Task | `.01` implementation | `.02` tests/evidence | `.03` documentation |
|---|---|---|---|
| P4-M00-T01 | input summary contract | redaction/ownership tests | input provenance |
| P4-M01-T01 | rationale renderer | deterministic rationale tests | explanation rules |
| P4-M02-T01 | generation state machine | loading/error/idempotency | state catalog |
| P4-M03-T01 | edit/regenerate controls | variation/guardrail tests | control contract |
| P4-M04-T01 | discard/undo draft | restore tests | reversible lifecycle |
| P4-M05-T01 | retry preserving inputs | timeout/retry tests | recovery runbook |
| P4-M06-T01 | weekly context adapter | HP-J05 regression | integration map |
| P4-M07-T01 | full AI verification | safe fixtures and evidence | P4 gate dossier |

## Acceptance

GIVEN a generated proposal, WHEN the user reviews it, THEN inputs used, rationale, limitations and available controls are visible; AND regenerate/edit/discard do not silently mutate the saved workout. GIVEN provider timeout, THEN input is preserved, loading ends, error is localized and retry is explicit. No copy implies diagnosis, treatment, clearance or guaranteed outcome.

**Rollback:** keep current generation path behind flag; discard only uncommitted proposal state.
**DO_NOT_BREAK:** existing AI constraints, rate limits, input validation, user ownership and deterministic safety guardrails.

## Microtask registry

Concrete IDs for execution and evidence tracking:

| Task | Microtasks |
|---|---|
| P4-M00-T01 | P4-M00-T01.01 contract/implementation · P4-M00-T01.02 tests/evidence · P4-M00-T01.03 docs/gate |
| P4-M01-T01 | P4-M01-T01.01 contract/implementation · P4-M01-T01.02 tests/evidence · P4-M01-T01.03 docs/gate |
| P4-M02-T01 | P4-M02-T01.01 contract/implementation · P4-M02-T01.02 tests/evidence · P4-M02-T01.03 docs/gate |
| P4-M03-T01 | P4-M03-T01.01 contract/implementation · P4-M03-T01.02 tests/evidence · P4-M03-T01.03 docs/gate |
| P4-M04-T01 | P4-M04-T01.01 contract/implementation · P4-M04-T01.02 tests/evidence · P4-M04-T01.03 docs/gate |
| P4-M05-T01 | P4-M05-T01.01 contract/implementation · P4-M05-T01.02 tests/evidence · P4-M05-T01.03 docs/gate |
| P4-M06-T01 | P4-M06-T01.01 contract/implementation · P4-M06-T01.02 tests/evidence · P4-M06-T01.03 docs/gate |
| P4-M07-T01 | P4-M07-T01.01 contract/implementation · P4-M07-T01.02 tests/evidence · P4-M07-T01.03 docs/gate |
