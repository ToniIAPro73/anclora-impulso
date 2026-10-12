# Review packet 1 — Exercise professional (AI-03 and the rules of AI-04 / AI-05)

Reviewer: **not named** (decision D2). Prepared by engineering. Contains no approval, no signature, no clinical claim.

## Scope
In: limits, templates, exclusions, referral and progression rules the pilot would apply automatically; the text that
instructs the AI model about 40+ users. Out: legal wording, UI copy, pricing, security.

## Original acceptance (plan)
| Task | Accept | Reject | Evidence |
|---|---|---|---|
| AI-03 | "Todos los ejercicios/reglas del piloto revisados por profesional competente." | "Sin revisor, restricciones ambiguas o promesa de terapia." | "Acta profesional y casos límite." |
| AI-04 | corpus inválido 100 % rechazado, sin escritura parcial; válidos guardan versión y modo | cast de tipo como validación; persistir salida inválida | fixtures + consulta BD |
| AI-05 | caída/credencial ausente/respuesta inválida → plan revisado o error seguro; misma entrada/versión ⇒ mismo resultado | fallback aleatorio, silencioso o incompatible | fallos inyectados + aviso |
AI-04/AI-05 cannot be accepted without this review: the numbers below are an engineering placeholder.

## Files to read
| File | What it contains |
|---|---|
| `backend/src/services/workouts/plan-limits.ts` | the ceilings (placeholder, `PENDING_PROFESSIONAL_REVIEW`) |
| `backend/src/services/workouts/plan-validator.ts` | every rule applied to AI output |
| `backend/src/services/workouts/deterministic-fallback.ts` | fallback selection and prescription |
| `backend/src/services/workouts.service.ts` | candidate filtering, prompt construction, age/adjustment logic |
| `backend/src/services/forty-plus-guidance.ts` | health-related instructions given to the model (pre-existing) |
| `backend/src/services/personalization.service.ts` | adherence-based "reduce / maintain / increase" adjustment |
| `backend/src/services/progression/engine.ts`, `types.ts` | progression/deload rules (AI-13 territory; pre-existing) |
| `backend/src/services/coach/guardrails.ts` | medical/injury refusal patterns of the coach |
| `sdd/features/impulso-pilot-professional-review/ai-03-reviewer-dossier-v1.md` | previous dossier (placeholders, decision table R1–R8) |

## 1. Rules the software enforces today (for AI-04/AI-05)
| # | Rule | Value / behaviour | Reviewed? |
|---|---|---|---|
| V1 | Sets per exercise | 1–5 | **no** |
| V2 | Reps per set | 1–15 | **no** |
| V3 | Rest between sets | 0–75 s | **no** |
| V4 | Exercises per routine | 1–6; 1–5 when age ≥ 40 | **no** |
| V5 | Exercise must belong to the candidate set of the request (difficulty, environment, optional equipment, optional muscle groups) | rejected otherwise | structural |
| V6 | No duplicate exercise, no duplicate order | rejected | structural |
| V7 | Integers only, no coercion | rejected | structural |
| F1 | Fallback selection | stable hash per user/type/difficulty, spread across muscle groups | **no** |
| F2 | Fallback prescription | beginner 3×10, intermediate 4×12, advanced 5×15 (clamped to V1–V3) | **no** |
| F3 | Rest in fallback | 60 s; 75 s if age ≥ 40 or load "reduce" | **no** |
| F4 | Minimum exercises | any pool ≥ 1 yields a routine (no reviewed minimum) | **no** |
| G1 | Difficulty de-escalation under "reduce" adjustment | advanced→intermediate→beginner; duration clamp 25–40 min | **no** |

## 2. Not implemented (gaps to weigh)
- No mapping from declared limitations (free text, ≤ 8 items) to excluded exercises.
- No weekly volume/frequency limits, intensity (RIR/RPE, % load) limits, deload or warm-up requirements in generation.
- The AI prompt does not state the ceilings (expect many fallbacks until aligned).
- Catalogue labels (difficulty, equipment, environment) are not clinically reviewed.

## 3. Pre-existing health-related text to rule on (AI instruction, `forty-plus-guidance.ts`)
Statements such as: sustain "150–300 minutos semanales de actividad total"; for women 40+ "contempla cambios …
perimenopausia/menopausia … salud ósea"; nutrition guidance "1,3–1,6 g de proteína/kg/día", "deficit … proteger la
masa muscular". The reviewer should say whether each is acceptable as an instruction to a model **and** whether any
may surface to users.

## 4. Worked cases (synthetic)
| Case | Input | Result today |
|---|---|---|
| A | 3×10, rest 60, 4 valid exercises | accepted (`ai`) |
| B | sets = 8 | rejected → fallback |
| C | id outside the candidate list | rejected → fallback |
| D | age 52, 6 exercises | rejected (limit 5) |
| E | provider timeout | fallback (`ai_timeout`/`ai_error`) |
| F | beginner, age 45, gym | fallback: 5 exercises, 3×10, rest 75 s |
| G | candidate pool of 1 exercise | fallback with 1 exercise (no minimum) |
| H | user declares "dolor de rodilla" | no exclusion applied (gap) |

## 5. Evidence available
Unit: `workout-plan-validator`, `deterministic-fallback`, `workouts-service-integrity`. Integration (isolated DB,
run `20261012T034716Z-865b056c`): `inc01-data-integrity`. Provenance is persisted (`generationMode/Version/Reason`).
This is **technical** evidence that the rules execute; it says nothing about whether the values are appropriate.

## 6. Questions for the reviewer
R1 ceilings per level · R2 exercises per session by age band · R3 mandatory warm-up/mobility · R4 exclusions per
limitation (list) · R5 pain/injury rule wording and referral threshold · R6 fallback templates or selection method ·
R7 progression/deload acceptable for the pilot · R8 conditions that must block generation · **R9** minimum exercises ·
**R10** acceptability of the §3 texts · **R11** whether the 40+ ceilings should depend on declared limitations ·
**R12** the coach's refusal patterns (EN/ES) are sufficient or need a corpus.

## 7. Expected output (plan: "Acta profesional y casos límite")
Reviewer identity and credential · date · artifacts and diff reviewed (`sourceTreeSha256` above) · decisions R1–R12 ·
edge cases added · outcome · written confirmation reference. **All pending; nothing here is signed.**
