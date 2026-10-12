# Review request C — Hermes / copy gate (AI-02; strings of AI-04 and AI-05)

**Status of this request: LISTO PARA ASIGNACIÓN** (no reviewer designated; not sent; not in review).
Toni decides recipients and sends it. Prepared 2026-10-12 from the consolidated package; tree
`sourceTreeSha256 dee09279107148dddf28e075a29577cd64692b480d5e1f6db64b6c28ea07efb6`, base `77f852aa…`, uncommitted.

**Gate:** `AGENTS.md` requires the Hermes copy gate for public-copy changes. **No Hermes Copy Curator is available in
this environment**; this request states what must be reviewed and must not be read as passing or replacing the gate.
Hermes is not a substitute for the exercise professional or the legal reviewer.

## Scope
Only the strings changed for AI-02 (honest promises and offer) and the real-mode badge / fallback notice of AI-04/AI-05.
**Out:** legal pages (request D), exercise rules (request A).

## Documents and paths
- Packet: `07-packet-hermes-copy.md` (criteria 1–4, open items H1–H6).
- Full diff table: `../impulso-pilot-professional-review/ai-02-copy-diff-for-hermes-v1.md`.
- Files: `components/workout-generator.tsx`, `lib/translations/es.json`, `lib/translations/en.json`
  (`home.smartWorkoutsDesc`, `dashboard.stepTwoDesc`, `nutrition.generateAiPlan`, `…generateMealPlanDescription`, `…emptyDescription`),
  `__tests__/components/modal-scroll-close-and-localization.test.tsx`.

## Concrete questions
H1 wording of the fallback notice and the three badges (ES/EN) · H2 keep, change or remove "Inteligente" in the landing title ·
H3 "Generar plan" vs the previous "Plan IA" · H4 the promise → function → proof matrix does not exist (no paywall in the
repository) · H5 strings left unchanged because they are legal text · H6 "¡Entrenamiento Generado!" shown as success also in fallback mode.

## Evidence available
E2E runs listed in `11-…` assert: no "IA/AI" in the button before the outcome, `data-mode` of the badge, `role=status`
notice, no error panel, layout on mobile/desktop × light/dark (E2E 14/14 on the final tree). A human visual review is pending.

## Limits
No approval or copy decision is implied. Product positioning/pricing text is out of scope.

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
