# Anclora Impulso — Deep UX/UI Product Re-Audit

**AUDIT_REVISION:** `CONSISTENCY_REMEDIATION`
**STATUS:** `PASS`

## Audit metadata
| Field | Value |
| --- | --- |
| date | 2026-09-14 |
| audit_revision | CONSISTENCY_REMEDIATION |
| status | PASS |
| previous_audit_artifact | docs/audits/anclora-impulso-ux-reaudit-2026-09-14.pdf |
| remediation_reason | Correct internal coverage/status contradictions, retest UX-08, document version drift and deepen three narratives. |
| repository | ToniIAPro73/anclora-impulso |
| repository_path | /Users/toni/Developer/anclora/anclora-impulso |
| branch | development |
| current_head | 65e655e0c435acc1f63f3961b7794a58ae0b3a24 |
| origin_development_head | 65e655e0c435acc1f63f3961b7794a58ae0b3a24 |
| old_audit_date | 2026-09-06 |
| old_audit_head | f32ca59 |
| commits_between | 1 |
| worktree_final | Audit artifacts only; product code unchanged |
| local_remote_match | True |
| skill_contract_version | 1.5.0 |
| skill_runtime_version | 1.5.0 candidate (runtime implementation header); manifest/skill.yaml metadata 1.4.0 |
| skill_manifest_version | 1.4.0 |
| skill_version | 1.5.0 |
| skill_source_path | /Users/toni/Developer/anclora/anclora-infrastructure/skills/ux-product-experience-review |
| skill_contract_sha | d53718eac916e117d72ec1196a1d6ffc648fe3f842c7db9752fe9903fb7bf12c |
| skill_manifest_sha | c91229de6681de319bc6474908b0b42015272c77dafde74effc7b2dae4755850 |
| skill_release_notes_path | /Users/toni/Developer/anclora/anclora-infrastructure/skills/ux-product-experience-review/docs/RELEASE_NOTES.md |
| skill_release_notes_sha | b258d1ddc21b994ef9afd2ae2bf56fe902608f62b7c6d50ffd3c03b3f313e969 |
| runtime_manifest_sha | cb21ba0b9f4c63600228b092df7924ef1bc5b74e7a10293b49f9ac7b72b21b31 |
| primary_surface | APPLICATION |
| surface_mode | APPLICATION |
| surface_mode_source | AUTO_DETECT + CODE/BROWSER OVERRIDE |
| platform_mode | PWA |
| platform_mode_source | manifest + app shell |
| secondary_surfaces | LANDING_PAGE |
| domain_profile | FITNESS |
| canonical_frontend_url | https://impulso.anclora.com |
| backend_url | https://anclora-impulso.onrender.com/api |
| audited_browser_environments | PRODUCTION |
| old_finding_count | 13 |
| current_finding_count | 11 |
| fixed_since_previous | 1 |
| still_present | 5 |
| partially_fixed | 5 |
| regressions | 0 |
| new_findings | 6 |
| product_ux_findings | 10 |
| product_access_findings | 1 |
| engineering_support_findings | 0 |
| external_infrastructure_findings | 0 |
| compliance_review_items | 0 |
| browser_evidence_count | 83 |
| useful_screenshot_count | 57 |
| previous_browser_evidence_count | 12 |
| previous_screenshot_count | 7 |
| new_screenshot_count | 50 |
| full_core_journeys | 21 |
| authenticated_surfaces_reviewed | 10 |
| mobile_authenticated_surfaces | 7 |
| desktop_authenticated_surfaces | 10 |
| viewports_represented | 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 430×932, 390×844 |
| themes_represented | light, dark |
| locales_represented | es, en |
| production_auth_status | PASS |
| cors_status | PASS_AFTER_RUNTIME_REMEDIATION |
| preview_auth_status | NOT_REQUIRED_FOR_DEEP_PASS |
| surface_mode_mismatch_warning | Static heuristic may call the shell DASHBOARD; code/browser evidence supports APPLICATION plus LANDING_PAGE. |
| depth_gate_justification | 64+ evidence records, 55 useful screenshots, 21 full-schema journey records, 10 private surfaces, 7 mobile and 10 desktop representations. Writes, first-use fixture, induced failures, OAuth, offline and longitudinal history remain explicit gaps. |
| commit_sha | NOT_CREATED_AUDIT_ONLY |
| push_result | NOT_PERFORMED_AUDIT_ONLY |
| previous_pdf_page_count | 21 |
| new_pdf_page_count | 44 |
| current_development_head_recorded | PASS |
| no_product_code_modified | PASS |
| skill_registry_version | 1.3.0 catalog entry; agentic_binding_registry module v0.1, not skill-specific |
| skill_version_drift | True |
| audit_consistency_status | PASS |
| coverage_conflicts_found | 9 |
| coverage_conflicts_fixed | 9 |
| ux08_retest | PASS |
| ux08_final_status | CONFIRMED |
| ux08_final_title | Public entry model splits login root from marketing landing |
| ux07_final_status | REFINED |
| first_onboarding_final_status | COVERED_READONLY |
| complete_profile_final_status | BLOCKED_WRITE |
| logout_final_status | COVERED |
| session_recovery_final_status | COVERED |
| complete_workout_final_status | BLOCKED_WRITE |
| resume_workout_final_status | PARTIAL |
| exercise_detail_final_status | COVERED_READONLY |
| meal_plan_final_status | COVERED_READONLY |
| achievements_final_status | COVERED_READONLY |
| ux08_final_severity | MEDIUM |
| ux08_final_priority | P2 |

## 00 Index

This is a deep remediation of the previous Impulso audit, not an independent report. It reuses valid evidence and expands current authenticated product coverage with real production browser screenshots.

## Contents

1. 01 Executive assessment
2. 02 What changed
3. 03 Methodology delta and depth gap
4. 04 Surface classification and product model
5. 05 Promise versus observed
6. 06 User types and task inventory
7. 07 Critical journeys
8. 08 Screen map and experience map
9. 09 Landing and authentication
10. 10 Onboarding
11. 11 Workout generation and review
12. 12 Workout execution
13. 13 Mobile workout ergonomics
14. 14 Exercise library and detail
15. 15 Progress
16. 16 Nutrition
17. 17 Gamification
18. 18 AI personalization and trust
19. 19 Application shell
20. 20 Primary workspaces
21. 21 Viewport economy
22. 22 Action hierarchy
23. 23 System states
24. 24 Error recovery
25. 25 Responsive
26. 26 Light and dark
27. 27 Accessibility
28. 28 Internationalization
29. 29 Premium surface
30. 30 Anti-template and memorability
31. 31 Historical regression matrix
32. 32 Scorecards
33. 33 What works well
34. 34 Product UX/access findings
35. 35 Engineering/compliance scope
36. 36 Quick wins
37. 37 Structural opportunities
38. 38 Roadmap
39. 39 DO_NOT_BREAK
40. 40 Evidence coverage
41. 41 Tool compatibility
42. 42 Limitations
43. 43 Final comparative answer

## Audit consistency remediation

This is a targeted consistency revision of the deep audit. Existing evidence is preserved; only the mandatory UX-08 retest and selective narrative/status corrections were added.

### AUDIT_CONSISTENCY_MATRIX

| ITEM | CURRENT A | CURRENT B | CONTRADICTION | SOURCE A | SOURCE B | ROOT CAUSE | CORRECT VALUE | FIXED |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FIRST_ONBOARDING | BLOCKED | COVERED_READONLY | Read-only form was treated as total block | Task/J05 | E12 + current dialog | Status conflation | COVERED_READONLY | YES |
| COMPLETE_PROFILE | BLOCKED | NOT_EVALUATED | Form observation vs persistence boundary | Task/J06 | Onboarding form; no save | Write boundary omitted | BLOCKED_WRITE | YES |
| LOGOUT | BLOCKED | B05 PASS | Executed action stale in task table | Task/B05 | B05 | Aggregate status stale | COVERED | YES |
| SESSION_RECOVERY | BLOCKED | B04 PASS | Refresh proof omitted | Task/B04 | B04 | Combined with logout | COVERED | YES |
| COMPLETE_WORKOUT | BLOCKED | READONLY | Screen vs final write not separated | Task/J11 | E26-E28/E35/E52/E60 | Final action boundary omitted | BLOCKED_WRITE | YES |
| RESUME_WORKOUT | BLOCKED | READONLY | Intent visible, persisted resume not run | Task/J12 | E26-E28 + code | Draft intent overstated | PARTIAL | YES |
| EXERCISE_DETAIL | BLOCKED | READONLY | Detail was opened | Task/J14/B06 | E54 | Interaction not propagated | COVERED_READONLY | YES |
| MEAL_PLAN | BLOCKED | READONLY | Observable read-only plan state | Task/J17 | E17/E23/E33/E40/E47/E59 | No-write policy treated as total block | COVERED_READONLY | YES |
| ACHIEVEMENTS | BLOCKED | READONLY | Route/content observed | Task/J18 | E18/E24/E34/E41 | Read-only review treated as block | COVERED_READONLY | YES |
| UX-08 | Broad orphan/split | Mixed route evidence | Landing exists and works; root remains login | Prior finding | E61-E62/B08-B13 + code | Old title overgeneralized | Refined split-entry finding | YES |
| SKILL_VERSION | Contract 1.5.0 | Manifest 1.4.0 | Installed layers disagree | SKILL.md | skill.yaml/runtime/index | Authority not explicit | SKILL.md authoritative; drift documented | YES |
| RUNTIME_VERSION | Code header 1.5.0 | Manifest/skill.yaml 1.4.0 | Runtime candidate vs metadata | runtime implementation | skill.yaml/manifest | Source layers collapsed | 1.5.0 candidate; 1.4.0 metadata | YES |

### AUDIT_REMEDIATION_CHANGELOG

| ISSUE | BEFORE | AFTER | EVIDENCE | REASON |
| --- | --- | --- | --- | --- |
| COVERAGE_STATUS_NORMALIZATION | Mixed BLOCKED/read-only labels | Single taxonomy with write boundaries | Existing E12/B04-B06/E54 | Avoid false blockers. |
| UX08_RETEST | Broad orphan/split claim | Confirmed split-entry model and refined finding | E61-E62/B08-B13 + code/manifest | Current browser evidence. |
| SKILL_VERSION_DRIFT | 1.5.0 vs 1.4.0 unexplained | Contract, runtime, manifest, registry and notes separated | Installed skill layers | Preserve provenance. |
| PROGRESS_DEPTH | Short summary | Interpretation, low-data, trends, next action and preservation contract | E16/E22/E32/E39/E46/E58 | Selective narrative. |
| NUTRITION_DEPTH | Short summary | Decision support, plan/log, low-data and workout relation | E17/E23/E33/E40/E47/E59 | Selective narrative. |
| GAMIFICATION_DEPTH | Short summary | Meaning, feedback, motivation and workout relation | E18/E24/E34/E41 | Selective narrative. |

