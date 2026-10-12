# PROPOSED addendum A-08-01 (v2) — local isolated PostgreSQL as evidence for AI-08 (NOT APPROVED)

**Status: PROPOSAL. Not approved. It changes nothing until Toni signs (§7).** The original criteria text is **not
modified**; this records an interpretation of the *evidence line* only. The local environment is **not** called
staging, and PostgreSQL 16 local is **not** declared equivalent to the remote environment.

## 1. What the original text says (unchanged)
| Field | Text |
|---|---|
| Accept 1 | "Fallo borrar/actualizar conserva rutina" |
| Accept 2 | "concurrencia no supera cuota" |
| Accept 3 | "reintento no duplica consumo" |
| Reject | "Pérdida parcial o cuota evadible" |
| Evidence | "Tests rollback/concurrencia **en staging**" |

## 2. Proposal — three separate things (not one gate)
| Part | What it is | What it decides | Needs a deployment? |
|---|---|---|---|
| **Stage L — technical acceptance of the demonstrable criteria** | Criteria Accept 1–3 are judged on the isolated, identified local PostgreSQL under conditions L1–L6 | Whether each criterion's **mechanism** is technically met. If the conditions hold and the evidence passes, the criterion is *technically accepted at Stage L* | **No.** Production or any deployed environment is not required to accept local evidence |
| **Stage D — compatibility and operation verification of the deployment** | The checks of §5, run once in the target environment before launch | Whether the mechanisms behave the same behind the real topology (pooler, instances, clock, engine version) | Yes — **mandatory before launch**; it is a launch gate, not a precondition of Stage L |
| **Independent review** | The P0 "revisión competente, independiente" of the common control | Whether the design and evidence are sound | No — **a separate requirement, pending** (reviewer not named) |

Consequences: Stage L may be recorded without waiting for Stage D; **AI-08 as a task cannot be ACEPTADA** until the
common-control conditions are also met (independent review, predecessor AI-01) and Stage D has been performed for the
launch. Stage L does not close the plan's "en staging" evidence line by itself; it records what is demonstrated where.

## 3. Conditions for Stage L evidence to count
| # | Condition | How it is shown |
|---|---|---|
| L1 | Environment identified: container id, postmaster start, marker `impulso-test-v1`, loopback host/port/name | `identity.json` of the run |
| L2 | Code identified | `sourceTreeSha256`, `diffSha256`, base SHA in `identity.json` |
| L3 | Schema identical to the one to be deployed | `verify-migrations`: clean install ≡ upgrade ≡ `schema.prisma` |
| L4 | Isolated from operational configuration | `verify-runner-isolation.sh` (observation-based, with controls) |
| L5 | Synthetic data only | fixtures in tests |
| L6 | Evidence preserved and tamper-evident | run directory never reused + `MANIFEST.sha256` |

## 4. What the local evidence demonstrates, per criterion — and what it does not
| Original criterion | Local evidence (valid runs) | Demonstrates | Does **not** demonstrate (carried to Stage D) |
|---|---|---|---|
| Accept 1 — failed delete/update keeps the routine | `inc01-data-integrity` (FK and unique violations after the delete roll back; routine intact) | transactional atomicity of the update on PostgreSQL 16 with Prisma interactive transactions | behaviour through the production connection pooler; the remote engine major version (the repository documents PostgreSQL 17 on Neon) |
| Accept 2 — concurrency does not exceed quota | `inc01`/`inc03`/`inc04`: 12 concurrent requests with limit 3, first-window race, deterministic in-flight admission, per-user scope across keys | conditional `UPDATE … WHERE requestCount < limit` and `INSERT … ON CONFLICT` semantics under concurrent connections of one process | concurrency across several instances/regions; clock skew between instances (lock expiry uses the application clock); pooler/connection limits |
| Accept 3 — retry does not duplicate consumption | `inc02`/`inc03`: replay, conflict, simultaneous, lost response, crash recovery, stale owner, atomic completion; E2E | the persistent ledger, owner token and atomic completion on this schema | provider-side behaviour (real timeouts/billing); real network retries through the production edge |
| Reject — partial loss / evadable quota | no partial loss in any failure case; user-scoped limits not evadable by key | application-level logic | per-IP limits are per instance and there is no global ceiling (residual risk R-7; not a tested criterion) |

## 5. Stage D — verification of compatibility and operation (before launch)
| # | Check | Control it carries | Pass signal |
|---|---|---|---|
| D1 | Forced failure after the delete (FK-invalid exercise id) on a QA routine | atomicity in the real topology | routine unchanged |
| D2 | N concurrent coach requests with a low limit for a QA user | quota under real concurrency | accepted ≤ limit; the rest `429 quota_exhausted` with `windowResetsAt` |
| D3 | Same `Idempotency-Key` ×N simultaneous and sequential | ledger semantics | one execution; others 409/replay; counters +1 |
| D4 | D1–D3 through the production connection path (**pooler**) | pooler / interactive-transaction compatibility | identical outcomes; no prepared-statement/transaction errors |
| D5 | Two or more backend **instances** serving the same user (if the platform scales out) | multi-instance concurrency and lock takeover | cap holds; takeover correct |
| D6 | **Clock** skew check between instances | lock/expiry decisions | consistent decisions within the lock margin |
| D7 | **Engine version** and migration state of the target | version difference (16 local vs remote) | version recorded; `_prisma_migrations` rows match; no drift; D1–D3 pass on it |

## 6. Scope limits
- Applies **only** to AI-08 criteria Accept 1–3. It is **not** extended to AI-04, AI-05, AI-06, AI-14 or any other
  task; each needs its own evaluation of what a local environment can and cannot show.
- It does not waive the independent review, the predecessor AI-01, or Stage D.
- It does not rename the local environment: it remains "isolated local PostgreSQL (exception IMPULSO-TEST-DB-2026-10-12)".
- It makes no claim of equivalence between local PostgreSQL 16 and the remote environment: the controls D4–D7 exist
  precisely because equivalence is not assumed.

## 7. Approval block (empty)
| Role | Name | Decision | Date |
|---|---|---|---|
| Owner (Toni) | *pending* | *pending* | *pending* |
| Independent reviewer (P0) | *pending — not named* | *pending* | *pending* |
