# QA identity account — Spec v1 (decision: I1 + L1, approved by Toni 2026-11-26)

## Problem
Impulso only accepts sign-in through Anclora Identity (`ANCLORA_IDENTITY_ENABLED`). The dedicated QA user declared in
`.anclora/PRODUCTION_RUNTIME.md` (`QA_PERSISTENT_IDENTITY=qa.impulso@anclora.local`, Impulso user
`926a24f0-dff7-4518-9398-14545f9c8455`) has **no Identity account and no identity link**, so no agent or human can sign
in as QA. Blocked today: F1 delete test through the deployed API, F2 end-to-end session check, visual QA.

Facts (read-only, 2026-11-26):
- Identity production DB (`anclora-identity/.env.local`, contract `LOCAL_DATABASE_SCOPE=production`): 2 users,
  `qa.nexus@anclora.local` and `tonipmi.test@gmail.com`; no `qa.impulso`.
- Impulso production: 1 identity link (Toni's user → Identity `a1af8bcc-…`, `authenticated_link`).
- Impulso never links an Identity subject to an existing user by email (`identity-link.service.ts`: `LOGIN_DENIED`,
  `link_requires_original_method`). Linking an existing user needs `authenticated_link` (user already signed in by the
  original method, which is disabled) — or an explicit operator action.
- Identity creates users only through invitations (`POST /apps/:applicationId/invitations`, per-application service
  token, activation link by email) or the one-off bootstrap scripts (`bootstrap:first-identity` refuses when any user
  exists). `qa.impulso@anclora.local` is not a deliverable mailbox.

## Goal
A persistent QA identity that signs in to Impulso through Identity and lands on the existing QA user (its data and
the contract stay as they are), created and linked only by audited operator actions run by Toni.

## Options
### Identity side — create the QA identity
| Option | How | Pros | Cons |
|---|---|---|---|
| I1 | Invitation to a mailbox Toni reads (e.g. a `+qa` alias) | Uses the normal flow, no new code | Identity email ≠ `qa.impulso@anclora.local`; needs the per-app service token |
| **I2** | New operator CLI in `anclora-identity` (`provision-identity`): creates an ACTIVE, verified user for a given email, password prompted without echo, audit event; refuses if the email exists | Exact email `qa.impulso@anclora.local`; same trust model as `set-password` | Code change in another repo (its own SDD, tests, commit) |

### Impulso side — link it to the existing QA user
| Option | How | Pros | Cons |
|---|---|---|---|
| **L1** | New operator CLI in Impulso (`link-identity`): creates the `identity_links` row for a given user id + Identity subject, `linkedVia='operator_link'`, writes an `identity_link_audits` row; refuses on conflicts | Keeps the QA user, its data and the contract; explicit and audited | New code; production write (Toni runs it) |
| L2 | Let Identity auto-provision a **new** Impulso user on first login (needs `ANCLORA_IDENTITY_AUTO_PROVISION=true` and an Identity email not used in Impulso) | No Impulso code | New QA user; contract and existing QA data change |

**Decision (Toni, 2026-11-26): I1 + L1.** I2 was first approved and then withdrawn: `anclora-identity` states that
only identity #1 may be created outside the invitation flow (`identityBootstrapService.ts`,
`bootstrap-first-identity.ts`), so a provisioning CLI would contradict its security invariant. With I1 the QA identity
is a normal invited user whose email is a mailbox Toni reads (e.g. `tonipmi.test+qa-impulso@gmail.com`); L1 links it
by subject, so the Identity email does not need to match `qa.impulso@anclora.local`.

Additional gate found: Impulso only lets an Identity subject sign in when it is in
`ANCLORA_IDENTITY_PILOT_ALLOWED_SUBJECTS` (Render), format `https://anclora-identity.anclora.com|<subject>`,
comma-separated (or the Identity email is in `ANCLORA_IDENTITY_PILOT_BOOTSTRAP_EMAILS` and the link is active).

## Requirements (I1 + L1)
- **FR-001** (no code) The QA identity is created with the normal Identity invitation flow for application
  `anclora-impulso`, invited by Toni's identity, to a mailbox Toni reads; Toni accepts and sets the password.
- **FR-002** Impulso: `scripts/maintenance/link-identity.ts` → `linkIdentityByOperator()`; refuses invalid input,
  unknown or disabled users, a subject linked to another user, and a user already linked for the issuer; idempotent
  for the same pair; one transaction writes the `identity_links` row (`linkedVia='operator_link'`) and an
  `identity_link_audits` row (`LINKED`, reason `operator_link`, metadata `{ operator }`).
- **FR-003** The CLI requires `DATABASE_URL` set in the shell (not from `backend/.env`) and `--target-endpoint` matching
  its host; prints the outcome only.
- **FR-004** The QA subject is appended to `ANCLORA_IDENTITY_PILOT_ALLOWED_SUBJECTS` on Render (Toni).
- **FR-005** Afterwards: signing in at `impulso.anclora.com` with the QA identity lands on user `926a24f0-…`.

## Operator procedure (Toni)
1. Get an application service token accepted by Identity's `POST /api/v1/admin/apps/anclora-impulso/invitations`
   (`APPLICATION_SERVICE_TOKENS_JSON` in the Identity Vercel project; Impulso has no entry locally).
2. Invite: `curl -X POST https://anclora-identity.anclora.com/api/v1/admin/apps/anclora-impulso/invitations
   -H "Authorization: Bearer $TOKEN" -H 'content-type: application/json'
   -d '{"email":"tonipmi.test+qa-impulso@gmail.com","invitedByIdentityUserId":"a1af8bcc-ac83-4f28-8f03-c8accbba75d3","locale":"es"}'`
3. Accept the email, set the password (≥ 12 chars). The agent then reads the new Identity user id (read-only).
4. Link (Impulso production, direct URL): `DATABASE_URL='…' pnpm exec tsx scripts/maintenance/link-identity.ts
   --user-id 926a24f0-dff7-4518-9398-14545f9c8455 --issuer https://anclora-identity.anclora.com --subject <QA id>
   --operator "Toni: QA identity for Impulso" --target-endpoint ep-lingering-paper-agjnrga3`
5. Render: append `,https://anclora-identity.anclora.com|<QA id>` to `ANCLORA_IDENTITY_PILOT_ALLOWED_SUBJECTS`; redeploy.
6. Sign in as QA; the agent verifies `/api/auth/me` and runs the pending QA.

## Security finding (separate task, not fixed here)
`anclora-identity/src/http/adminRouter.ts`: `POST /apps/:applicationId/invitations` accepts the service token of
**any** configured application for **any** `applicationId` (`Object.values(deps.serviceTokens).some(...)`), so one
application's token can mint invitations for another. To be reviewed in `anclora-identity`.

## Acceptance criteria
| ID | Criterion |
|---|---|
| QA-ID-AC01 | The QA identity exists in Identity through an accepted invitation (ACTIVE, verified, PASSWORD) |
| QA-ID-AC02 | Linking refuses conflicts (subject linked elsewhere, user already linked for the issuer, disabled user) |
| QA-ID-AC03 | A successful link writes one link and one audit row in one transaction; repeating it changes nothing |
| QA-ID-AC04 | Production: QA signs in through Identity and `/api/auth/me` returns `qa.impulso@anclora.local` (user `926a24f0-…`) |
| QA-ID-AC05 | Pending checks unblocked: F1 delete through the API, F2 end-to-end session, visual QA of the active-workout page |

## Out of scope
Self-service password reset in Identity; invitation UX; changes to auto-provisioning.
