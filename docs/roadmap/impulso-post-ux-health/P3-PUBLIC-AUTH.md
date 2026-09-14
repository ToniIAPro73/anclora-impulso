# P3 — Public entry & auth experience

**Status:** NEEDS_VERIFICATION
**Drivers:** UX-08, UX-09, UX-10, UX-11
**Depends on:** P0; route decision must be explicit before implementation.

## Microphase contract

| ID | Objective | Current → target | Scope | Out of scope | Dependencies | Risk | Gate |
|---|---|---|---|---|---|---|---|
| P3-M00 | canonical entry contract | split intent → documented model | `/`, `/landing`, auth, PWA | provider migration | P0 | SEO/auth regression | G6/G13 |
| P3-M01 | root behavior | implicit root → anonymous/auth explicit | redirects and CTA | new marketing copy | M00 | loop | G5 |
| P3-M02 | authenticated redirect | route ambiguity → session-aware redirect | refresh/deep links | session model change | M00–M01 | session loss | G4/G5 |
| P3-M03 | PWA start_url | login-only declaration → intentional start | manifest/install smoke | offline engine | M00–M02 | install regression | G8/G13 |
| P3-M04 | social signup parity | login > signup providers → parity/explanation | Google/GitHub availability | OAuth provider addition | P0 | callback break | G4/G5 |
| P3-M05 | mobile auth layout | dead space → compact form | card/layout | auth semantics | M00 | keyboard overlap | G7/G8 |
| P3-M06 | copper brand coherence | competing accents → restrained token use | landing tokens | design-system rewrite | P0 | contrast | G6/G9 |
| P3-M07 | legal/cookie/a11y | public gaps → compliant surfaces | landmarks, consent, links | legal advice | M00–M06 | missing consent | G4/G7 |
| P3-M08 | ES/EN and final gate | mixed entry → parity | copy/routes tests | new locales | M00–M07 | raw keys | G10/G13/G24 |

## Tasks

| Task | `.01` implementation | `.02` tests/evidence | `.03` documentation |
|---|---|---|---|
| P3-M00-T01 | route model and decision | anonymous/auth route matrix | canonical entry ADR |
| P3-M01-T01 | root redirects/CTA | redirect loop tests | public route map |
| P3-M02-T01 | session-aware entry | refresh/deep-link tests | auth contract |
| P3-M03-T01 | manifest start_url | install/manifest checks | PWA decision |
| P3-M04-T01 | signup provider parity | provider availability/callback tests | OAuth matrix |
| P3-M05-T01 | mobile card layout | 390/430 keyboard tests | viewport evidence |
| P3-M06-T01 | copper token hierarchy | theme/contrast review | brand delta |
| P3-M07-T01 | landmarks/cookie/legal | keyboard/consent tests | legal/a11y checklist |
| P3-M08-T01 | localized public flow | ES/EN route smoke | P3 gate dossier |

## Acceptance

GIVEN an anonymous visitor, WHEN `/` is opened, THEN one documented acquisition/entry intent is presented; AND `/landing` and auth routes remain reachable. GIVEN an authenticated session, WHEN `/` or `/dashboard` is refreshed, THEN the user is not sent to an unintended public loop. GIVEN Google/GitHub, WHEN login and signup are compared, THEN providers are equal or the UI explains why.

**Rollback:** restore prior route/manifest behavior behind flag; preserve auth tokens and callbacks.
**DO_NOT_BREAK:** successful canonical login/session/dashboard/logout, legal routes, provider PKCE/state and copper/navy identity.

## Microtask registry

Concrete IDs for execution and evidence tracking:

| Task | Microtasks |
|---|---|
| P3-M00-T01 | P3-M00-T01.01 contract/implementation · P3-M00-T01.02 tests/evidence · P3-M00-T01.03 docs/gate |
| P3-M01-T01 | P3-M01-T01.01 contract/implementation · P3-M01-T01.02 tests/evidence · P3-M01-T01.03 docs/gate |
| P3-M02-T01 | P3-M02-T01.01 contract/implementation · P3-M02-T01.02 tests/evidence · P3-M02-T01.03 docs/gate |
| P3-M03-T01 | P3-M03-T01.01 contract/implementation · P3-M03-T01.02 tests/evidence · P3-M03-T01.03 docs/gate |
| P3-M04-T01 | P3-M04-T01.01 contract/implementation · P3-M04-T01.02 tests/evidence · P3-M04-T01.03 docs/gate |
| P3-M05-T01 | P3-M05-T01.01 contract/implementation · P3-M05-T01.02 tests/evidence · P3-M05-T01.03 docs/gate |
| P3-M06-T01 | P3-M06-T01.01 contract/implementation · P3-M06-T01.02 tests/evidence · P3-M06-T01.03 docs/gate |
| P3-M07-T01 | P3-M07-T01.01 contract/implementation · P3-M07-T01.02 tests/evidence · P3-M07-T01.03 docs/gate |
| P3-M08-T01 | P3-M08-T01.01 contract/implementation · P3-M08-T01.02 tests/evidence · P3-M08-T01.03 docs/gate |
