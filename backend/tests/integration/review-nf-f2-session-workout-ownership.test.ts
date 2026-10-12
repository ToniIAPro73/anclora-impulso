/**
 * F-2 (B1-IA): POST /api/sessions must only accept a workoutId owned by the authenticated user.
 * Reproduction with synthetic users A and B in the isolated database: A submits B's workout id.
 * Checks response, persisted rows, gamification/activity side effects and that B's data is not returned.
 */
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/database';
import { createSession } from '../../src/services/sessions.service';

const tag = `f2-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
let exerciseId = '';

async function newUser(label: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `${tag}-${label}@example.test`, password: `pw-${randomUUID()}`, fullName: `F2 ${label}` });
  expect(res.status).toBe(201);
  userIds.push(res.body.user.id);
  return { id: res.body.user.id as string, token: res.body.accessToken as string };
}

async function workoutFor(userId: string, name: string) {
  return prisma.workout.create({
    data: { userId, name, exercises: { create: [{ exerciseId, sets: 3, reps: 10, rest: 60, order: 0 }] } },
  });
}

const body = (workoutId: string) => ({
  workoutId,
  duration: 1200,
  notes: 'F2 synthetic',
  exercises: [{ exerciseId, sets: [{ reps: 10, weight: 20, order: 0 }] }],
});

async function sideEffectSnapshot(userId: string) {
  const [sessions, xpEvents, feed, gamification] = await Promise.all([
    prisma.workoutSession.count({ where: { userId } }),
    prisma.xPEvent.count({ where: { userId } }),
    prisma.activityFeedItem.count({ where: { userId } }),
    prisma.userGamification.findUnique({ where: { userId }, select: { xp: true, currentStreak: true } }),
  ]);
  return { sessions, xpEvents, feed, gamification };
}

beforeAll(async () => {
  const ex = await prisma.exercise.create({
    data: {
      name: `F2 exercise ${tag}`, category: 'strength', muscleGroup: 'chest', equipment: 'bodyweight',
      difficulty: 'beginner', description: 'synthetic', instructions: ['x'],
    },
  });
  exerciseId = ex.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.exercise.deleteMany({ where: { id: exerciseId } });
  await prisma.$disconnect();
});

describe('F-2: session creation checks workout ownership', () => {
  it('own workout: 201, session persisted for the caller with the workout name', async () => {
    const a = await newUser('own');
    const workout = await workoutFor(a.id, `A-own-${tag}`);
    const res = await request(app).post('/api/sessions').set('Authorization', `Bearer ${a.token}`).send(body(workout.id));
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(a.id);
    expect(res.body.workout.name).toBe(`A-own-${tag}`);
    expect((await sideEffectSnapshot(a.id)).sessions).toBe(1);
  });

  it("another user's workout: rejected like a missing resource, nothing persisted, nothing leaked, no side effects", async () => {
    const a = await newUser('thief');
    const b = await newUser('victim');
    const secretName = `B-secret-${tag}`;
    const workoutB = await workoutFor(b.id, secretName);
    const before = await sideEffectSnapshot(a.id);
    const beforeB = await sideEffectSnapshot(b.id);

    const res = await request(app).post('/api/sessions').set('Authorization', `Bearer ${a.token}`).send(body(workoutB.id));
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain(secretName);
    expect(JSON.stringify(res.body)).not.toContain(b.id);

    expect(await sideEffectSnapshot(a.id)).toEqual(before);
    expect(await sideEffectSnapshot(b.id)).toEqual(beforeB);
    expect(await prisma.workoutSession.count({ where: { workoutId: workoutB.id } })).toBe(0);
    const feedA = await prisma.activityFeedItem.findMany({ where: { userId: a.id } });
    expect(JSON.stringify(feedA)).not.toContain(secretName);
  });

  it('a non-existent workout id gives the same response as another user’s workout (no existence oracle)', async () => {
    const a = await newUser('ghost');
    const b = await newUser('other');
    const workoutB = await workoutFor(b.id, `B-x-${tag}`);
    const foreign = await request(app).post('/api/sessions').set('Authorization', `Bearer ${a.token}`).send(body(workoutB.id));
    const ghost = await request(app).post('/api/sessions').set('Authorization', `Bearer ${a.token}`).send(body(randomUUID()));
    expect(ghost.status).toBe(foreign.status);
    expect(ghost.body).toEqual(foreign.body);
  });

  it('the check lives in the service: a direct call cannot bypass it', async () => {
    const a = await newUser('direct');
    const b = await newUser('direct-victim');
    const workoutB = await workoutFor(b.id, `B-direct-${tag}`);
    await expect(createSession(a.id, body(workoutB.id))).rejects.toMatchObject({ statusCode: 404 });
    expect((await sideEffectSnapshot(a.id)).sessions).toBe(0);
  });

  it('a workout deleted between the check and the write ends as 404 with nothing persisted (real lock race)', async () => {
    const a = await newUser('race');
    const workout = await workoutFor(a.id, `A-race-${tag}`);
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    // T1 deletes the workout and keeps its transaction open. The service reads the row (READ COMMITTED still sees it),
    // then its INSERT must wait for the foreign-key lock; when T1 commits the INSERT fails with a FK violation.
    let deleted!: () => void;
    const deletedInTx = new Promise<void>((resolve) => { deleted = resolve; });
    const t1 = prisma.$transaction(async (tx) => {
      await tx.workout.delete({ where: { id: workout.id } });
      deleted();
      await sleep(1200);
    });
    await deletedInTx;
    const outcome = createSession(a.id, body(workout.id)).then(
      () => ({ ok: true as const }),
      (error: any) => ({ ok: false as const, status: error?.statusCode }),
    );
    await t1;
    const result = await outcome;
    expect(result).toEqual({ ok: false, status: 404 });
    expect((await sideEffectSnapshot(a.id)).sessions).toBe(0);
  });
});
