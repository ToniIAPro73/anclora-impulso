# AI-01 appendix — existing specifications → AI-xx (read and checked against code)

Method: each specification's goal and acceptance criteria were read (`sdd/features/*`, plus the larger documents
under `docs/specs` and `docs/roadmap/impulso-post-ux-health/`), then the claimed capability was looked up in source.
No tests were re-run for this mapping. Earlier "PASS" lines in the historical gate reports are **historical (H)**
evidence, not re-verified.

**Classes.** *Confirmed* = code verified and the AI task's acceptance concerns the same capability.
*Partial* = code verified, but only part of the AI task's criteria is covered (the gap is stated).
*Doubtful* = related subject; coverage cannot be argued from the code.
*None* = no roadmap task corresponds.
Duplication rule: a Confirmed/Partial row means the AI task must **extend** what exists, not rebuild it.

## A. `sdd/features/*`
| Specification | AI task | Class | Verified in code | Not covered by it (what the AI task still needs) |
|---|---|---|---|---|
| `fase-0-estabilizacion-ci` | AI-09 | **Partial** | `.github/workflows/ci.yml` runs backend migrate/test/build and frontend lint/typecheck/test/build (as the spec states) | lockfile reproducibility (frontend job uses `npm install` with a pnpm lockfile), vulnerability scan, alerts, backup/restore and rollback rehearsal, sanitized CI logs |
| `fase-0-estabilizacion-ci` | AI-06 | **Confirmed (explicit deferral)** | spec "Out of scope": persisted/revocable refresh sessions | the whole of AI-06 (now designed and implemented locally) |
| `fase-1-onboarding-streaks` | AI-11 | **Doubtful** | `sessions.service.ts` awards XP/streak on completion; achievements | AI-11's journey reduction, 390 px validation, empty/error states; fase-1 is gamification, not the onboarding journey |
| `fase-2-tracking-avanzado` | AI-12 | **Partial** | `createSessionSchema` accepts reps/weight/RIR/RPE/rest; `PUT/DELETE /api/sessions/:id`; `GET /api/progress/strength` | pending vs confirmed state, idempotent keys, explicit conflict, network-failure E2E (no such code existed before this work's idempotency for coach/generate; **not** applied to sessions) |
| `fase-3-dynamic-progression` | AI-13 | **Partial** | `services/progression/engine.ts`, `POST /api/v1/progression/next-session`, deload after 3 stalls, readiness input | weekly review of adherence/discomfort/time (only a `weekly_review` *nudge* in `engagement.service.ts` exists), pain rules, professional review of increments |
| `fase-4-llm-coach` | AI-14 | **Confirmed (backend); criteria Partial** | provider abstraction, guardrails, per-window quota, memory, `POST /api/v1/coach/messages` | evaluation corpus, ES/EN limit policy review, data/instruction separation against injection, visible quota UI, any user interface |
| `fase-4-llm-coach` | AI-08 | **Confirmed** | the per-window counter it introduced was non-atomic; replaced by the atomic reservation of this work | — |
| `fase-5-social-community` | AI-07 | **Confirmed (risk)** | `socialProfileVisibility` default `"public"`; feed/kudos/challenges | opt-in/private default, export/erase, legal review |
| `fase-5-social-community` | AI-02 | **Doubtful** | feature present; the plan says not to expand to an open social network, while AI-02's hide list names video, voice and wearables only | whether social is kept out of promises is a product decision to record in the promise matrix |
| `fase-6-smart-nutrition` | — | **None** (outside the strength/adherence pilot) | foods, targets, logs, meal-plan shell; `HEALTH_DATA_IMPORT_ENABLED` default off | touchpoint only: AI-07 (health data), AI-02 (nutrition copy changed) |
| `fase-7-wearables-readiness` | AI-02 | **Confirmed** | `WEARABLE_*` flags default off in `config/env.ts`; readiness feeds progression | keep hidden from paid promises (plan: no wearables) |
| `fase-8-premium-form-voice` | AI-02 | **Confirmed** | `FORM_ANALYSIS_ENABLED`/`VOICE_COACH_ENABLED` default off; scripted cues, no media processing | hide in offer; plan forbids video/voice promises |
| `fase-8-premium-form-voice` | AI-16 | **Confirmed (prior art to replace)** | `premium.service.ts` decides entitlement from `User.subscriptionTier` only | server Subscription/Entitlement, webhooks, reconciliation — AI-16 *rejects* tier-only access |
| `dashboard-shell-and-entry` | AI-11 | **Doubtful** | shell/header/language/theme exist | spec says `/` redirects to login; code and the later P3 gate render the landing at `/` → **spec superseded** |
| `modal-scroll-close-and-localization` | AI-11 | **Partial** | onboarding dialog scroll/close fixes; component test present | journey length, 390 px matrix evidence, keyboard flow end to end |
| `workout-accessibility-certification` | AI-12 | **Doubtful** | accessible names on timer/set controls (`aria-label`s in the start page) | reliability semantics of AI-12 are unrelated |
| `exercise-display-localization` | AI-02 | **Doubtful** | localized exercise copy (`localized-exercise-copy` test) | the plan's ES/EN *promise* review (landing/paywall) |
| `exercise-image-completion`, `health-plan-card-spacing`, `certification-fixture-display-name`, `meal-plan-variety-all-diets`, `meal-plan-variety-completion`, `no-oven-nutrition-recipes` | — | **None** | content/visual/nutrition-library work | not roadmap tasks |

## B. `docs/specs` and `docs/roadmap/impulso-post-ux-health` (not under `sdd/`)
| Document | AI task | Class | Verified in code | Not covered / note |
|---|---|---|---|---|
| SPEC "Health Plans + Post UX Re-audit" §8 (Ruta Vital 50–60), P1 gate | AI-03 | **Partial** | `health-plans.domain.ts`: pillars, phases (weeks 1–4, 5–12, months 4–6), safety classification with 12 "professional review recommended" signals; `/api/health-plans` (7 routes) | different cohort (50–60, explicit boundaries) and program shape than the plan's 8-week 40+ strength program; **no professional review record** found; exercise-level rules absent |
| same, §8.6 safety model | AI-13 | **Partial** | `classifySafety` → `REDUCE` guidance | not connected to workout generation/progression |
| P4 "AI trust" and P4 gate | AI-02, AI-05 | **Confirmed** | `workout-generator.tsx`: inputs used, rationale, regenerate, discard via ownership-protected delete | P4-M02 *generation state with pending/idempotency* and P4-M05 *retry* were planned; idempotency/retry semantics were **added by this work** (server + client). Mode honesty (fallback) was not in P4 |
| P2 "Workout experience" and P2 gate | AI-12 | **Partial** | start page: current-exercise index, `fieldset`/`legend`, local draft persistence (`localStorage` key per user/workout). A "sticky" status card is claimed by the gate report (H) and was not found in that file | server-confirmed saves, idempotent finish, conflict handling |
| P2 / P3 responsive claims (390/430/1440) | AI-11 | **Doubtful** | gate reports claim a matrix; no run was repeated here | needs fresh E2E evidence |
| P3 "Public entry and auth" and P3 gate | AI-11 / AI-06 | **Partial / deferral** | `/` renders the landing; signup/login provider parity; PWA `start_url` | P3 lists "session model change" as out of scope → AI-06 stands alone |
| P5, P6 | — | **None** | cross-links, placeholders | not roadmap tasks |
| P7 "Release hardening" | AI-09 | **Doubtful** | document language sync, regression runs | CI reproducibility/restore/alerts not addressed |
| `product-events` (backend) + `lib/product-events` (client) | AI-18 | **Partial** | `POST /api/events`, `trackProductEvent('workout_generated', …)` | event dictionary, pseudonymous ids, dedupe, consent gate, cohort queries |

## C. AI tasks with no existing counterpart
AI-15, AI-17 (no payment provider code exists), AI-19, AI-20/AI-26/AI-30 (gates), AI-21…AI-25, AI-27…AI-29 (human/commercial
activities). AI-10 (G1) is a gate.

## D. Documentation drift found while mapping (informative; not corrected)
1. `dashboard-shell-and-entry` spec says `/` redirects to `/auth/login`; code and the P3 gate report say `/` shows the landing.
2. `docs/roadmap/.../P2…P7` phase documents still read "Status: MISSING / NEEDS_VERIFICATION" while their final-gate reports
   describe implemented changes; the gate reports are the more recent statements (H).
3. `CLAUDE.md` describes an httpOnly refresh cookie and "production-ready"; neither matches the code read.
4. The gate reports cite 78 frontend tests / 41 backend tests; the repository now runs 96 / 126 (different time).

## E. Conclusion for the AI-01 reject condition "trabajo duplicado"
Each Confirmed/Partial row above identifies existing work that the corresponding AI task must extend. No AI task as
implemented in this work re-created an existing capability: provenance/validator/fallback extend the P4 generator
panel; sessions, idempotency, quota reservation and retention are new server mechanisms; the premium entitlement
remains the prior art to be replaced by AI-16.
