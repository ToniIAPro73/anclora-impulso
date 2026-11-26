# Session recording F2 — Decisions v1

**Approved by Toni on 2026-11-26: all recommendations (D1 = A, D2 = A, D3 = A, D4 = A, D5 = A).**

Implementation note on D2: `resistance_bands` was added to the allow-list (band tension has no kilogram value; without it
93 catalogue exercises would require typing 0). Pending Toni's validation; removing it is a one-line change in
`lib/session-recording.ts`.

## D1 — Maximum duration accepted by the API
Today `duration` only requires ≥ 1 s (no upper bound).

| Option | Rule | Pros | Cons |
|---|---|---|---|
| A | v2 max **4 h** (14 400 s) | Consistent with the 4 h inactivity threshold; blocks absurd values | A real > 4 h session (rare) must be split |
| B | v2 max 6 h (21 600 s) | Margin for long sessions | Inconsistent with the 4 h threshold |
| C | v2 max 24 h | Almost never rejects | Barely protects the data |

**Recommendation: A.** With FR-005 the client sends *active* time, so 4 h is a ceiling, not a typical value. Legacy
payloads (no `recordingVersion`) keep today's rule so an old frontend is not broken (see D4).

## D2 — Which exercises accept an empty weight (bodyweight)
`Exercise` has no load-type field. Production catalogue: 118 exercises with `equipment = 'bodyweight'`; also
`pull_up_bar`, `plyo_box`, `stairs`, `jump_rope`, `ab_wheel`, `battle_ropes`, `assault_bike` are usually unloaded.

| Option | Rule | Pros | Cons |
|---|---|---|---|
| A | Allow-list of `equipment` values: `bodyweight`, `pull_up_bar`, `plyo_box`, `stairs`, `jump_rope`, `ab_wheel`, `battle_ropes`, `assault_bike` | No migration; covers today's catalogue | Implicit rule; a weighted pull-up still records 0 when left empty |
| B | New `Exercise.loadType` (`external` \| `bodyweight` \| `none`) with a backfill from `equipment` | Explicit and editable | Second migration and catalogue backfill; more scope |
| C | Empty weight allowed for every exercise (stored 0) | Simplest | Loaded sets with a forgotten weight become 0 kg again (defect D3 by another route) |

**Recommendation: A**, implemented in one shared function (frontend + backend) so B can replace it later. Weight
entered explicitly is always recorded, including on bodyweight exercises (e.g. weighted pull-ups).

## D3 — Drafts without `lastActivityAt` (created before F2)
Existing drafts in `localStorage` only have `startedAt`.

| Option | Rule | Pros | Cons |
|---|---|---|---|
| A | Treat `lastActivityAt = startedAt`. If older than 4 h, show "Resume (time restarts now) / Discard"; on resume, active time starts at the first activity after resuming | No silent loss; honest duration | Extra dialog once per old draft |
| B | Discard any draft without `lastActivityAt` | Simplest | Loses sets already marked |
| C | Keep the draft, cap the duration at the maximum (D1) | No dialog | Records an invented duration |

**Recommendation: A.** It also covers new drafts left inactive for more than 4 h.

## D4 — New backend receiving an old frontend (all sets, no `recordingVersion`)
Vercel can serve the old bundle to an open tab after the deploy.

| Option | Rule | Pros | Cons |
|---|---|---|---|
| A | Accept, store `recordingVersion = 1` (legacy), keep today's validation; log a `legacy_session_payload` counter | No user-facing error; legacy data already excluded from records and progression (F4/F5) | Unfaithful rows can still be created during the transition |
| B | Reject with 426 and a "reload the app" message | Only faithful data from day one | A user can lose a session in a stale tab (the old page does not catch errors, D5) |
| C | Accept and treat as v2 | Simplest | Mixes unfaithful data into faithful history; defeats F4/F5 |

**Recommendation: A**, and revisit B after a few weeks once the counter shows no legacy payloads.

## D5 — Git flow for F2 (`AGENTS.md`: work on `development`, no branches or PRs)
F1 was developed on `claude/project-thread-0c4f1l` with PR #57 against that rule.

| Option | Flow | Pros | Cons |
|---|---|---|---|
| A | Work directly on `development`, uncommitted until Toni validates each block; small commits per task (tests + code); migration via protected workflow; `PROMOTE=FULL` once at the end | Matches `AGENTS.md` and `PRODUCTION_RUNTIME.md` (`FEATURE_BRANCHES=DISALLOWED`) | No PR review UI; uncommitted work lives only locally until validated |
| B | Feature branch + PR, as F1 | Review UI and CI per PR | Contradicts the repository contract; needs an explicit exception from Toni |
| C | `development` with the new recording behind a frontend flag | Can merge early and switch on later | The defects are data-integrity bugs; a flag delays the fix and adds a dual path |

**Recommendation: A.** The backend change is backward compatible (D4) and the migration is additive, so deploy order
migration → backend → frontend works within one `PROMOTE=FULL`.

## Recommended defaults (if Toni accepts all)
D1 = A (4 h), D2 = A (equipment allow-list), D3 = A (resume or discard), D4 = A (accept as legacy), D5 = A (`development`).
