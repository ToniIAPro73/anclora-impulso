# Certification Fixture Display Name Spec v1

## Objective

Hide the internal certification fixture identifier from user-facing workout
names while preserving the persisted workout ID, data, relationships, sets,
exercises, and generation logic.

## Scope

- Map the exact certification fixture name at the frontend presentation layer.
- Use a friendly Spanish label and its English equivalent according to the
  active locale.
- Apply the mapping wherever a workout name is rendered in the workout flow.

## Out of scope

- Database writes or fixture mutation.
- Workout IDs, API contracts, workout data, sets, exercises, or business logic.
- Renaming any workout other than the exact certification fixture.

## Acceptance criteria

- GIVEN the exact certification fixture name WHEN rendered in Spanish THEN the
  UI shows `Entrenamiento de Fuerza de Cuerpo Completo`.
- GIVEN the exact certification fixture name WHEN rendered in English THEN the
  UI shows `Full-Body Strength Workout`.
- GIVEN any other workout name WHEN rendered in either locale THEN the original
  name is preserved.
- GIVEN any workout route WHEN opened THEN its internal ID and workout data are
  unchanged.

## Verification

Run lint, typecheck, frontend tests, and production build. Add unit coverage
for the exact-match and locale behavior.
