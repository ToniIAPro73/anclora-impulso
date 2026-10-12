# AI-01 — evaluation of each original criterion against its evidence (v2)

**Status: PENDIENTE.** This document evaluates; it does not accept. Acceptance is Toni's decision (plan role
"Toni + técnico"; the técnico is not named). v2 supersedes v1 of this file: the function inventory is now route-level
(`01a`), the duplication check is a read-and-verified mapping (`01b`), and every task has state, evidence and owner-or-block (§C).

## Original definition (anclora-plan-90-dias v1.0, unchanged)
| Field | Text |
|---|---|
| Priority / deps | P0 · none |
| Work | "Fijar SHA, entorno, CI, funciones reales, tickets existentes y responsables; estimar capacidad antes de comprometer fechas." |
| Deliverable | "Inventario versionado y decisiones." |
| Accept | "Cada función y tarea tiene estado, evidencia y responsable o bloqueo explícito." |
| Reject | "Despliegue asumido operativo, trabajo duplicado o capacidad inventada." |
| Evidence | "Inventario, SHA, resultados CI si disponibles." |

Reading rules applied: static evidence, correctly labelled, is valid inventory content but is **not** proof of
operation; an explicit block is a valid owner/status; unresolved product blockers do not prevent acceptance of an
inventory whose function is to record them.

## A. Accept criterion — "cada función y tarea tiene estado, evidencia y responsable o bloqueo explícito"
| Subject | Where | State | Evidence | Owner |
|---|---|---|---|---|
| Functions (105 routes) | `01a-route-level-inventory.md` | per row: *runtime-referenced (local)* 61 / *source only* 44 | per row: test names or "—"; class defined in the file | per row: `B-D6` (explicit block) |
| Capability areas | `baseline-v1 §3` | per area | static (S), historical (H), runtime-local (R) classes | `B-D6` |
| Tasks AI-01…AI-30 | §C below | per task | per task | role from the plan + `B-D6` for the person |
| Existing specifications | `01b-sdd-to-ai-mapping.md` | Confirmed / Partial / Doubtful / None | code lookups cited | — |
**Assessment: met**, provided Toni confirms that `B-D6` ("no person assigned") is the accepted owner status.

## B. Remaining criteria
| Criterion | Evidence | Assessment |
|---|---|---|
| Fix the SHA | base `77f852aa…` = plan SHA, branch `development`, tree clean at start; delivered work uncommitted, identified by `sourceTreeSha256 76df7605…` / `diffSha256 183782a8…` | **Met** for the base. A SHA of the delivered state does not exist (commit not authorized) |
| Fix the environment | `baseline §2`: declared contract; isolated exception verified; operational target **not verified** (file read blocked) | **Met as declared-vs-verified, block explicit** |
| CI | three workflows inventoried; finding: frontend job installs with `npm` while a pnpm lockfile exists; **no CI result available** | **Met as inventory**; results "si disponibles" → not available (explicit) |
| Real functions | §A | **Met** (route level) |
| Existing tickets | tracker not consulted | **Not performed — explicit** (needs Toni / access) |
| Responsible parties | roles only | **Explicit block** `B-D6` |
| Capacity estimate | not estimated | **Explicit; not invented** (reject-safe) |
| Deliverable: versioned inventory and decisions | files `…-v1`/`v2` with decisions D1–D10 and the one-page decision list | **Met at file-version level**; not in VCS history (not committed) |
| Reject: deployment assumed operational | no deployment, secret or CI assumed | **No violation** |
| Reject: duplicated work | `01b`: each Confirmed/Partial row says the AI task must extend, not rebuild; no re-creation found | **No violation demonstrated**; 8 *Doubtful* rows are stated as such |
| Reject: invented capacity | none | **No violation** |
| Evidence: inventory, SHA, CI results if available | inventory ✔, SHA ✔, CI results n/a | **Met** |

