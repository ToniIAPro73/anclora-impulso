# INC-01 Data integrity — Plan v1

## Design
| Component | File | Notes |
|---|---|---|
| Limits | `backend/src/services/workouts/plan-limits.ts` | Ceilings reuse the envelope the previous generator already emitted (sets ≤5, reps ≤15, rest ≤75 s, ≤6 exercises, ≤5 if age ≥40). `reviewStatus: PENDING_PROFESSIONAL_REVIEW`. Versions: `plan-validator-v1`, `deterministic-fallback-v1` |
| Validator | `workouts/plan-validator.ts` | `validateWorkoutPlan(raw, constraints) → {ok, plan}|{ok:false, violations}`; Zod strict shape (no coercion) + semantic rules; renumbers `order` 0..n-1 |
| Fallback | `workouts/deterministic-fallback.ts` | Candidates grouped by muscle group (sorted), ranked by `sha256(seed:id)`, round-robin; prescription from the old difficulty table, clamped to limits |
| Orchestration | `workouts.service.ts#generateWorkout` | LLM output typed `unknown` → validator → persist `plan` only; otherwise fallback. Logs violation **codes** only (no content). Response adds `generation: {mode, …}` (additive) |
| Update | `workouts.service.ts#updateWorkout` | `prisma.$transaction(async tx => deleteMany + update)` |
| Quota | `coach/coach.service.ts#checkAndIncrementUsage` | `upsert` window row, then `updateMany where {id, requestCount < limit}`; `count===0 ⇒ 429` |

## Compatibility / rollout / recovery
- API response gains an optional `generation` object; no existing field changed. No schema change.
- Behavioural change: AI plans with sets >5, reps >15, rest >75 s, or >6 exercises are now rejected and replaced by the fallback — stricter than before. Intentional until AI-03 supplies reviewed limits.
- Rollback: revert the two modified service files and delete `backend/src/services/workouts/` and the four new unit tests. No data migration to undo.

## Risks
| Risk | Control |
|---|---|
| Ceilings too tight reject good plans | Fallback still returns a safe plan; limits centralized for AI-03 |
| Mock tests cannot prove DB atomicity | Marked BLOCKED in tasks; D1 decision |
| Fallback not a reviewed template | Labelled in code and spec; AI-03 |
