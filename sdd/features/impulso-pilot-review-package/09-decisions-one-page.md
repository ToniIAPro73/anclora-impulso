# Decisions — one page (2026-10-12)

Nothing in this package is approved, signed or accepted. Every decision below belongs to Toni unless stated.
Technical questions that could be answered from code or evidence were answered (`01b`, `01a`); none is delegated to Toni.

| # | Decision | Options | Effect of each | Needed before |
|---|---|---|---|---|
| 1 | **AI-01**: accept, modify or hold | accept with `B-D6` as owner status and N1–N4 explicit · modify (assign names, add tickets) · hold | accept → AI-01 ACEPTADA, unblocks AI-02/03/06/07/08/09 *acceptance* (their predecessor); modify/hold → they stay blocked by AI-01 | accepting any task that depends on AI-01 |
| 2 | **Name the "técnico"** (co-decider/reviewer of AI-01) and the P0 independent reviewer for AI-08 | name · defer | naming allows N7 and the independent-review requirement of A-08-01 to be met; deferring leaves them pending | AI-01 and AI-08 acceptance |
| 3 | **Addendum A-08-01 (v2)**: approve, amend or reject | approve (Stage L accepts local evidence; Stage D stays mandatory before launch; review separate) · amend · reject (staging only) | approve → Accept 1–3 can be technically accepted at Stage L without deploying; reject → they wait for a staging environment | AI-08 evidence path |
| 4 | **Staging**: will a deployed non-production environment exist? | yes · no (then Stage D runs on the launch environment under the authorized procedure) | determines where Stage D is executed for AI-04/06/08 | launch planning |
| 5 | **External log checks** (doc 03): perform and record | do · decline | doing closes the "undetermined" effects; declining keeps them undetermined permanently | any statement about "no external contact" |
| 6 | **Reviewers**: exercise professional, security, Hermes, legal | name each · defer each | unlocks AI-03 (and AI-04/05), AI-06-AC10, AI-02, AI-07; deferral keeps them BLOQUEADA/PENDIENTE | the corresponding acceptances |
| 7 | **Old artifacts** (doc 04 §B): review and remove manually | remove selected · keep all | housekeeping only; do not remove whole `artifacts/` trees | — |
| 8 | **Commit/versioning** of the working tree | commit later by explicit instruction · keep uncommitted | makes the inventory "versionado" in VCS history (N6) | AI-01 "versionado" at VCS level |

Not decisions of this package (tracked elsewhere): quota per plan and experimental caps (AI-15/AI-19), B1/B2 and
execution of D10 (launch only), G1–G4.

Tasks and gates stay as stated in `INDEX.md`; no one is accepted by answering this page alone.
