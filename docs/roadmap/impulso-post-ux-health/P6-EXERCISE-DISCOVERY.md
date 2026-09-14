# P6 — Exercise discovery & content quality

**Status:** MISSING
**Driver:** UX-04
**Depends on:** current exercise API and P2 accessible naming.

## Microphase contract

| ID | Objective | Current → target | Scope | Out of scope | Dependencies | Risk | Gate |
|---|---|---|---|---|---|---|---|
| P6-M00 | placeholder strategy | large unavailable media → compact instructional fallback | card media | producing missing media | P0 | visual loss | G6/G9 |
| P6-M01 | metadata hierarchy | image-first → name/muscle/level first | card content | taxonomy redesign | M00 | dense cards | G6 |
| P6-M02 | filter/search density | scan-heavy → discoverable controls | query/filter state | new search provider | M01 | slow queries | G5/G16 |
| P6-M03 | exercise detail | card → actionable detail | instructions, equipment, media state | medical technique claims | M01 | unsafe copy | G18/G20 |
| P6-M04 | naming consistency | mixed labels → localized canonical names | ES/EN content | bulk editorial invention | M01–M03 | broken references | G10 |
| P6-M05 | Ruta Vital links | isolated detail → action destination | workout/action links | duplicate library | P1 | wrong context | G22 |
| P6-M06 | responsive/a11y gate | desktop evidence → matrix | mobile, keyboard, target, contrast | full media audit | M00–M05 | regressions | G7–G10 |

## Tasks

| Task | `.01` implementation | `.02` tests/evidence | `.03` documentation |
|---|---|---|---|
| P6-M00-T01 | fallback component/token | media-missing snapshots | content fallback rule |
| P6-M01-T01 | metadata-first cards | hierarchy queries | card contract |
| P6-M02-T01 | search/filter UX | query/filter tests | route/state map |
| P6-M03-T01 | detail hierarchy | detail/empty/error tests | detail content model |
| P6-M04-T01 | canonical localized naming | ES/EN scans | editorial glossary |
| P6-M05-T01 | plan/library deep links | return-context tests | integration note |
| P6-M06-T01 | responsive/a11y closure | viewport/keyboard/contrast | P6 gate dossier |

## Acceptance

GIVEN an exercise without image, WHEN its card renders, THEN name, target muscle, level and primary action retain priority; AND the fallback does not pretend to be a demonstration. GIVEN a filtered/search result, THEN query state, no-result and retry states are understandable in ES/EN and keyboard accessible.

**Rollback:** restore current card renderer; retain API and content data.
**DO_NOT_BREAK:** 479-exercise-scale discovery if still current, filters, detail route, optional image behavior and ownership boundaries.

## Microtask registry

Concrete IDs for execution and evidence tracking:

| Task | Microtasks |
|---|---|
| P6-M00-T01 | P6-M00-T01.01 contract/implementation · P6-M00-T01.02 tests/evidence · P6-M00-T01.03 docs/gate |
| P6-M01-T01 | P6-M01-T01.01 contract/implementation · P6-M01-T01.02 tests/evidence · P6-M01-T01.03 docs/gate |
| P6-M02-T01 | P6-M02-T01.01 contract/implementation · P6-M02-T01.02 tests/evidence · P6-M02-T01.03 docs/gate |
| P6-M03-T01 | P6-M03-T01.01 contract/implementation · P6-M03-T01.02 tests/evidence · P6-M03-T01.03 docs/gate |
| P6-M04-T01 | P6-M04-T01.01 contract/implementation · P6-M04-T01.02 tests/evidence · P6-M04-T01.03 docs/gate |
| P6-M05-T01 | P6-M05-T01.01 contract/implementation · P6-M05-T01.02 tests/evidence · P6-M05-T01.03 docs/gate |
| P6-M06-T01 | P6-M06-T01.01 contract/implementation · P6-M06-T01.02 tests/evidence · P6-M06-T01.03 docs/gate |
