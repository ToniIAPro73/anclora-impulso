import { z } from 'zod';
import {
  DEFAULT_PLAN_LIMITS,
  PLAN_VALIDATOR_VERSION,
  type WorkoutPlanLimits,
} from './plan-limits';

/** Minimal catalog row the validator needs; the authorized catalog is built by the caller. */
export interface CatalogExercise {
  id: string;
  equipment: string;
  difficulty: string;
  trainingEnvironments: string[];
}

export interface PlanConstraints {
  /** Authorized candidate exercises for this request. IDs outside this set are rejected. */
  catalog: ReadonlyArray<CatalogExercise>;
  difficulty: string;
  trainingEnvironment: string;
  /** When provided and non-empty, every exercise must use one of these equipment values. */
  equipment?: ReadonlyArray<string>;
  age?: number | null;
  limits?: WorkoutPlanLimits;
}

export type PlanViolationCode =
  | 'NOT_AN_OBJECT'
  | 'SCHEMA_INVALID'
  | 'EMPTY_PLAN'
  | 'TOO_MANY_EXERCISES'
  | 'UNKNOWN_EXERCISE'
  | 'DUPLICATE_EXERCISE'
  | 'DUPLICATE_ORDER'
  | 'EQUIPMENT_MISMATCH'
  | 'ENVIRONMENT_MISMATCH'
  | 'DIFFICULTY_MISMATCH'
  | 'SETS_OUT_OF_RANGE'
  | 'REPS_OUT_OF_RANGE'
  | 'REST_OUT_OF_RANGE';

export interface PlanViolation {
  code: PlanViolationCode;
  message: string;
  index?: number;
}

export interface ValidatedPlan {
  name: string;
  exercises: Array<{
    exerciseId: string;
    sets: number;
    reps: number;
    rest: number;
    order: number;
  }>;
}

export type PlanValidationResult =
  | { ok: true; plan: ValidatedPlan; validatorVersion: string }
  | { ok: false; violations: PlanViolation[]; validatorVersion: string };

const MAX_NAME_LENGTH = 120;

// Strict shape: no coercion, so "3" or 3.5 or NaN are rejected rather than cast.
const candidateSchema = z.object({
  name: z.string().trim().min(1).max(MAX_NAME_LENGTH),
  exercises: z.array(
    z.object({
      exerciseId: z.string().min(1),
      sets: z.number().int(),
      reps: z.number().int(),
      rest: z.number().int(),
      order: z.number().int().min(0),
    }),
  ),
});

function outside(value: number, min: number, max: number) {
  return value < min || value > max;
}

/**
 * Semantic validation of a workout plan produced by an untrusted source (LLM).
 * Pure function: no I/O, no clock, no randomness. Never mutates `raw`.
 * The caller must persist only `result.plan` when `ok` is true.
 */
export function validateWorkoutPlan(raw: unknown, constraints: PlanConstraints): PlanValidationResult {
  const limits = constraints.limits ?? DEFAULT_PLAN_LIMITS;
  const fail = (violations: PlanViolation[]): PlanValidationResult => ({
    ok: false,
    violations,
    validatorVersion: PLAN_VALIDATOR_VERSION,
  });

  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return fail([{ code: 'NOT_AN_OBJECT', message: 'Plan is not an object' }]);
  }

  const parsed = candidateSchema.safeParse(raw);
  if (!parsed.success) {
    return fail(
      parsed.error.issues.slice(0, 5).map((issue) => ({
        code: 'SCHEMA_INVALID' as const,
        message: `${issue.path.join('.') || 'plan'}: ${issue.message}`,
      })),
    );
  }

  const plan = parsed.data;
  const violations: PlanViolation[] = [];

  if (plan.exercises.length < limits.minExercises) {
    return fail([{ code: 'EMPTY_PLAN', message: 'Plan has no exercises' }]);
  }

  const maxExercises =
    typeof constraints.age === 'number' && constraints.age >= 40
      ? limits.maxExercisesAge40Plus
      : limits.maxExercises;
  if (plan.exercises.length > maxExercises) {
    violations.push({
      code: 'TOO_MANY_EXERCISES',
      message: `Plan has ${plan.exercises.length} exercises; maximum is ${maxExercises}`,
    });
  }

  const catalogById = new Map(constraints.catalog.map((exercise) => [exercise.id, exercise]));
  const seenExercises = new Set<string>();
  const seenOrders = new Set<number>();
  const equipmentFilter =
    constraints.equipment && constraints.equipment.length > 0 ? new Set(constraints.equipment) : null;

  plan.exercises.forEach((entry, index) => {
    const catalogEntry = catalogById.get(entry.exerciseId);

    if (!catalogEntry) {
      violations.push({ code: 'UNKNOWN_EXERCISE', message: 'Exercise is not in the authorized catalog', index });
    } else {
      if (equipmentFilter && !equipmentFilter.has(catalogEntry.equipment)) {
        violations.push({ code: 'EQUIPMENT_MISMATCH', message: 'Exercise equipment not allowed', index });
      }
      if (!catalogEntry.trainingEnvironments.includes(constraints.trainingEnvironment)) {
        violations.push({ code: 'ENVIRONMENT_MISMATCH', message: 'Exercise not valid for environment', index });
      }
      if (catalogEntry.difficulty !== constraints.difficulty) {
        violations.push({ code: 'DIFFICULTY_MISMATCH', message: 'Exercise difficulty differs from request', index });
      }
    }

    if (seenExercises.has(entry.exerciseId)) {
      violations.push({ code: 'DUPLICATE_EXERCISE', message: 'Exercise appears more than once', index });
    }
    seenExercises.add(entry.exerciseId);

    if (seenOrders.has(entry.order)) {
      violations.push({ code: 'DUPLICATE_ORDER', message: 'Order value repeated', index });
    }
    seenOrders.add(entry.order);

    if (outside(entry.sets, limits.minSets, limits.maxSets)) {
      violations.push({ code: 'SETS_OUT_OF_RANGE', message: `sets must be ${limits.minSets}-${limits.maxSets}`, index });
    }
    if (outside(entry.reps, limits.minReps, limits.maxReps)) {
      violations.push({ code: 'REPS_OUT_OF_RANGE', message: `reps must be ${limits.minReps}-${limits.maxReps}`, index });
    }
    if (outside(entry.rest, limits.minRestSeconds, limits.maxRestSeconds)) {
      violations.push({
        code: 'REST_OUT_OF_RANGE',
        message: `rest must be ${limits.minRestSeconds}-${limits.maxRestSeconds}s`,
        index,
      });
    }
  });

  if (violations.length > 0) {
    return fail(violations);
  }

  return {
    ok: true,
    validatorVersion: PLAN_VALIDATOR_VERSION,
    plan: {
      name: plan.name,
      // Re-number orders 0..n-1 in the order given so persistence never sees gaps.
      exercises: [...plan.exercises]
        .sort((a, b) => a.order - b.order)
        .map((entry, order) => ({
          exerciseId: entry.exerciseId,
          sets: entry.sets,
          reps: entry.reps,
          rest: entry.rest,
          order,
        })),
    },
  };
}
