/**
 * Ceilings applied to every generated workout plan before it is persisted.
 *
 * REVIEW STATUS: PENDING_PROFESSIONAL_REVIEW (AI-03).
 * These values are NOT professionally reviewed exercise limits. They reuse the
 * envelope already emitted by the pre-existing deterministic generator in
 * `workouts.service.ts` (sets 3-5, reps 10-15, rest 60-75 s, 5-6 exercises), so
 * the validator never accepts a plan that is more demanding than what the app
 * already generated without AI. Replace them with the reviewed values from the
 * AI-03 deliverable; do not widen them on engineering judgement alone.
 */
export interface WorkoutPlanLimits {
  readonly reviewStatus: 'PENDING_PROFESSIONAL_REVIEW' | 'REVIEWED';
  readonly minExercises: number;
  readonly maxExercises: number;
  readonly maxExercisesAge40Plus: number;
  readonly minSets: number;
  readonly maxSets: number;
  readonly minReps: number;
  readonly maxReps: number;
  readonly minRestSeconds: number;
  readonly maxRestSeconds: number;
}

export const DEFAULT_PLAN_LIMITS: WorkoutPlanLimits = Object.freeze({
  reviewStatus: 'PENDING_PROFESSIONAL_REVIEW',
  minExercises: 1,
  maxExercises: 6,
  maxExercisesAge40Plus: 5,
  minSets: 1,
  maxSets: 5,
  minReps: 1,
  maxReps: 15,
  minRestSeconds: 0,
  maxRestSeconds: 75,
});

export const PLAN_VALIDATOR_VERSION = 'plan-validator-v1';
export const FALLBACK_VERSION = 'deterministic-fallback-v1';
