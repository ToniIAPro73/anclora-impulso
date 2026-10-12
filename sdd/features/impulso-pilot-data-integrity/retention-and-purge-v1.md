# Retention and purge (idempotency records, sessions)

## Two different things
| | Logical expiry | Physical deletion |
|---|---|---|
| Idempotency record | `expiresAt`: the replay guarantee ENDS; from then the key is reusable even if the row exists | row removed `RETENTION_PURGE_GRACE_SECONDS` (3600) after `expiresAt`, never while `in_progress` with an unexpired lock |
| Session | `expiresAt`: every check rejects it | row (and refresh tokens, cascade) removed after the same grace |
| Guaranteed replay period | `IDEMPOTENCY_RETENTION_HOURS` (24 h) **measured from completion** | — |

## Implementation (local)
`purgeExpiredIdempotencyRecords(now, {graceSeconds, batchSize})` and `purgeExpiredSessions(...)`: select ids in batches,
delete by id **re-checking the predicate in the DELETE**, so a record revived between SELECT and DELETE survives;
deleting an already-deleted row is a no-op, so concurrent and repeated runs are safe.
Entry point: `backend/scripts/maintenance/purge-expired.ts [--dry-run]` (prints counts only). Nothing schedules it.
Also fixed on the way: a held execution whose retention elapsed could be taken over (`begin` now refuses it).

## Verified (`inc04-retention-and-limits`, isolated PostgreSQL)
Held executions are never deleted · records inside the guarantee survive purges and still replay with no second
effect · logically expired rows are kept during grace but the key is reusable · completion renews the guarantee ·
6 simultaneous batched purges delete each eligible row exactly once, concurrently with live operations ·
mid-flight purge cannot enable a duplicate execution · sessions: only expired are removed, active and
revoked-but-unexpired stay, grace respected, concurrent purges safe.

## Production operation (D10 §8; NOT deployed, no scheduler contracted)
Run `purge-expired` from whatever scheduler the platform provides (decision pending with B1), at most hourly,
`--dry-run` first, alert on non-zero exit; monitor table sizes. Until scheduled the tables simply grow (bounded by
24 h of idempotent traffic + session lifetime).