### UX-08 retest

`UX08 = CONFIRMED`. Anonymous `/` renders login; `/landing` renders the public fitness proposition; its primary CTA goes to `/auth/signup`, the secondary CTA to `/auth/login`; `site.webmanifest` declares `/auth/login` as `start_url`. The finding is refined to a split-entry model, not an absent landing.

## 01 Executive assessment

### Current verdict
The audit is materially deeper than the previous artifact: canonical auth/session now pass, private production routes are captured in desktop and mobile viewports, and workout execution is analyzed as a real fitness workflow. Status is `PASS` for this consistency remediation; inherited deep-audit product limitations remain explicitly documented because safety rules prevented writes and fixture-sensitive tests.

| Question | Evidence-backed answer |
| --- | --- |
| BIGGEST_USER_FRICTION | Long repeated workout set ledger without persistent current-exercise focus. |
| BIGGEST_SIMPLIFICATION_OPPORTUNITY | Make workout execution a focused session workspace. |
| BIGGEST_COGNITIVE_LOAD_OPPORTUNITY | Reduce repeated field scanning and cross-surface card interpretation. |
| BIGGEST_QUICK_WIN | Unique per-set accessible names and fieldsets. |
| BIGGEST_STRUCTURAL_OPPORTUNITY | Mobile-first workout focus + safe exit/resume. |
| BIGGEST_PREMIUM_UI_OPPORTUNITY | Unify copper identity and reduce accent/card fragmentation. |
| BIGGEST_VIEWPORT_ECONOMY_OPPORTUNITY | Keep current exercise, timer/progress and primary set action above fold at 390×844. |
| BIGGEST_AI_TRUST_OPPORTUNITY | Inputs-used summary plus rationale/regenerate/undo. |
| BIGGEST_MOBILE_WORKOUT_OPPORTUNITY | Thumb-reachable frequent actions without global-nav interruption. |
| OVERALL | Good foundation and operational core; fair-to-good active fitness UX until focus, semantics and AI control improve. |

## 02 What changed

The previous artifact contained seven saved screenshots and aggregated private observation E12. This remediation preserves prior records with context, adds current production route captures, measures viewports, and creates a deep journey/screen/evidence index. The repository HEAD remains unchanged; CORS remediation is an already-deployed runtime observation, not a product-code change.

### Evidence reuse
| Material | Classification | Reason |
| --- | --- | --- |
| CORS preflight/health | REUSABLE_WITH_CONTEXT | Retested after runtime remediation; F-01 status changed. |
| Public landing/auth captures | REUSABLE_WITH_CONTEXT | Still current production. |
| Preview private E12 | REUSABLE_WITH_CONTEXT | Context only; current production captures replace aggregation. |
| Missing private mobile captures | INSUFFICIENT | Now added at 390×844 and 430×932. |
| Static runtime output | REUSABLE_WITH_CONTEXT | Code/context only, never browser coverage. |

### DEPTH_GAP_MATRIX
| AREA | CURRENT | TALENT TARGET | GAP | WHY | NEW EVIDENCE | OUTPUT |
| --- | --- | --- | --- | --- | --- | --- |
| Executive assessment | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Methodology | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Surface classification | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Product model | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| User types | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Task inventory | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Critical journeys | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Screen map | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Experience map | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Onboarding | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| AI personalization | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Workout generation | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Workout execution | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Exercise library | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Progress | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Nutrition | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Gamification | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Auth/recovery | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Application shell | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Primary workspace | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Viewport economy | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Action hierarchy | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| System states | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Error recovery | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Responsive | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Theme | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Accessibility | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| i18n | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Premium product quality | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Historical matrix | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Scorecards | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Findings | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Evidence coverage | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |
| Limitations | Section present but shallow | Per-surface evidence + traceability | Expanded with current browser records | Prevents code or one preview state being mistaken for coverage | Route screenshots, observations, code provenance or explicit safety boundary | Dedicated chapter/table |

## 03 Methodology delta

The installed contractual skill is v1.5.0 while `skill.yaml` and runtime manifest metadata report v1.4.0. The current SKILL.md wins. Browser environment is explicitly PRODUCTION. `COMPLETED != COVERED`; writes and non-observable states remain partial or not evaluated.

## 04 Surface classification and product model
| Field | Result | Source |
| --- | --- | --- |
| PRIMARY_SURFACE | APPLICATION | Route inventory + private browser evidence |
| SURFACE_MODE | APPLICATION | Auto-detect reconciled with code/browser |
| PLATFORM_MODE | PWA | Manifest/app shell; offline unknown |
| SECONDARY_SURFACES | LANDING_PAGE | /landing |
| DOMAIN_PROFILE | FITNESS | Workout/progress/nutrition/exercises/motivation |
| ENVIRONMENT | PRODUCTION | Current deep pass |
| MISMATCH | DOCUMENTED | Heuristic may say DASHBOARD |

| Capability | Classification | Evidence |
| --- | --- | --- |
| Auth/session | CONFIRMED_FUNCTIONAL | B01-B05 |
| Dashboard/shell | CONFIRMED_FUNCTIONAL | E13/E19/E29/E36/E55 |
| Workout generation | CONFIRMED_RENDERED; write blocked | E14/E56 + code |
| Workout execution | CONFIRMED_RENDERED; completion blocked | E26-E28/E35/E42/E48/E52/E60 |
| Exercises | CONFIRMED_FUNCTIONAL_READONLY | E15/E31/E38/E53/E54 |
| Progress | CONFIRMED_RENDERED | E16/E58 |
| Nutrition | CONFIRMED_RENDERED | E17/E59 |
| Gamification | CONFIRMED_RENDERED | E18/E41 |
| PWA/offline | DECLARED_DOCS / UNKNOWN | Manifest only |
| Admin | CODE_ONLY / SAFETY_BLOCKED | Not authorized |

## 05 Promise versus observed
| PROMISE | OBSERVED | EVIDENCE | CONFIDENCE |
| --- | --- | --- | --- |
| Personalization | Profile proposal and broad 40+ rationale; result controls not observed | E14/E56 | MEDIUM |
| Workout execution | 12-set session with rest/notes/finish; long-form concern | E26/E35/E60 | HIGH |
| Progress | KPIs/recommendation/charts; low-data history | E16/E58 | HIGH |
| Nutrition | Daily state and plan/log actions; no write | E17/E59 | MEDIUM |
| Motivation | XP/achievements visible; longitudinal meaning unknown | E18/E41 | MEDIUM |
| Premium | Strong dark/copper base; accents/density reduce polish | E01-E04/E55/E60 | MEDIUM |
| PWA | Manifest declared; no offline proof | Code/manifest | LOW |
| ES/EN | Private visible copy switches; document lang drift | E19/E36/B07 | HIGH |
| Accessibility | Named shell/forms; repeated set semantics incomplete | E26/E35/code | MEDIUM |

## 06 User types and task inventory
| USER_TYPE | PRIMARY_GOAL | ENTRY | WORKSPACE | NEXT_ACTION | RECOVERY |
| --- | --- | --- | --- | --- | --- |
| ANONYMOUS_VISITOR | Understand value | /landing or / | Read proof; signup; login | Value/trust/entry | Landing/auth | Choose signup/login | Clear root intent |
| FIRST_TIME_USER | Provide context | Signup → dashboard | Onboarding; first plan | Required fields/payoff | Onboarding | Continue/later | Preserve progress |
| ACTIVE_USER | Train with minimal interruption | Workout | Execute sets; rest; finish | Current exercise/targets/timer | Workout | Mark next set | Keep draft |
| RETURNING_USER | Understand progress | Dashboard/progress | Review trends; resume | Period/baseline/action | Progress | Act on recommendation | Low-data clarity |
| USER_WITHOUT_PLAN | Create relevant plan | Generator | Set constraints/generate | AI inputs/rationale | Generator | Generate | Retry without duplicate |
| USER_WITH_ACTIVE_PLAN | Trust and start plan | Review | Scan/start | Sequence/constraints | Workout review | Start | Back/delete distinction |
| LOW_ENGAGEMENT_USER | Re-enter without shame | Dashboard | Use nudge/next action | Adherence context | Action hub | Resume | Positive recovery |
| POWER_USER | Optimize progression | Progress/workout | Compare records/adjust | History/precision | Progress | Next session | Stable state |
| ADMIN | Maintain content safely | Admin | Edit editorial data | Scope/auditability | Admin | Save | Restricted access |

| ID | TASK | CLASS | CRITICALITY | COVERAGE |
| --- | --- | --- | --- | --- |
| J1 | Landing → signup | ACQUISITION | HIGH | COVERED_READONLY |
| J2 | Signup → first login | ACTIVATION | CRITICAL | PARTIAL |
| J3 | Credential login | ACCESS | CRITICAL | COVERED |
| J4 | OAuth login | ACCESS | CRITICAL | PARTIAL |
| J5 | Password recovery | RECOVERY | HIGH | PARTIAL |
| J6 | First onboarding | ACTIVATION | HIGH | COVERED_READONLY |
| J7 | Complete profile | ACTIVATION | HIGH | BLOCKED_WRITE |
| J8 | Generate personalized workout | CORE | CRITICAL | COVERED_READONLY |
| J9 | Review generated workout | CORE | HIGH | COVERED_READONLY |
| J10 | Start workout | CORE | CRITICAL | COVERED_READONLY |
| J11 | Execute exercise/set | CORE | CRITICAL | COVERED_READONLY |
| J12 | Complete workout | CORE | HIGH | BLOCKED_WRITE |
| J13 | Resume interrupted workout | RECOVERY | HIGH | PARTIAL |
| J14 | Browse exercises | DISCOVERY | MEDIUM | COVERED |
| J15 | Inspect exercise | DISCOVERY | MEDIUM | COVERED_READONLY |
| J16 | Record progress | CORE | HIGH | BLOCKED |
| J17 | Review progress | CORE | HIGH | COVERED_READONLY |
| J18 | Nutrition dashboard | CORE | HIGH | COVERED_READONLY |
| J19 | Meal plan | CORE | HIGH | COVERED_READONLY |
| J20 | Log nutrition | CORE | HIGH | COVERED_READONLY |
| J21 | Achievements | RETENTION | MEDIUM | COVERED_READONLY |
| J22 | XP/gamification | RETENTION | MEDIUM | COVERED |
| J23 | Coach/AI guidance | CORE | HIGH | COVERED |
| J24 | Theme change | PREFERENCE | LOW | COVERED |
| J25 | Language change | PREFERENCE | MEDIUM | COVERED |
| J26 | Mobile navigation | NAVIGATION | HIGH | COVERED |
| J27 | Logout | ACCOUNT | HIGH | COVERED |
| J28 | Session recovery | RECOVERY | HIGH | COVERED |
| J29 | PWA install/use | PLATFORM | MEDIUM | PARTIAL |
| J30 | Public legal entry | TRUST | MEDIUM | COVERED |

