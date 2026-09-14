# P7 — Premium coherence, PWA & release hardening

**Status:** NEEDS_HARDENING
**Depends on:** P1–P6 final gates.
**Purpose:** close cross-cutting quality and release risks; no new Health Plan scope.

## Microphase contract

| ID | Objective | Current → target | Scope | Out of scope | Dependencies | Risk | Gate |
|---|---|---|---|---|---|---|---|
| P7-M00 | visual/system consistency | local fixes → shared tokens | spacing, type, controls, states | brand rebrand | P2–P6 | broad regression | G6/G9 |
| P7-M01 | document language | metadata drift → correct lang | HTML/document locale | translation rewrite | P3/P6 | hidden a11y issue | G7/G10 |
| P7-M02 | PWA entry/install | manifest-only → verified entry | manifest/install/start | native app | P3 | wrong route | G8/G13 |
| P7-M03 | offline/recovery | unknown → truthful state | supported offline/sync states | invented offline capability | P1/P3 | stale data | G5/G16 |
| P7-M04 | accessibility deep pass | partial audits → private-route pass | forms/dialogs/charts/timers | certification claim | P2–P6 | false WCAG claim | G7 |
| P7-M05 | performance perception | unmeasured → bounded UX states | loading/layout shift/query behavior | backend rewrite | all | timeout | G16 |
| P7-M06 | analytics/observability | events scattered → safe model | product/health events | surveillance | P1/P5 | sensitive logging | G17/G23 |
| P7-M07 | regression | phase-local → full suite | all routes/fixtures | destructive production tests | all | escaped defect | G11–G13 |
| P7-M08 | docs/manual impact | feature docs only → release-ready | runbooks, AOS, changelog | implementation | all | operational gap | G14/G15/G24 |

## Tasks

| Task | `.01` implementation | `.02` tests/evidence | `.03` documentation |
|---|---|---|---|
| P7-M00-T01 | token/control consistency | visual regression | premium checklist |
| P7-M01-T01 | document language metadata | rendered locale tests | i18n/a11y note |
| P7-M02-T01 | manifest/install contract | real browser smoke | PWA runbook |
| P7-M03-T01 | truthful offline/sync states | network-condition tests | limitation matrix |
| P7-M04-T01 | deep a11y fixes | keyboard/AX/manual review | evidence dossier |
| P7-M05-T01 | bounded loading/perception | timing/state instrumentation | performance note |
| P7-M06-T01 | safe event schema | redaction/ownership tests | observability catalog |
| P7-M07-T01 | full regression | all required suites | regression report |
| P7-M08-T01 | release docs/AOS | link/contract checks | final gate package |

## Acceptance

GIVEN the complete product, WHEN the release matrix runs across required routes, seven viewports, light/dark and ES/EN, THEN no phase-local change breaks auth, workouts, progress, nutrition, gamification, PWA entry or legal routes; AND loading/offline/timeout states are truthful; AND observability contains no secret or unnecessary sensitive data.

**Rollback:** disable new flags and revert phase commit; preserve existing source data and route availability.
**DO_NOT_BREAK:** all SPEC Section 20 capabilities, especially auth/session, workouts, progress honesty, nutrition, gamification, theme/locale and safety boundaries.

## Microtask registry

Concrete IDs for execution and evidence tracking:

| Task | Microtasks |
|---|---|
| P7-M00-T01 | P7-M00-T01.01 contract/implementation · P7-M00-T01.02 tests/evidence · P7-M00-T01.03 docs/gate |
| P7-M01-T01 | P7-M01-T01.01 contract/implementation · P7-M01-T01.02 tests/evidence · P7-M01-T01.03 docs/gate |
| P7-M02-T01 | P7-M02-T01.01 contract/implementation · P7-M02-T01.02 tests/evidence · P7-M02-T01.03 docs/gate |
| P7-M03-T01 | P7-M03-T01.01 contract/implementation · P7-M03-T01.02 tests/evidence · P7-M03-T01.03 docs/gate |
| P7-M04-T01 | P7-M04-T01.01 contract/implementation · P7-M04-T01.02 tests/evidence · P7-M04-T01.03 docs/gate |
| P7-M05-T01 | P7-M05-T01.01 contract/implementation · P7-M05-T01.02 tests/evidence · P7-M05-T01.03 docs/gate |
| P7-M06-T01 | P7-M06-T01.01 contract/implementation · P7-M06-T01.02 tests/evidence · P7-M06-T01.03 docs/gate |
| P7-M07-T01 | P7-M07-T01.01 contract/implementation · P7-M07-T01.02 tests/evidence · P7-M07-T01.03 docs/gate |
| P7-M08-T01 | P7-M08-T01.01 contract/implementation · P7-M08-T01.02 tests/evidence · P7-M08-T01.03 docs/gate |
