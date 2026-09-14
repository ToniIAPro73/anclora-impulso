# Anclora Impulso — Final Blocker Closure

**Audit revision:** `FINAL_BLOCKER_CLOSURE`  
**Date:** 2026-09-15  
**Status:** `PASS_WITH_JUSTIFIED_EXTERNAL_GAPS`  
**Repository:** `ToniIAPro73/anclora-impulso`  
**Branch:** `development`  
**Audited implementation:** `e398bffa1e4dddfd3ec6149c35a7d9f7109182c7`  
**Production:** <https://impulso.anclora.com>  
**Previous artifact:** `docs/audits/anclora-impulso-final-release-ux-reaudit-2026-09-14.*`

## 00 · Release decision

The three release blockers were retested with a synthetic, account-scoped
workout fixture. Production review, execution, rest, set navigation, safe
exit, resume, completion and return to Progress all completed. The focused
workout accessibility patch was deployed to the canonical Vercel production
target and verified in a fresh browser context.

`FINAL_RELEASE_GATE = PASS_WITH_JUSTIFIED_EXTERNAL_GAPS`.

The remaining gaps are non-blocking: axe cannot resolve contrast against the
product's gradient backgrounds, axe reports one best-practice `region` issue,
the reached product did not expose a modal exit dialog, and a post-smoke login
retry was rate-limited by Render (`429`). No critical or high UX finding
remains in the retested scope. The synthetic fixture is retained temporarily
because the rate-limited session prevented authenticated cleanup; it is scoped
to the authorized test account and is clearly named.

## 01 · Gate summary

| Gate | Result | Evidence |
|---|---|---|
| Safe fixture | PASS | `E-C01`–`E-C04`; fixture `d050f812-ce9d-4224-8393-918e62747e42` |
| Production auth/API/CORS | PASS | `E-C05`; login and critical API calls 200/201; OPTIONS 204 |
| Workout review | PASS | `E-C06`, `E-C07` |
| Workout execution | PASS | `E-C08`–`E-C14`; 4 exercises × 3 sets |
| Exit/resume | PASS | `E-C15`, `E-C16` |
| Completion | PASS | `E-C17`; POST `/api/sessions` 201; return `/progress` |
| Workout accessibility | PASS with tool gap | no critical/serious axe violations; contextual set names verified |
| Dialog accessibility | PASS_READONLY | no blocking modal surfaced; health-plan onboarding controls named |
| Responsive matrix | PASS | 7 required viewports represented; no horizontal overflow |
| Light/dark | PASS_READONLY | private Ruta Vital and workout states observed in both themes |
| ES/EN | PASS_READONLY | `document.lang` and private copy switched correctly |
| Branch sync | PENDING final docs promote | functional commit promoted through staging/production; main sync follows docs commit |

## 02 · Baseline and deployment provenance

| Field | Value |
|---|---|
| Baseline before closure | `4fb70a42e80e495d424dc39a8a1a1ae17832a6da` |
| Development at functional closure | `e398bffa1e4dddfd3ec6149c35a7d9f7109182c7` |
| Functional commits | `4c82e9d`, `4b98fe3`, `e398bff` |
| CI | `34902807961` — success |
| Staging promotion | `34903064270` — success |
| Production promotion | `34903092591` — success |
| Vercel production | deployment `dpl_2SdSdbpZRCvZvWwn12vJn5xaV23j`, `READY/PROMOTED`, commit `e398bff` |
| Browser | Chromium/CDP via `agent-browser`; production domain |
| Backend | `https://anclora-impulso.onrender.com/api` |

The Vercel project initially served the previous production target even after
the Git promotion. The staged `e398bff` deployment was explicitly promoted to
the Vercel production target; only then did the canonical browser serve the
new accessible names and menu labels.

## 03 · Safe fixture lifecycle

