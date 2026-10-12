import { createHash } from 'crypto';
import { DEFAULT_PLAN_LIMITS, FALLBACK_VERSION, type WorkoutPlanLimits } from './plan-limits';
import type { ValidatedPlan } from './plan-validator';

export interface FallbackCandidate {
  id: string;
  muscleGroup: string;
}

export interface FallbackInput {
  userId: string;
  candidates: ReadonlyArray<FallbackCandidate>;
  workoutType: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | string;
  age?: number | null;
  reduceLoad: boolean;
  limits?: WorkoutPlanLimits;
}

function stableRank(seed: string, id: string) {
  return createHash('sha256').update(`${seed}:${id}`).digest('hex');
}

/**
 * Deterministic replacement for the former `Math.random` fallback.
 * Same input + FALLBACK_VERSION => identical plan. No clock, no randomness.
 *
 * Selection spreads across muscle groups (round-robin over groups in stable
 * order) so the plan is not N exercises of one group. Prescription reuses the
 * pre-existing difficulty table; it is NOT a professionally reviewed template
 * (AI-03 pending) and is clamped to the active limits.
 */
export function buildDeterministicFallbackPlan(input: FallbackInput): ValidatedPlan {
  const limits = input.limits ?? DEFAULT_PLAN_LIMITS;
  const maxExercises =
    typeof input.age === 'number' && input.age >= 40 ? limits.maxExercisesAge40Plus : limits.maxExercises;

  const seed = [FALLBACK_VERSION, input.userId, input.workoutType, input.difficulty].join('|');

  const byGroup = new Map<string, FallbackCandidate[]>();
  for (const candidate of input.candidates) {
    const bucket = byGroup.get(candidate.muscleGroup) ?? [];
    bucket.push(candidate);
    byGroup.set(candidate.muscleGroup, bucket);
  }
  const groups = [...byGroup.keys()].sort();
  for (const group of groups) {
    byGroup.get(group)!.sort((a, b) => stableRank(seed, a.id).localeCompare(stableRank(seed, b.id)));
  }

  const selected: FallbackCandidate[] = [];
  let progressed = true;
  while (selected.length < maxExercises && progressed) {
    progressed = false;
    for (const group of groups) {
      const next = byGroup.get(group)!.shift();
      if (next) {
        selected.push(next);
        progressed = true;
        if (selected.length >= maxExercises) break;
      }
    }
  }

  const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
  const sets = input.difficulty === 'beginner' ? 3 : input.difficulty === 'intermediate' ? 4 : 5;
  const reps = input.difficulty === 'beginner' ? 10 : input.difficulty === 'intermediate' ? 12 : 15;
  const rest = (typeof input.age === 'number' && input.age >= 40) || input.reduceLoad ? 75 : 60;

  return {
    name: `Entrenamiento de ${input.workoutType} - ${input.difficulty}`,
    exercises: selected.map((candidate, order) => ({
      exerciseId: candidate.id,
      sets: clamp(sets, limits.minSets, limits.maxSets),
      reps: clamp(reps, limits.minReps, limits.maxReps),
      rest: clamp(rest, limits.minRestSeconds, limits.maxRestSeconds),
      order,
    })),
  };
}
