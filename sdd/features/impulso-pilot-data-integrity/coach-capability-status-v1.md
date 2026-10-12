# Coach — what actually consumes it, and what is (not) a product feature

## Facts (verified by search at the working tree)
| Layer | Item | Consumers |
|---|---|---|
| Backend | `POST /api/v1/coach/messages` (auth required) | **none in this repository besides tests** |
| Frontend client | `coachApi.sendMessage(data, scope)` in `lib/api/index.ts` | **no component, hook or page imports it** |
| Where `Idempotency-Key` is created | inside `coachApi.sendMessage` via `runIdempotent('coach.message', scope, …)` (`lib/idempotency.ts`); sent as header | — (only reachable by a future caller) |
| Server side | key read from header by `resolveIdempotencyKey`; during the transition a derived key is used when absent | — |
| Tests that exercise it | backend integration (`llm-coach`, `inc02`, `inc03`, `inc04`, `final-state`), Playwright at HTTP level (`request` fixture, no UI) | — |

## Classification
**Backend capability, verified by API. It is NOT a complete product feature**: there is no user interface, no
onboarding of the capability, no copy, no consent/safety UX and no end-to-end user journey. It must not appear in
paid promises (AI-02 matrix) and must not be counted as delivered AI-14.

## Increment that would be required (not built; no UI is created under this instruction)
| Need | Detail | Relation to AI-14 |
|---|---|---|
| Conversation UI | chat surface in the dashboard (messages, loading, retry, error, empty), mobile first, a11y | AI-14 "Definir temas y límites" needs a surface to be evaluated end to end |
| Idempotent client use | reuse `coachApi.sendMessage`; one logical send = one key; disable-on-send; show replay without duplicating the bubble | already provided by the helper |
| Quota UX | show remaining requests and `windowResetsAt`; explain 429 reasons (`quota_exhausted`, `operational_failure_cap`, `concurrency_limit`) | AI-14 "cuota atómica y visible" |
| Safety content | refusal copy for medical/injury, scope limits ES/EN, evaluation corpus (prompt injection, dosage, diagnosis), professional review | AI-14 + AI-03 (reviewer) |
| Privacy | what is stored (messages, 24 h idempotent responses), retention, export/erase | AI-07 |
| Copy gate | Hermes review of every string | AGENTS.md rule |
| Gate | depends on AI-05, AI-08, AI-10 (G1) per the plan | blocked until G1 |
