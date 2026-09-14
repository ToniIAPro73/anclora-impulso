# P5 — Progress, nutrition & fitness loop

**Status:** MISSING
**Drivers:** UX-06, UX-07; Ruta Vital cross-surface contract.
**Depends on:** P1 NBA/pillars; existing Progress/Nutrition/Gamification APIs.

## Microphase contract

| ID | Objective | Current → target | Scope | Out of scope | Dependencies | Risk | Gate |
|---|---|---|---|---|---|---|---|
| P5-M00 | period/context | isolated KPI → interpretable period | labels/date range | metric redesign | P1 | misleading comparison | G6 |
| P5-M01 | low-data semantics | zero reads failure → honest insufficiency | empty/low-data states | fabricated baselines | M00 | false optimism | G6/G18 |
| P5-M02 | confidence/sufficiency | no context → confidence text | source/coverage metadata | clinical confidence | M00–M01 | numeric pseudo-certainty | G20 |
| P5-M03 | progress next action | chart → decision | action recommendation | diagnosis | M00–M02 | generic CTA | G5/G6 |
| P5-M04 | nutrition next action | parallel dashboard → useful link | logging/meal-plan CTA | nutrition engine rewrite | P1-M12 | overload | G22 |
| P5-M05 | gamification feedback | XP display → continuity feedback | milestones/streak context | weight/deficit rewards | P1-M13 | pressure | G19/G22 |
| P5-M06 | orchestration | peer routes → weekly loop | NBA resolver/read model | forced fusion | M03–M05 | coupling | G21/G22 |
| P5-M07 | longitudinal safe states | isolated dates → trend-safe | missed/return states | clinical outcomes | M00–M06 | overinterpretation | G18/G20 |
| P5-M08 | tests/gate | readonly narratives → tested loop | fixtures and E2E | real longitudinal claims | M00–M07 | shallow proof | G11–G13 |

## Tasks

| Task | `.01` implementation | `.02` tests/evidence | `.03` documentation |
|---|---|---|---|
| P5-M00-T01 | period/context adapter | period boundary tests | metric dictionary |
| P5-M01-T01 | low-data components | zero/partial tests | state copy |
| P5-M02-T01 | confidence/read model | source sufficiency tests | confidence contract |
| P5-M03-T01 | progress action | next-action tests | recommendation rules |
| P5-M04-T01 | nutrition action links | route/return tests | integration contract |
| P5-M05-T01 | safe XP feedback | forbidden reward tests | motivation policy |
| P5-M06-T01 | weekly orchestration | HP-J06/J07/J10/J11 | loop map |
| P5-M07-T01 | interruption/trend states | longitudinal fixture tests | safe-state runbook |
| P5-M08-T01 | full regression | progress/nutrition/gamification E2E | P5 gate dossier |

## Acceptance

GIVEN no history, WHEN Progress opens, THEN zeros are labeled as missing/insufficient data with period and one useful next action; AND no historical trend is fabricated. GIVEN an active week, WHEN workout/nutrition/progress/gamification states are combined, THEN Ruta Vital exposes at most one primary NBA with a reason and deep link; AND modules remain independently usable. XP never rewards weight loss, extreme deficit or overtraining.

**Rollback:** disable orchestration read model; existing module pages continue.
**DO_NOT_BREAK:** honest low-data behavior, nutrition logs/meal plans, progress APIs, XP/achievement semantics and user control.

## Microtask registry

Concrete IDs for execution and evidence tracking:

| Task | Microtasks |
|---|---|
| P5-M00-T01 | P5-M00-T01.01 contract/implementation · P5-M00-T01.02 tests/evidence · P5-M00-T01.03 docs/gate |
| P5-M01-T01 | P5-M01-T01.01 contract/implementation · P5-M01-T01.02 tests/evidence · P5-M01-T01.03 docs/gate |
| P5-M02-T01 | P5-M02-T01.01 contract/implementation · P5-M02-T01.02 tests/evidence · P5-M02-T01.03 docs/gate |
| P5-M03-T01 | P5-M03-T01.01 contract/implementation · P5-M03-T01.02 tests/evidence · P5-M03-T01.03 docs/gate |
| P5-M04-T01 | P5-M04-T01.01 contract/implementation · P5-M04-T01.02 tests/evidence · P5-M04-T01.03 docs/gate |
| P5-M05-T01 | P5-M05-T01.01 contract/implementation · P5-M05-T01.02 tests/evidence · P5-M05-T01.03 docs/gate |
| P5-M06-T01 | P5-M06-T01.01 contract/implementation · P5-M06-T01.02 tests/evidence · P5-M06-T01.03 docs/gate |
| P5-M07-T01 | P5-M07-T01.01 contract/implementation · P5-M07-T01.02 tests/evidence · P5-M07-T01.03 docs/gate |
| P5-M08-T01 | P5-M08-T01.01 contract/implementation · P5-M08-T01.02 tests/evidence · P5-M08-T01.03 docs/gate |