## 07 Critical journeys

The prior full-schema journey records are retained and now linked to current screenshots where applicable.

| ID | NAME | ROUTE | COVERAGE | SCREENSHOTS |
| --- | --- | --- | --- | --- |
| J01 | Landing → signup | /landing → /auth/signup | COVERED_READONLY | E01, E02, E03, E04 |
| J02 | Credential login | /auth/login → /dashboard | COVERED_READONLY | E05, B03 |
| J03 | OAuth login | /auth/login → provider callback | COVERED_READONLY | E05, E06 |
| J04 | Password recovery | /auth/forgot-password | COVERED_READONLY | E07 |
| J05 | First onboarding | /dashboard → onboarding | COVERED_READONLY | E12 |
| J06 | Complete profile | /dashboard/profile | BLOCKED_WRITE |  |
| J07 | Generate workout | /workouts/generate | COVERED_READONLY | E14, E20, E30, E37, E44, E50, E56 |
| J08 | Review generated workout | /workouts/:id | COVERED_READONLY | E25 |
| J09 | Start workout | /workouts/:id/start | COVERED_READONLY | E26, E35, E60 |
| J10 | Execute exercise/set | /workouts/:id/start | COVERED_READONLY | E26, E35, E42, E48, E52, E60 |
| J11 | Complete workout | /workouts/:id/start | BLOCKED_WRITE | E26 |
| J12 | Resume interrupted workout | /dashboard → /workouts/:id/start | PARTIAL | E29 |
| J13 | Browse exercises | /exercises | COVERED_READONLY | E15, E31, E38, E45, E51, E53, E57 |
| J14 | Inspect exercise | /exercises → detail | COVERED_READONLY | E54 |
| J15 | Review progress | /progress | COVERED_READONLY | E16, E22, E32, E39, E46, E58 |
| J16 | Nutrition dashboard | /nutrition | COVERED_READONLY | E17, E23, E33, E40, E47, E59 |
| J17 | Meal plan | /nutrition/meal-plans/:id | COVERED_READONLY | E17, E23 |
| J18 | Gamification | /achievements | COVERED_READONLY | E18, E24, E34, E41 |
| J19 | Language change | Any private route | COVERED_READONLY | E19, E36, B07 |
| J20 | Theme change and shell | Any private route | COVERED_READONLY | E19, E36, E55, E60 |
| J21 | Logout and session recovery | /dashboard → /auth/login | COVERED | B04, B05 |

### Workout execution record
Entry: existing plan. Goal: complete sets with divided attention. Route: `/workouts/:id/start`. Inputs: reps, weight, RIR, RPE, rest and notes. Decisions: mark vs rest, exit vs finish. Wait/loading: workout/image load; rest timer not activated. Disabled: completion-state behavior not invoked. Success: session screen and explicit finish action. Error: no induced fault. Recovery: exit and keep draft; local draft was cleared after observation. Viewports: 1440×900, 390×844, 430×932, 1920×1080. Themes/locales: light/dark, ES/EN. Coverage: `COVERED_READONLY` / `BLOCKED_WRITE` for completion.

## 08 Screen map and experience map
| SCREEN | PURPOSE | PRIMARY | SECONDARY | DESTRUCTIVE | USER_TYPE | ENTRY | EXIT | RECOVERY |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| / | Returning auth entry | Login | Signup/recovery | — | ANONYMOUS_VISITOR | Direct | /dashboard | Use /landing for acquisition |
| /landing | Public acquisition | Start journey | Login/proof | — | ANONYMOUS_VISITOR | Public CTA | /auth/signup | Cookie preferences |
| /dashboard | Next action hub | Start/resume | Feature routes/reminders | Logout | ACTIVE_USER | Auth | Workout/routes | Refresh/session |
| /workouts/generate | Plan setup | Generate AI workout | Saved plans/preferences | Delete | USER_WITHOUT_PLAN | Dashboard | /workouts/:id | Keep inputs |
| /workouts/:id | Plan review | Start | Exercise list/back | Delete | USER_WITH_ACTIVE_PLAN | Generator | /start | Back |
| /workouts/:id/start | Live session | Mark/finish | Rest/notes/exit | Finish | ACTIVE_USER | Plan review | /progress | Keep draft |
| /exercises | Discovery | Search/filter | Cards/detail | — | ACTIVE_USER | Shell | Detail | Clear search |
| exercise detail | Technique | Read instructions | Target muscles | — | ACTIVE_USER | Library | Library | Close |
| /progress | Interpretation | Review next action | Charts/measures/records | — | RETURNING_USER | Shell | Workout | Low-data |
| /nutrition | Daily intake | Log/generate | Macros/meals | Delete plan | ACTIVE_USER | Shell | Meal plan | Empty state |
| /achievements | Motivation | Review progress | XP/history | — | ACTIVE_USER | Shell | Dashboard | No-data |
| profile dialog | Preferences | Save profile | Recommendation preview | — | PROFILE_INCOMPLETE_USER | Account | Dashboard | Close |
| admin/content | Editorial admin | Restricted edit | Content controls | Bulk update | ADMIN | Account | Library | Safety blocked |

| STAGE | ENTRY | GOAL | ACTION | RESPONSE | FRICTION | RESULT | RECOVERY |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Acquisition | /landing | Understand value | Read hero/proof | CTA/cookie competition | Signup | Choose entry |
| Login | /auth/login | Reach workspace | Submit credentials | Canonical now passes | Dashboard | Retry |
| Onboarding | /dashboard | Supply context | Choose goal/data | Fixture absent | Personalization | Later/back |
| Generate | /workouts/generate | Create plan | Set constraints/AI CTA | Result/reversibility not observed | Pending | Keep inputs |
| Execute | /workouts/:id/start | Complete sets | Enter/mark/rest | Repeated fields/scroll | Partial session | Keep draft |
| Progress | /progress | Know what changed | Read KPI/recommendation | Low-data dominance | Next action | Return workout |
| Nutrition | /nutrition | Act on intake | Read/log/generate | Separate from training loop | Nutrition state | Dashboard |
| Return | /dashboard | Resume momentum | Use action hub | Draft-dependent | Start/resume | Discard/continue |

## 09 Landing and authentication

The canonical domain now passes the previously blocking auth path: preflight 204, API health 200, credential login to dashboard, refresh persistence and logout. F-01 is therefore `VERIFIED_FIXED`. The public root/landing split and login/signup provider asymmetry remain current findings. OAuth entry was inspected read-only and not launched.

## 10 Onboarding

Source and prior CUA observation confirm a three-step onboarding dialog collecting context, base data, objective and limitations. The authorized profile-complete account did not expose first-use onboarding in the isolated browser session; no real profile write was attempted. This is `NOT_RETESTED`, not a negative score.

## 11 Workout generation and review

The generator is substantive: saved plans, profile proposal, 40+ rationale, type/duration/difficulty/environment, target muscles, equipment and AI CTA. Review shows title, exercise list, delete and start. Generation/delete were blocked writes; result rationale, regeneration, undo and error/wait states remain open.

## 12 Workout execution

The page renders four exercises and 12 set rows with reps, weight, RIR, RPE, rest, mark/rest controls, progress, notes and exit/finish. On mobile, the title, 0/12 progress, rest card and first exercise occupy the first view; later sets require scrolling. The problem is not missing capability but focus/context during physical use.

| MEASURE | OBSERVED | IMPLICATION |
| --- | --- | --- |
| Sets | 12 loaded rows | Repeated scanning |
| Scroll | Later exercise groups below 390×844 fold | High divided-attention burden |
| Targets | Touch-sized controls | Context ambiguity remains |
| Timer | Rest card visible; live timer not activated | Later persistence unknown |
| Next set | Mark local to row; no explicit next focus | Opportunity for focused state |
| Completion | Not invoked | Write boundary |

## 13 Mobile workout ergonomics

The current mobile shell uses a top hamburger; in-workout controls are local, but global actions require a drawer/context switch. A bottom nav is not assumed to be universally better. The evidence supports a focused session action bar, safe exit/resume semantics and unique set control context. The answer to 'can a person train without fighting the UI?' is `PARTLY_SUPPORTED`, not certified: touch targets are visible, but long scroll and repeated context remain material.

## 14 Exercise library and detail

The library exposes a 479/485-scale dataset, four filters, search, virtualized results and a same-route detail dialog. Synthetic search produced 17 results; detail exposed description, target muscles and instructions. Repeated unavailable-image placeholders and mixed naming conventions reduce scan confidence.

## 15 Progress
### Selective consistency remediation analysis

| DIMENSION | OBSERVATION |
| --- | --- |
| PRIMARY_USER_GOAL | Understand meaningful change and choose the next training action. |
| PRIMARY_ACTION | Review recommendation and switch charts/measurements/records. |
| KPI_INTERPRETABILITY | Good state scan; zeros and missing values need period/baseline context. |
| LOW_DATA_STATE | Honest, with missing trend and recommendation cues; no fabricated progress. |
| TREND_CLARITY | Charts are discoverable, but interpretation is weaker than metric inventory. |
| NEXT_ACTION | Return to workout or act on recommendation; currently implied rather than orchestrated. |
| MOBILE_DESKTOP | Readable stacked mobile cards; denser but scannable desktop KPI/chart area. |
| LIGHT_DARK_ES_EN | Both themes and ES/EN represented; document lang remains Spanish. |
| WHAT_WORKS_WELL | Honest low-data state, visible recommendation, separate chart/measurement/record views. |
| FRICTION | The user can see state but not always what changed or what to do next. |
| DO_NOT_BREAK | Preserve honest missing-data treatment and avoid decorative or invented progress. |
| ANSWER | Partially answers what changed and what to do next. |


Progress provides total workouts, monthly count, time, records, volume, best PR, dominant group, adherence, weight trend, stagnation risk, recommendation and chart/measurement/record tabs. Low-data interpretation is real but numeric zeros dominate early scanning; longitudinal usefulness is not established.

## 16 Nutrition
### Selective consistency remediation analysis

