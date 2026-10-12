/**
 * B2-F1: per-user rolling quota of workout generations, counted from the idempotency ledger under the same
 * advisory lock as the admission. Isolated PostgreSQL, synthetic data, no provider (fallback path).
 */
import { randomUUID } from 'crypto';
import { prisma } from '../../src/config/database';
import { env } from '../../src/config/env';
import { generateWorkoutIdempotent, WORKOUT_GENERATE_OPERATION } from '../../src/services/workouts.service';
import { resetCoachRuntimeState } from '../../src/services/coach/coach.service';
import { AppError } from '../../src/middleware/errorHandler';

const tag = `b2f1-${randomUUID().slice(0, 8)}`;
const MUSCLE = `${tag}-m`;
const EQUIPMENT = `${tag}-e`;
const OPERATION = WORKOUT_GENERATE_OPERATION;
const userIds: string[] = [];
const exerciseIds: string[] = [];
const original = { ...env };
const key = () => `k-${randomUUID()}`;
const params = { workoutType: 'strength', duration: 40, difficulty: 'beginner', trainingEnvironment: 'home', targetMuscles: [MUSCLE], equipment: [EQUIPMENT] } as const;

async function makeUser(label: string) {
  const user = await prisma.user.create({ data: { email: `${tag}-${label}@example.test`, fullName: label } });
  userIds.push(user.id);
  return user;
}

const generate = (userId: string, k: string = key()) => generateWorkoutIdempotent(userId, params as any, k);

async function outcome(promise: Promise<unknown>) {
  try {
    await promise;
    return { ok: true as const };
  } catch (error) {
    const e = error as AppError;
    return { ok: false as const, status: e.statusCode, reason: (e.details as any)?.reason, details: e.details as any };
  }
}

beforeAll(async () => {
  const rows = await Promise.all(Array.from({ length: 6 }, (_, i) =>
    prisma.exercise.create({ data: { name: `${tag}-x${i}`, category: 'c', muscleGroup: MUSCLE, equipment: EQUIPMENT, trainingEnvironments: ['home'], difficulty: 'beginner', description: 'd', instructions: ['i'] } })));
  exerciseIds.push(...rows.map((r) => r.id));
});

beforeEach(() => {
  Object.assign(env, original);
  env.groqApiKey = ''; // fallback path: no provider is involved
  env.idempotencyKeyEnforcement = 'warn';
  env.idempotencyLegacySunsetAt = '';
  env.idempotencyMaxAttempts = 3;
  env.llmCoachMaxConcurrent = 50; // isolate the quota from the in-flight cap
  env.workoutGenerateWindowMinutes = 60;
  env.workoutGenerateWindowLimit = 3;
  resetCoachRuntimeState();
});
afterAll(async () => {
  Object.assign(env, original);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
  await prisma.$disconnect();
});

