# Review request A — Exercise professional (AI-03; supports AI-04 / AI-05)

**Status of this request: LISTO PARA ASIGNACIÓN** (no reviewer designated; not sent; not in review).
Toni decides recipients and sends it. Prepared 2026-10-12 from the consolidated package; tree
`sourceTreeSha256 dee09279107148dddf28e075a29577cd64692b480d5e1f6db64b6c28ea07efb6`, base `77f852aa…`, uncommitted.

## Scope
Whether the limits, validation rules, deterministic fallback and instructions to the AI model are acceptable for a pilot
of 40+ users. **Out of scope:** security, copy, legal, session handling. This request does not claim clinical validity of
any value; the numbers are an engineering placeholder (`PENDING_PROFESSIONAL_REVIEW`).
Required competence: qualified exercise professional with experience of adults 40+ (to be stated by the reviewer).

## Documents and paths
- Packet and worked cases: `05-packet-professional-exercise.md` (rules V1–V7, F1–F3, G1, gaps, §3 texts, cases A–H, questions R1–R12).
- Previous dossier: `../impulso-pilot-professional-review/ai-03-reviewer-dossier-v1.md`.
- Code (shorthand paths are under `backend/src/services/`; unchanged-since-base files are not in the ZIP, only in the repository at `77f852aa`): `backend/src/services/workouts/plan-limits.ts`, `plan-validator.ts`, `deterministic-fallback.ts`,
  `backend/src/services/workouts.service.ts`, `forty-plus-guidance.ts`, `personalization.service.ts`,
  `progression/engine.ts`, `coach/guardrails.ts` (the last four are pre-existing and listed for context).
- Original acceptance of AI-03/04/05: `05-…` table.

## Concrete questions
R1 ceilings per level · R2 exercises per session by age band · R3 mandatory warm-up/mobility · R4 exclusions per
declared limitation (the software applies none today) · R5 pain/injury wording and referral threshold · R6 fallback
templates or selection method · R7 progression/deload for the pilot · R8 conditions that must block generation ·
R9 minimum exercises (a pool of 1 yields a routine today) · R10 acceptability of the pre-existing health-related
instructions given to the model (§3) and whether any may reach users · R11 whether 40+ ceilings depend on limitations ·
R12 sufficiency of the coach's refusal patterns (EN/ES).

## Evidence available (and what it does not show)
Unit: `workout-plan-validator`, `deterministic-fallback`, `workouts-service-integrity`; integration `inc01-data-integrity`
on the isolated PostgreSQL (rules execute, invalid output is never persisted, mode/version are stored). It is **technical**
evidence that the rules run; it says nothing about whether the values are appropriate. See `11-…` for runs and trees.

## Limits
No claim of therapy or clinical advice. No approval is implied by the existence of tests. AI-04/AI-05 cannot be accepted without this review.

## Return format (to be completed by the reviewer; every field is empty on purpose)
| Field | Entry |
|---|---|
| Reviewer name | |
| Competence / role / credential | |
| Date | |
| Package and code reviewed (ZIP SHA-256, `sourceTreeSha256`) | |
| Documents / files actually reviewed | |
| Findings (id · location · effect · evidence) | |
| Decision | ☐ approved  ☐ requires changes  ☐ not evaluable — with justification: |
| Conditions | |
| Limits of the review | |
| Written reference | |
Nothing in this request is signed or approved. A reviewer may answer "not evaluable" and say what is missing.