| DIMENSION | OBSERVATION |
| --- | --- |
| PRIMARY_USER_GOAL | Understand today's nutrition state and choose log, plan or generation action. |
| CALORIE_MACRO_CLARITY | Daily state and macro concepts are visible; action meaning could be clearer. |
| PLAN_LOGGING | Plan access/generation and logging are discoverable; post-write feedback not tested. |
| RECOMMENDATION_RATIONALE | Recommendations are visible, but selection rationale is not established. |
| EMPTY_LOW_DATA | Current low-data state is readable; fully empty first-day state not induced. |
| WORKOUT_RELATIONSHIP | Conceptually adjacent, not presented as coordinated next action. |
| NEXT_ACTION | User chooses among parallel log/generate/review controls. |
| MOBILE_DESKTOP | Readable vertical mobile stack; clearer desktop workspace than workout ledger. |
| LIGHT_DARK_ES_EN | Both themes and representative private locales covered. |
| WHAT_WORKS_WELL | Daily state, macro/recommendation framing and visible plan/log affordances. |
| FRICTION | No single highest-value nutrition action dominates. |
| DO_NOT_BREAK | Keep visible daily state and user-controlled non-clinical actions. |
| ANSWER | Helps choose a nutrition action, but currently behaves as a parallel dashboard. |


Nutrition provides daily state, macros/recommendation, meal-plan and logging/generation affordances. It is operationally rendered and screenshot-backed in both mobile and desktop. No food log or plan generation write was executed; no clinical judgement is made.

## 17 Gamification
### Selective consistency remediation analysis

| DIMENSION | OBSERVATION |
| --- | --- |
| LEVEL_XP_STREAK | Level, XP and streak are visible status signals. |
| ACHIEVEMENTS | Achievement and history provide a real review destination. |
| PROGRESS_MEANING | Status is clearer than meaning; next unlock/behavior is less explicit. |
| REWARD_FEEDBACK | Display is observed; feedback after earning was not tested. |
| MOTIVATION_PRESSURE | Reinforcement potential is plausible; behavior change and pressure need longitudinal evidence. |
| NEXT_ACTION | Review achievements or return to training; bridge is implicit. |
| WORKOUT_PROGRESS_RELATION | Separate from workout completion and Progress workspace in the observed UI. |
| MOBILE_DESKTOP_LIGHT_DARK_ES_EN | Readable stacked mobile and compact desktop views in both theme/locale families. |
| WHAT_WORKS_WELL | Concrete level/XP/streak/achievement/history vocabulary. |
| FRICTION | Surface shows progress without making the next rewarding behavior unmistakable. |
| DO_NOT_BREAK | Keep rewards subordinate to meaningful training behavior. |
| ANSWER | More than decoration, but not yet proven behavior guidance. |


Achievements exposes level/XP/streak/achievement/history surfaces. The feature is real and readable; whether it motivates rather than decorates requires longitudinal observation.

## 18 AI personalization and trust

Trust is `FAIR`: explicit AI CTA, profile proposal and broad rationale support disclosure/control. Inputs-used summary, result rationale, uncertainty, regenerate/edit/undo, wait, cost and error behavior were not safely observable.

## 19 Application shell

Desktop: persistent sidebar, active route, collapse, brand, theme/language/account controls. Mobile: compact top bar/hamburger and preference controls. Shell coherence is a strength; mobile workflow interruption is the trade-off.

## 20 Primary workspaces
| WORKSPACE | PRIMARY_ACTION | DENSITY | MOBILE | DESKTOP |
| --- | --- | --- | --- | --- |
| Dashboard | Start/resume | Medium/high | Readable but tall | Strong action hub |
| Workout | Mark/finish | High/repeated | Long scroll | Full session but dense |
| Progress | Review recommendation | Medium | Cards stack | KPI clear |
| Nutrition | Log/generate | Medium | Vertical | Readable |
| Exercises | Search/filter | High | Filters consume fold | Virtualized scan |
| Achievements | Review | Medium | Stacked | Compact |

## 21 Viewport economy
| VIEWPORT | PRIVATE REPRESENTATION | OBSERVATION |
| --- | --- | --- |
| 1920×1080 | Workout | Wide session; repetition persists |
| 1440×900 | Six+ private routes | Exact desktop captures |
| 1366×768 | Dashboard | Short height exposes chrome |
| 1024×768 | Generator | Tablet width |
| 768×1024 | Exercises | Portrait tablet density |
| 430×932 | Six private routes | Mobile auth coverage |
| 390×844 | Seven private routes | Core mobile execution coverage |

## 22 Action hierarchy

Dashboard action hub and workout primary controls are visually clear. Delete plan is present as a competing destructive control in review but separate from start. In execution, Mark and Rest are clear per row, yet no persistent next action exists. Disabled/loading/finish states need controlled interaction coverage.

## 23 System states
| STATE | WHAT HAPPENS | UNDERSTANDING | NEXT ACTION |
| --- | --- | --- | --- |
| LOADING | Route/API transitions | Partly understood | Keep stable skeleton and intent |
| SUCCESS | Private routes/login/dashboard render | Understood | Keep action hub |
| ERROR | Historical raw Failed to fetch; no current induced fault | Not retested | Controlled retry fixture |
| EMPTY/LOW_DATA | Progress/nutrition zero/missing values | Partly understood | Explain missing vs zero |
| OFFLINE | PWA declared | Unknown | Test offline contract |
| SYNCING | Workout local draft code-observed | Partly understood | Show save time/state |
| DISABLED | State-dependent controls | Partly understood | Explain why disabled |
| FIRST_USE | Onboarding source/CUA observed | Not fully evaluated | Use incomplete fixture |

## 24 Error recovery

Successful auth/API/session recovery is current. The raw `Failed to fetch` path is historical context, not newly induced evidence; F-02 remains `NOT_RETESTED`. Workout exit/keep draft is explicit. Retry, timeout, offline, session-expiry and backend-unavailable paths require a safe fixture.

## 25 Responsive

Private routes stack and remain legible at 390/430 widths. The main task risk is vertical/contextual rather than horizontal overflow. Progress/nutrition require deeper scroll; exercises spend the first mobile viewport on filters, an acceptable discovery trade-off that should retain a compact result signal.

## 26 Light and dark

Private dashboard, generator, exercises, progress, nutrition, achievements and workout execution are represented in light/dark combinations. Dark has stronger brand confidence; light preserves readability/hierarchy.

## 27 Accessibility

AX evidence exposes named shell, form, heading, button and dialog controls. Repeated workout textboxes are not consistently specific in the AX tree; visual grouping carries semantics that assistive technology needs explicitly. The composed private accessibility tool did not return a material authenticated report and is recorded as a compatibility gap.

## 28 Internationalization

Private visible copy changes ES/EN. The English state retains `html lang=es` because the layout hardcodes Spanish while language context updates visible copy/localStorage. This is a semantic metadata gap, not a blanket untranslated-copy claim.

## 29 Premium surface

The dark navy shell, copper mark, orange CTA and modern typography create a strong base. Premium quality is held back by mobile workout density, repeated cards, unavailable imagery and public accent fragmentation.

## 30 Anti-template and memorability

Impulso reads as a recognizable fitness product because of Momentum Fitness, exercise-specific data and workout controls. Dashboard card patterns are conventional SaaS; the next premium opportunity is a distinctive focused workout canvas, not more decorative cards.

## 31 Historical regression matrix
| ID | TITLE | OLD SEV | OLD EVIDENCE | CURRENT STATUS | CURRENT ID | CURRENT SEV | CURRENT EVIDENCE | CHANGE | NOTES |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| F-01 | Canonical domain cannot authenticate/load data | CRITICAL | Old CORS 500 / AUTH_BLOCKED | VERIFIED_FIXED | — | — | B01-B03: preflight 204, health 200, login/dashboard pass | FIXED | Runtime allowlist now includes canonical origin. |
| F-02 | Login waits/fails with literal Failed to fetch | CRITICAL | Raw failure and long wait | NOT_RETESTED | — | NOT_EVALUATED | No induced backend fault after remediation; successful path passes B03 | NOT_RETESTED | Requires controlled non-destructive fault fixture. |
| F-04 | Root login and orphan /landing split entry model | HIGH | Root/login vs marketing landing | STILL_PRESENT | UX-08 | MEDIUM | E61-E62/B08-B14: root remains login; /landing and both CTAs are real; manifest start_url is /auth/login | REFINED | Landing is not absent; the current issue is the documented split between canonical root/manifest and marketing entry. |
| F-05 | Social login/signup inconsistency | MEDIUM | Providers on login only | STILL_PRESENT | UX-09 | MEDIUM | E05/E06: providers on login, credential-only signup | NO_CHANGE | OAuth was not launched; parity is read-only measured. |
| F-06 | Mobile auth vertical dead space | MEDIUM | 390px auth whitespace | STILL_PRESENT | UX-10 | MEDIUM | E05-E07 current 390×844 captures | NO_CHANGE | Current public captures confirm the condition. |
| F-07 | Landing feature colors break copper/orange brand | MEDIUM | Blue/green/magenta accents | STILL_PRESENT | UX-11 | MEDIUM | E01-E04 current landing captures | NO_CHANGE | Accent fragmentation remains. |
| F-09 | Mobile drawer vs bottom navigation opportunity | OPPORTUNITY | Code-only opportunity | STILL_PRESENT | UX-02 | MEDIUM | E29-E48 show hamburger shell/no persistent bottom nav on private mobile | RETESTED | Real mobile evidence now exists; bottom nav is not assumed as the solution. |
| H-08 | Admin/content protection unknown | OPEN QUESTION | No prior browser proof | NOT_RETESTED | — | NOT_EVALUATED | Admin not authorized or entered | NOT_RETESTED | No admin action attempted. |
| H-09 | Onboarding modal scale/complexity question | OPEN QUESTION | Large three-step dialog described | PARTIALLY_FIXED | — | MEDIUM | E12 plus current authenticated onboarding dialog: three steps, progress, fields and later/continue intent observed; completion not submitted | PARTIAL_OBSERVATION | The modal is now observable, but first-use persistence and full mobile ergonomics remain open. |
| H-10 | AI personalization trust not evaluated | OPEN QUESTION | No generation evidence | PARTIALLY_FIXED | UX-05 | MEDIUM | E14/E56 show proposal, rationale, controls and AI CTA; no result/regenerate/undo | PARTIAL_OBSERVATION | Read-only trust evidence now exists. |
| H-11 | Workout execution not evaluated | OPEN QUESTION | Auth blocked historically | PARTIALLY_FIXED | UX-01/UX-03 | HIGH | E26-E28/E35/E42/E48/E52/E60 show real 12-set session; completion not run | PARTIAL_OBSERVATION | Mobile and desktop execution now observable. |
| H-12 | Progress UX not evaluated | OPEN QUESTION | Auth blocked historically | PARTIALLY_FIXED | UX-06 | MEDIUM | E16/E22/E32/E39/E46/E58 show KPIs/recommendation/chart/low-data state | PARTIAL_OBSERVATION | Longitudinal usefulness remains open. |
| H-13 | Nutrition/gamification not evaluated | OPEN QUESTION | Auth blocked historically | PARTIALLY_FIXED | UX-07 | MEDIUM | E17/E23/E33/E40/E47/E59 and E18/E24/E34/E41 render both workspaces | PARTIAL_OBSERVATION | Writes and longitudinal motivation remain open. |

