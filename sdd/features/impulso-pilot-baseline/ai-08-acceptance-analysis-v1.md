# AI-08 — acceptance analysis against the ORIGINAL plan text

## Original definition (anclora-plan-90-dias v1.0, unchanged)
| Field | Text |
|---|---|
| Priority / role / deps | P0 · Backend + QA · AI-01 |
| Work | "Hacer actualización de rutina atómica; idempotencia en reintentos y contador atómico de coach; definir periodo y reseteo." |
| Deliverable | "Mutaciones y cuotas seguras." |
| Accept | "Fallo borrar/actualizar conserva rutina; concurrencia no supera cuota; reintento no duplica consumo." |
| Reject | "Pérdida parcial o cuota evadible." |
| Evidence | "Tests rollback/concurrencia en staging." |
| Common control | versioned deliverable, responsible/reviewer, accepted dependencies, reproducible tests, rollback; P0 needs competent, independent review where applicable; ACEPTADA = all mandatory criteria pass; BLOQUEADA = missing data/environment/decision/reviewer/evidence |

## Classification of every item that has been discussed
| Item | Class | Origin | Evidence / state |
|---|---|---|---|
| Update failure after delete keeps the routine | **Mandatory criterion** | plan | met locally (`inc01`, I-VALID) |
| Concurrency does not exceed quota (incl. first window) | **Mandatory criterion** | plan | met locally (`inc01`, `inc03`, `inc04`) |
| Retry does not duplicate consumption | **Mandatory criterion** | plan | met for requests with a key and for double taps of previous clients (derived key); not met for previous clients retrying after the 30 s bucket (see residual) |
| Define period and reset | **Work item** | plan | defined: fixed 60-minute windows, exact `windowResetsAt` (D9, adopted by Toni) |
| "Pérdida parcial" / "cuota evadible" (reject conditions) | **Reject condition** | plan | no partial loss observed; quota not evadable by key/user-scoped limits; per-IP limits are per instance and there is no global ceiling (residual R-7, not a failed criterion) |
| Tests **in staging** | **Mandatory evidence** | plan | **not met**: no staging environment exists or is authorized; local isolated PostgreSQL is not staging → evidence condition BLOQUEADA |
| Independent competent review (P0 common control) | **Mandatory review** | plan | **pending** (no reviewer named) |
| Dependency AI-01 accepted | **Mandatory precondition** | plan ("Dependencias son de cierre") | AI-01 is PENDIENTE (not accepted) |
| Rollback documented | **Common control** | plan | documented (D10 §6, migration headers) |
| Commercial number of responses per plan | **Commercial decision** | not AI-08: belongs to AI-15 (offer) and AI-19 (cost and quota); AI-14 requires "cuota atómica y visible" | open; irrelevant to AI-08's mechanism |
| Approval of the experimental caps 3 / 5 / 2 | **Commercial/operational decision** | added by this work as operational protections (origin: Toni's D9 request to bound attempts/concurrency/provider calls) | open; not an AI-08 criterion |
| Retention/purge of idempotency and sessions | **Improvement / own requirement** | Toni's request ("retención y expiración del registro"), not in the plan text | implemented and verified locally |
| Deployed scheduler for the purge job | **Launch-exclusive operation** | D10 | not deployed, not required by AI-08 text |
| Global spend ceiling, UI quota display | **Additional improvement** | proposals of this work / AI-14 | not required by AI-08 text |
| Execute D10 (migrations/deploy) | **Launch-exclusive operation** | D10 | not authorized |

## Correction of an earlier statement
Earlier reports said AI-08 stays open "because the commercial quota figure and the deployed scheduler are missing".
**That was an over-extension.** Neither appears in the original AI-08 text; the number is AI-15/AI-19 scope and the
scheduler is a launch operation (D10). Keeping them as AI-08 conditions would add requirements without plan
provenance. They remain tracked as decisions/operations, not as AI-08 acceptance conditions.

## Resulting status
- **Mandatory criteria**: technically met in the isolated local environment.
- **Not ACEPTADA, because of conditions that do come from the plan**: (1) staging evidence absent, (2) independent
  review absent, (3) predecessor AI-01 not accepted. Status: **BLOQUEADA for acceptance**, not RECHAZADA.
- **No mandatory requirement is currently known to be violated.** The residual noted above (previous clients that
  retry after the derived-key bucket) is a transition effect covered by the `Deprecation`/sunset plan, and goes away
  with enforcement.
