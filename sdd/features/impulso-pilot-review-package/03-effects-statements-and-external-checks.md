# Historical effects — limited statements and external log checks

Local records only were used. No external service was consulted and no secret value was read or is shown here.
Times: CEST = UTC+2 (2026-10-12).

## 1. Universal statements replaced by statements limited to what was observed
| Earlier wording (in reports/docs) | Replacement (limited to evidence) |
|---|---|
| "The tests never wrote to production / only to the isolated database" | "Writes were **observed** in the isolated database (at the time of this review: 424 users, 70 routines, 440 sessions, 90 idempotency records, 126 coach messages; 0 OAuth accounts; 0 notification deliveries). No write to any other database was observed in the local records. Local records cannot establish that no other write happened." |
| "No production access occurred" | "No connection to the operational database was observed in local records. The Next orphan process held database/platform variable **names**; no repository code reads them; third-party packages were not audited; outbound connections were not captured. **Undetermined.**" |
| "OAuth endpoints were never requested" | "14 requests to `/api/auth/google/callback` were observed (04:34:13–05:28:59 CEST), all issued by this work's own test, each `302` in ≈0.5 ms; no OAuth start request and no provider round-trip was observed. Provider-side contact is **undetermined** at network level." |
| "No AI provider was contacted (all routines `ai_unavailable`)" | "No provider client construction was logged in any process of the day (`LLM provider initialized` = 0). `ai_unavailable` records only that the key value was empty when the configuration module was evaluated. Provider-side contact is **undetermined** at network level." |
| "The E2E stack did not load operational configuration" | "Runs E-01…E-11 loaded operational variable **names** into the Next (repository root) and API (loader merge) processes; runs E-VALID/V-VALID did not (observed)." |
| "No email/notification was sent" | "No notification delivery row and no notification log line exist; SMTP variable names were not among the merged names. Sending cannot be excluded at network level." |
| "No credentials were rendered" | "Login-autofill variable names were present in the orphan Next process; whether stored credentials were rendered into the local login page is **undetermined**; no retained screenshot shows a login page." |

## 2. Where "undetermined" remains (and what would settle it)
| Subject | Why undetermined | What would settle it |
|---|---|---|
| Outbound connections of the orphan Next (:3100) and API (:3101), 05:00:42–≈05:27 CEST | no packet/connection capture; no per-process log | provider/host-side logs below |
| Third-party package reads of ambient variables in the frontend | node_modules not audited | dependency audit or provider-side logs |
| Rendering of autofilled credentials | variable values never read; screenshots overwritten | operator confirms the flag value / rotates if relevant |
| Whether pre-clone jest processes (outside the sandbox) used merged variables | only the sandbox env was probed once | provider-side logs |

## 3. External log checks to perform (owner action; this agent did not and will not consult them)
Window **W1** (orphan servers): 2026-10-12 **05:00:42 → 05:28:00 CEST** = **03:00:42 → 03:28:00 UTC**.
Window **W2** (all test activity that could have carried merged names): **04:25 → 05:35 CEST** = **02:25 → 03:35 UTC**.
Source host: this development Mac (egress IP of the home/office network).

| # | Service (owner's console) | Interval | Signal to search | Expected if nothing was contacted |
|---|---|---|---|---|
| 1 | **Operational database host** (Neon project of the declared production database): connection/compute activity, query/error logs | W2 (W1 first) | any session from the host IP; any statement touching `auth_sessions`, `refresh_tokens`, `idempotency_records`, `coach_usage_windows.providerCalls/failedAttempts`, `workouts.generationMode`, or inserts of `*@example.test` users — these relations/columns **do not exist in production**, so such statements would appear as *relation/column does not exist* errors | no sessions from the host IP; no such errors |
| 2 | **AI provider console** (Groq usage / API log for the operational key) | W2 | any request signed by the operational key; model names matching the configured `GROQ_MODEL*`; request counts/tokens | zero requests |
| 3 | **Google OAuth console** (Cloud Console → Credentials/Audit logs for the operational client id) | W2 | `authorize`/token-exchange events for the client id; unusual redirect URIs | none (the observed callbacks were `302` without provider calls) |
| 4 | **GitHub OAuth app** (Developer settings → app → recent deliveries/audit) | W2 | authorization or token events | none |
| 5 | **Hosting platform (Vercel)** audit log and OIDC token usage for the project | W1 | token issuance/use from the host IP; deployments or environment reads | none |
| 6 | **Email provider** (if one is configured for the operational app) | W2 | outbound sends/API calls | none (SMTP names were not in the merged set) |
| 7 | **Operator's own accounts** (only if the login-autofill flag was `true`) | W1 | sign-in attempts from the host IP with the autofilled identity | none |
| 8 | **Host network records** (router/DNS/VPN/EDR logs, if any exist) | W1 | DNS lookups or connections to the services above from the Mac | none |
If any signal appears: treat the related credential as exposed, rotate per the owner's policy, and record the finding
next to this document; do not re-run anything against production to "check".