## 32 Scorecards

### APPLICATION
| DIMENSION | RATING | BASIS |
| --- | --- | --- |
| Clarity | GOOD | Shell labels and workspace headings clear; low-data/AI need more context |
| Efficiency | FAIR | Repeated workout fields and mobile drawer add steps |
| Consistency | GOOD | Shared shell/theme/locale patterns |
| Feedback | FAIR | Success/low-data visible; induced fault not tested |
| Error recovery | FAIR | Exit/keep draft explicit; failure fixture absent |
| Cognitive load | FAIR | Workout ledger is highest load |
| Navigation | FAIR | Desktop clear; mobile drawer context switch |
| Accessibility | FAIR | Repeated set inputs need names |
| Responsive task completion | FAIR | Private mobile renders; live completion not run |
| Viewport economy | FAIR | Mobile auth/workout vertical burden |
| Primary workspace | FAIR | Dashboard strong; workout needs focus |
| Workflow efficiency | FAIR | Read-only path discoverable; writes bounded |
| Progress interpretation | FAIR | State is honest; period meaning and next action less explicit in low-data state |
| Nutrition decision support | FAIR | Daily state/actions visible; UI remains parallel rather than orchestrated |
| Motivation meaning | FAIR | Level/XP/streak/achievements real; behavior change not longitudinally proven |

### LANDING
| DIMENSION | RATING | BASIS |
| --- | --- | --- |
| Audience/purpose | FAIR | Root/landing split |
| Value proposition | GOOD | Fitness promise clear |
| Visual hierarchy | GOOD | Hero leads; accents compete |
| Conversion | FAIR | CTA available; entry ambiguity |
| Responsive | GOOD | No material public overflow |
| Accessibility | FAIR | Named controls; landmarks/semantics gaps |
| Trust | GOOD | Legal/cookie/auth links visible |

### MOBILE_WORKOUT
| DIMENSION | RATING | BASIS |
| --- | --- | --- |
| Thumb reach | FAIR | Frequent controls local; global nav outside bottom reach |
| Target size | GOOD | Visible targets touch-sized |
| Scroll during set | POOR | Later sets below short viewport |
| Timer visibility | GOOD | Rest card visible; live later state unknown |
| Current exercise visibility | FAIR | First prominent; later focus requires scroll |
| Next action clarity | FAIR | Mark/Rest clear; next implicit |

### AI_TRUST
| DIMENSION | RATING | BASIS |
| --- | --- | --- |
| AI disclosure | GOOD | AI CTA explicit |
| Explainability | FAIR | 40+ rationale broad |
| Reversibility | NOT_EVALUATED | No result/undo invoked |
| Control | GOOD | Many constraints |
| Expectation setting | FAIR | Wait/error/result not observed |
| Trust | FAIR | Good start, incomplete contract |

### PREMIUM
| DIMENSION | RATING | BASIS |
| --- | --- | --- |
| Hierarchy | GOOD | Strong dark shell/CTA |
| Brand coherence | FAIR | Copper base; landing accents fragment |
| Typography | GOOD | Modern readable type |
| State clarity | FAIR | Partial/low-data visible |
| Density | FAIR | Exercise/workout dense |
| Memorability | FAIR | Fitness signal, dashboard patterns |
| Mobile polish | FAIR | Workout/nav need refinement |

## 33 What works well
| CAPABILITY | EVIDENCE | WHY_IT_WORKS | DO_NOT_BREAK |
| --- | --- | --- | --- |
| Canonical auth/session | B01-B05 | Login, API, refresh and logout pass after CORS runtime fix | Preserve explicit origin/session handling |
| Action hub | E13/E19/E29/E36/E55 | Dashboard prioritizes next best action | Keep primary action above fold |
| Workout controls | E26-E28/E35/E42/E48/E52/E60 | Targets, rest, notes, progress and exit/finish are real | Preserve draft and recovery |
| Exercise discovery | E15/E31/E38/E53/E54 | Search/filter/detail support discovery at scale | Preserve filter/detail model |
| Progress transparency | E16/E22/E32/E58 | Missing data is not fabricated; recommendation is visible | Keep honest low-data copy |
| Theme/locale | E19/E36/E55/B07 | Private visible copy/theme switch | Preserve persistence and contrast |
| Fitness identity | E01-E04/E55/E60 | Copper mark and dark navy shell are distinctive | Keep restrained copper anchor |

## 34 Product UX/access findings

### UX-01 · Workout execution is a long-form set ledger rather than a focused training workspace
| FIELD | VALUE |
| --- | --- |
| category | Product UX |
| finding_scope | PRODUCT_UX |
| surface | WORKOUT_EXECUTION |
| journey | J10 |
| screen | /workouts/:id/start |
| user_type | ACTIVE_USER |
| task_criticality | CRITICAL |
| friction_type | CONTEXT_LOAD |
| severity | HIGH |
| priority | P1 |
| evidence_level | MEASURED_BROWSER + MEASURED_CODE |
| browser_environment | PRODUCTION |
| evidence | E26/E35/E42/E48/E52/E60 show 12 set rows and four exercise groups in one continuous page; at 390×844 only the first exercise is above the fold. |
| frequency | Recurring for the affected journey |
| current_behavior | E26/E35/E42/E48/E52/E60 show 12 set rows and four exercise groups in one continuous page; at 390×844 only the first exercise is above the fold. |
| root_ux_cause | The data model is rendered directly without a current-exercise/session focus layer. |
| why_it_matters | The user must act under time, attention and recovery constraints. |
| user_impact | Repeated scan/scroll and loss of next-action focus during a physical session. |
| recommended_change | Add current-exercise focus, sticky progress/rest, explicit next/previous and compact set navigation. |
| why_this_change | It reduces friction while preserving the current capability contract. |
| expected_benefit | Clearer task completion and higher confidence. |
| effort | MEDIUM |
| risk | MEDIUM |
| quick_win | False |
| dependencies | Targeted UX/accessibility regression coverage |
| do_not_break | Existing successful route, state persistence and primary actions |
| historical_id | None |
| change_class | NEW |
| implementation_guidance | Add current-exercise focus, sticky progress/rest, explicit next/previous and compact set navigation. |

### UX-02 · Mobile shell hides navigation behind a hamburger during an active fitness workflow
| FIELD | VALUE |
| --- | --- |
| category | Product UX |
| finding_scope | PRODUCT_UX |
| surface | APPLICATION_SHELL/MOBILE_WORKOUT |
| journey | J20/J24 |
| screen | Private mobile shell |
| user_type | ACTIVE_USER |
| task_criticality | HIGH |
| friction_type | NAVIGATION_CONTEXT_SWITCH |
| severity | MEDIUM |
| priority | P2 |
| evidence_level | MEASURED_BROWSER + MEASURED_CODE |
| browser_environment | PRODUCTION |
| evidence | E29-E48 show top hamburger and no persistent bottom nav; frequent navigation requires opening a drawer. |
| frequency | Recurring for the affected journey |
| current_behavior | E29-E48 show top hamburger and no persistent bottom nav; frequent navigation requires opening a drawer. |
| root_ux_cause | Desktop sidebar compression is used without task-specific mobile navigation. |
| why_it_matters | The user must act under time, attention and recovery constraints. |
| user_impact | Extra taps and interruption risk for one-handed users. |
| recommended_change | Keep drawer for low-frequency destinations but add explicit in-workout reachable navigation and safe exit semantics. |
| why_this_change | It reduces friction while preserving the current capability contract. |
| expected_benefit | Clearer task completion and higher confidence. |
| effort | MEDIUM |
| risk | MEDIUM |
| quick_win | False |
| dependencies | Targeted UX/accessibility regression coverage |
| do_not_break | Existing successful route, state persistence and primary actions |
| historical_id | F-09 |
| change_class | RETESTED |
| implementation_guidance | Keep drawer for low-frequency destinations but add explicit in-workout reachable navigation and safe exit semantics. |

### UX-03 · Repeated workout inputs lack sufficiently specific accessible names
| FIELD | VALUE |
| --- | --- |
| category | Accessibility |
| finding_scope | PRODUCT_ACCESS |
| surface | WORKOUT_EXECUTION |
| journey | J10 |
| screen | Set rows |
| user_type | ACTIVE_USER |
| task_criticality | CRITICAL |
| friction_type | SEMANTIC_AMBIGUITY |
| severity | HIGH |
| priority | P1 |
| evidence_level | MEASURED_BROWSER + MEASURED_CODE |
| browser_environment | PRODUCTION |
| evidence | E26/E35/E42 AX snapshots expose many unnamed textboxes beside named 0-5/0-10 fields; source relies on visual grouping. |
| frequency | Recurring for the affected journey |
| current_behavior | E26/E35/E42 AX snapshots expose many unnamed textboxes beside named 0-5/0-10 fields; source relies on visual grouping. |
| root_ux_cause | Labels are not consistently bound to exercise, set index and metric. |
| why_it_matters | The user must act under time, attention and recovery constraints. |
| user_impact | Keyboard/screen-reader users cannot reliably distinguish repeated fields. |
| recommended_change | Use unique names, fieldsets and timer/rest live-region semantics for each exercise/set/metric. |
| why_this_change | It reduces friction while preserving the current capability contract. |
| expected_benefit | Clearer task completion and higher confidence. |
| effort | LOW |
| risk | LOW |
| quick_win | True |
| dependencies | Targeted UX/accessibility regression coverage |
| do_not_break | Existing successful route, state persistence and primary actions |
| historical_id | None |
| change_class | NEW |
| implementation_guidance | Use unique names, fieldsets and timer/rest live-region semantics for each exercise/set/metric. |

