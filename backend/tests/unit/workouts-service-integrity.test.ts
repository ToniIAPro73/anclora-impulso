const prismaMock = {
  workout: { findFirst: jest.fn(), update: jest.fn(), create: jest.fn() },
  workoutExercise: { deleteMany: jest.fn() },
  exercise: { findMany: jest.fn() },
  $transaction: jest.fn(),
};
const generateJSON = jest.fn();

jest.mock('../../src/config/database', () => ({ prisma: prismaMock }));
jest.mock('../../src/config/env', () => ({ env: { groqApiKey: 'test-key-not-real' } }));
jest.mock('../../src/config/logger', () => ({ __esModule: true, default: { warn: jest.fn(), info: jest.fn(), error: jest.fn() } }));
jest.mock('../../src/services/llm', () => ({ generateJSON, SYSTEM_PROMPT_ES: 'system' }));
jest.mock('../../src/services/personalization.service', () => ({
  getPersonalizationSnapshot: jest.fn().mockResolvedValue({
    profile: { age: 30, sex: null, preferredTrainingEnvironment: 'home', experienceLevel: 'beginner', limitations: [], trainingGoal: null },
    preferredMuscleGroups: [],
    workoutAdjustment: 'maintain',
    averageSessionDuration: null,
    adherenceRate: null,
    workoutsLast7Days: 0,
    workoutsLast28Days: 0,
    weeklyTarget: null,
    stagnationRisk: 'low',
  }),
}));

import { generateWorkout, updateWorkout } from '../../src/services/workouts.service';

const exercises = [
  { id: 'a', name: 'A', muscleGroup: 'chest', equipment: 'dumbbell', difficulty: 'beginner', trainingEnvironments: ['home'] },
  { id: 'b', name: 'B', muscleGroup: 'legs', equipment: 'bodyweight', difficulty: 'beginner', trainingEnvironments: ['home'] },
];
const params = { workoutType: 'strength', duration: 40, difficulty: 'beginner', trainingEnvironment: 'home' } as const;

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.exercise.findMany.mockResolvedValue(exercises);
  prismaMock.workout.create.mockImplementation(async ({ data }: any) => ({
    id: 'w1', name: data.name, generationMode: data.generationMode, generationVersion: data.generationVersion, generationReason: data.generationReason, exercises: data.exercises.create.map((e: any) => ({ ...e, exercise: exercises[0], })),
  }));
});

describe('generateWorkout (AI-04 / AI-05)', () => {
  it('persists a valid AI plan and reports mode ai', async () => {
    generateJSON.mockResolvedValue({ name: 'AI', exercises: [{ exerciseId: 'a', sets: 3, reps: 10, rest: 60, order: 0 }] });
    const result: any = await generateWorkout('u1', params as any);
    expect(result.generation.mode).toBe('ai');
    expect(prismaMock.workout.create).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['foreign exercise id', { name: 'x', exercises: [{ exerciseId: 'zzz', sets: 3, reps: 10, rest: 60, order: 0 }] }],
    ['empty plan', { name: 'x', exercises: [] }],
    ['excessive volume', { name: 'x', exercises: [{ exerciseId: 'a', sets: 40, reps: 10, rest: 60, order: 0 }] }],
    ['broken shape', 'not-an-object'],
  ])('never persists invalid AI output (%s) and falls back deterministically', async (_label, bad) => {
    generateJSON.mockResolvedValue(bad);
    const result: any = await generateWorkout('u1', params as any);
    expect(result.generation.mode).toBe('fallback');
    expect(result.generation.reason).toBe('ai_output_rejected');
    const persisted = prismaMock.workout.create.mock.calls[0][0].data.exercises.create;
    expect(persisted.every((e: any) => ['a', 'b'].includes(e.exerciseId))).toBe(true);
  });

  it('falls back on provider timeout/error with no partial write', async () => {
    generateJSON.mockRejectedValue(new Error('timeout'));
    const result: any = await generateWorkout('u1', params as any);
    expect(result.generation.reason).toBe('ai_error');
    expect(prismaMock.workout.create).toHaveBeenCalledTimes(1);
  });

  it('returns identical fallback plans for identical input', async () => {
    generateJSON.mockRejectedValue(new Error('down'));
    await generateWorkout('u1', params as any);
    await generateWorkout('u1', params as any);
    const [first, second] = prismaMock.workout.create.mock.calls.map((c: any) => c[0].data);
    expect(second).toEqual(first);
  });
});

describe('updateWorkout atomicity (AI-08)', () => {
  it('runs delete and update through the same transaction client', async () => {
    prismaMock.workout.findFirst.mockResolvedValue({ id: 'w1' });
    const tx = {
      workoutExercise: { deleteMany: jest.fn().mockResolvedValue({}) },
      workout: { update: jest.fn().mockResolvedValue({ id: 'w1', name: 'n', exercises: [] }) },
    };
    prismaMock.$transaction.mockImplementation(async (fn: any) => fn(tx));
    await updateWorkout('w1', 'u1', { name: 'n', exercises: [{ exerciseId: 'a', sets: 3, reps: 10, rest: 60, order: 0 }] });
    expect(tx.workoutExercise.deleteMany).toHaveBeenCalledTimes(1);
    expect(tx.workout.update).toHaveBeenCalledTimes(1);
    expect(prismaMock.workoutExercise.deleteMany).not.toHaveBeenCalled();
    expect(prismaMock.workout.update).not.toHaveBeenCalled();
  });

  it('propagates a failure raised inside the transaction (rollback is the DB’s job)', async () => {
    prismaMock.workout.findFirst.mockResolvedValue({ id: 'w1' });
    prismaMock.$transaction.mockRejectedValue(new Error('update failed'));
    await expect(updateWorkout('w1', 'u1', { exercises: [] })).rejects.toThrow('update failed');
  });
});
