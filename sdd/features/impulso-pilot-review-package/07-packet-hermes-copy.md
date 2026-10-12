# Review packet 3 — Hermes (copy gate)

Reviewer: **no Hermes Copy Curator available** in this environment. Gate: **PENDING**. No approval is claimed.
Rule: `AGENTS.md` — a change that affects public copy needs Hermes before merge.

## Scope
Only the strings changed for AI-02 ("promesas y oferta honesta") and the new mode badge. The full diff table is
`sdd/features/impulso-pilot-professional-review/ai-02-copy-diff-for-hermes-v1.md`.

## Original acceptance (plan, AI-02)
Accept: "Todas las promesas de pago trazan a capacidad probada." Reject: "Vender funciones parciales como completas o
superioridad sin evidencia." Evidence: "Capturas y matriz aprobada."

## Files
`components/workout-generator.tsx` (button, result notices, badge), `lib/translations/es.json` and `en.json`
(`home.smartWorkoutsDesc`, `dashboard.stepTwoDesc`, `nutrition.generateAiPlan`, `…generateMealPlanDescription`,
`…emptyDescription`), test `__tests__/components/modal-scroll-close-and-localization.test.tsx` (button name).

## Criteria for review
1. No text promises guaranteed AI generation before the outcome is known.
2. After the outcome the real mode is stated; a fallback is presented as a valid standard plan, not as an error.
3. ES/EN equivalence of meaning; tone consistent with the brand; no clinical or superiority claim.
4. Strings that mention AI describe only what the product does today.

## Evidence
E2E in the valid run `artifacts/qa/runs/20261012T034530Z-c214631e`: button label contains no IA/AI before the result;
badge `data-mode="fallback"`; notice `role=status`; no error panel; text contains no "error"; layout fits on
mobile/desktop × light/dark (`screenshots/` of that run; not attached here). Visual human review still pending.

## Open items for Hermes
| # | Question |
|---|---|
| H1 | Wording of the fallback notice (ES/EN) and of the three badges |
| H2 | Landing title `home.smartWorkouts` "Generación Inteligente de Entrenamientos" — keep, change, or remove "Inteligente"? |
| H3 | Nutrition strings: the feature name "Generar plan" vs the previous "Plan IA" |
| H4 | The matrix promise → function → proof of AI-02 does not exist yet (no paywall in the repository) |
| H5 | Strings not changed because they are legal text (see the legal packet) |
| H6 | The generator still announces "¡Entrenamiento Generado!" as success in fallback mode — acceptable? |
Output expected: approval/changes per string with reviewer identity — **pending**.