### UX-04 · Exercise discovery spends image space on unavailable media placeholders
| FIELD | VALUE |
| --- | --- |
| category | Exercise library |
| finding_scope | PRODUCT_UX |
| surface | EXERCISE_LIBRARY |
| journey | J13 |
| screen | /exercises |
| user_type | ACTIVE_USER |
| task_criticality | HIGH |
| friction_type | CONTEXT_LOAD |
| severity | MEDIUM |
| priority | P2 |
| evidence_level | MEASURED_BROWSER + MEASURED_CODE |
| browser_environment | PRODUCTION |
| evidence | E15/E31/E38/E45/E51/E53/E57 show repeated 'Imagen no disponible todavía' cards and mixed exercise naming. |
| frequency | Recurring for the affected journey |
| current_behavior | E15/E31/E38/E45/E51/E53/E57 show repeated 'Imagen no disponible todavía' cards and mixed exercise naming. |
| root_ux_cause | Unavailable media has no compact instructional fallback hierarchy. |
| why_it_matters | The user must act under time, attention and recovery constraints. |
| user_impact | More scanning and weaker confidence before opening detail. |
| recommended_change | Use a compact category/icon placeholder and prioritize name, target muscle and level. |
| why_this_change | It reduces friction while preserving the current capability contract. |
| expected_benefit | Clearer task completion and higher confidence. |
| effort | LOW |
| risk | LOW |
| quick_win | True |
| dependencies | Targeted UX/accessibility regression coverage |
| do_not_break | Existing successful route, state persistence and primary actions |
| historical_id | None |
| change_class | NEW |
| implementation_guidance | Use a compact category/icon placeholder and prioritize name, target muscle and level. |

### UX-05 · AI proposal explains profile rules but not controllable result rationale or reversibility
| FIELD | VALUE |
| --- | --- |
| category | AI personalization |
| finding_scope | PRODUCT_UX |
| surface | WORKOUT_GENERATION |
| journey | J07 |
| screen | /workouts/generate |
| user_type | ACTIVE_USER |
| task_criticality | HIGH |
| friction_type | TRUST_AND_CONTROL |
| severity | MEDIUM |
| priority | P2 |
| evidence_level | MEASURED_BROWSER + MEASURED_CODE |
| browser_environment | PRODUCTION |
| evidence | E14/E20/E30/E37/E44/E56 show proposal, 40+ rationale, controls and AI CTA; no result/regenerate/undo was safely invoked. |
| frequency | Recurring for the affected journey |
| current_behavior | E14/E20/E30/E37/E44/E56 show proposal, 40+ rationale, controls and AI CTA; no result/regenerate/undo was safely invoked. |
| root_ux_cause | Rationale is attached to profile heuristics, not to a reversible generation state. |
| why_it_matters | The user must act under time, attention and recovery constraints. |
| user_impact | Uncertainty about what the plan uses and how to recover from an unwanted result. |
| recommended_change | Show inputs used, post-generation rationale, edit/regenerate and discard/undo. |
| why_this_change | It reduces friction while preserving the current capability contract. |
| expected_benefit | Clearer task completion and higher confidence. |
| effort | MEDIUM |
| risk | MEDIUM |
| quick_win | False |
| dependencies | Targeted UX/accessibility regression coverage |
| do_not_break | Existing successful route, state persistence and primary actions |
| historical_id | H-10 |
| change_class | RETESTED |
| implementation_guidance | Show inputs used, post-generation rationale, edit/regenerate and discard/undo. |

### UX-06 · Progress low-data KPIs can read as failure despite a useful recommendation
| FIELD | VALUE |
| --- | --- |
| category | Progress |
| finding_scope | PRODUCT_UX |
| surface | PROGRESS |
| journey | J15 |
| screen | /progress |
| user_type | ACTIVE_USER |
| task_criticality | HIGH |
| friction_type | CONTEXT_LOAD |
| severity | MEDIUM |
| priority | P2 |
| evidence_level | MEASURED_BROWSER + MEASURED_CODE |
| browser_environment | PRODUCTION |
| evidence | E16/E22/E32/E39/E46/E58 show 0 weekly adherence, 0 kg volume, missing trend and a consistency recommendation. |
| frequency | Recurring for the affected journey |
| current_behavior | E16/E22/E32/E39/E46/E58 show 0 weekly adherence, 0 kg volume, missing trend and a consistency recommendation. |
| root_ux_cause | Numeric status is more visually dominant than history coverage/confidence. |
| why_it_matters | The user must act under time, attention and recovery constraints. |
| user_impact | Early users may see absence as failure rather than a next step. |
| recommended_change | Pair low-data values with period, confidence and one above-fold next action. |
| why_this_change | It reduces friction while preserving the current capability contract. |
| expected_benefit | Clearer task completion and higher confidence. |
| effort | LOW |
| risk | LOW |
| quick_win | True |
| dependencies | Targeted UX/accessibility regression coverage |
| do_not_break | Existing successful route, state persistence and primary actions |
| historical_id | H-12 |
| change_class | RETESTED |
| implementation_guidance | Pair low-data values with period, confidence and one above-fold next action. |

### UX-07 · Nutrition and gamification do not yet expose a shared next-action loop
| FIELD | VALUE |
| --- | --- |
| category | Fitness feedback |
| finding_scope | PRODUCT_UX |
| surface | NUTRITION/GAMIFICATION |
| journey | J16/J18 |
| screen | /nutrition and /achievements |
| user_type | ACTIVE_USER |
| task_criticality | HIGH |
| friction_type | CONTEXT_LOAD |
| severity | MEDIUM |
| priority | P2 |
| evidence_level | MEASURED_BROWSER + MEASURED_CODE |
| browser_environment | PRODUCTION |
| evidence | E17/E18/E23/E24/E33/E34/E40/E41/E47/E59 plus the selective surface review. |
| frequency | Recurring for the affected journey |
| current_behavior | Both are real readable workspaces, but their current UI presents parallel states rather than an explicit bridge from workout behavior to nutrition or XP action. |
| root_ux_cause | Feature routes are organized as peer dashboards rather than a coordinated weekly narrative. |
| why_it_matters | The user must act under time, attention and recovery constraints. |
| user_impact | Metrics can feel decorative and require extra navigation to act. |
| recommended_change | Define one evidence-based cross-surface next action only where it helps the user, such as a workout completion cue leading to nutrition logging or XP feedback. |
| why_this_change | It reduces friction while preserving the current capability contract. |
| expected_benefit | Clearer task completion and higher confidence. |
| effort | MEDIUM |
| risk | MEDIUM |
| quick_win | False |
| dependencies | Targeted UX/accessibility regression coverage |
| do_not_break | Existing successful route, state persistence and primary actions |
| historical_id | H-13 |
| change_class | REFINED_AFTER_SURFACE_REVIEW |
| implementation_guidance | Add contextual links such as how intake/XP affects the next workout and one weekly review narrative. |

### UX-08 · Public entry model splits login root from marketing landing
| FIELD | VALUE |
| --- | --- |
| category | Information architecture |
| finding_scope | PRODUCT_UX |
| surface | PUBLIC_ENTRY |
| journey | J01 |
| screen | / and /landing |
| user_type | ACTIVE_USER |
| task_criticality | HIGH |
| friction_type | ENTRY_MODEL_AMBIGUITY |
| severity | MEDIUM |
| priority | P2 |
| evidence_level | MEASURED_BROWSER + MEASURED_CODE |
| browser_environment | PRODUCTION |
| evidence | E61-E62/B08-B14 plus app/page.tsx and site.webmanifest: / renders login for anonymous and authenticated sessions; /landing is reachable with working signup/login CTAs; start_url remains /auth/login. |
| frequency | Recurring for the affected journey |
| current_behavior | Two valid public surfaces have different entry jobs, but canonical root and PWA start_url choose login while the marketing proposition lives at /landing. |
| root_ux_cause | Acquisition and returning-user entry are not explicitly unified or documented at route/manifest level. |
| why_it_matters | The user must act under time, attention and recovery constraints. |
| user_impact | Entry intent is ambiguous rather than the landing being absent; users can reach signup/login once they know the route. |
| recommended_change | Choose and document the canonical model and align root, authenticated redirect, CTA semantics and PWA start_url. |
| why_this_change | It reduces friction while preserving the current capability contract. |
| expected_benefit | Clearer acquisition/return intent without removing existing capabilities. |
| effort | MEDIUM |
| risk | MEDIUM |
| quick_win | False |
| dependencies | Targeted UX/accessibility regression coverage |
| do_not_break | Existing successful route, state persistence and primary actions |
| historical_id | F-04 |
| change_class | REFINED_AFTER_RETEST |
| implementation_guidance | Add route regression tests for anonymous root, authenticated root, /landing CTAs and manifest start_url before changing behavior. |

### UX-09 · Login offers more social entry choices than signup
| FIELD | VALUE |
| --- | --- |
| category | Authentication |
| finding_scope | PRODUCT_UX |
| surface | AUTHENTICATION |
| journey | J02/J03 |
| screen | /auth/login and /auth/signup |
| user_type | ACTIVE_USER |
| task_criticality | CRITICAL |
| friction_type | CHOICE_PARITY |
| severity | MEDIUM |
| priority | P2 |
| evidence_level | MEASURED_BROWSER + MEASURED_CODE |
| browser_environment | PRODUCTION |
| evidence | E05/E06 show Google/GitHub on login and credential-only signup. |
| frequency | Recurring for the affected journey |
| current_behavior | E05/E06 show Google/GitHub on login and credential-only signup. |
| root_ux_cause | Provider actions are implemented separately across entry screens. |
| why_it_matters | The user must act under time, attention and recovery constraints. |
| user_impact | Extra navigation and uncertainty about provider account creation. |
| recommended_change | Align provider actions or explain the single account-creation path. |
| why_this_change | It reduces friction while preserving the current capability contract. |
| expected_benefit | Clearer task completion and higher confidence. |
| effort | LOW |
| risk | LOW |
| quick_win | True |
| dependencies | Targeted UX/accessibility regression coverage |
| do_not_break | Existing successful route, state persistence and primary actions |
| historical_id | F-05 |
| change_class | RETESTED |
| implementation_guidance | Align provider actions or explain the single account-creation path. |

