# Summary for Toni — consolidation R1–R8-C (2026-10-12)

One page. Nothing here is an approval, and no communication was sent to anyone.

## Where things stand
- **Technical findings R1–R8-C are corrected within their stated scope** (local isolated PostgreSQL, Jest/RTL, Playwright E2E, plus
  the independent reviewers' simulated probes). Matrix: `10-consolidated-matrix-r1-r8c.md`. Executions, trees and what exists as an
  artifact: `11-execution-coverage-and-provenance.md`.
- **Final code identity:** `sourceTreeSha256 dee09279107148dddf28e075a29577cd64692b480d5e1f6db64b6c28ea07efb6`
  (from `identity.json` of E2E run `20261012T063117Z-c38e75c8`, 14/14). The complete backend integration run (23 / 141) and
  `verify-migrations` ran on the previous tree `bc7c2dc7…`; the backend files they exercise did not change afterwards.
- **Unknown causes stay unknown:** the historical E2E failure `…255cfca9` and the `premium-form-voice` failure.
- **Statuses unchanged:** AI-01 PENDIENTE · AI-02 PENDIENTE · AI-03 BLOQUEADA · AI-04/05 PENDIENTE · AI-06 PENDIENTE (AC10 BLOQUEADA) ·
  AI-08 not accepted · AI-14 not started · G1–G4 not approved · A-08-01 is still a proposal · D10 not executed.

## What is ready for assignment (state: LISTO PARA ASIGNACIÓN; nothing sent)
| Request | File | Reviewer | Needed from you |
|---|---|---|---|
| A. Exercise professional (AI-03; AI-04/05) | `13-review-requests/13a-…` | not named | name a qualified person |
| B1. Security (AI-06-AC10) | `13-review-requests/13b-…` | not named | name a reviewer |
| B2. Independent technical review of AI-08 | same file | not named; not the same engagement as B1 | name a reviewer (may differ) |
| C. Hermes / copy (AI-02, AI-04/05 strings) | `13-review-requests/13c-…` | no Hermes available | confirm the gate route you want |
| D. Legal, L1–L8 only | `13-review-requests/13d-…` | not named | name a reviewer |

## Minimum decisions for you (none is a technical question already settled)
1. Who reviews each of A, B1, B2, C, D (or defer each).
2. Whether you want the independent review reports attached to the package (they are not in the repository).
3. Whether to approve, amend or reject addendum A-08-01 (document 02) — it decides where AI-08's evidence is accepted.
4. Whether a staging environment will exist (Stage D) — AI-04/06/08 launch evidence.
5. Whether to run the external log checks of document 03 (closes "undetermined" effects).
6. Confirm `B-D6` as the AI-01 owner status and name the "técnico" (AI-01).
Product/operation items (quota per plan, caps, retention values, scheduler, token transport) are listed in `10-…` §C and do not gate this package.

## Things I noticed and did not resolve
`10-…` §B lists residual risks (tabs not synchronized visually, abandoned rotated session alive until expiry, opaque-token comparison,
data hooks not audited, local PostgreSQL ≠ deployment) and §B "candidate items" T-1…T-5 (stale file lists in two older documents, an AI-08
label that differs between two documents, historical hashes). All are documentation/triage items; none was corrected here.
