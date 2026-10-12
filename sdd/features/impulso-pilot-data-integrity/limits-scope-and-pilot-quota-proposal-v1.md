# Limits: exact scope, status, and pilot-quota proposal

**All numbers below are EXPERIMENTAL LOCAL CONFIGURATION, not an approved commercial or economic policy.**
The commercial offer and the number of responses per plan remain **undecided** (AI-08 stays open).

## 1. Scope of every limit (verified by tests `inc03`, `inc04`)
| Limit | Config (default) | Scope | Window | Counts | Reset | Evaded by changing the key? | System-wide? |
|---|---|---|---|---|---|---|---|
| Commercial quota ("responses") | `LLM_COACH_WINDOW_LIMIT` (20, placeholder) | **user** | fixed 60 min aligned to the clock | completed + in-flight reservations (released on failure) | exact `windowResetsAt` | **No** (shared by all keys of the user) | no |
| Failed attempts | `LLM_COACH_MAX_FAILED_ATTEMPTS_PER_WINDOW` (5, experimental) | **user** (coach) | same fixed window | provider errors, timeouts, persistence failures | window reset | **No** | no |
| In-flight concurrency | `LLM_COACH_MAX_CONCURRENT` (2, experimental) | **user × operation** (`coach.message`, `workouts.generate` separate) | instantaneous; self-expiring lock | unexpired `in_progress` records, deterministic rank (createdAt, id) | when executions finish or lock expires | **No** (counted across keys) | no |
| Attempts per key | `IDEMPOTENCY_MAX_ATTEMPTS` (3, experimental) | **user × operation × key** | key retention (24 h from completion/start) | executions of that key | key expiry | **Yes, by design** (a new key is a new operation) — bounded by the per-user limits above | no |
| Provider timeout | `LLM_COACH_PROVIDER_TIMEOUT_MS` (25 s), `LLM_WORKOUT_TIMEOUT_MS` (30 s) | per call | per call | — | — | — | no |
| Per-IP HTTP rate limits | express-rate-limit (100/15 min general, 5 failed auth/15 min outside development) | **IP, per process** | 15 min | requests | window | n/a | **not shared across instances** |

Gaps (explicit): there is **no global/system-wide spend or request ceiling** and **no per-day/month budget**; all
user-scoped limits are per window only. Per-IP limiters are in-memory per instance. Tests proving non-evasion:
quota across keys + other user unaffected; failed-attempt cap across keys; concurrency across keys, other user and
other operation independent; per-key attempts do not reset per-user caps.

## 2. Proposal for the pilot quota (method only — **no number is proposed**)
Inputs required and their current availability:
| Input | Needed for | Available? |
|---|---|---|
| Measured provider cost per answer (tokens in/out × model price, incl. failed/timeout calls) | variable cost per response | **No.** Tests use a deterministic provider; no production/metered usage was read. `estimatedInputTokens/OutputTokens` are recorded per exchange and `providerCalls` per window now, so measurement can start |
| Typical session duration and messages per session | responses a session needs | **No data** (no UI, no pilot cohort yet) |
| Support load per user (tickets, refunds) | contribution margin | **No data** |
| Price and plan structure | allowed cost per user | **Not decided** (plan numbers are hypotheses) |
| Acceptable failure overhead | operational cap | partly: `failedAttempts` and `providerCalls` are now observable |

Method once data exists: `quota_per_window ≈ min(session_need, affordable_cost / cost_per_response)` with
`affordable_cost = target_price × target_contribution_margin_for_AI − expected_failure_overhead`, validated on a small
cohort with the counters above; revisit after the first D30 cohort. Until the inputs exist, `LLM_COACH_WINDOW_LIMIT`
is a placeholder and **AI-08 cannot be closed**. Data to start collecting (no code needed beyond what exists):
per-window `requestCount`, `providerCalls`, `failedAttempts`, `tokenEstimate`; messages per conversation; 429 rate.
