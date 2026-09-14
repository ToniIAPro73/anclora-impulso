# P0 Final Gate — Baseline, Contracts & Infrastructure

## Gate result

| Check | Result | Evidence |
|---|---|---|
| Repository integrity | PASS | `development`, HEAD `654ae5177a33a075217510b7c4f9d92f22a7ec00`, clean before P1 |
| Remote sync | PASS | `origin/development` matched HEAD at gate start |
| Architecture reconfirmed | PASS | Next.js 14 frontend, Express/Prisma backend, PostgreSQL, JWT |
| Frontend harness | PASS | `lint`, `typecheck`, 78 Jest tests |
| Backend harness | PASS | `typecheck`, 39 Jest/Supertest tests |
| API contract baseline | PASS | Express routes, Zod validators, Prisma schema reviewed |
| Deployment model | PASS | Vercel project `pmi140979-6354s-projects/anclora-impulso`; Render API URL is documented in environment examples |
| Health-content contract | PASS | Source, evidence level, claim type, owner and review date required by approved SPEC |
| Safety boundary | PASS | Educational/behavioral guidance only; fail-closed review categories; no diagnosis/treatment/clearance |
| Privacy/data minimization | PASS | No sensitive health fields introduced in P0; P1 is opt-in and additive |
| Fixtures/rollback/observability contract | PASS | Defined in approved SPEC and P1 roadmap; implementation gate remains P1 |
| P1 implementation started | PASS | NO product code changed at P0 close |

## Baseline

- `BASELINE_HEAD`: `654ae5177a33a075217510b7c4f9d92f22a7ec00`
- `ORIGIN_DEVELOPMENT_HEAD`: `654ae5177a33a075217510b7c4f9d92f22a7ec00`
- `WORKTREE_INITIAL`: clean
- `REMOTE_SYNC`: synchronized
- `BRANCH`: `development`
- `REMOTE`: `git@github.com:ToniIAPro73/anclora-impulso.git`

## Runtime inventory

Frontend environment keys: `NEXT_PUBLIC_API_URL`, OAuth/provider flags and public Supabase keys where configured. Backend environment keys include `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS`, OAuth settings, SMTP settings, LLM settings, health-data import flags and provider keys. Values are intentionally not recorded.

The deployed frontend is reachable at the canonical public URL and the Vercel project is authenticated through the local Vercel CLI. The historically supplied Render URL currently answers with the application’s JSON 404 for `/api/health/*`; this is recorded as an infrastructure endpoint-mapping uncertainty, not as evidence of a product-code defect. P1 deployment validation must re-identify the live backend base URL before applying migrations or smoke tests.

## Health-source provenance

The two supplied PDF inputs were read as design/content sources only:

| Source | SHA-256 | Authority treatment |
|---|---|---|
| `Guia_salud_53_anos_2026-09-04.pdf` | `82fe9fd93aeaaa5f5c4de9a33f55ac1091ad1969975ef2afd7ec95ef3efac57d` | Design input; claims require independent validation |
| `Plan_salud_y_longevidad_50_plus.pdf` | `64b409412829b357201fed73b7c2682b8d79e1c73f24eb453918514bfbce0846` | Design input; not clinical authority |

No claim is approved for product publication solely because it appears in either PDF. P1 must attach provenance and safety metadata to every health-content item.

## P0 gate decision

`P0-FINAL-GATE = PASS`

P1 may start. The Render/API endpoint mapping remains an explicit deployment verification dependency. No product behavior was modified by this gate.
