# Review package — single index (2026-10-12) — CONSOLIDATED through R1–R8-C

> **Consolidation addendum (2026-10-12, after R8-C).** The text below this block is the index of the original package and is kept
> unchanged as history; where it conflicts with this block, this block describes the current state.
> Current code identity: `sourceTreeSha256 dee09279107148dddf28e075a29577cd64692b480d5e1f6db64b6c28ea07efb6`
> (`identity.json` of E2E `20261012T063117Z-c38e75c8`), base `77f852aa…`, `development`, **uncommitted**.
> One consolidated ZIP replaces the need to apply the five-bundle chain (the chain is kept, unmodified, for traceability).
> No approval, signature or reviewer exists; no task or gate status changed; D10 not executed; nothing was sent to anyone.

| # | New document | Purpose |
|---|---|---|
| 10 | `10-consolidated-matrix-r1-r8c.md` | R1–R8-C: problem, files, correction, bundle, review basis, regression, environment, tree, residuals; sections A–E |
| 11 | `11-execution-coverage-and-provenance.md` | every execution → scope → tree hash → result → artifact; console-only results; bundle chain; provenance gaps |
| 12 | `12-summary-for-toni.md` | one page, minimum decisions |
| 13 | `13-review-requests/` | four independent requests (A professional, B security + AI-08 technical, C Hermes, D legal) — **LISTO PARA ASIGNACIÓN**, none sent |
| 14 | `14-review-assignment-register.md` + `14-assignments/` | single assignment register (A, B1, B2, C, D) and five prepared engagements — all **LISTO PARA ASIGNACIÓN**, nothing sent |
Superseded details of the original index (still true as history): the "valid evidence" list (three runs) is extended by `11-…`;
test totals are now backend integration 23 suites / 141 tests, 5 migrations, frontend Jest 17 / 123 (console), Playwright 14/14.
Status by task and gate is unchanged from the table below.
> **Update (assignment step):** the working tree described here has since been committed and pushed (`origin/development` and `origin/staging` at `944eb67`); the only code difference to the consolidated ZIP is the typing fix in `components/workout-generator.tsx` (see `14-review-assignment-register.md`). Task/gate statuses and the review states are unchanged.

---

State reviewed: base `77f852aa`, `development`, **uncommitted** working tree, `sourceTreeSha256 76df760527d9cd1b…`.
No approval, signature or reviewer appears anywhere in this package: all of those fields are empty on purpose.
Nothing was committed, pushed, deployed or run against production; D10 not executed.

## Documents
| # | Document | Purpose | Decider / reviewer |
|---|---|---|---|
| 01 | `01-ai-01-evaluation.md` (v2) | AI-01 criterion-by-criterion evaluation, per-task state/evidence/owner-or-block, remaining shortfalls N1–N7 | Toni (+ técnico, unnamed) |
| 01a | `01a-route-level-inventory.md` | 105 routes: state, evidence class, owner-or-block | Toni + técnico |
| 01b | `01b-sdd-to-ai-mapping.md` | existing specs (`sdd/` and `docs/`) → AI-xx, checked against code: Confirmed / Partial / Doubtful / None | técnico (confirmation) |
| 02 | `02-proposed-addendum-ai-08-local-evidence.md` (v2) | **Proposed, unapproved** A-08-01: Stage L (technical acceptance on local PostgreSQL), Stage D (pre-launch compatibility/operation checks), independent review (separate, pending) | Toni + independent P0 reviewer |
| 03 | `03-effects-statements-and-external-checks.md` | Limited statements about historical effects; external log checks (service, CEST/UTC interval, signal) | Toni (owner action) |
| 04 | `04-artifact-inventory.md` | Current / old / gone artifacts; non-overwrite policy; rejected deletion record | Toni |
| 05 | `05-packet-professional-exercise.md` | AI-03 and rules of AI-04/AI-05 | exercise professional (unnamed) |
| 06 | `06-packet-security.md` | auth, dashboard, logs, OAuth, legacy, idempotency | security reviewer (unnamed) |
| 07 | `07-packet-hermes-copy.md` | copy changes | Hermes (unavailable) |
| 08 | `08-packet-legal.md` | documents/decisions that need legal judgement | legal reviewer (unnamed) |
| 09 | `09-decisions-one-page.md` | the eight decisions, options and effects, on one page | Toni |
| — | `evidence-manifest-v1.sha256` | SHA-256 of the valid runs' files at review time (re-verified: unchanged) | — |
Supporting (already in `../impulso-pilot-baseline/`): `evidence-validity-register-v1.md`, `effects-assessment-v1.md`,
`ai-08-acceptance-analysis-v1.md`, `closure-matrix-v1.md`, `phase-closure-report-v1.md`.

## Valid evidence (identified environment and code)
| Ref | Path | Result |
|---|---|---|
| I-VALID | `backend/artifacts/test-runs/20261012T034716Z-865b056c` | integration 20 suites / 126 tests |
| E-VALID | `artifacts/qa/runs/20261012T034530Z-c214631e` | Playwright 13/13, server identity verified |
| V-VALID | `artifacts/qa/isolation/20261012T034331Z-65c1904d` | runner isolation 11/11 with controls |
Unit 7/57, frontend jest 11/96, `tsc`, builds, `verify-migrations`: unaffected by the earlier runner defects.

