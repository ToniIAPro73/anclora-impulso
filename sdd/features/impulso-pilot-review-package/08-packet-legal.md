# Review packet 4 — Legal (only what really needs legal judgement)

Reviewer: **not named**. This packet lists questions; it is not legal advice and states no conclusion on compliance.

## Items that DO need legal review (and why)
| # | Item | Why legal | Where |
|---|---|---|---|
| L1 | Public legal documents say the app offers "funciones … asistidas por IA" and "no sustituye consejo médico" | accuracy of statements about AI use and health disclaimers | `components/legal-document.tsx`, `app/legal`, `app/privacy`, `app/terms` |
| L2 | Personal data held by the new mechanisms: idempotent responses (24 h; coach answers and generated routines), session records (30 days), failure counters | retention, purpose, data-subject rights, backups | `idempotency_records`, `auth_sessions`, `refresh_tokens`, `coach_usage_windows` |
| L3 | Server logs contain user ids, IPs and emails (error context); rotation: combined 14 d, http 7 d, error 30 d | retention and legal basis for logs | `backend/src/config/logger.ts` |
| L4 | Health-adjacent data: free-text `limitations`, age/sex/weight, coach messages sent to an AI provider | special-category treatment, international transfer, processor terms | profile model, `workouts.service.ts` prompt, coach provider |
| L5 | `socialProfileVisibility` default is `"public"` | privacy by default (pre-existing finding, AI-07) | `backend/prisma/schema.prisma` |
| L6 | No export/erase flows exist | rights to access/erasure; backups and stores covered | AI-07 |
| L7 | Cookie/consent banner stores a choice and defaults optional categories to off | whether it meets the applicable consent rules | `components/cookie-consent.tsx` |
| L8 | Product events accept arbitrary `metadata` | what may be collected under analytics consent (AI-18) | `product-events.*` |

## Items that do NOT need legal review (technical; listed to avoid over-escalation)
Token rotation and revocation design; idempotency ownership and atomic completion; log redaction implementation;
configuration policy; runner isolation; migrations; test infrastructure. (They matter to security review, and
their *data* consequences are captured by L2/L3.)

## Questions
1. Are the AI-use and medical-disclaimer statements in the legal pages accurate and sufficient for the pilot?
2. Maximum retention for stored idempotent responses and session history; is 24 h / 30 d acceptable?
3. Retention and content limits for application logs; is IP/email in error context acceptable?
4. Does sending profile/limitations/coach messages to the AI provider require explicit consent or a processor addendum?
5. What default must the social profile have for the pilot?
6. Required scope and deadlines for export/erase (incl. backups)?
7. Is the consent banner sufficient; which categories may be on without consent?

## Evidence available
Schema and code listed above; retention values from configuration (`IDEMPOTENCY_RETENTION_HOURS=24`,
`RETENTION_PURGE_GRACE_SECONDS=3600`, `AUTH_REFRESH_SESSION_DAYS=30`, winston rotation); the retention job and tests
(`inc04`). No legal opinion exists in the repository.
Output expected: findings and required text/retention changes with reviewer identity — **pending**.
