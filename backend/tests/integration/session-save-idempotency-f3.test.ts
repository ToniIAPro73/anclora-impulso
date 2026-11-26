/**
 * Session save idempotency F3 — POST /api/sessions must not create duplicate sessions when the client retries.
 * Spec: sdd/features/session-save-idempotency-f3/session-save-idempotency-f3-spec-v1.md (F3-AC01..AC05).
 * Isolated PostgreSQL, synthetic data. Written before the fix (red on purpose).
 */
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/database';

const tag = `f3-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
const exerciseIds: string[] = [];
let token = '';
let userId = '';
let workoutId = '';
let exerciseId = '';

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `${tag}@example.test`, password: `pw-${randomUUID()}`, fullName: 'F3 user' });
  expect(res.status).toBe(201);
  userId = res.body.user.id;
  userIds.push(userId);
  token = res.body.accessToken;

  const exercise = await prisma.exercise.create({
    data: { name: `F3 exercise ${tag}`, category: 'strength', muscleGroup: 'chest', equipment: 'barbell', difficulty: 'beginner', description: 'synthetic', instructions: ['x'] },
  });
  exerciseIds.push(exercise.id);
  exerciseId = exercise.id;
});

beforeEach(async () => {
  const workout = await prisma.workout.create({
    data: { userId, name: `F3 routine ${randomUUID().slice(0, 6)}`, generationMode: 'manual', exercises: { create: [{ exerciseId, sets: 3, reps: 10, rest: 90, order: 0 }] } },
  });
  workoutId = workout.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
  await prisma.$disconnect();
});

const body = (overrides: Record<string, unknown> = {}) => ({
  workoutId,
  duration: 1800,
  recordingVersion: 2,
  exercises: [{ exerciseId, sets: [{ reps: 8, weight: 12.5, order: 0 }] }],
  ...overrides,
});

const post = (payload: Record<string, unknown>, key?: string) => {
  const req = request(app).post('/api/sessions').set('Authorization', `Bearer ${token}`);
  return (key ? req.set('Idempotency-Key', key) : req).send(payload);
};

const sessionsOf = () => prisma.workoutSession.count({ where: { workoutId } });
const xpEventsOf = () => prisma.xPEvent.count({ where: { userId, action: 'complete_workout' } });

describe('POST /api/sessions — idempotent save (F3)', () => {
  it('F3-AC01 a retry with the same key and body replays the first result and creates nothing new', async () => {
    const key = `sess-${randomUUID()}`;
    const xpBefore = await xpEventsOf();

    const first = await post(body(), key);
    const second = await post(body(), key);

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body.id).toBe(first.body.id);
    expect(await sessionsOf()).toBe(1);
    expect(await xpEventsOf()).toBe(xpBefore + 1); // side effects (XP, streak, records, feed) run once
  });

  it('F3-AC02 the same key with a different body is refused and creates nothing', async () => {
    const key = `sess-${randomUUID()}`;
    expect((await post(body(), key)).status).toBe(201);

    const conflict = await post(body({ duration: 1900 }), key);
    expect(conflict.status).toBe(422);
    expect(await sessionsOf()).toBe(1);
  });

  it('F3-AC03 concurrent submissions with the same key create exactly one session', async () => {
    const key = `sess-${randomUUID()}`;
    const results = await Promise.all([post(body(), key), post(body(), key), post(body(), key)]);

    expect(results.filter((r) => r.status === 201)).toHaveLength(1);
    for (const r of results) expect([200, 201, 409]).toContain(r.status);
    expect(await sessionsOf()).toBe(1);
  });

  it('F3-AC04 a legacy client without a key is deduplicated for an immediate double submit', async () => {
    const legacy = { workoutId, duration: 600, exercises: [{ exerciseId, sets: [{ reps: 10, weight: 20, order: 0 }] }] };
    const first = await post(legacy);
    const second = await post(legacy);

    expect(first.status).toBe(201);
    expect([200, 201]).toContain(second.status);
    expect(await sessionsOf()).toBe(1);
  });

  it('F3-AC05 different keys are different sessions', async () => {
    expect((await post(body(), `sess-${randomUUID()}`)).status).toBe(201);
    expect((await post(body(), `sess-${randomUUID()}`)).status).toBe(201);
    expect(await sessionsOf()).toBe(2);
  });
});