## C. Tasks — state, evidence, owner-or-block
Evidence classes: **S** static (source/document), **H** historical report not re-verified, **R-L** runtime-verified on
the isolated local PostgreSQL (valid runs `…865b056c`, `…c214631e`), **—** none. Owner = plan role + person `B-D6`.
| Task | State | Evidence | Plan role · person |
|---|---|---|---|
| AI-01 | parcial (this inventory) | S | Toni + técnico · B-D6 |
| AI-02 | parcial: copy changed locally; promise matrix absent; no paywall exists | S, R-L (E2E assertions) | Producto · B-D6 |
| AI-03 | pendiente; dossier prepared; no reviewer | S | Profesional + producto · B-D6 |
| AI-04 | parcial: validator implemented | S, R-L | Backend + QA · B-D6 |
| AI-05 | parcial: deterministic fallback, mode persisted | S, R-L | Backend + profesional · B-D6 |
| AI-06 | parcial: sessions/revocation/policy implemented; AC10 blocked | S, R-L | Backend + seguridad · B-D6 |
| AI-07 | pendiente: findings only (public default, no export/erase) | S | Legal + ingeniería · B-D6 |
| AI-08 | parcial: implemented; acceptance blocked (staging evidence, review, AI-01) | S, R-L | Backend + QA · B-D6 |
| AI-09 | parcial: CI config exists; no CI result; lockfile/scan/restore absent | S, H | Técnico + QA · B-D6 |
| AI-10 (G1) | pendiente (gate) | — | Toni + revisores · B-D6 |
| AI-11 | parcial: existing onboarding dialog and entry; not measured | S, H | Frontend + producto · B-D6 |
| AI-12 | parcial: set logging exists; no confirm/idempotency on sessions | S, R-L (sessions routes) | Frontend + backend · B-D6 |
| AI-13 | parcial: engine and endpoint; weekly review only a nudge | S, R-L | Ingeniería + profesional · B-D6 |
| AI-14 | parcial: backend capability; no UI; no evaluation corpus | S, R-L (API) | Backend + profesional · B-D6 |
| AI-15 | pendiente: nothing exists | — | Producto + backend + legal · B-D6 |
| AI-16 | pendiente: tier-string gating is prior art to replace | S | Backend + QA · B-D6 |
| AI-17 | pendiente | — | Backend + soporte · B-D6 |
| AI-18 | parcial: `/api/events` exists, no dictionary/dedupe/consent; no test references it | S | Datos + producto · B-D6 |
| AI-19 | pendiente | — | Toni + finanzas + backend · B-D6 |
| AI-20 (G2) | pendiente (gate) | — | Toni + QA + legal · B-D6 |
| AI-21 | pendiente (human/commercial) | — | Producto + Toni · B-D6 |
| AI-22 | pendiente (human) | — | Producto · B-D6 |
| AI-23 | pendiente | — | Producto + soporte · B-D6 |
| AI-24 | pendiente | — | Toni + producto · B-D6 |
| AI-25 | pendiente | — | Soporte + técnico · B-D6 |
| AI-26 (G3) | pendiente (gate) | — | Toni + producto · B-D6 |
| AI-27 | pendiente | — | Datos + producto · B-D6 |
| AI-28 | pendiente | — | Producto + ingeniería · B-D6 |
| AI-29 | pendiente | — | Toni + finanzas · B-D6 |
| AI-30 (G4) | pendiente (gate) | — | Toni + producto + técnico · B-D6 |

## D. Concrete remaining shortfalls (and nothing else)
| # | Shortfall | Nature | Who |
|---|---|---|---|
| N1 | "Tickets existentes": the tracker was not consulted; the work item is unperformed | explicit, cannot be done by the agent | Toni (state none/list, or give access) |
| N2 | No named responsible person for any of the 30 tasks / 105 routes (`B-D6`) | explicit block; satisfies the accept criterion only if Toni confirms it as the status | Toni |
| N3 | Capacity not estimated | explicit; correct per the reject rule | Toni (outside acceptance) |
| N4 | Operational runtime target "declared, not verified" | explicit; `.env.local` read blocked | Toni, if verification is wanted |
| N5 | CI results not available | explicit ("si disponibles") | — |
| N6 | Inventory is not in version-control history (not committed) — "versionado" holds at file level only | pending separate decision | Toni |
| N7 | Review by the "técnico" (and independent competent review for P0) of this inventory | pending | Toni names the técnico |
None of N1–N7 is a violation of a reject condition. AI-01 remains PENDIENTE until Toni decides.
