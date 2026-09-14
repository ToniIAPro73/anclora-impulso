# ROADMAP MASTER — Impulso Health Plans + UX remediation

**Authority:** `docs/specs/SPEC-IMPULSO-POST-UX-REAUDIT-HEALTH-PLANS-END-TO-END.md`
**Branch:** `development`
**Baseline:** `c37f068f20de71c9e58079a0b4846de615e1edf2`
**Mode:** authoring complete; implementation not started.

## Global phase order

| Phase | Name | Repo status | Dependencies | Microphases | Tasks | Gates |
|---|---|---|---|---:|---:|---|
| P0 | Baseline, contracts & spec foundation | DONE (documentary) | none | 6 | 6 | G0–G4, G14–G15 |
| P1 | Ruta Vital 50–60 | MISSING | P0 | 21 | 21 | G1–G4, G5–G12, G14–G24 |
| P2 | Focused workout experience | MISSING | P1 domain contracts; can run UI work in parallel only after P1 interfaces freeze | 10 | 10 | G5–G13, G22 |
| P3 | Public entry & auth experience | NEEDS_VERIFICATION | P0; UX-08 route decision | 9 | 9 | G4–G13, G24 |
| P4 | AI trust, explainability & reversibility | MISSING | P0; existing AI guardrails | 8 | 8 | G5–G13, G18–G20 |
| P5 | Progress, nutrition & fitness loop | MISSING | P1 NBA contract; existing module APIs | 9 | 9 | G5–G13, G21–G22 |
| P6 | Exercise discovery & content quality | MISSING | existing exercise API; P2 naming contract | 7 | 7 | G5–G13 |
| P7 | Premium coherence, PWA & release hardening | NEEDS_HARDENING | P1–P6 | 9 | 9 | G6–G20, G23–G24 |
| **Total** |  |  |  | **79** | **79** | **25 global + 8 final gates** |

One task exists per microphase. Each task has three mandatory microtasks: `.01` contract/implementation, `.02` tests/evidence, `.03` docs/gate evidence. The phase files expand the acceptance criteria and risks.

## Release state machine

```text
development
  → phase final gate
  → CI + diff check + docs
  → staging promotion
  → safe staging validation
  → production promotion
  → production smoke
  → main promotion
```

Health-plan writes use synthetic fixtures only in staging. No phase promotes with a failed safety, provenance, privacy or no-diagnosis gate.

## Global gate catalog

| Gate | Contract |
|---|---|
| G0 Repository integrity | clean diff scope, branch and baseline recorded |
| G1 Architecture consistency | module boundaries and dependencies match current repo |
| G2 Schema/data integrity | additive migration, ownership and rollback verified |
| G3 Domain invariants | phase/week/action/minimum rules deterministic |
| G4 Auth/security | JWT, ownership, rate limit, consent and no secret leakage |
| G5 Functional behavior | requested behavior works in unit/integration/E2E evidence |
| G6 UX | next action, recovery and hierarchy are understandable |
| G7 Accessibility | semantics, names, focus, keyboard, contrast and targets |
| G8 Responsive | required viewports and mobile task paths pass |
| G9 Light/dark | both themes retain hierarchy and state clarity |
| G10 i18n | ES/EN complete; no raw keys or mixed operational copy |
| G11 Unit/integration | relevant suites pass with meaningful assertions |
| G12 E2E | core journey and negative branches pass |
| G13 Regression | existing product routes remain intact |
| G14 Documentation | spec, roadmap, API, content and release notes updated |
| G15 AOS | declarations/contracts and project context remain aligned |
| G16 Performance | no unbounded query, blocking state or avoidable layout shift |
| G17 Observability | safe transition/event evidence exists |
| G18 Health content provenance | every claim has source/category/review metadata |
| G19 Safety boundary | red flags cannot trigger unsafe escalation |
| G20 No diagnosis/treatment | product remains educational/behavioral |
| G21 Health-plan personalization | non-clinical inputs produce explainable variation |
| G22 Cross-module continuity | links reuse existing capabilities; no duplicate engines |
| G23 Privacy/data minimization | only necessary data collected/stored/logged |
| G24 Production smoke | canonical deployment smoke and rollback readiness pass |

## Mandatory final gates

