# P2 — Focused workout experience

**Status:** MISSING
**Drivers:** UX-01, UX-02, UX-03
**Depends on:** P1 interfaces; existing Workout/Session API remains source of truth.

## Microphase contract

| ID | Objective | Current → target | Scope | Out of scope | Dependencies | Risk | Gate |
|---|---|---|---|---|---|---|---|
| P2-M00 | current exercise focus | long ledger → one clear current exercise | layout/state model | new workout engine | P1-M10 | state drift | G5/G6 |
| P2-M01 | compact set navigation | many rows → focused set progression | set selector/summary | changing set semantics | M00 | hidden sets | G5 |
| P2-M02 | next/previous semantics | ambiguous controls → explicit actions | labels/disabled boundaries | navigation redesign elsewhere | M00–M01 | accidental skip | G6/G7 |
| P2-M03 | sticky progress/rest | context lost on scroll → persistent status | timer/progress | background timing claims | M00–M02 | timer drift | G5/G8 |
| P2-M04 | one-handed ergonomics | top-heavy controls → thumb reachable primary action | mobile layout/targets | generic nav replacement | M01–M03 | accidental taps | G7/G8 |
| P2-M05 | safe exit/resume | exit ambiguity → draft/resume intent | session state and confirmation | destructive data deletion | M00–M04 | data loss | G4/G5 |
| P2-M06 | accessible set semantics | repeated unnamed fields → unique names/fieldsets | labels, live regions, keyboard | third-party axe claims alone | M01–M05 | noisy announcements | G7 |
| P2-M07 | Ruta Vital integration | workout isolated → weekly action in/out | deep-link/context return | duplicate plan engine | P1 | broken return | G22 |
| P2-M08 | responsive/theme/i18n | single view → tested matrix | 390/430/1440; light/dark; ES/EN | unsupported locale | M00–M07 | visual regression | G8–G10 |
| P2-M09 | E2E closure | partial execution → full safe fixture path | tests/evidence | real-user writes | M00–M08 | false completion | G11–G13 |

## Tasks

| Task | `.01` implementation | `.02` tests/evidence | `.03` documentation |
|---|---|---|---|
| P2-M00-T01 | current-exercise state/view | visual/state tests | workspace contract |
| P2-M01-T01 | compact set navigation | set-order tests | interaction map |
| P2-M02-T01 | next/previous semantics | boundary/keyboard tests | accessible action copy |
| P2-M03-T01 | sticky progress/rest | timer/progress tests | timing limitations |
| P2-M04-T01 | thumb-first mobile controls | target/viewport evidence | ergonomics record |
| P2-M05-T01 | exit/resume state | interrupted-session tests | rollback/state machine |
| P2-M06-T01 | fieldsets/names/live regions | RTL/AX/manual keyboard | a11y evidence |
| P2-M07-T01 | plan context and return | HP-J08/J09 | integration docs |
| P2-M08-T01 | matrix implementation | theme/locale/viewport tests | screenshots and matrix |
| P2-M09-T01 | full E2E | start/set/pause/resume/complete | P2 gate dossier |

## Acceptance

GIVEN a workout with multiple exercises, WHEN an active user opens execution on 390×844, THEN the current exercise, current set, target, timer/rest state and primary next action are visible without scanning the complete ledger; AND the primary target is reachable with one hand; AND every repeated input has an accessible name including exercise and set.

GIVEN an interrupted draft, WHEN the user returns, THEN the app explains resume state and preserves safe draft data; AND exit does not silently discard it. GIVEN the last set, THEN “next” is disabled or replaced by completion with a reason.

**Rollback:** feature-flag focused workspace; fallback to current execution route without deleting session drafts.
**DO_NOT_BREAK:** existing set values, rest, notes, completion API, keyboard access and Ruta Vital return context.

## Microtask registry

Concrete IDs for execution and evidence tracking:

| Task | Microtasks |
|---|---|
| P2-M00-T01 | P2-M00-T01.01 contract/implementation · P2-M00-T01.02 tests/evidence · P2-M00-T01.03 docs/gate |
| P2-M01-T01 | P2-M01-T01.01 contract/implementation · P2-M01-T01.02 tests/evidence · P2-M01-T01.03 docs/gate |
| P2-M02-T01 | P2-M02-T01.01 contract/implementation · P2-M02-T01.02 tests/evidence · P2-M02-T01.03 docs/gate |
| P2-M03-T01 | P2-M03-T01.01 contract/implementation · P2-M03-T01.02 tests/evidence · P2-M03-T01.03 docs/gate |
| P2-M04-T01 | P2-M04-T01.01 contract/implementation · P2-M04-T01.02 tests/evidence · P2-M04-T01.03 docs/gate |
| P2-M05-T01 | P2-M05-T01.01 contract/implementation · P2-M05-T01.02 tests/evidence · P2-M05-T01.03 docs/gate |
| P2-M06-T01 | P2-M06-T01.01 contract/implementation · P2-M06-T01.02 tests/evidence · P2-M06-T01.03 docs/gate |
| P2-M07-T01 | P2-M07-T01.01 contract/implementation · P2-M07-T01.02 tests/evidence · P2-M07-T01.03 docs/gate |
| P2-M08-T01 | P2-M08-T01.01 contract/implementation · P2-M08-T01.02 tests/evidence · P2-M08-T01.03 docs/gate |
| P2-M09-T01 | P2-M09-T01.01 contract/implementation · P2-M09-T01.02 tests/evidence · P2-M09-T01.03 docs/gate |
