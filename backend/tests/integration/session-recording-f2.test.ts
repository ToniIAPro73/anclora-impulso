/**
 * Session recording F2 — POST /api/sessions stores the recording version (isolated PostgreSQL, synthetic data).
 * Spec: sdd/features/session-recording-f2/session-recording-f2-spec-v1.md (F2-AC06, F2-AC08, F2-AC10). Decision D4.
 */
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/database';

const tag = `sr-f2-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
const exerciseIds: string[] = [];

let token = '';
let workoutId = '';
let exerciseId = '';

beforeAll(async () => {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `${tag}@example.test`, password: `pw-${randomUUID()}`, fullName: 'F2 user' });
  expect(res.status).toBe(201);
  userIds.push(res.body.user.id);
  token = res.body.accessToken;

  const exercise = await prisma.exercise.create({
    data: {
      name: `F2 exercise ${tag}`, category: 'strength', muscleGroup: 'chest', equipment: 'barbell',
      difficulty: 'beginner', description: 'synthetic', instructions: ['x'],
    },
  });
  exerciseIds.push(exercise.id);
  exerciseId = exercise.id;

  const workout = await prisma.workout.create({
    data: {
      userId: res.body.user.id, name: `F2 routine ${tag}`, generationMode: 'manual',
      exercises: { create: [{ exerciseId, sets: 3, reps: 10, rest: 90, order: 0 }] },
    },
  });
  workoutId = workout.id;
});

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
  await prisma.$disconnect();
});

const post = (body: Record<string, unknown>) =>
  request(app).post('/api/sessions').set('Authorization', `Bearer ${token}`).send(body);

const oneSet = () => [{ exerciseId, sets: [{ reps: 8, weight: 12.5, order: 1 }] }];

describe('POST /api/sessions — session recording F2', () => {
  it('stores a faithful session as recordingVersion 2 with the values sent', async () => {
    const res = await post({ workoutId, duration: 1800, recordingVersion: 2, exercises: oneSet() });
    expect(res.status).toBe(201);
    const stored = await prisma.workoutSession.findUniqueOrThrow({
      where: { id: res.body.id },
      include: { exercises: { include: { sets: true } } },
    });
    expect(stored.recordingVersion).toBe(2);
    expect(stored.duration).toBe(1800);
    expect(stored.exercises).toHaveLength(1);
    expect(stored.exercises[0].sets).toEqual([expect.objectContaining({ reps: 8, weight: 12.5, order: 1 })]);
  });

  it('stores a request without recordingVersion as legacy (1) and keeps the old rules (D4)', async () => {
    const res = await post({ workoutId, duration: 259_200, exercises: oneSet() });
    expect(res.status).toBe(201);
    const stored = await prisma.workoutSession.findUniqueOrThrow({ where: { id: res.body.id } });
    expect(stored.recordingVersion).toBe(1);
  });

  it('rejects a faithful session above the maximum duration, without exercises or with reps below 1', async () => {
    const before = await prisma.workoutSession.count({ where: { workoutId } });
    expect((await post({ workoutId, duration: 14_401, recordingVersion: 2, exercises: oneSet() })).status).toBe(400);
    expect((await post({ workoutId, duration: 600, recordingVersion: 2, exercises: [] })).status).toBe(400);
    expect(
      (await post({ workoutId, duration: 600, recordingVersion: 2, exercises: [{ exerciseId, sets: [{ reps: 0, weight: 10, order: 0 }] }] })).status,
    ).toBe(400);
    expect(await prisma.workoutSession.count({ where: { workoutId } })).toBe(before);
  });

  it('existing rows default to the legacy version (migration default)', async () => {
    const session = await prisma.workoutSession.create({ data: { userId: userIds[0], workoutId, duration: 60 } });
    expect(session.recordingVersion).toBe(1);
  });
});
