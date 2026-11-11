# Phase 1 — Hermes Copy Gate Diff (`TASK-009`)

**Gate status:** `PENDING_HERMES_REVIEW` (deterministic literalism audit via `anclora-content-generator-ai` `detectLiteralismRisk`: `0` findings; contractual/editorial review against `HERMES_COPY_CURATOR_CONTRACT.md` & `07-packet-hermes-copy.md` completed locally with real issues fixed; live `hermes:copy-curator` OpenRouter call returned `401 Missing Authentication header` because no active Hermes LLM API key is configured in this environment, so external Hermes Copy Curator sign-off remains pending).

## Principle
Public notices in workout generation, nutrition modals, meal `adjustmentReason`, and business summaries must not expose internal prompt markers, imply unverified clinical or hormonal prescriptions, or present unmeasured hypotheses as validated facts.

## Copy Diff
| File | Location | Before | After |
|---|---|---|---|
| `components/workout-generator.tsx` | 40+ banner (ES) | "Este entrenamiento se ajustará con criterios 40+: más prioridad a fuerza, movilidad, recuperación y composición corporal..." | "Orientación general 40+: se prioriza fuerza base, movilidad y recuperación progresiva (contenido educativo, no clínico)." |
| `components/workout-generator.tsx` | 40+ banner (EN) | "This workout will use 40+ rules: more emphasis on strength, mobility, recovery and body composition..." | "General 40+ guidance: prioritizes baseline strength, mobility, and gradual recovery (educational, not clinical care)." |
| `app/nutrition/page.tsx` | Log meal & Generate plan 40+ banners (ES) | "El plan tendrá en cuenta criterios 40+: proteína suficiente, saciedad, recuperación y ajustes por sexo..." | "Orientación general 40+: prioridad a saciedad, proteína repartida, alimentos frescos y recuperación (no sustituye criterio profesional)." |
| `app/nutrition/page.tsx` | Log meal & Generate plan 40+ banners (EN) | "The plan will use 40+ rules: sufficient protein, satiety, recovery and sex-specific adjustments..." | "General 40+ guidance: prioritizes satiety, steady protein, whole foods, and recovery (not professional advice)." |
| `backend/src/services/nutrition.service.ts` | `Meal.adjustmentReason` UI string (`40+` meal plans) | `"Personalizado con criterios del perfil: - AJUSTE 40+: construye un plan orientado a saciedad, energia estable, conservacion muscular y adherencia realista."` | `"Orientación general 40+: prioridad a saciedad, energía estable y adherencia (no sustituye criterio profesional)."` |
| `docs/business/EXECUTIVE-SUMMARY.md` | Verification banner, AI stack, and projections (§ Proyecciones Financieras) | Generic GPT-4 / "validación real de mercado" / "benchmarks validados de industria" | Explicit October 2025 unverified-hypothesis framing, Groq + deterministic fallback disclosure, and projections labeled pending validation |

