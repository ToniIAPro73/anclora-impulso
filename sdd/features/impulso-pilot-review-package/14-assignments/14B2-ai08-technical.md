# Assignment B2 — Independent technical review of AI-08

**State: LISTO PARA ASIGNACIÓN** (no designation registered; not sent; not accepted; not in review). Register: `../14-review-assignment-register.md`.

| Field | Entry |
|---|---|
| Designated person or agent | **PENDING — to be designated by Toni** |
| Reviewer type | pending (human / AI pre-assessment) |
| Competence to confirm | PostgreSQL transactions, concurrency, idempotency, quotas and migrations — **to be declared by the reviewer** |
| Relationship with the implementation | pending (the implementation was done by an AI agent working with Toni) |
| Agreed target date | pending |

## Scope
Atomic routine update, idempotency ledger (ownership, compare-and-set takeover, completion atomic with the effect), quota reservation/release/reconciliation (R1, R7), atomic admission (R2), retention/purge, migrations and `verify-migrations` (R5), guards (R6).

**Excluded:** commercial quota number (AI-15/AI-19), the retention scheduler (D10), session/security review (assignment B1, separate opinion).

## Request, dossiers and concrete questions (linked, not duplicated)
- Request: `../13-review-requests/13b-security-ai06-ac10-and-ai08-technical.md` §B2
- Evidence and residual risks: `../10-consolidated-matrix-r1-r8c.md`, `../11-execution-coverage-and-provenance.md`.
- Dossiers: `../../impulso-pilot-baseline/ai-08-acceptance-analysis-v1.md`, `../../impulso-pilot-data-integrity/*`, `../02-proposed-addendum-ai-08-local-evidence.md` (**proposal, unapproved**).
- **Independence:** the same person may cover B1 and B2 only if Toni designates them and the reviewer declares competence for both; the two opinions must stay separate. Record any participation in the implementation.

## Package and version to review
| Item | Value |
|---|---|
| ZIP | `artifacts/review-bundles/anclora-impulso-review-consolidated-20261012T064901Z.zip` |
| SHA-256 | `ae3e55758673d18214250c40e27641f3f9ca1f199f88719cea662d86a3294c75` |
| Base | `77f852aa3a1c67b8d1f58bb8852d408b0a8c0523` |
| Code identity of the package | `sourceTreeSha256 dee09279107148dddf28e075a29577cd64692b480d5e1f6db64b6c28ea07efb6` (E2E 14/14 `20261012T063117Z-c38e75c8`) |
| Entry point | `sdd/features/impulso-pilot-review-package/INDEX.md` |
| Update after the package was built | The working tree was later **committed** (`977c861 … ebfc707`) and one more commit `944eb67` was added; `origin/development` and `origin/staging` are at `944eb67` (code identity `5a5cf68d21767b72ac7eba2e04f7c1b549d4bb2e3f95ca619b5581e1e5221034`). The package statement "uncommitted" is therefore historical. **Exactly one file differs** between the package and `944eb67`: `components/workout-generator.tsx` (4 lines: `onValueChange` callbacks typed as `string` and narrowed by cast, to satisfy the CI typecheck; no user-facing string changed). |

## Limits of the evidence (read first)
- Tests are separate local executions on **successive trees** (isolated PostgreSQL, Jest/RTL, Playwright), not one full suite on the final tree (`11-execution-coverage-and-provenance.md`).
- The independent technical reviews so far were static/simulated probes (no PostgreSQL, no full suites). There is no staging and no production evidence.
- Unknown causes stay unknown: historical E2E failure `20261012T043534Z-255cfca9` and `premium-form-voice` in run `20261012T043219Z-74b2798b`.
- No task or gate is accepted; D10 was not executed; production is untouched.

## Known risks and pending states
See `../10-consolidated-matrix-r1-r8c.md` §B (residual risks and candidate items T-1…T-5) and §D (reviews pending).

## Return template (all fields empty on purpose)
| Field | Entry |
|---|---|
| Reviewer and type (human / AI) | |
| Competence and limits | |
| Relationship with the implementation | |
| Date | |
| Package / hash reviewed | |
| Documents actually examined | |
| Method | |
| Findings (path · evidence · impact) | |
| Decision («aprobado» / «requiere cambios» / «no evaluable») — **only for this engagement's scope** | |
| Conditions and pending items | |
Instruction: analyse and issue an opinion **without modifying code**. If extra tests are needed, propose them with justification and
environment, to be run under a separate mandate. The opinion does not accept any AI-xx task, G1–G4 or the launch.
