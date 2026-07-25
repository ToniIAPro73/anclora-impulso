# Exercise Display Localization Spec v1

## Goal

Exercise titles and visible exercise copy must match the selected UI language in the exercise library, workout detail, and active workout screens.

## Scope

- `/exercises`
- `/workouts/[id]`
- `/workouts/[id]/start`

## Acceptance Criteria

- When UI language is Spanish, known exercise names render in Spanish on all scoped screens.
- When UI language is English, exercise names render in English on all scoped screens.
- Exercise descriptions and instructions use localized copy when available.
- Canonical exercise values from the API are not mutated.
- Existing domain labels for category, muscle group, equipment, difficulty, and environment remain localized.

## Non-goals

- No Prisma schema migration.
- No backend API contract change.
- No machine translation service dependency.
