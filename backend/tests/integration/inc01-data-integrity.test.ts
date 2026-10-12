/**
 * INC-01 (AI-04, AI-05, AI-08) against a real PostgreSQL via Prisma.
 * Runs only through scripts/test-db.sh (isolated local database, synthetic data).
 */
import { randomUUID } from 'crypto';
import { prisma } from '../../src/config/database';
import { env } from '../../src/config/env';
import { generateWorkout, updateWorkout } from '../../src/services/workouts.service';
import { sendCoachMessage, resetCoachRuntimeState } from '../../src/services/coach/coach.service';
import { resetDeterministicCoachProviderCalls } from '../../src/services/coach/providers/deterministic.provider';
import { validateWorkoutPlan } from '../../src/services/workouts/plan-validator';

const generateJSON = jest.fn();
jest.mock('../../src/services/llm', () => ({
  generateJSON: (...args: unknown[]) => generateJSON(...args),
  SYSTEM_PROMPT_ES: 'system',
}));

const tag = `inc01-${randomUUID().slice(0, 8)}`;
const MUSCLE = `${tag}-muscle`;
const EQUIPMENT = `${tag}-equipment`;
const createdUserIds: string[] = [];
let exerciseIds: string[] = [];

async function createUser(label: string) {
  const user = await prisma.user.create({
    data: { email: `${tag}-${label}@example.test`, fullName: `INC01 ${label}`, passwordHash: null },
  });
  createdUserIds.push(user.id);
  return user;
}

const params = {
  workoutType: 'strength',
  duration: 40,
  difficulty: 'beginner',
  trainingEnvironment: 'home',
  targetMuscles: [MUSCLE],
  equipment: [EQUIPMENT],
} as const;

beforeAll(async () => {
  const rows = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      prisma.exercise.create({
        data: {
          name: `${tag}-exercise-${index}`,
          category: 'strength',
          muscleGroup: MUSCLE,
          equipment: EQUIPMENT,
          trainingEnvironments: ['home'],
          difficulty: 'beginner',
          description: 'synthetic',
          instructions: ['synthetic'],
        },
      }),
    ),
  );
  exerciseIds = rows.map((row) => row.id);
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
  await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
  await prisma.$disconnect();
});

const original = { groq: env.groqApiKey };
afterEach(() => {
  env.groqApiKey = original.groq;
});

describe('AI-04 invalid AI output leaves no partial writes (real DB)', () => {
  const foreign = randomUUID();
  const cases: Array<[string, unknown]> = [
    ['foreign exercise id', { name: 'x', exercises: [{ exerciseId: foreign, sets: 3, reps: 10, rest: 60, order: 0 }] }],
    ['empty plan', { name: 'x', exercises: [] }],
    ['excessive volume', { name: 'x', exercises: [{ exerciseId: 'PLACEHOLDER', sets: 60, reps: 10, rest: 60, order: 0 }] }],
    ['broken shape', 'not json {'],
    ['duplicate exercise', { name: 'x', exercises: ['PLACEHOLDER', 'PLACEHOLDER'].map((id, order) => ({ exerciseId: id, sets: 3, reps: 10, rest: 60, order })) }],
  ];

  it.each(cases)('%s → only the deterministic fallback is persisted', async (_label, bad) => {
    const user = await createUser(`ai-${_label.replace(/\W+/g, '-')}`);
    env.groqApiKey = 'local-test-placeholder';
    const withIds = JSON.parse(JSON.stringify(bad).replace(/PLACEHOLDER/g, exerciseIds[0]));
    generateJSON.mockResolvedValueOnce(withIds);

    const result: any = await generateWorkout(user.id, params as any);

    expect(result.generation.mode).toBe('fallback');
    const workouts = await prisma.workout.findMany({ where: { userId: user.id }, include: { exercises: true } });
    expect(workouts).toHaveLength(1);
    expect(workouts[0].exercises.length).toBeGreaterThan(0);
    expect(workouts[0].exercises.every((entry) => exerciseIds.includes(entry.exerciseId))).toBe(true);
    expect(workouts[0].name).not.toBe('x');
  });

  it('provider timeout → fallback only, no extra rows', async () => {
    const user = await createUser('ai-timeout');
    env.groqApiKey = 'local-test-placeholder';
    generateJSON.mockRejectedValueOnce(new Error('timeout'));
    const result: any = await generateWorkout(user.id, params as any);
    expect(result.generation).toMatchObject({ mode: 'fallback', reason: 'ai_error', version: 'deterministic-fallback-v1' });
    expect(await prisma.workout.count({ where: { userId: user.id } })).toBe(1);
  });

  it('valid AI plan is persisted exactly as validated (mode ai)', async () => {
    const user = await createUser('ai-valid');
    env.groqApiKey = 'local-test-placeholder';
    generateJSON.mockResolvedValueOnce({
      name: 'AI plan',
      exercises: [
        { exerciseId: exerciseIds[1], sets: 3, reps: 10, rest: 60, order: 4 },
        { exerciseId: exerciseIds[2], sets: 3, reps: 10, rest: 60, order: 7 },
      ],
    });
    const result: any = await generateWorkout(user.id, params as any);
    expect(result.generation.mode).toBe('ai');
    const stored = await prisma.workoutExercise.findMany({ where: { workoutId: result.id }, orderBy: { order: 'asc' } });
    expect(stored.map((row) => row.order)).toEqual([0, 1]);
  });

  it('generation mode, version and reason are persisted and returned by every read path', async () => {
    const user = await createUser('provenance');
    env.groqApiKey = 'local-test-placeholder';
    generateJSON.mockResolvedValueOnce({ name: 'p', exercises: [{ exerciseId: exerciseIds[5], sets: 3, reps: 10, rest: 60, order: 0 }] });
    const ai: any = await generateWorkout(user.id, params as any);
    generateJSON.mockResolvedValueOnce('garbage');
    const fb: any = await generateWorkout(user.id, params as any);
    const rows = await prisma.workout.findMany({ where: { userId: user.id } });
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(ai.id)).toMatchObject({ generationMode: 'ai', generationVersion: 'plan-validator-v1', generationReason: null });
    expect(byId.get(fb.id)).toMatchObject({ generationMode: 'fallback', generationVersion: 'deterministic-fallback-v1', generationReason: 'ai_output_rejected' });
    expect(ai.generation).toEqual({ mode: 'ai', version: 'plan-validator-v1', reason: null });
  });

  it('manual creation records mode manual; rows written without provenance stay unknown', async () => {
    const user = await createUser('manual');
    const { createWorkout, getUserWorkouts } = await import('../../src/services/workouts.service');
    const manual: any = await createWorkout(user.id, { name: 'm', exercises: [{ exerciseId: exerciseIds[0], sets: 3, reps: 10, rest: 60, order: 0 }] });
    expect(manual.generation).toEqual({ mode: 'manual', version: null, reason: null });
    const legacy = await prisma.workout.create({ data: { userId: user.id, name: 'legacy' } });
    const listed: any[] = await getUserWorkouts(user.id);
    expect(listed.find((w) => w.id === legacy.id).generation).toEqual({ mode: 'unknown', version: null, reason: null });
  });
});

