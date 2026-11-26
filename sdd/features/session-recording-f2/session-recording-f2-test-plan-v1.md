# Session recording F2 — Test plan v1

## Frontend reproduction / acceptance (written, red before the fix)
`__tests__/components/session-recording-f2.test.tsx` — renders the real page with mocked API, router, auth and language.
| Test | Criterion |
|---|---|
| sends only the sets marked as completed | F2-AC01 |
| a completed set with empty reps is not filled with the target reps | F2-AC02 |
| accepts a decimal comma in the weight | F2-AC03 |
| the duration is not measured from the start of an old restored draft | F2-AC04 |
| a failed save shows an error, keeps the draft and does not navigate away | F2-AC05 |
| marks the session as a faithful recording (`recordingVersion = 2`) | F2-AC06 |

## To write after the decisions (before code)
| Test | Location | Criterion |
|---|---|---|
| `parseDecimalInput`: `12,5`, `12.5`, `12`, `''`, `abc`, `1,234`, `12,555`, negative | `__tests__/lib/session-recording.test.ts` | F2-AC03 |
| `allowsBodyweight` allow-list; frontend and backend lists identical | unit (both sides) | F2-AC07 |
| `computeActiveDuration`: normal, gap > 4 h, missing `lastActivityAt`, clock skew, cap | unit | F2-AC04 |
| `buildSessionPayload`: no completed set, empty reps, empty weight bodyweight/loaded, ordering | unit | F2-AC01, 02, 07, 09 |
| page: empty weight on bodyweight accepted; on barbell blocked | RTL | F2-AC07 |
| page: no completed set blocks finishing, draft kept | RTL | F2-AC09 |
| page: old draft shows resume/discard; resume restarts active time | RTL | F2-AC04 (D3) |
| API v2: duration > max, reps 0, empty exercises → 422; valid → 201 with `recordingVersion = 2` | `backend/tests/integration/session-recording-f2.test.ts` | F2-AC06, 08 |
| API legacy payload (no `recordingVersion`) → 201, stored 1 | integration | F2-AC08 (D4) |
| migration: existing sessions read `recordingVersion = 1` | integration / Neon rehearsal | F2-AC10 |
| full frontend and backend suites, typecheck, lint, build | CI + local | F2-AC11 |

Known unrelated baseline: `anclora-identity-oidc-e2e` 5 tests fail before F1 and F2 (separate task, see backlog).
