import { buildDeterministicFallbackPlan } from '../../src/services/workouts/deterministic-fallback';
import { validateWorkoutPlan } from '../../src/services/workouts/plan-validator';

const candidates = [
  ...Array.from({ length: 4 }, (_, i) => ({ id: `chest-${i}`, muscleGroup: 'chest' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `legs-${i}`, muscleGroup: 'legs' })),
  ...Array.from({ length: 4 }, (_, i) => ({ id: `back-${i}`, muscleGroup: 'back' })),
];

const base = {
  userId: 'user-1',
  candidates,
  workoutType: 'strength',
  difficulty: 'intermediate',
  reduceLoad: false,
};

describe('buildDeterministicFallbackPlan', () => {
  it('returns the same plan for the same input regardless of candidate order', () => {
    const a = buildDeterministicFallbackPlan(base);
    const b = buildDeterministicFallbackPlan({ ...base, candidates: [...candidates].reverse() });
    expect(b).toEqual(a);
    expect(buildDeterministicFallbackPlan(base)).toEqual(a);
  });

  it('does not use Math.random', () => {
    const spy = jest.spyOn(Math, 'random');
    buildDeterministicFallbackPlan(base);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  it('spreads the selection across muscle groups', () => {
    const plan = buildDeterministicFallbackPlan(base);
    const groups = new Set(plan.exercises.map((entry) => entry.exerciseId.split('-')[0]));
    expect(groups.size).toBe(3);
    expect(plan.exercises).toHaveLength(6);
  });

  it('caps at 5 exercises for age 40+ and uses the longer rest', () => {
    const plan = buildDeterministicFallbackPlan({ ...base, age: 52 });
    expect(plan.exercises).toHaveLength(5);
    expect(plan.exercises.every((entry) => entry.rest === 75)).toBe(true);
  });

  it('handles fewer candidates than the ceiling and an empty pool', () => {
    expect(buildDeterministicFallbackPlan({ ...base, candidates: candidates.slice(0, 2) }).exercises).toHaveLength(2);
    expect(buildDeterministicFallbackPlan({ ...base, candidates: [] }).exercises).toHaveLength(0);
  });

  it('produces a plan that passes the semantic validator for every difficulty', () => {
    for (const difficulty of ['beginner', 'intermediate', 'advanced']) {
      const plan = buildDeterministicFallbackPlan({ ...base, difficulty });
      const catalog = candidates.map((c) => ({
        id: c.id, equipment: 'any', difficulty, trainingEnvironments: ['home'],
      }));
      const result = validateWorkoutPlan(plan, { catalog, difficulty, trainingEnvironment: 'home' });
      expect(result.ok).toBe(true);
    }
  });
});