describe('AI-05 deterministic fallback (real DB)', () => {
  it('same input and version → identical, compatible plans', async () => {
    const user = await createUser('fallback');
    env.groqApiKey = '';
    const first: any = await generateWorkout(user.id, params as any);
    const second: any = await generateWorkout(user.id, params as any);
    const shape = (workout: any) =>
      workout.exercises
        .map((entry: any) => ({ id: entry.exerciseId, sets: entry.sets, reps: entry.reps, rest: entry.rest, order: entry.order }))
        .sort((a: any, b: any) => a.order - b.order);
    expect(shape(second)).toEqual(shape(first));
    expect(first.generation).toMatchObject({ mode: 'fallback', version: 'deterministic-fallback-v1' });

    const catalog = (await prisma.exercise.findMany({ where: { id: { in: exerciseIds } } })).map((row) => ({
      id: row.id, equipment: row.equipment, difficulty: row.difficulty, trainingEnvironments: row.trainingEnvironments,
    }));
    const verdict = validateWorkoutPlan(
      { name: first.name, exercises: shape(first).map((e: any) => ({ exerciseId: e.id, sets: e.sets, reps: e.reps, rest: e.rest, order: e.order })) },
      { catalog, difficulty: 'beginner', trainingEnvironment: 'home', equipment: [EQUIPMENT] },
    );
    expect(verdict.ok).toBe(true);
  });
});