## Status by task and gate (nothing is accepted by this package)
| Item | Status | What is needed |
|---|---|---|
| AI-01 | PENDIENTE | only N1–N7 of doc 01 §D remain (tracker, owners-or-block, capacity, operational target, CI results, commit, técnico review) — all explicit; none violates a reject condition. Toni decides |
| AI-02 | PENDIENTE | Hermes review; promise-function-proof matrix when a paywall exists |
| AI-03 | BLOQUEADA | professional reviewer + acta (packet 05) |
| AI-04 / AI-05 | PENDIENTE | AI-03; Stage D evidence (doc 02 applies only to AI-08) |
| AI-06 | PENDIENTE; AC10 BLOQUEADA | security review (packet 06); transport decision |
| AI-08 | BLOQUEADA for acceptance; no mandatory criterion known to be violated | A-08-01 decision (Stage L technical acceptance is possible without deployment), independent review (separate), AI-01 accepted; Stage D before launch |
| AI-14 | not started | no coach UI; depends on G1 |
| G1–G4 | not evaluated, not approved | dependencies and reviews missing |

## Minimal decisions needed
| # | Decision | Who | Unblocks |
|---|---|---|---|
| 1 | Accept, modify or hold AI-01 (confirm `B-D6`, N1–N4 explicit; name the técnico) | Toni | AI-01 |
| 2 | Approve, amend or reject addendum A-08-01 (doc 02) | Toni + independent reviewer | AI-08 evidence path |
| 3 | Perform the external log checks of doc 03 and record the outcome | Toni | closes "undetermined" effects |
| 4 | Name reviewers: exercise professional, security, Hermes, legal | Toni | AI-03/04/05, AI-06, AI-02, AI-07 |
| 5 | Decide whether a staging environment will exist | Toni | Stage D for AI-04/06/08 |
| 6 | Review/remove old artifacts listed in doc 04 §B (rejected deletion not retried) | Toni | housekeeping |
Full list with options and effects: `09-decisions-one-page.md`. Product/commercial decisions that do **not** gate this package: quota per plan and caps (AI-15/AI-19), B1/B2 and D10.

## Evidence preservation (from now on)
Every run writes to its own new directory (creation **fails** if it already exists) and ends with `MANIFEST.sha256`;
ad-hoc Playwright screenshots are timestamped. The logic lives in `scripts/support/evidence-lib.sh`.
**Tested** with synthetic files only (`scripts/support/test-evidence-preservation.sh`: 13/13 — existing directory
refused, evidence preserved across two runs, manifest detects modification/addition/removal). The three runner
scripts that source the helper were **syntax-checked only**; they were not executed (no suite repetition).

---
## Addendum (2026-10-12, AI pre-assessments) — new folder `15-ai-pre-assessments/`
| # | Document | Purpose |
|---|---|---|
| 15-00 | `15-ai-pre-assessments/15-00-executive-summary.md` | consolidated new findings, known risks vs defects, what advanced, next-increment recommendation |
| 15-B1 | `15-ai-pre-assessments/15-B1-IA-security-ai06.md` | B1-IA: AI-06 security pre-assessment (not an AC10 sign-off) |
| 15-B2 | `15-ai-pre-assessments/15-B2-IA-integrity-ai08.md` | B2-IA: AI-08 technical pre-assessment (does not accept AI-08) |
| 15-A | `15-ai-pre-assessments/15-A-IA-exercise-ai03.md` | A-IA: decision table and questions for the exercise professional (no clinical endorsement) |
| 15-D | `15-ai-pre-assessments/15-D-IA-legal-l1-l8.md` | D-IA: L1–L8 facts and questions for the legal professional (not legal advice) |
Registered as supplementary engagements B1-IA/B2-IA/A-IA/D-IA in `14-review-assignment-register.md` (state ANÁLISIS IA RECIBIDO).
No task or gate status changed; no reviewer, approval or signature exists; Hermes (C) untouched. Target revision of these reviews:
`ed4bb64` (not `944eb67`; see the correction in the register).

## Addendum (2026-10-12, correction increment)
| # | Document | Purpose |
|---|---|---|
| 16 | `16-correction-nf1-f1-f2-f3.md` | local correction of NF-1, F-1, F-2, F-3 (uncommitted): mechanism, red/green, coverage on the final tree, deployment preconditions, historical-evidence addendum |
Delta bundle: `artifacts/review-bundles/anclora-impulso-review-delta-NF1-F1-F2-F3-*.zip` (see doc 16 / its STATUS). No task or gate status changed.
Addendum to doc 16 §9 (F-1-A, F-1-B) + small delta `anclora-impulso-review-delta-F1AB-*.zip`. No task or gate status changed.
| 17 | `17-oauth-f4-handoff-and-linking.md` | OAuth increment: F-4 (one-time handoff bound to the browser) and e-mail linking policy; local, uncommitted, simulated providers |