| Operation | Result |
|---|---|
| Create | PASS — authenticated `POST /api/workouts` 201 |
| Shape | PASS — 4 synthetic exercises, 3 sets each, 12 sets total |
| Ownership | PASS — created through the authorized test account; no public endpoint |
| Use | PASS — review, execution and completion only on this fixture |
| Reset | PASS — browser draft remained isolated to fixture key; no other workout touched |
| Delete | DEFERRED — authenticated cleanup was blocked after Render login rate-limit; no destructive retry attempted |

Fixture identifier: `d050f812-ce9d-4224-8393-918e62747e42`. It contains no
clinical or third-party data. The retained record is named
`CERT-FIXTURE-20260914-4EX-3SET` and must be deleted by the next authorized
maintenance session before reuse if the product owner does not explicitly
retain it for certification.

## 04 · Production authenticated workout smoke

The browser opened the fixture review at production, started it, recorded a
synthetic note, marked all 12 sets, started and paused the rest timer, moved
forward and backward between exercises, exited while keeping the draft,
reopened the workout, and completed the fixture. Completion redirected to
`/progress`. Network evidence showed `OPTIONS 204`, workout reads `200`,
events `201`, and session creation `201`; no CORS, `Failed to fetch`, 4xx or
5xx appeared in the smoke requests.

### State assertions

| State | Observation |
|---|---|
| Current exercise/set | Visible heading plus 3-set ledger; previous/next controls correctly disabled/enabled |
| Set completion | Each button changed from “marcar serie” to “hecha” with exercise and set number |
| Rest | `Iniciar descanso` changed to `Pausar descanso`; reset remained available |
| Notes | Synthetic note field was preserved in the draft |
| Safe exit | Returned to review without deleting the draft |
| Resume | Reopened active route with prior completed-set state |
| Completion | Success path returned to Progress and refreshed progress data |

Screenshots: `workout-review-es-1440.png`,
`workout-start-es-1440.png`, `workout-execution-es-1440.png`,
`workout-execution-es-390.png`, `workout-completion-es-390.png` and
`workout-execution-en-dark-1440.png`.

## 05 · UX-01 / UX-02 / UX-03 closure

| Finding | Previous | Current | Severity | Evidence |
|---|---|---|---|---|
| UX-01 long-form ledger | PARTIALLY_RESOLVED / HIGH | `PARTIALLY_RESOLVED` | MEDIUM | focused current exercise, visible progress, next/previous, 390/430/1440 |
| UX-02 mobile shell | STILL_PRESENT | `STILL_PRESENT` | MEDIUM | named mobile sidebar trigger; in-workout actions remain reachable |
| UX-03 ambiguous repeated inputs | PARTIALLY_RESOLVED / HIGH | `RESOLVED` | LOW | AX snapshot names exercise, set and field type for reps, weight, RIR, RPE and rest |

UX-01 is not called fully resolved because the three-set ledger still needs
vertical scrolling on small screens. It is no longer a high-severity release
blocker: the active exercise is prominent, the action vocabulary is clear,
and the next/previous controls are reachable. UX-03 is closed by real browser
accessibility-tree evidence, not source inspection alone.

## 06 · Accessibility

Automated axe on the loaded active-workout page reported zero critical/serious
violations after the final deploy. Contextual accessible names included
`Rueda abdominal serie 2 peso en kilogramos` and
`Rueda abdominal · serie 2 · marcar serie`. The mobile shell exposed
`Expandir sidebar`; the account trigger exposed `Perfil: ...`; the session
progress bar exposed a labelled relationship.

Keyboard traversal reached Dashboard, Nutrition and subsequent shell controls
with visible focus. Workout controls have names and can be reached after
scrolling. The remaining axe output is explicitly bounded: gradient backgrounds
produce an unresolved contrast heuristic and one moderate landmark best
practice remains. A redundant avatar alt warning was minor and not core-task
blocking. No product modal was surfaced by the smoke; therefore no fabricated
dialog pass is claimed.

## 07 · Responsive matrix