describe('AI-08 routine update is atomic (real DB)', () => {
  async function seedWorkout(label: string) {
    const user = await createUser(label);
    const workout = await prisma.workout.create({
      data: {
        userId: user.id,
        name: 'before',
        exercises: {
          create: [
            { exerciseId: exerciseIds[0], sets: 3, reps: 10, rest: 60, order: 0 },
            { exerciseId: exerciseIds[1], sets: 3, reps: 10, rest: 60, order: 1 },
          ],
        },
      },
    });
    return { user, workout };
  }

  async function snapshotOf(workoutId: string) {
    const row = await prisma.workout.findUniqueOrThrow({ where: { id: workoutId }, include: { exercises: { orderBy: { order: 'asc' } } } });
    return { name: row.name, exercises: row.exercises.map((e) => [e.exerciseId, e.sets, e.reps, e.rest, e.order]) };
  }

  it('FK failure after the delete rolls back and keeps the previous routine', async () => {
    const { user, workout } = await seedWorkout('rollback-fk');
    const before = await snapshotOf(workout.id);
    await expect(
      updateWorkout(workout.id, user.id, {
        name: 'after',
        exercises: [{ exerciseId: randomUUID(), sets: 3, reps: 10, rest: 60, order: 0 }],
      }),
    ).rejects.toBeTruthy();
    expect(await snapshotOf(workout.id)).toEqual(before);
  });

  it('unique (workoutId, order) violation after the delete also rolls back', async () => {
    const { user, workout } = await seedWorkout('rollback-unique');
    const before = await snapshotOf(workout.id);
    await expect(
      updateWorkout(workout.id, user.id, {
        name: 'after',
        exercises: [
          { exerciseId: exerciseIds[2], sets: 3, reps: 10, rest: 60, order: 0 },
          { exerciseId: exerciseIds[3], sets: 3, reps: 10, rest: 60, order: 0 },
        ],
      }),
    ).rejects.toBeTruthy();
    expect(await snapshotOf(workout.id)).toEqual(before);
  });

  it('a successful update replaces the exercises', async () => {
    const { user, workout } = await seedWorkout('update-ok');
    await updateWorkout(workout.id, user.id, {
      name: 'after',
      exercises: [{ exerciseId: exerciseIds[4], sets: 4, reps: 8, rest: 60, order: 0 }],
    });
    expect(await snapshotOf(workout.id)).toEqual({ name: 'after', exercises: [[exerciseIds[4], 4, 8, 60, 0]] });
  });
});

describe('AI-08 coach quota under concurrency (real DB)', () => {
  const originalCoach = {
    enabled: env.llmCoachEnabled, provider: env.llmProvider, limit: env.llmCoachWindowLimit,
    ttl: env.llmCoachCacheTtlSeconds, windowMinutes: env.llmCoachWindowMinutes,
  };

  beforeEach(() => {
    env.llmCoachEnabled = true;
    env.llmProvider = 'deterministic';
    env.llmCoachWindowLimit = 3;
    env.llmCoachCacheTtlSeconds = 0;
    env.llmCoachWindowMinutes = 1440;
    resetCoachRuntimeState();
    resetDeterministicCoachProviderCalls();
  });

  afterAll(() => {
    env.llmCoachEnabled = originalCoach.enabled;
    env.llmProvider = originalCoach.provider;
    env.llmCoachWindowLimit = originalCoach.limit;
    env.llmCoachCacheTtlSeconds = originalCoach.ttl;
    env.llmCoachWindowMinutes = originalCoach.windowMinutes;
  });

  async function usageRows(userId: string) {
    return prisma.coachUsageWindow.findMany({ where: { userId } });
  }

  it('existing window: concurrent requests never exceed the limit', async () => {
    const user = await createUser('quota-existing');
    const conversation = await prisma.coachConversation.create({ data: { userId: user.id, title: 't' } });
    await sendCoachMessage(user.id, { conversationId: conversation.id, message: 'warm up question about training' }); // creates window, count=1
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) => sendCoachMessage(user.id, { conversationId: conversation.id, message: `concurrent training question ${i}` })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const limited = results.filter((r) => r.status === 'rejected' && (r.reason as any).statusCode === 429).length;
    const other = results.filter((r) => r.status === 'rejected' && (r.reason as any).statusCode !== 429);
    expect(other).toHaveLength(0);
    expect(ok).toBe(2); // limit 3, one already used
    expect(limited).toBe(10);
    const rows = await usageRows(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].requestCount).toBe(3);
  });

  it('first window created concurrently: still cannot exceed the limit', async () => {
    const user = await createUser('quota-first');
    const conversation = await prisma.coachConversation.create({ data: { userId: user.id, title: 't' } });
    expect(await usageRows(user.id)).toHaveLength(0);
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, (_, i) => sendCoachMessage(user.id, { conversationId: conversation.id, message: `first window question ${i}` })),
    );
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const rejectedReasons = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => `${(r.reason as any).statusCode ?? (r.reason as any).code ?? 'err'}`);
    const rows = await usageRows(user.id);
    expect(rows).toHaveLength(1);
    expect(rows[0].requestCount).toBeLessThanOrEqual(3);
    expect(ok).toBeLessThanOrEqual(3);
    // Spurious failures (not 429) would mean concurrent first-window creation breaks requests.
    expect(rejectedReasons.filter((code) => code !== '429')).toEqual([]);
    expect(ok).toBe(3);
  });

  it('CHARACTERIZATION: WITHOUT an Idempotency-Key a retried identical message still consumes quota twice (legacy behaviour; keyed behaviour is covered in inc02)', async () => {
    const user = await createUser('quota-retry');
    const conversation = await prisma.coachConversation.create({ data: { userId: user.id, title: 't' } });
    const message = 'same message retried by the client';
    await sendCoachMessage(user.id, { conversationId: conversation.id, message });
    await sendCoachMessage(user.id, { conversationId: conversation.id, message });
    const rows = await usageRows(user.id);
    expect(rows[0].requestCount).toBe(2); // clients that omit the key keep legacy semantics
  });
});
