# AI-03 reviewer dossier v1

Prepared by engineering for a **competent exercise professional** (reviewer: *not yet named*). This document
does not contain, and must not be read as, a professional approval. AI-04 and AI-05 cannot be ACEPTADAS until
the review record below is completed by the reviewer.

## 1. What the reviewer is asked to decide
1. Hard ceilings the application must never exceed in an automatically produced routine.
2. Which exercise templates/rules are acceptable fallbacks when AI generation fails.
3. Exclusions and referral rules (pain, injury, medical conditions) for the 40+ pilot, **without diagnosing**.
4. Wording of in-app notices where they touch exercise advice.

## 2. Current engineering placeholder (NOT reviewed)
Source: `backend/src/services/workouts/plan-limits.ts`, `reviewStatus: PENDING_PROFESSIONAL_REVIEW`.

| Parameter | Placeholder | Why it exists |
|---|---|---|
| Exercises per routine | ≤ 6 (≤ 5 if age ≥ 40) | Envelope of the pre-existing generator |
| Sets per exercise | 1–5 | same |
| Reps per set | 1–15 | same |
| Rest between sets | 0–75 s | same |
| Beginner / intermediate / advanced prescription | 3×10 / 4×12 / 5×15 | pre-existing difficulty table, not a progression model |
| Rest for age ≥ 40 or "reduce" adjustment | 75 s (else 60 s) | pre-existing |

These numbers are **not** professionally derived: they only prevent the AI path from being more demanding than
the app's previous non-AI path. The reviewer may replace every value.

## 3. What the software enforces today (verifiable)
- AI output is accepted only if: object shape, integer types, ≥1 exercise, every ID in the candidate catalogue for
  the request, no duplicate exercise/order, equipment/environment/difficulty match, within the ceilings above.
- Otherwise a deterministic fallback is stored and flagged (`generationMode = fallback`, version, reason).
- The fallback picks exercises by a stable hash, spread across muscle groups; same input ⇒ same routine.

## 4. What the software does NOT do (gaps for the reviewer to weigh)
- No mapping of declared limitations/injuries to excluded exercises (profile has free-text `limitations`).
- No load/intensity (RIR/RPE, % of max) limits, no weekly volume or frequency limits, no deload rules in generation.
- Candidate catalogue quality (exercise descriptions, difficulty labels) has not been clinically reviewed.
- Progression rules (`services/progression/*`) and the coach's refusal patterns are separate and also unreviewed.
- The prompt sent to the model does not state the ceilings; expect many fallbacks until aligned.

## 5. Worked examples
| Case | Input (synthetic) | Result today |
|---|---|---|
| A | AI returns 3×10, rest 60, 4 exercises, valid IDs | accepted (`ai`) |
| B | AI returns sets = 8 | rejected → fallback (`ai_output_rejected`) |
| C | AI returns an ID not in the candidate list | rejected → fallback |
| D | Age 52, 6 exercises | rejected (limit 5 for 40+) |
| E | Provider timeout | fallback (`ai_error`) |
| F | Beginner, age 45, gym, fallback | 5 exercises, 3×10, rest 75 s |

## 6. Decisions requested (table to complete)
| # | Question | Reviewer answer |
|---|---|---|
| R1 | Maximum sets / reps / rest per difficulty level | |
| R2 | Maximum exercises per session by age band and level | |
| R3 | Required warm-up / mobility content in each routine | |
| R4 | Excluded movements per declared limitation (list) | |
| R5 | Pain/injury rule: wording and referral threshold | |
| R6 | Fallback templates to adopt (or confirm selection method) | |
| R7 | Progression and deload rules acceptable for pilot | |
| R8 | Conditions that must block plan generation entirely | |

## 7. Review record (to be filled by the reviewer)
| Field | Value |
|---|---|
| Reviewer name and credential | *pending* |
| Date | *pending* |
| Artifacts reviewed (commit/diff) | *pending* |
| Outcome (approved / approved with changes / rejected) | *pending* |
| Signature / written confirmation reference | *pending* |