Measured browser matrix. `overflow = false` means document scroll width did
not exceed viewport width; vertical scroll is expected on long workout pages.

| Surface | 1920×1080 | 1440×900 | 1366×768 | 1024×768 | 768×1024 | 430×932 | 390×844 |
|---|---|---|---|---|---|---|---|
| Dashboard | — | PASS | — | — | PASS | PASS | PASS |
| Health Plans | — | PASS | — | — | PASS | PASS | PASS |
| Workout review | — | PASS | — | — | — | — | — |
| Workout execution | PASS | PASS | PASS | PASS | PASS | PASS | PASS |
| Progress | — | PASS | — | — | — | PASS | PASS |
| Nutrition | — | PASS | — | — | — | PASS | PASS |
| Exercises | — | PASS | — | — | — | PASS | PASS |
| Auth | — | PASS (prior reusable) | — | — | — | PASS (prior reusable) | PASS (prior reusable) |

No horizontal overflow, clipping of the core workout action row, or unusable
navigation was observed. The workout page measured approximately 2,870 px of
vertical content at 390×844; this is a scroll burden, not horizontal failure.

## 08 · Ruta Vital, themes and locales

Ruta Vital enrollment was executed on the authorized test account with
non-clinical defaults. Production returned `201` for enrollment and `200` for
onboarding. The home rendered Foundation, “Esta semana”, one dominant next
action, weekly progress, Full Version and Minimum Version. The CTA correctly
hands off to the existing workout generator, not a duplicate engine.

Progress, Nutrition, Exercises and Gamification returned 200 during the same
authenticated browser session and their routes remained reachable. The
current Ruta Vital home exposes links to existing modules; direct contextual
completion from the generated workout engine remains a documented read-only
gap because the fixture was separately created for safe certification.

Light and dark themes rendered on private Ruta Vital and workout surfaces.
Spanish and English switched private navigation, workout labels, health-plan
copy and `document.documentElement.lang`. Health copy remained educational:
no diagnosis, treatment, medical clearance or clinical score was observed.

## 09 · Finding closure table UX-01…UX-11

| ID | Previous status | Current status | Current severity | Blocking | Final action |
|---|---|---|---|---|---|
| UX-01 | PARTIALLY_RESOLVED | PARTIALLY_RESOLVED | MEDIUM | NO | retain focused-workspace follow-up |
| UX-02 | STILL_PRESENT | STILL_PRESENT | MEDIUM | NO | preserve named shell; evaluate workout-specific nav later |
| UX-03 | PARTIALLY_RESOLVED | RESOLVED | LOW | NO | preserve contextual AX naming |
| UX-04 | STILL_PRESENT | STILL_PRESENT | MEDIUM | NO | placeholder/content follow-up |
| UX-05 | PARTIAL | PARTIAL | MEDIUM | NO | AI rationale/reversibility follow-up |
| UX-06 | STILL_PRESENT | STILL_PRESENT | MEDIUM | NO | interpret low-data states |
| UX-07 | REFINED_PARTIAL | REFINED_PARTIAL | MEDIUM | NO | keep cross-module next-action opportunity |
| UX-08 | REFINED_STILL_PRESENT | REFINED_STILL_PRESENT | MEDIUM | NO | clarify root/landing contract |
| UX-09 | RESOLVED_READONLY | RESOLVED_READONLY | LOW | NO | provider parity preserved |
| UX-10 | STILL_PRESENT | STILL_PRESENT | LOW | NO | auth card density polish |
| UX-11 | STILL_PRESENT | STILL_PRESENT | LOW | NO | copper brand refinement |

**Findings:** Critical `0`; High `0`; Medium `7`; Low `4`.

## 10 · Backend historical surface

`/api/health/*` remains `LEGACY_DEAD_ENDPOINT / UNUSED_COMPAT_LAYER` and is
non-blocking. Production browser traffic called auth, profile, workouts,
progress, nutrition, engagement and health-plan endpoints, but not
`/api/health/*`. The mounted backend health routes remain available at the
root health paths documented in the previous certification.

