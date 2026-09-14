# Health Plan Card Spacing Spec v1

## Objective

Improve only the visual spacing and elevation breathing room of cards in
`/health-plans`, especially the “This week” action cards.

## Scope

- Add a centered responsive content shell to all `HealthPlanHome` states.
- Add consistent horizontal/vertical breathing room around the action grid.
- Prevent local card elevation and shadow clipping.
- Preserve the existing motion language, content, actions, API calls, themes,
  locales and responsive behavior.

## Out of scope

No business logic, copy, data model, routes, API, navigation, or global design
system changes.

## Acceptance criteria

- GIVEN `/health-plans` at 390px, 768px and 1440px WHEN the page renders THEN
  cards have visible horizontal inset and consistent grid gaps.
- GIVEN a weekly action card WHEN hovered or focused through a child action
  THEN its border/shadow is not clipped and the layout does not reflow.
- GIVEN light or dark theme and ES or EN locale WHEN the page renders THEN the
  same spacing and state hierarchy remain intact.
- GIVEN reduced motion WHEN the page renders THEN no new motion is introduced.

## Verification

Run lint, typecheck, frontend tests, production build, and browser screenshots
at 390×844, 768×1024 and 1440×900 in both themes with both locales.