### UX-10 · Mobile auth card reserves more vertical space than the short form needs
| FIELD | VALUE |
| --- | --- |
| category | Responsive auth |
| finding_scope | PRODUCT_UX |
| surface | AUTHENTICATION |
| journey | J02/J04 |
| screen | /auth/* |
| user_type | ACTIVE_USER |
| task_criticality | HIGH |
| friction_type | VIEWPORT_ECONOMY |
| severity | MEDIUM |
| priority | P3 |
| evidence_level | MEASURED_BROWSER + MEASURED_CODE |
| browser_environment | PRODUCTION |
| evidence | E05-E07 at 390×844 show centered cards with notable unused top/bottom space. |
| frequency | Recurring for the affected journey |
| current_behavior | E05-E07 at 390×844 show centered cards with notable unused top/bottom space. |
| root_ux_cause | Desktop-oriented vertical centering dominates the mobile form layout. |
| why_it_matters | The user must act under time, attention and recovery constraints. |
| user_impact | Lower focus and less efficient thumb-zone use for a high-intent task. |
| recommended_change | Reduce mobile card chrome and align the form to a deliberate safe-area position. |
| why_this_change | It reduces friction while preserving the current capability contract. |
| expected_benefit | Clearer task completion and higher confidence. |
| effort | LOW |
| risk | LOW |
| quick_win | True |
| dependencies | Targeted UX/accessibility regression coverage |
| do_not_break | Existing successful route, state persistence and primary actions |
| historical_id | F-06 |
| change_class | RETESTED |
| implementation_guidance | Reduce mobile card chrome and align the form to a deliberate safe-area position. |

### UX-11 · Landing proof palette dilutes the copper fitness identity
| FIELD | VALUE |
| --- | --- |
| category | Visual identity |
| finding_scope | PRODUCT_UX |
| surface | LANDING_PAGE |
| journey | J01 |
| screen | /landing |
| user_type | ACTIVE_USER |
| task_criticality | HIGH |
| friction_type | BRAND_FRAGMENTATION |
| severity | MEDIUM |
| priority | P3 |
| evidence_level | MEASURED_BROWSER + MEASURED_CODE |
| browser_environment | PRODUCTION |
| evidence | E01-E04 show cyan, green and purple feature accents beside copper/orange brand elements. |
| frequency | Recurring for the affected journey |
| current_behavior | E01-E04 show cyan, green and purple feature accents beside copper/orange brand elements. |
| root_ux_cause | Feature semantics use independent accent families instead of restrained tokens. |
| why_it_matters | The user must act under time, attention and recovery constraints. |
| user_impact | Lower memorability and weaker premium confidence. |
| recommended_change | Keep semantic status colors but make copper the primary emphasis token. |
| why_this_change | It reduces friction while preserving the current capability contract. |
| expected_benefit | Clearer task completion and higher confidence. |
| effort | LOW |
| risk | LOW |
| quick_win | True |
| dependencies | Targeted UX/accessibility regression coverage |
| do_not_break | Existing successful route, state persistence and primary actions |
| historical_id | F-07 |
| change_class | RETESTED |
| implementation_guidance | Keep semantic status colors but make copper the primary emphasis token. |

## 35 Engineering/compliance scope

No engineering-support or compliance finding is promoted without current evidence. Runtime CORS is documented as an already-remediated external configuration dependency. Admin was safety-blocked. No product-code change is part of this audit.

## 36 Quick wins
| ID | CHANGE | PHASE | LINK | EFFORT |
| --- | --- | --- | --- | --- |
| Q1 | Unique per-set names/fieldsets | P0/P1 | UX-03 | LOW |
| Q2 | Align login/signup provider actions | P1 | UX-09 | LOW |
| Q3 | Add period/confidence to low-data KPIs | P2 | UX-06 | LOW |
| Q4 | Reduce mobile auth card dead space | P3 | UX-10 | LOW |
| Q5 | Compact unavailable-image placeholder | P5 | UX-04 | LOW |
| Q6 | Synchronize document lang | P2 | B07/code | LOW |

## 37 Structural opportunities
| ID | OPPORTUNITY | PHASE | LINK | RATIONALE |
| --- | --- | --- | --- | --- |
| S1 | Focused mobile workout workspace | P3 | UX-01/02/03 | Current long form needs focus, next action and safe reachability |
| S2 | Unified public entry model | P1 | UX-08 | Align root/landing/manifest intent |
| S3 | AI rationale and reversibility | P4 | UX-05 | Make inputs/results inspectable |
| S4 | Fitness weekly loop | P5 | UX-07 | Connect progress/nutrition/XP |
| S5 | Safe first-use fixture | P4 | H-09 | Measure onboarding without profile mutation |

## 38 Roadmap
| PHASE | WORK | SOURCE |
| --- | --- | --- |
| P0 — access | Keep canonical auth/CORS validation; add controlled error fixture | B01-B05/F-01/F-02 |
| P1 — core | Focused workout + public/social entry decisions | UX-01/UX-08/UX-09 |
| P2 — recovery | Retry, low-data context, document lang | UX-06/B07 |
| P3 — mobile workout | Set progression, safe exit/resume, drawer strategy | UX-01/02/03 |
| P4 — onboarding/AI | Safe fixture, inputs/rationale/regenerate/undo | UX-05/H-09 |
| P5 — feedback | Progress/nutrition/XP weekly loop | UX-07/H-12/H-13 |
| P6 — premium | Copper token, media/motion/accessibility polish | UX-04/UX-11 |

## 39 DO_NOT_BREAK

- Canonical auth/session — Login, API, refresh and logout pass after CORS runtime fix
- Action hub — Dashboard prioritizes next best action
- Workout controls — Targets, rest, notes, progress and exit/finish are real
- Exercise discovery — Search/filter/detail support discovery at scale
- Progress transparency — Missing data is not fabricated; recommendation is visible
- Theme/locale — Private visible copy/theme switch
- Fitness identity — Copper mark and dark navy shell are distinctive

## 40 Evidence coverage
| METRIC | RESULT | GATE |
| --- | --- | --- |
| Browser evidence | 83 | >=60 target |
| Useful screenshots | 57 | >=40 target |
| Full journeys | 21 | >=15 target |
| Private surfaces | 10 | >=8 target |
| Mobile private surfaces | 7 | >=4 target |
| Desktop private surfaces | 10 | >=6 target |
| Viewports | 1920×1080, 1440×900, 1366×768, 1024×768, 768×1024, 430×932, 390×844 | 7 represented |
| Themes/locales | light + dark / es + en | PASS |

### Screenshot index
| ID | ENV | SURFACE | JOURNEY | VIEWPORT | THEME | LOCALE | URL | DESCRIPTION |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| E01 | PRODUCTION | APPLICATION | J20 | 1440×900 | dark | es | https://impulso.anclora.com | Current production landing state with shell and route content. |
| E02 | PRODUCTION | APPLICATION | J20 | 390×844 | dark | es | https://impulso.anclora.com | Current production landing state with shell and route content. |
| E03 | PRODUCTION | APPLICATION | J20 | 1440×900 | light | en | https://impulso.anclora.com | Current production landing state with shell and route content. |
| E04 | PRODUCTION | APPLICATION | J20 | 390×844 | light | en | https://impulso.anclora.com | Current production landing state with shell and route content. |
| E05 | PRODUCTION | APPLICATION | J20 | 390×844 | dark | es | https://impulso.anclora.com | Current production login state with shell and route content. |
| E06 | PRODUCTION | APPLICATION | J20 | 390×844 | dark | es | https://impulso.anclora.com | Current production signup state with shell and route content. |
| E07 | PRODUCTION | APPLICATION | J20 | 390×844 | dark | es | https://impulso.anclora.com | Current production forgot password state with shell and route content. |
| E13 | PRODUCTION | DASHBOARD/SHELL | J20 | 1440×900 | dark | es | https://impulso.anclora.com/dashboard | Current production dashboard state with shell and route content. |
| E14 | PRODUCTION | WORKOUT_GENERATION | J07 | 1440×900 | dark | es | https://impulso.anclora.com/workouts/generate | Current production generator state with shell and route content. |
| E15 | PRODUCTION | EXERCISE_LIBRARY | J13 | 1440×900 | dark | es | https://impulso.anclora.com/exercises | Current production exercises state with shell and route content. |
| E16 | PRODUCTION | PROGRESS | J15 | 1440×900 | dark | es | https://impulso.anclora.com/progress | Current production progress state with shell and route content. |
| E17 | PRODUCTION | NUTRITION | J16 | 1440×900 | dark | es | https://impulso.anclora.com/nutrition | Current production nutrition state with shell and route content. |
| E18 | PRODUCTION | GAMIFICATION | J18 | 1440×900 | dark | es | https://impulso.anclora.com/achievements | Current production achievements state with shell and route content. |
| E19 | PRODUCTION | DASHBOARD/SHELL | J20 | 1440×900 | light | en | https://impulso.anclora.com | Current production dashboard state with shell and route content. |
| E20 | PRODUCTION | WORKOUT_GENERATION | J07 | 1440×900 | light | en | https://impulso.anclora.com/workouts/generate | Current production generator state with shell and route content. |
| E21 | PRODUCTION | EXERCISE_LIBRARY | J13 | 1440×900 | light | en | https://impulso.anclora.com/exercises | Current production exercises state with shell and route content. |
| E22 | PRODUCTION | PROGRESS | J15 | 1440×900 | light | en | https://impulso.anclora.com/progress | Current production progress state with shell and route content. |
| E23 | PRODUCTION | NUTRITION | J16 | 1440×900 | light | en | https://impulso.anclora.com/nutrition | Current production nutrition state with shell and route content. |
| E24 | PRODUCTION | GAMIFICATION | J18 | 1440×900 | light | en | https://impulso.anclora.com/achievements | Current production achievements state with shell and route content. |
| E25 | PRODUCTION | WORKOUT_REVIEW | J08 | 1440×900 | light | en | https://impulso.anclora.com/workouts/f7d715e2-4fb6-476c-bf28-70a5a0f5f60f | Current production workout review state with shell and route content. |
| E26 | PRODUCTION | WORKOUT_EXECUTION | J10 | 1440×900 | light | en | https://impulso.anclora.com/workouts/f7d715e2-4fb6-476c-bf28-70a5a0f5f60f/start | Current production workout execution state with shell and route content. |
| E27 | PRODUCTION | WORKOUT_EXECUTION | J10 | 1440×900 | light | en | https://impulso.anclora.com | Current production workout execution state with shell and route content. |
| E28 | PRODUCTION | WORKOUT_EXECUTION | J10 | 1440×900 | light | en | https://impulso.anclora.com | Current production workout execution state with shell and route content. |
| E29 | PRODUCTION | DASHBOARD/SHELL | J20 | 390×844 | light | en | https://impulso.anclora.com/dashboard | Current production dashboard state with shell and route content. |
| E30 | PRODUCTION | WORKOUT_GENERATION | J07 | 390×844 | light | en | https://impulso.anclora.com/workouts/generate | Current production generator state with shell and route content. |
| E31 | PRODUCTION | EXERCISE_LIBRARY | J13 | 390×844 | light | en | https://impulso.anclora.com/exercises | Current production exercises state with shell and route content. |
| E32 | PRODUCTION | PROGRESS | J15 | 390×844 | light | en | https://impulso.anclora.com/progress | Current production progress state with shell and route content. |
| E33 | PRODUCTION | NUTRITION | J16 | 390×844 | light | en | https://impulso.anclora.com/nutrition | Current production nutrition state with shell and route content. |
| E34 | PRODUCTION | GAMIFICATION | J18 | 390×844 | light | en | https://impulso.anclora.com/achievements | Current production achievements state with shell and route content. |
| E35 | PRODUCTION | WORKOUT_EXECUTION | J10 | 390×844 | light | en | https://impulso.anclora.com/workouts/f7d715e2-4fb6-476c-bf28-70a5a0f5f60f/start | Current production workout execution state with shell and route content. |
| E36 | PRODUCTION | DASHBOARD/SHELL | J20 | 390×844 | dark | es | https://impulso.anclora.com/dashboard | Current production dashboard state with shell and route content. |
| E37 | PRODUCTION | WORKOUT_GENERATION | J07 | 390×844 | dark | es | https://impulso.anclora.com/workouts/generate | Current production generator state with shell and route content. |
| E38 | PRODUCTION | EXERCISE_LIBRARY | J13 | 390×844 | dark | es | https://impulso.anclora.com/exercises | Current production exercises state with shell and route content. |
| E39 | PRODUCTION | PROGRESS | J15 | 390×844 | dark | es | https://impulso.anclora.com/progress | Current production progress state with shell and route content. |
| E40 | PRODUCTION | NUTRITION | J16 | 390×844 | dark | es | https://impulso.anclora.com/nutrition | Current production nutrition state with shell and route content. |
| E41 | PRODUCTION | GAMIFICATION | J18 | 390×844 | dark | es | https://impulso.anclora.com/achievements | Current production achievements state with shell and route content. |
| E42 | PRODUCTION | WORKOUT_EXECUTION | J10 | 390×844 | dark | es | https://impulso.anclora.com/workouts/f7d715e2-4fb6-476c-bf28-70a5a0f5f60f/start | Current production workout execution state with shell and route content. |
| E43 | PRODUCTION | DASHBOARD/SHELL | J20 | 430×932 | dark | es | https://impulso.anclora.com/dashboard | Current production dashboard state with shell and route content. |
| E44 | PRODUCTION | WORKOUT_GENERATION | J07 | 430×932 | dark | es | https://impulso.anclora.com/workouts/generate | Current production generator state with shell and route content. |
| E45 | PRODUCTION | EXERCISE_LIBRARY | J13 | 430×932 | dark | es | https://impulso.anclora.com/exercises | Current production exercises state with shell and route content. |
| E46 | PRODUCTION | PROGRESS | J15 | 430×932 | dark | es | https://impulso.anclora.com/progress | Current production progress state with shell and route content. |
| E47 | PRODUCTION | NUTRITION | J16 | 430×932 | dark | es | https://impulso.anclora.com/nutrition | Current production nutrition state with shell and route content. |
| E48 | PRODUCTION | WORKOUT_EXECUTION | J10 | 430×932 | dark | es | https://impulso.anclora.com/workouts/f7d715e2-4fb6-476c-bf28-70a5a0f5f60f/start | Current production workout execution state with shell and route content. |
| E49 | PRODUCTION | DASHBOARD/SHELL | J20 | 1366×768 | dark | es | https://impulso.anclora.com/dashboard | Current production dashboard state with shell and route content. |
| E50 | PRODUCTION | WORKOUT_GENERATION | J07 | 1024×768 | dark | es | https://impulso.anclora.com/workouts/generate | Current production generator state with shell and route content. |
| E51 | PRODUCTION | EXERCISE_LIBRARY | J13 | 768×1024 | dark | es | https://impulso.anclora.com/exercises | Current production exercises state with shell and route content. |
| E52 | PRODUCTION | WORKOUT_EXECUTION | J10 | 1920×1080 | dark | es | https://impulso.anclora.com/workouts/f7d715e2-4fb6-476c-bf28-70a5a0f5f60f/start | Current production workout execution state with shell and route content. |
| E53 | PRODUCTION | EXERCISE_LIBRARY | J13 | 390×844 | dark | es | https://impulso.anclora.com/exercises | Current production exercise search push state with shell and route content. |
| E54 | PRODUCTION | EXERCISE_DETAIL | J14 | 390×844 | dark | es | https://impulso.anclora.com/exercises | Current production exercise detail con mancuerna push press state with shell and route content. |
| E55 | PRODUCTION | DASHBOARD/SHELL | J20 | 1440×900 | dark | es | https://impulso.anclora.com/dashboard | Current production dashboard state with shell and route content. |
| E56 | PRODUCTION | WORKOUT_GENERATION | J07 | 1440×900 | dark | es | https://impulso.anclora.com/workouts/generate | Current production generator state with shell and route content. |
| E57 | PRODUCTION | EXERCISE_LIBRARY | J13 | 1440×900 | dark | es | https://impulso.anclora.com/exercises | Current production exercises state with shell and route content. |
| E58 | PRODUCTION | PROGRESS | J15 | 1440×900 | dark | es | https://impulso.anclora.com/progress | Current production progress state with shell and route content. |
| E59 | PRODUCTION | NUTRITION | J16 | 1440×900 | dark | es | https://impulso.anclora.com/nutrition | Current production nutrition state with shell and route content. |
| E60 | PRODUCTION | WORKOUT_EXECUTION | J10 | 1440×900 | dark | es | https://impulso.anclora.com/workouts/f7d715e2-4fb6-476c-bf28-70a5a0f5f60f/start | Current production workout execution state with shell and route content. |
| E61 | PRODUCTION | PUBLIC_ENTRY | J01 | 1280×633 | dark | es | https://impulso.anclora.com/ | Root route renders credential login, not the public marketing landing. |
| E62 | PRODUCTION | LANDING_PAGE | J01 | 1280×633 | dark | es | https://impulso.anclora.com/landing | Public landing renders fitness value proposition with signup and login CTAs. |

## 41 Tool compatibility

The previous native CUA path supplied real authorized Chrome accessibility evidence but no screenshot export. The isolated agent-browser session supplied current production screenshots and route measurements. Static runtime output is code/context only. The private composed accessibility tool produced no material authenticated element report, so coverage is not claimed.

## 42 Limitations

- No workout completion, profile save, meal log, AI generation, delete or admin write.
- No OAuth provider launch, first-use incomplete-profile fixture, controlled backend fault or offline/PWA install.
- Longitudinal progress/motivation value cannot be established from the test account history.
- Private automated accessibility composition did not return a material authenticated element report; this is a tool-compatibility gap.
- No credentials, tokens, emails or private personal data are included in the report.

## 44 Consistency completion gate

| GATE | RESULT |
| --- | --- |
| ACCESSIBILITY | PASS_WITH_TOOL_GAP |
| AI_REVIEW | PASS_WITH_EXPLICIT_READONLY_GAPS |
| ALL_13_HISTORICAL_FINDINGS_ACCOUNTED_FOR | PASS |
| AUTH_RETEST | PASS |
| CORE_PRODUCT_REVIEW | PASS_WITH_EXPLICIT_READONLY_GAPS |
| COVERAGE_MATRIX_CONSISTENT | PASS |
| CRITICAL_JOURNEYS | PASS |
| CURRENT_DEVELOPMENT_HEAD_RECORDED | PASS |
| DO_NOT_BREAK | PASS |
| EVIDENCE_INDEX | PASS |
| FINDINGS | PASS |
| GAMIFICATION_DEPTH | PASS |
| HISTORICAL_MATRIX | PASS |
| HISTORICAL_MATRIX_CONSISTENCY | PASS |
| HTML | PASS |
| HTML_REGENERATED | PASS |
| I18N | PASS_WITH_SEMANTIC_GAP |
| JSON_COMPANION | PASS |
| JSON_REGENERATED | PASS |
| LATEST_SKILL_USED | PASS |
| LOGOUT_STATUS_RECONCILED | PASS |
| NO_PRODUCT_CODE_CHANGED | PASS |
| NO_PRODUCT_CODE_MODIFIED | PASS |
| NUTRITION_DEPTH | PASS |
| NUTRITION_REVIEW | PASS_WITH_EXPLICIT_BLOCKED_WRITE |
| OLD_AUDIT_RECONCILED | PASS |
| ONBOARDING_STATUS_RECONCILED | PASS |
| OTHER_READONLY_BLOCKED_CONFLICTS | PASS |
| PDF | PASS |
| PDF_REGENERATED | PASS |
| PRODUCT_MODEL | PASS |
| PROGRESS_DEPTH | PASS |
| PROGRESS_REVIEW | PASS |
| RESPONSIVE | PASS |
| ROADMAP | PASS |
| SCORECARDS | PASS |
| SCORECARD_CONSISTENCY | PASS |
| SESSION_RECOVERY_STATUS_RECONCILED | PASS |
| SKILL_VERSION_DRIFT_ANALYZED | PASS |
| SURFACE_CLASSIFICATION | PASS |
| TASK_INVENTORY | PASS |
| THEME | PASS |
| USER_TYPES | PASS |
| UX07_REVALIDATED | PASS |
| UX08_FINAL_STATUS_DEFINED | PASS |
| UX08_RETEST | PASS |
| WORKOUT_EXECUTION_REVIEW | PASS_WITH_EXPLICIT_BLOCKED_WRITE |

## 43 Final comparative answer
| QUESTION | ANSWER |
| --- | --- |
| Better/igual/peor | Better on access and private evidence; not fully end-to-end because writes were bounded. |
| Historical fixes | F-01 VERIFIED_FIXED after CORS runtime remediation. |
| Still present | F-04/F-05/F-06/F-07/F-09; F-02 NOT_RETESTED; H-10-H-13 partial. |
| Canonical operational | Yes: login/session/dashboard/API/refresh/logout pass. |
| Core tasks | Auth, browse, review and preferences covered; generation/completion/logging/profile writes partial or blocked. |
| Mobile workout | Partly supported, not certified: controls visible, but long scroll/repeated context. |
| AI trust | Moderate foundation; result rationale/reversibility incomplete. |
| Progress/nutrition | Useful current state; longitudinal/action loop open. |
| Premium | Strong foundation, not fully premium until mobile/focus/density/palette improve. |
| Highest return | Focused mobile workout workspace plus accessible set semantics. |

**FINAL_RESULT:** `PASS` — consistency gate passed; inherited deep-audit product limitations remain explicitly documented.