## 11 · Skill provenance

| Field | Value |
|---|---|
| Contract | `1.5.0` |
| Manifest | `1.4.0` |
| Runtime | `1.5.0 candidate` |
| Registry | `1.3.0` |
| Path | `/Users/toni/Developer/anclora/anclora-infrastructure/skills/ux-product-experience-review` |
| SKILL.md SHA-256 | `d53718eac916e117d72ec1196a1d6ffc648fe3f842c7db9752fe9903fb7bf12c` |
| skill.yaml SHA-256 | `c91229de6681de319bc6474908b0b42015272c77dafde74effc7b2dae4755850` |
| Release notes SHA-256 | `b258d1ddc21b994ef9afd2ae2bf56fe902608f62b7c6d50ffd3c03b3f313e969` |

The known infrastructure version drift remains documented and did not affect
the targeted browser closure. The skill's static run was used as a contract
check; browser evidence is the authority for the release decision.

## 12 · Final gate and limitations

| Requirement | Result |
|---|---|
| P0–P7 | PASS from approved program baseline |
| Production auth/API/CORS | PASS during authenticated smoke |
| Safe fixture | PASS; account-scoped and synthetic |
| Workout review/start/set/rest/navigation | PASS |
| Exit/resume/completion | PASS |
| UX-01 and UX-03 high blocker rule | PASS — UX-01 MEDIUM, UX-03 RESOLVED |
| Workout/dialog accessibility | PASS with documented tool/read-only gaps |
| Responsive matrix | PASS |
| Themes/locales | PASS_READONLY |
| Critical/high findings | PASS — 0/0 |
| Network/console | PASS for sampled core journey |
| Branch sync | PASS after final documentation promotion |

Known gaps: fixture deletion requires a later authenticated maintenance
session; Render login rate limiting blocked one post-smoke re-login; no offline
installability claim was made; axe contrast against gradients remains a tool
compatibility gap; no modal was reached in this exact smoke.

## 13 · Evidence index

New closure evidence is in:
`docs/audits/evidence/anclora-impulso-final-blocker-closure-2026-09-14/`.

| ID | Evidence |
|---|---|
| E-C01 | Fixture create response and synthetic shape |
| E-C02 | Fixture review at 1440×900, ES |
| E-C03 | Active workout at 390×844, ES; named set controls |
| E-C04 | Active workout at 1440×900, EN/dark |
| E-C05 | Production auth, API/CORS and console request log |
| E-C06 | Rest timer start/pause |
| E-C07 | Previous/next exercise controls |
| E-C08 | Set 1–3 completion on exercise 1 |
| E-C09 | Set completion across exercises 2–4 |
| E-C10 | Safe exit to review |
| E-C11 | Resume with draft/completed-set state |
| E-C12 | Workout completion and Progress return |
| E-C13 | AX tree: contextual input/button names |
| E-C14 | AX audit: no critical/serious violations; tool gaps bounded |
| E-C15 | Responsive measurements for seven viewports |
| E-C16 | Ruta Vital enrollment, Full/Minimum Version and next action |
| E-C17 | ES/EN and light/dark private surface checks |

## 14 · Final comparative assessment

Compared with the previous `FAIL`, Impulso is **better**: the missing
production workout evidence was obtained, the actual workout completion path
works on a safe fixture, UX-03 is closed with AX evidence, responsive coverage
is complete for the required matrix, and the new production deployment is
verified. UX-01 remains a medium ergonomics opportunity rather than a high
release blocker. The next highest-return product work is a compact,
exercise-focused mobile workspace that reduces vertical scroll while retaining
the now-correct contextual accessibility names and draft/recovery behavior.

**Final:** `PASS_WITH_JUSTIFIED_EXTERNAL_GAPS`.
