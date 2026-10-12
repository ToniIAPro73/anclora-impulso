# Effects assessment of the invalid / provisional runs (local records only; no production consulted)

Method: local winston logs (`backend/logs/*2026-10-12.log`, no pid per line), the names-only probe log
(`artifacts/qa/env-probe-before-shield.log`), the isolated database, and source reading. No value of any operational
file or variable was read or printed; **no network capture exists**, so "not observed" never means "did not happen".

Vocabulary: **Declared** = target the runner/contract names · **Present** = variable existed in the process ·
**Observed** = a connection/request actually seen in a local record · **Undetermined** = evidence insufficient.

## Processes concerned
| Process | Origin | Notes |
|---|---|---|
| Orphan API :3101 | E-01 (05:00:42) | started by the runner with an explicit local `DATABASE_URL`; Prisma loader merged `backend/.env` names into undefined keys; received all traffic of E-02…E-10 |
| Orphan Next :3100 | E-01 | started at the **repository root**; loaded `.env.local` (names incl. database/Vercel/autofill) |
| Orphan API :3122 and Next :3120/:3121 | verification runs V-01…V-03 | probes only; same loader behaviour |
| jest processes before the shield | all integration runs before 05:2x | env file read by the loader; sandbox env probed once (keys absent) |

## Per destination
| Destination | Declared | Present in the process | Observed | Verdict |
|---|---|---|---|---|
| **Database – orphan API** | explicit local URL from the runner (explicit value beats the file; `schema.prisma` has no `directUrl`) | local URL (explicit); no second database variable among the names the loader added | writes landed in the isolated DB (37 `e2e-*` users, routines, sessions) | Local target **observed**. Contact with the operational database: **not observed; undetermined** (no egress capture), structurally unlikely for the API |
| **Database – orphan Next** | none (frontend has no database) | database and platform variable **names** from `.env.local` were present (names in the probe record) | none | Present; **no code path in this repository reads them**; third-party packages were not audited; connection **undetermined** |
| **OAuth** | none for tests | client id/secret **names** present in the orphan API after the loader ran (read lazily at request time) | 14 requests to `/api/auth/google/callback` between 04:34:13 and 05:28:59, each `302` in ≈0.5 ms; all issued by this work's own `dashboard-authorization` test inside jest (where the keys were absent in the sandbox env). The callback redirects **before any provider call** when no transaction cookie exists. No `/api/auth/google` or `/github` *start* request, no OAuth account row (`oauth_accounts` = 0) | Request path observed and benign; provider contact **not observed**, network level **undetermined**. An earlier report said OAuth routes "were never requested": that was **wrong** (they were, by the test) |
| **AI provider** | `LLM_PROVIDER=deterministic` for the API; mocked/absent key in jest | `GROQ_API_KEY` and model **names** were merged into the orphan API process | `LLM provider initialized` (logged when the provider client is constructed) appears **0 times** in all logs of the day; every routine generated in E2E records `ai_unavailable` (key empty when `config/env` was evaluated); coach provider has no log line but was `deterministic` | No provider construction **observed**; the coach Groq client and any dependency default reading are not log-covered → network level **undetermined**. `ai_unavailable` alone is **not** proof (it only shows the captured config value) |
| **Notifications / email** | none | no `SMTP_*` name was among the merged names | no notification log line; `notification_deliveries` = 0 rows locally; dispatch timer only queries the local DB | No send **observed**; absence of the SMTP names in the merged set is evidence the file does not define them; network level **undetermined** |
| **Login autofill (frontend)** | none | `UTILIZAR_USER_TEXT`, `USER_TEXT`, `PASS_TEXT` **names** present in the orphan Next; `app/auth/login/page.tsx` reads them on the server | none | Could have rendered stored credentials into the local login page if the flag was `true` (value never read) → **undetermined**. No retained screenshot shows a login page (Playwright empties `test-results/` each run) |
| **Platform token** | none | a Vercel OIDC token **name** was present in the orphan Next | none | Not read by any repository code; **undetermined** |

## What can and cannot be concluded
- Conclude: the runs wrote only to the isolated database; no OAuth start/redirect to a provider was requested; no AI
  provider client was constructed in any logged process; the causes (A/B/C) are removed and verified (V-VALID).
- Do **not** conclude: "no production access occurred". Local records cannot establish absence of outbound
  connections from the orphan Next/API processes. Evidence required to settle it (not available here): host network
  logs for 05:00–05:28 local time, or the provider/database-side audit logs. Those are outside this environment and
  were not consulted.
- Recommended owner action (no secrets needed): review provider-side access logs (OAuth provider console, AI provider
  usage page, database/hosting connection logs) for the window 2026-10-12 05:00–05:28 CEST; if the operational
  `.env.local` held the login-autofill credentials, treat them as exposed to a local browser/dev server and rotate if
  policy requires.
