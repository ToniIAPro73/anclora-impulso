import { validateWorkoutPlan, type CatalogExercise } from '../../src/services/workouts/plan-validator';

const catalog: CatalogExercise[] = [
  { id: 'ex-1', equipment: 'dumbbell', difficulty: 'beginner', trainingEnvironments: ['home', 'gym'] },
  { id: 'ex-2', equipment: 'bodyweight', difficulty: 'beginner', trainingEnvironments: ['home'] },
  { id: 'ex-3', equipment: 'barbell', difficulty: 'beginner', trainingEnvironments: ['gym'] },
];

const constraints = { catalog, difficulty: 'beginner', trainingEnvironment: 'home' };

const validPlan = () => ({
  name: 'Plan A',
  exercises: [
    { exerciseId: 'ex-1', sets: 3, reps: 10, rest: 60, order: 0 },
    { exerciseId: 'ex-2', sets: 3, reps: 10, rest: 60, order: 1 },
  ],
});

function codes(raw: unknown, extra: Partial<Parameters<typeof validateWorkoutPlan>[1]> = {}) {
  const result = validateWorkoutPlan(raw, { ...constraints, ...extra });
  return result.ok ? [] : result.violations.map((violation) => violation.code);
}

describe('validateWorkoutPlan', () => {
  it('accepts a valid plan and renumbers order', () => {
    const plan = validPlan();
    plan.exercises[0].order = 5;
    plan.exercises[1].order = 9;
    const result = validateWorkoutPlan(plan, constraints);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.plan.exercises.map((entry) => entry.order)).toEqual([0, 1]);
      expect(result.validatorVersion).toBeTruthy();
    }
  });

  it('does not mutate its input', () => {
    const plan = validPlan();
    const snapshot = JSON.stringify(plan);
    validateWorkoutPlan(plan, constraints);
    expect(JSON.stringify(plan)).toBe(snapshot);
  });

  it.each([
    ['null', null],
    ['array', []],
    ['string', 'not json'],
    ['number', 42],
  ])('rejects non-object input: %s', (_label, raw) => {
    expect(codes(raw)).toEqual(['NOT_AN_OBJECT']);
  });

  it('rejects an empty exercise list', () => {
    expect(codes({ name: 'x', exercises: [] })).toEqual(['EMPTY_PLAN']);
  });

  it('rejects a missing exercises field and non-integer numerics without coercion', () => {
    expect(codes({ name: 'x' })).toContain('SCHEMA_INVALID');
    const stringSets = validPlan();
    (stringSets.exercises[0] as any).sets = '3';
    expect(codes(stringSets)).toContain('SCHEMA_INVALID');
    const fractional = validPlan();
    fractional.exercises[0].reps = 10.5;
    expect(codes(fractional)).toContain('SCHEMA_INVALID');
    const nan = validPlan();
    nan.exercises[0].rest = Number.NaN;
    expect(codes(nan)).toContain('SCHEMA_INVALID');
  });

  it('rejects an exercise ID outside the authorized catalog', () => {
    const plan = validPlan();
    plan.exercises[0].exerciseId = 'someone-elses-id';
    expect(codes(plan)).toContain('UNKNOWN_EXERCISE');
  });

  it('rejects duplicate exercises and duplicate order values', () => {
    const plan = validPlan();
    plan.exercises[1].exerciseId = 'ex-1';
    plan.exercises[1].order = 0;
    const found = codes(plan);
    expect(found).toContain('DUPLICATE_EXERCISE');
    expect(found).toContain('DUPLICATE_ORDER');
  });

  it('rejects incompatible equipment, environment and difficulty', () => {
    expect(codes(validPlan(), { equipment: ['barbell'] })).toContain('EQUIPMENT_MISMATCH');
    const gymOnly = { name: 'x', exercises: [{ exerciseId: 'ex-3', sets: 3, reps: 10, rest: 60, order: 0 }] };
    expect(codes(gymOnly)).toContain('ENVIRONMENT_MISMATCH');
    expect(codes(validPlan(), { difficulty: 'advanced' })).toContain('DIFFICULTY_MISMATCH');
  });

  it('rejects excessive volume, reps and rest', () => {
    const heavy = validPlan();
    heavy.exercises[0].sets = 40;
    heavy.exercises[0].reps = 500;
    heavy.exercises[0].rest = 4000;
    const found = codes(heavy);
    expect(found).toEqual(expect.arrayContaining(['SETS_OUT_OF_RANGE', 'REPS_OUT_OF_RANGE', 'REST_OUT_OF_RANGE']));
  });

  it('rejects zero and negative prescriptions', () => {
    const plan = validPlan();
    plan.exercises[0].sets = 0;
    plan.exercises[0].reps = -1;
    plan.exercises[0].rest = -5;
    expect(codes(plan)).toEqual(expect.arrayContaining(['SETS_OUT_OF_RANGE', 'REPS_OUT_OF_RANGE', 'REST_OUT_OF_RANGE']));
  });

  it('enforces the lower exercise ceiling for age 40+', () => {
    const many = (n: number) => ({
      name: 'x',
      exercises: Array.from({ length: n }, (_, i) => ({ exerciseId: `ex-${i}`, sets: 3, reps: 10, rest: 60, order: i })),
    });
    const bigCatalog = Array.from({ length: 8 }, (_, i) => ({
      id: `ex-${i}`, equipment: 'dumbbell', difficulty: 'beginner', trainingEnvironments: ['home'],
    }));
    expect(codes(many(6), { catalog: bigCatalog })).toEqual([]);
    expect(codes(many(6), { catalog: bigCatalog, age: 45 })).toEqual(['TOO_MANY_EXERCISES']);
    expect(codes(many(7), { catalog: bigCatalog })).toEqual(['TOO_MANY_EXERCISES']);
  });
});
