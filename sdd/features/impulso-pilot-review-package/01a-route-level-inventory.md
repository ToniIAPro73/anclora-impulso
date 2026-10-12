# AI-01 appendix — route-level function inventory (105 routes)

Source: application router, parsed statically from `backend/src/app.ts` and `backend/src/routes/*.ts` (mount prefix; per-route and router-level `authenticate` / `requireAdmin`). Generated 2026-10-12 from the working tree (`sourceTreeSha256 76df7605…`).

**Evidence classes.** *source only* = the route exists in source; no behaviour is claimed. *runtime-referenced (local)* = a local integration/E2E test calls that method + path (literal, or a table/helper path confirmed by reading the test); it shows the route was exercised against the isolated PostgreSQL, **not** that every branch is correct, and it is not production or staging evidence. *source only* may include routes exercised indirectly in ways the scan cannot see; those would be reclassified by the technician, not assumed.

**Owner column.** `B-D6` = explicit block: no responsible person assigned (decision D6); no name is implied. Tracker/ticket status: not consulted for any row.

Totals: 105 routes · runtime-referenced (local): 61 · source only: 44. Access: public 18, auth 71, admin 16.

| # | Method | Path | Access (static) | State | Evidence | Owner |
|---|---|---|---|---|---|---|
| 1 | GET | `/api/auth/github` | public | source only | — | B-D6 |
| 2 | GET | `/api/auth/github/callback` | public | source only | — | B-D6 |
| 3 | GET | `/api/auth/google` | public | source only | — | B-D6 |
| 4 | GET | `/api/auth/google/callback` | public | runtime-referenced (local) | dashboard-authorization | B-D6 |
| 5 | POST | `/api/auth/login` | public | runtime-referenced (local) | auth, dashboard-authorization, session-and-fallback | B-D6 |
| 6 | POST | `/api/auth/logout` | public | runtime-referenced (local) | ai06-sessions | B-D6 |
| 7 | GET | `/api/auth/me` | auth | runtime-referenced (local) | auth, session-and-fallback | B-D6 |
| 8 | POST | `/api/auth/refresh` | public | runtime-referenced (local) | auth, session-and-fallback | B-D6 |
| 9 | POST | `/api/auth/register` | public | runtime-referenced (local) | ai06-sessions, auth, dashboard-authorization, health-plans, inc02-coach-idempotency, inc03-idempotency-hardening, llm-coach, premium-form-voice, profile, progression-next-session, session-gamification, smart-nutrition, social-community, strength-progress, wearables-readiness | B-D6 |
| 10 | GET | `/api/dashboard/db-metrics` | admin | runtime-referenced (local) | dashboard-authorization (table) | B-D6 |
| 11 | GET | `/api/dashboard/logs` | admin | runtime-referenced (local) | dashboard-authorization | B-D6 |
| 12 | GET | `/api/dashboard/logs-stats` | admin | runtime-referenced (local) | dashboard-authorization (table) | B-D6 |
| 13 | GET | `/api/dashboard/metrics` | admin | runtime-referenced (local) | dashboard-authorization (table) | B-D6 |
| 14 | GET | `/api/dashboard/summary` | admin | runtime-referenced (local) | dashboard-authorization | B-D6 |
| 15 | GET | `/api/engagement/admin/deliveries` | admin | source only | — | B-D6 |
| 16 | POST | `/api/engagement/admin/dispatch-now` | admin | source only | — | B-D6 |
| 17 | GET | `/api/engagement/deliveries` | auth | source only | — | B-D6 |
| 18 | GET | `/api/engagement/nudges` | auth | source only | — | B-D6 |
| 19 | POST | `/api/events` | auth | source only | — | B-D6 |
| 20 | GET | `/api/events/summary` | admin | source only | — | B-D6 |
| 21 | GET | `/api/exercises` | public | source only | — | B-D6 |
| 22 | POST | `/api/exercises` | admin | source only | — | B-D6 |
| 23 | DELETE | `/api/exercises/:id` | admin | source only | — | B-D6 |
| 24 | GET | `/api/exercises/:id` | public | source only | — | B-D6 |
| 25 | PUT | `/api/exercises/:id` | admin | source only | — | B-D6 |
| 26 | POST | `/api/exercises/editorial/bulk-update` | admin | source only | — | B-D6 |
| 27 | GET | `/api/exercises/editorial/summary` | admin | source only | — | B-D6 |
| 28 | GET | `/api/exercises/meta/categories` | public | source only | — | B-D6 |
| 29 | GET | `/api/exercises/meta/equipment` | public | source only | — | B-D6 |
| 30 | GET | `/api/exercises/meta/muscle-groups` | public | source only | — | B-D6 |
| 31 | GET | `/api/exercises/meta/training-environments` | public | source only | — | B-D6 |
| 32 | GET | `/api/gamification/achievements` | auth | runtime-referenced (local) | session-gamification | B-D6 |
| 33 | GET | `/api/gamification/status` | auth | runtime-referenced (local) | session-gamification | B-D6 |
| 34 | GET | `/api/gamification/xp-history` | auth | source only | — | B-D6 |
| 35 | POST | `/api/health-plans/actions/:actionId/complete` | auth | runtime-referenced (local) | health-plans | B-D6 |
| 36 | GET | `/api/health-plans/definitions` | auth | runtime-referenced (local) | health-plans | B-D6 |
| 37 | GET | `/api/health-plans/enrollment` | auth | source only | — | B-D6 |
| 38 | POST | `/api/health-plans/enrollment` | auth | runtime-referenced (local) | health-plans | B-D6 |
| 39 | PUT | `/api/health-plans/enrollment/status` | auth | runtime-referenced (local) | health-plans | B-D6 |
| 40 | GET | `/api/health-plans/home` | auth | runtime-referenced (local) | health-plans | B-D6 |
| 41 | POST | `/api/health-plans/onboarding` | auth | runtime-referenced (local) | health-plans | B-D6 |
| 42 | GET | `/api/nutrition/editorial/summary` | admin | source only | — | B-D6 |
| 43 | GET | `/api/nutrition/foods` | auth | runtime-referenced (local) | smart-nutrition | B-D6 |
| 44 | POST | `/api/nutrition/foods` | auth | runtime-referenced (local) | smart-nutrition | B-D6 |
| 45 | GET | `/api/nutrition/health-import/status` | auth | runtime-referenced (local) | smart-nutrition | B-D6 |
| 46 | POST | `/api/nutrition/log` | auth | source only | — | B-D6 |
| 47 | GET | `/api/nutrition/logs` | auth | source only | — | B-D6 |
| 48 | GET | `/api/nutrition/meal-logs` | auth | runtime-referenced (local) | smart-nutrition | B-D6 |
| 49 | POST | `/api/nutrition/meal-logs` | auth | runtime-referenced (local) | smart-nutrition | B-D6 |
| 50 | GET | `/api/nutrition/meal-plans` | auth | source only | — | B-D6 |
| 51 | DELETE | `/api/nutrition/meal-plans/:id` | auth | runtime-referenced (local) | ai06-sessions | B-D6 |
| 52 | GET | `/api/nutrition/meal-plans/:id` | auth | runtime-referenced (local) | ai06-sessions | B-D6 |
| 53 | POST | `/api/nutrition/meal-plans/generate` | auth | source only | — | B-D6 |
| 54 | POST | `/api/nutrition/meal-plans/smart` | auth | runtime-referenced (local) | smart-nutrition | B-D6 |
| 55 | POST | `/api/nutrition/meals/:mealId/replace` | auth | runtime-referenced (local) | ai06-sessions | B-D6 |
| 56 | GET | `/api/nutrition/recipes` | auth | source only | — | B-D6 |
| 57 | POST | `/api/nutrition/recipes` | auth | source only | — | B-D6 |
| 58 | GET | `/api/nutrition/recipes/:id` | auth | source only | — | B-D6 |
| 59 | PUT | `/api/nutrition/recipes/:id` | admin | source only | — | B-D6 |
| 60 | POST | `/api/nutrition/recipes/editorial/bulk-update` | admin | source only | — | B-D6 |
| 61 | GET | `/api/nutrition/summary` | auth | source only | — | B-D6 |
| 62 | GET | `/api/nutrition/targets` | auth | source only | — | B-D6 |
| 63 | PUT | `/api/nutrition/targets` | auth | runtime-referenced (local) | smart-nutrition | B-D6 |
| 64 | POST | `/api/premium/form-analysis` | auth | runtime-referenced (local) | premium-form-voice | B-D6 |
| 65 | GET | `/api/premium/status` | auth | runtime-referenced (local) | premium-form-voice | B-D6 |
| 66 | POST | `/api/premium/voice-cues` | auth | runtime-referenced (local) | premium-form-voice | B-D6 |
| 67 | GET | `/api/profile` | auth | runtime-referenced (local) | profile | B-D6 |
| 68 | PUT | `/api/profile` | auth | runtime-referenced (local) | health-plans, profile | B-D6 |
| 69 | GET | `/api/progress/complete` | auth | source only | — | B-D6 |
| 70 | GET | `/api/progress/measurements` | auth | source only | — | B-D6 |
| 71 | POST | `/api/progress/measurements` | auth | source only | — | B-D6 |
| 72 | DELETE | `/api/progress/measurements/:id` | auth | runtime-referenced (local) | ai06-sessions | B-D6 |
| 73 | PUT | `/api/progress/measurements/:id` | auth | runtime-referenced (local) | ai06-sessions | B-D6 |
| 74 | GET | `/api/progress/stats` | auth | source only | — | B-D6 |
| 75 | GET | `/api/progress/strength` | auth | runtime-referenced (local) | strength-progress | B-D6 |
| 76 | GET | `/api/sessions` | auth | source only | — | B-D6 |
| 77 | POST | `/api/sessions` | auth | runtime-referenced (local) | session-gamification, social-community, strength-progress | B-D6 |
| 78 | DELETE | `/api/sessions/:id` | auth | runtime-referenced (local) | ai06-sessions | B-D6 |
| 79 | GET | `/api/sessions/:id` | auth | runtime-referenced (local) | ai06-sessions | B-D6 |
| 80 | PUT | `/api/sessions/:id` | auth | runtime-referenced (local) | ai06-sessions | B-D6 |
| 81 | POST | `/api/social/challenges/:challengeId/join` | auth | runtime-referenced (local) | social-community | B-D6 |
| 82 | GET | `/api/social/challenges/:challengeId/leaderboard` | auth | runtime-referenced (local) | social-community | B-D6 |
| 83 | GET | `/api/social/challenges/weekly` | auth | runtime-referenced (local) | social-community | B-D6 |
| 84 | GET | `/api/social/feed` | auth | runtime-referenced (local) | social-community | B-D6 |
| 85 | DELETE | `/api/social/feed/:feedItemId/kudos` | auth | source only | — | B-D6 |
| 86 | POST | `/api/social/feed/:feedItemId/kudos` | auth | runtime-referenced (local) | social-community | B-D6 |
| 87 | DELETE | `/api/social/follows/:userId` | auth | source only | — | B-D6 |
| 88 | POST | `/api/social/follows/:userId` | auth | runtime-referenced (local) | social-community | B-D6 |
| 89 | PUT | `/api/social/privacy` | auth | runtime-referenced (local) | social-community | B-D6 |
| 90 | POST | `/api/v1/coach/messages` | auth | runtime-referenced (local) | inc02-coach-idempotency, inc03-idempotency-hardening, llm-coach, session-and-fallback | B-D6 |
| 91 | POST | `/api/v1/progression/next-session` | auth | runtime-referenced (local) | progression-next-session, wearables-readiness | B-D6 |
| 92 | PUT | `/api/wearables/connections/:provider` | auth | runtime-referenced (local) | wearables-readiness | B-D6 |
| 93 | GET | `/api/wearables/readiness` | auth | runtime-referenced (local) | wearables-readiness | B-D6 |
| 94 | POST | `/api/wearables/recovery-samples` | auth | runtime-referenced (local) | wearables-readiness | B-D6 |
| 95 | GET | `/api/wearables/status` | auth | runtime-referenced (local) | wearables-readiness | B-D6 |
| 96 | GET | `/api/workouts` | auth | runtime-referenced (local) | ai06-sessions (helper default path), session-and-fallback | B-D6 |
| 97 | POST | `/api/workouts` | auth | runtime-referenced (local) | session-and-fallback | B-D6 |
| 98 | DELETE | `/api/workouts/:id` | auth | runtime-referenced (local) | ai06-sessions | B-D6 |
| 99 | GET | `/api/workouts/:id` | auth | runtime-referenced (local) | ai06-sessions, session-and-fallback | B-D6 |
| 100 | PUT | `/api/workouts/:id` | auth | runtime-referenced (local) | ai06-sessions | B-D6 |
| 101 | POST | `/api/workouts/generate` | auth | runtime-referenced (local) | inc03-idempotency-hardening | B-D6 |
| 102 | GET | `/health` | public | source only | — | B-D6 |
| 103 | GET | `/health/live` | public | runtime-referenced (local) | health | B-D6 |
| 104 | GET | `/health/ready` | public | source only | — | B-D6 |
| 105 | GET | `/health/simple` | public | source only | — | B-D6 |
