# Review request D — Legal (items L1–L8 only)

**Status of this request: LISTO PARA ASIGNACIÓN** (no reviewer designated; not sent; not in review).
Toni decides recipients and sends it. Prepared 2026-10-12 from the consolidated package; tree
`sourceTreeSha256 dee09279107148dddf28e075a29577cd64692b480d5e1f6db64b6c28ea07efb6`, base `77f852aa…`, uncommitted.

Limited to the eight items of `08-packet-legal.md`. This is a list of questions, not legal advice and not a statement
of compliance. It does **not** extend to each technical change (session design, idempotency, migrations, runners,
test infrastructure): their data consequences are already captured by L2/L3.

## Correspondence of L1–L8 with the final tree (checked 2026-10-12 against the files, not executed)
| # | Item | Where | Current correspondence |
|---|---|---|---|
| L1 | statements on AI use and "no sustituye consejo médico" | `components/legal-document.tsx`, `app/legal`, `app/privacy`, `app/terms` | paths as in the packet; text unchanged by R1–R8-C |
| L2 | personal data of idempotent responses (24 h), sessions (30 d), counters | `idempotency_records`, `auth_sessions`, `refresh_tokens`, `coach_usage_windows` | tables exist in migrations `…030100`, `…030200`, `…040000`; R1 adds reservation columns `reservedWindowId`, `reservedOwnerToken`, `reservedTokens`, `reservedAt` to `idempotency_records` (migration `…050000`): **internal accounting, no new personal-data category identified**, to be confirmed by the reviewer |
| L3 | logs with user ids, IPs, emails; rotation 14/7/30 d | `backend/src/config/logger.ts` | R4 added redaction of query strings and free text; R8 added an `auth.logout` log with `reason` and `origin` (no tokens, no identifiers) |
| L4 | health-adjacent data to an AI provider | profile model, `workouts.service.ts` prompt, coach provider | unchanged |
| L5 | `socialProfileVisibility` default `"public"` | `backend/prisma/schema.prisma` | unchanged |
| L6 | no export/erase flows | AI-07 | unchanged |
| L7 | cookie/consent banner | `components/cookie-consent.tsx` | unchanged |
| L8 | product events accept arbitrary `metadata` | `product-events.*` | unchanged |

## Questions (from the packet, unchanged)
1 accuracy/sufficiency of AI-use and medical-disclaimer statements · 2 maximum retention of stored idempotent responses and
session history (24 h / 30 d) · 3 retention and content limits of logs; IP/email in error context · 4 consent or processor
addendum for sending profile/limitations/coach messages to the AI provider · 5 default of the social profile · 6 scope and
deadlines of export/erase (incl. backups) · 7 sufficiency of the consent banner.

## Evidence available
Schema and code above; configuration values (`IDEMPOTENCY_RETENTION_HOURS=24`, `RETENTION_PURGE_GRACE_SECONDS=3600`,
`AUTH_REFRESH_SESSION_DAYS=30`, winston rotation); the retention job and tests (`inc04`). No legal opinion exists in the repository.

## Limits
No conclusion on compliance is stated or implied.

## Return format (to be completed by the reviewer; every field is empty on purpose)
| Field | Entry |
|---|---|
| Reviewer name | |
| Competence / role / credential | |
| Date | |
| Package and code reviewed (ZIP SHA-256, `sourceTreeSha256`) | |
| Documents / files actually reviewed | |
| Findings (id · location · effect · evidence) | |
| Decision | ☐ approved  ☐ requires changes  ☐ not evaluable — with justification: |
| Conditions | |
| Limits of the review | |
| Written reference | |
Nothing in this request is signed or approved. A reviewer may answer "not evaluable" and say what is missing.