| Final gate | Minimum proof |
|---|---|
| `P0-FINAL-GATE` | source precedence, contracts, fixtures, tests and safety vocabulary approved |
| `P1-FINAL-GATE` | discover → join → onboard → safe route → week → action → existing module → return → persisted NBA |
| `P2-FINAL-GATE` | complete workout flow usable at 390×844, 430×932 and 1440×900 with keyboard/a11y evidence |
| `P3-FINAL-GATE` | `/`, `/landing`, login, signup, callback, PWA start and auth redirects agree |
| `P4-FINAL-GATE` | AI inputs/rationale/generation/retry/edit/discard and guardrails are observable |
| `P5-FINAL-GATE` | progress/nutrition/gamification form a useful action loop without forced fusion |
| `P6-FINAL-GATE` | exercise search/detail/media fallback and responsive/a11y content quality pass |
| `P7-FINAL-GATE` | all regressions, themes, locales, PWA, accessibility, observability, docs and production smoke pass |

## Execution rules

1. Start every phase from a fresh `development` branch state.
2. Read the phase file and current code before each microphase.
3. Write failing tests before implementation when behavior changes.
4. Use feature flags for Health Plans until P1 final gate.
5. Keep writes idempotent and reversible.
6. Record evidence IDs, fixture, environment, viewport, theme and locale.
7. Never use a passing render as proof of persistence or safety.
8. If a gate fails, stop the phase, record the blocker and do not promote.
9. Commit after the final phase gate; push `development`; promotion is a separate authorized operation.

## Dependency graph

```text
P0
└── P1 Ruta Vital
    ├── P2 Workout
    ├── P4 AI trust
    └── P5 Fitness loop
P0 ── P3 Public/Auth
P2 ── P6 Exercise discovery
P1–P6 ── P7 Release hardening
```

## Traceability summary

| Driver | Phase path |
|---|---|
| UX-01 | P2-M00–M05, P2-M07–M09 |
| UX-02 | P2-M04–M05, P2-M08 |
| UX-03 | P2-M06, P2-M09 |
| UX-04 | P6-M00–M06 |
| UX-05 | P4-M00–M07 |
| UX-06 | P5-M00–M03, P5-M07–M08 |
| UX-07 | P1-M08–M13, P5-M03–M08 |
| UX-08 | P3-M00–M03, P3-M08 |
| UX-09 | P3-M04, P3-M08 |
| UX-10 | P3-M05, P3-M08 |
| UX-11 | P3-M06–M08, P7-M00–M01 |
| Health content/safety/privacy | P0-M03–M04, P1-M03/M14, P7-M03–M06 |

## Definition of done for a microphase

```text
contract reviewed = PASS
scope/out-of-scope explicit = PASS
dependencies/prerequisites checked = PASS
implementation or documentary artifact present = PASS
tests/evidence recorded = PASS
rollback known = PASS
DO_NOT_BREAK checked = PASS
docs updated = PASS
```

## Microphase record template

Before starting each ID, copy this record into the implementation PR/spec task and fill it with concrete paths. The phase matrices provide the initial values; an empty value is a gate failure.

```yaml
id: P?-M??
title: "..."
objective: "..."
source_drivers: [UX-XX, HP-REQ-XX]
current_state: "verified code/test truth"
target_state: "observable behavior"
scope: [routes, components, services, schema, tests]
out_of_scope: [explicit exclusions]
dependencies: [phase/microphase IDs]
prerequisites: [flags, migration, fixture, review]
risks: [data, security, UX, health-content]
do_not_break: [existing capability contract]
affected_routes: [concrete current/proposed routes]
affected_components: [concrete paths]
affected_api: [methods and validators]
affected_data: [models/read models/events]
migration_impact: "none | additive | rollback"
affected_tests: [unit, integration, E2E, a11y, responsive]
observability: [safe event/state evidence]
rollback: "flag/revert/restore steps"
documentation: [files updated]
tasks:
  - id: P?-M??-T01
    microtasks: [P?-M??-T01.01, P?-M??-T01.02, P?-M??-T01.03]
acceptance:
  - given: "..."
    when: "..."
    then: "..."
    and: "..."
gate: [G0]
```

Task `.01` owns the code/contract change, `.02` owns executable tests and browser evidence, `.03` owns documentation and gate evidence. A task is incomplete if only `.01` is done.
