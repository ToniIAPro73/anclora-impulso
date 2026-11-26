# Session save idempotency F3 — Decisions v1

**Approved by Toni on 2026-11-26: all recommendations (D1 = A, D2 = A, D3 = A, D4 = 24 h).**

## D1 — What a key identifies, and what happens if the user edits after a failed save
A save can fail on the client while the server actually stored it (lost response). Any edit-then-resubmit with a NEW
key could then create a duplicate.

| Option | Rule | Pros | Cons |
|---|---|---|---|
| **A** | Freeze on first "Finalizar": key + payload stored in the draft; while a submission is pending the sets are read-only; buttons "Reintentar" and "Descartar y empezar de nuevo" | No duplicate in any scenario; simple to reason about | The user cannot correct a value after a failed save without discarding (rare) |
| B | One key per draft; edits allowed; a resubmission with the same key and different content is answered 422 | Edits allowed | If the first attempt failed server-side, the key stays in conflict for the retention (24 h): the user is stuck |
| C | New key whenever the content changes (current `runIdempotent` rule) | Edits allowed, never stuck | Duplicate if the first attempt was saved with its response lost |

**Recommendation: A.**

## D2 — Client reaction to a 422 conflict
| Option | Rule |
|---|---|
| **A** | Show "Esta sesión ya se registró con otros datos" and offer to discard the draft (go to progress) |
| B | Silently discard the draft |

**Recommendation: A** (with D1 = A a 422 should not happen in normal use; it is a safety net).

## D3 — Clients without `Idempotency-Key`
| Option | Rule |
|---|---|
| **A** | Keep `IDEMPOTENCY_KEY_ENFORCEMENT=warn`: derived 30 s key dedupes double taps; `Deprecation` header |
| B | `require` for sessions now (428 without key) |

**Recommendation: A**, then switch to `require` after a few weeks without legacy traffic (same counter as F2 D4).

## D4 — Retention
Default 24 h (`IDEMPOTENCY_RETENTION_HOURS`). A retry later than that would create a new session. Drafts inactive
for more than 4 h already ask to resume or discard (F2 D3), so 24 h is enough. **Recommendation: keep 24 h.**
