# INC-01 Data integrity — Spec v1

Covers roadmap tasks **AI-04** (semantic validator), **AI-05** (stable fallback), **AI-08** (transactions and quotas).
Original plan criteria are quoted; clarifications are marked (C).

## Problem
AI-generated routines were persisted without semantic validation, the non-AI fallback was random, a routine update could delete exercises and then fail, and the coach quota could be exceeded by concurrent requests.

## Functional requirements
- **FR-001 (AI-04)** An AI-produced plan is persisted only if it passes structural and semantic validation: object shape, strict integer types, non-empty, exercise IDs in the authorized candidate set, no duplicate exercises/orders, equipment/environment/difficulty compatibility, prescription within configured ceilings, exercise count ceiling.
- **FR-002 (AI-04)** Any rejected, malformed, empty, timed-out or errored AI output causes no write of that output.
- **FR-003 (AI-05)** When AI is unavailable or its output is rejected, a deterministic plan is produced: same inputs and fallback version ⇒ same plan; no randomness.
- **FR-004 (AI-05)** The response states the generation mode (`ai` / `fallback`) and version(s) so the client can communicate it. (C: persisted in `workouts.generationMode/Version/Reason`; rows that predate the migration are explicitly `unknown`, never inferred.)
- **FR-005 (AI-08)** Replacing a routine's exercises and updating the routine is atomic.
- **FR-006 (AI-08)** The coach per-window request limit is enforced atomically; concurrent requests cannot exceed it.

## Non-functional requirements
- **NFR-001** Validator and fallback are pure (no I/O, clock, randomness).
- **NFR-002** Ceilings live in one file, labelled with review status; they are not presented as professional limits.
- **NFR-003** No new dependency, no schema/migration, no external call.

## Out of scope
Professionally reviewed limits and templates (AI-03), contraindication/limitation mapping, UI notice of fallback mode, idempotency keys for retried updates, coach response cache sharing, any production access.

## Acceptance criteria
| ID | Criterion | Original source |
|---|---|---|
| AI-04-AC01 | Invalid corpus (foreign ID, empty, broken JSON/shape, excessive volume, duplicates, incompatible equipment/env/difficulty) is 100% rejected by the validator | AI-04 "Corpus inválido 100% rechazado" |
| AI-04-AC02 | On rejection no `workout.create` is invoked with AI content | AI-04 "sin escritura parcial" |
| AI-04-AC03 | Valid plan persists version and mode | AI-04 "guardan versión y modo" — persisted and returned (`generation`) |
| AI-04-AC04 | Database query after failure shows no partial write | AI-04 evidence — verified on isolated PostgreSQL (see tasks) |
| AI-05-AC01 | Provider error, missing credential and invalid response each yield a plan or a safe error | AI-05 |
| AI-05-AC02 | Same input/version ⇒ identical plan | AI-05 |
| AI-05-AC03 | Mode visible in response | AI-05 "comunicar modo" (UI display pending) |
| AI-08-AC01 | Update failure after delete preserves the routine | AI-08 — verified on isolated PostgreSQL (FK and unique violations after delete) |
| AI-08-AC02 | Concurrent coach requests do not exceed quota, including concurrent first-window creation | AI-08 — verified on isolated PostgreSQL (12 concurrent, limit 3) |
| AI-08-AC03 | With an `Idempotency-Key`, a retry (same user, operation, key, same content) does not consume quota nor repeat effects; same key + different content is an explicit 422; in-flight duplicates get 409; failed attempts and timeouts can be retried with the same key; records expire after retention | AI-08 — verified on isolated PostgreSQL (10 tests, incl. simultaneous, restart and expiry). Requests **without** a key keep legacy semantics |
| AI-08-AC05 | D9 policy (adopted by Toni for this increment): quota counts completed and persisted answers; an in-flight request reserves capacity; a failure without a persisted answer releases the reservation; repeating a completed operation with the same key never consumes; fixed 60-minute windows with the exact reset instant communicated (`usage.windowResetsAt`, 429 body, `Retry-After`) | Implemented and verified. **Open:** the number of responses per plan stays at the existing configuration (`LLM_COACH_WINDOW_LIMIT`), linking it to the commercial offer is pending |
| AI-08-AC06 | Operational protection separated from commercial quota: max attempts per key, failed attempts per window, in-flight concurrency, provider calls counted | Implemented with engineering defaults (3 / 5 / 2) — **not approved economic limits** |
| AI-08-AC07 | `Idempotency-Key` created once per logical operation, kept across retries, new for a new operation; scoped by user+operation; bound to normalized content; applied to coach and `POST /workouts/generate` | Implemented client + server; mandatory for the updated client (428 when `require`), transition for older clients defined |
| AI-08-AC08 | A superseded lock owner can neither complete nor release a recovered operation; completion commits atomically with the effect | Implemented (owner token + same transaction) and verified, including lock expiry while the original still runs |
| AI-08-AC09 | Provider timeout is an UNKNOWN outcome, not "not executed" | Implemented: abort requested, `outcome: unknown_result`, counted against the operational cap |
| AI-08-AC04 | Quota period and reset defined | AI-08 "definir periodo y reseteo" — **PARTIAL**: fixed window `LLM_COACH_WINDOW_MINUTES` aligned to epoch; product-level period/reset not decided |
| AI-04-N01…N05 | Negative cases: NaN, string numerics, fractional reps, zero/negative values, age ≥ 40 exercise ceiling | — |