describe('workout generation quota (per user, rolling window, exact)', () => {
  it('accepts exactly the limit and refuses the next one with quota_exhausted and a reset instant', async () => {
    const user = await makeUser('seq');
    for (let i = 0; i < 3; i += 1) await expect(generate(user.id)).resolves.toBeTruthy();

    const refused = await outcome(generate(user.id));
    expect(refused).toMatchObject({ ok: false, status: 429, reason: 'quota_exhausted' });
    expect(Date.parse(refused.ok ? '' : refused.details.windowResetsAt)).toBeGreaterThan(Date.now());
    expect((refused.ok ? 0 : refused.details.retryAfterSeconds)).toBeGreaterThanOrEqual(1);
    // refusal created no record and no routine
    expect(await prisma.idempotencyRecord.count({ where: { userId: user.id, operation: OPERATION } })).toBe(3);
    expect(await prisma.workout.count({ where: { userId: user.id } })).toBe(3);
  });

  it('never exceeds the limit under concurrency: exactly N executions and the rest refused', async () => {
    const user = await makeUser('conc');
    const results = await Promise.all(Array.from({ length: 12 }, () => outcome(generate(user.id))));
    const accepted = results.filter((r) => r.ok).length;
    const refused = results.filter((r) => !r.ok);
    expect(accepted).toBe(3);
    expect(refused).toHaveLength(9);
    expect(refused.every((r) => !r.ok && r.status === 429 && r.reason === 'quota_exhausted')).toBe(true);
    expect(await prisma.workout.count({ where: { userId: user.id } })).toBe(3);
  });

  it('does not consume a unit on replay, and still replays when the quota is exhausted', async () => {
    const user = await makeUser('replay');
    const k = key();
    const first = await generate(user.id, k);
    expect(first.replayed).toBe(false);
    for (let i = 0; i < 4; i += 1) expect((await generate(user.id, k)).replayed).toBe(true);
    expect(await prisma.idempotencyRecord.count({ where: { userId: user.id, operation: OPERATION } })).toBe(1);

    await generate(user.id); await generate(user.id); // limit reached (3)
    expect(await outcome(generate(user.id))).toMatchObject({ ok: false, reason: 'quota_exhausted' });
    expect((await generate(user.id, k)).replayed).toBe(true); // the completed key still answers
  });

  it('is scoped per user', async () => {
    const a = await makeUser('a');
    const b = await makeUser('b');
    for (let i = 0; i < 3; i += 1) await generate(a.id);
    expect(await outcome(generate(a.id))).toMatchObject({ ok: false, reason: 'quota_exhausted' });
    await expect(generate(b.id)).resolves.toBeTruthy();
  });

  it('frees units when the records leave the window', async () => {
    const user = await makeUser('window');
    for (let i = 0; i < 3; i += 1) await generate(user.id);
    expect(await outcome(generate(user.id))).toMatchObject({ ok: false, reason: 'quota_exhausted' });

    const old = new Date(Date.now() - 61 * 60 * 1000);
    await prisma.idempotencyRecord.updateMany({ where: { userId: user.id, operation: OPERATION }, data: { createdAt: old } });
    await expect(generate(user.id)).resolves.toBeTruthy();
  });

  it('does not count failed records, and a retry of a failed key counts once', async () => {
    const user = await makeUser('failed');
    for (let i = 0; i < 3; i += 1) {
      await prisma.idempotencyRecord.create({
        data: {
          userId: user.id, operation: OPERATION, key: key(), requestHash: `h${i}`, status: 'failed', ownerToken: randomUUID(),
          lockedUntil: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 3600_000), errorCode: 'error',
        },
      });
    }
    // three failed rows consumed nothing
    for (let i = 0; i < 3; i += 1) await expect(generate(user.id)).resolves.toBeTruthy();
    expect(await outcome(generate(user.id))).toMatchObject({ ok: false, reason: 'quota_exhausted' });
  });

  it('reports the exact reset: the oldest counted record plus the window', async () => {
    const user = await makeUser('reset');
    for (let i = 0; i < 3; i += 1) await generate(user.id);
    const oldest = new Date(Date.now() - 20 * 60 * 1000);
    const first = await prisma.idempotencyRecord.findFirstOrThrow({ where: { userId: user.id, operation: OPERATION }, orderBy: { createdAt: 'asc' } });
    await prisma.idempotencyRecord.update({ where: { id: first.id }, data: { createdAt: oldest } });

    const refused = await outcome(generate(user.id));
    expect(refused.ok).toBe(false);
    const resetsAt = Date.parse((refused as any).details.windowResetsAt);
    expect(Math.abs(resetsAt - (oldest.getTime() + 60 * 60 * 1000))).toBeLessThan(1000);
  });

  it('is disabled with a limit of 0', async () => {
    env.workoutGenerateWindowLimit = 0;
    const user = await makeUser('off');
    for (let i = 0; i < 5; i += 1) await expect(generate(user.id)).resolves.toBeTruthy();
  });

  it('clamps the window to the record retention (records older than the retention no longer exist)', async () => {
    env.idempotencyRetentionHours = 1;
    env.workoutGenerateWindowMinutes = 600; // 10 h requested, 1 h retention
    const user = await makeUser('clamp');
    for (let i = 0; i < 3; i += 1) await generate(user.id);
    const refused = await outcome(generate(user.id));
    const resetsInMs = Date.parse((refused as any).details.windowResetsAt) - Date.now();
    expect(resetsInMs).toBeLessThanOrEqual(60 * 60 * 1000 + 1000);
  });
});
