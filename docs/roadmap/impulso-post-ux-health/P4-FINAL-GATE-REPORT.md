# P4 Final Gate — AI Trust, Explainability and Reversibility

## Changes

- Generated workout proposals now show the profile/preferences signals used by the flow.
- The result includes plain-language rationale and an explicit expectation that the proposal can be regenerated or discarded before starting.
- “Generate Another” clears the current proposal for revision.
- “Discard proposal” removes the generated proposal through the existing ownership-protected delete API.
- Generation, loading and error states remain visible and localized.

## Gate

| Check | Result |
|---|---|
| Lint/typecheck/build | PASS |
| Input transparency | PASS |
| Rationale visibility | PASS |
| Regeneration | PASS |
| Discard/reversibility | PASS |
| API ownership boundary | PASS |
| Browser/LLM provider smoke | FOLLOW-UP |

`P4-FINAL-GATE = PASS`
