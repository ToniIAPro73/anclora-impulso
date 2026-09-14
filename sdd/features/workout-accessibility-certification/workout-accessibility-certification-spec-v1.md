# Workout Accessibility Certification Spec v1

## Objective

Close the release-blocking accessibility gap observed in the active workout
screen without changing workout behavior or data contracts.

## Scope

- Give the rest timer controls explicit accessible names in Spanish and English.
- Give repeated set actions names that identify the exercise and set.
- Preserve existing workout state, draft persistence, navigation, and visual UI.

## Acceptance criteria

- GIVEN an active workout, WHEN the accessibility tree is inspected, THEN every
  visible icon-only timer control has a non-empty accessible name.
- GIVEN a set row, WHEN its actions are inspected, THEN mark/rest controls
  identify the exercise and set number.
- GIVEN an active workout, WHEN existing frontend tests and typecheck run, THEN
  they pass without changing API behavior.
- GIVEN the production fixture, WHEN the workout is opened, THEN the real
  browser snapshot exposes the names and keyboard focus reaches the controls.

## Out of scope

- Workout layout redesign.
- API, database, authentication, or session changes.
- New workout features.
