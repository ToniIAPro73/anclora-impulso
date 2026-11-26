/**
 * History integrity F1: deleting catalogue exercises or routines must never destroy training history.
 * Spec: sdd/features/history-integrity-f1/history-integrity-f1-spec-v1.md (F1-AC01..AC09).
 * Synthetic users and exercises only, isolated PostgreSQL.
 */
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/database';
import { env } from '../../src/config/env';
import { generateWorkout } from '../../src/services/workouts.service';
import { syncExerciseCatalog } from '../../prisma/exercise-catalog-sync';

const tag = `hi-f1-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
const exerciseIds: string[] = [];
const originalAdminIds = [...env.adminUserIds];

type TestUser = { id: string; token: string };

async function newUser(label: string): Promise<TestUser> {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `${tag}-${label}@example.test`, password: `pw-${randomUUID()}`, fullName: `F1 ${label}` });
  expect(res.status).toBe(201);
  userIds.push(res.body.user.id);
  return { id: res.body.user.id as string, token: res.body.accessToken as string };
}

async function newExercise(label: string, overrides: Record<string, unknown> = {}) {
  const exercise = await prisma.exercise.create({
    data: {
      name: `F1 ${label} ${tag}`,
      category: 'strength',
      muscleGroup: 'chest',
      equipment: 'bodyweight',
      difficulty: 'beginner',
      description: 'synthetic',
      instructions: ['x'],
      ...overrides,
    },
  });
  exerciseIds.push(exercise.id);
  return exercise;
}

/** Routine + one logged session + personal record + progression state, all on `exerciseId`. */
async function historyFor(user: TestUser, exerciseId: string) {
  const workout = await prisma.workout.create({
    data: {
      userId: user.id,
      name: `F1 routine ${tag}`,
      exercises: { create: [{ exerciseId, sets: 3, reps: 10, rest: 60, order: 0 }] },
    },
  });
  const res = await request(app)
    .post('/api/sessions')
    .set('Authorization', `Bearer ${user.token}`)
    .send({
      workoutId: workout.id,
      duration: 1200,
      exercises: [{ exerciseId, sets: [{ reps: 10, weight: 20, order: 0 }, { reps: 8, weight: 22.5, order: 1 }] }],
    });
  expect(res.status).toBe(201);
  await prisma.exerciseProgressionState.upsert({
    where: { userId_exerciseId: { userId: user.id, exerciseId } },
    update: {},
    create: { userId: user.id, exerciseId, currentWeight: 20, targetMinReps: 8, targetMaxReps: 12 },
  });
  return { workout, sessionId: res.body.id as string };
}

async function historyCounts(userId: string, exerciseId: string) {
  const [sessions, sessionExercises, sets, records, routineRows, progression] = await Promise.all([
    prisma.workoutSession.count({ where: { userId } }),
    prisma.sessionExercise.count({ where: { exerciseId, session: { userId } } }),
    prisma.sessionSet.count({ where: { sessionExercise: { exerciseId, session: { userId } } } }),
    prisma.personalRecord.count({ where: { userId, exerciseId } }),
    prisma.workoutExercise.count({ where: { exerciseId, workout: { userId } } }),
    prisma.exerciseProgressionState.count({ where: { userId, exerciseId } }),
  ]);
  return { sessions, sessionExercises, sets, records, routineRows, progression };
}

const EXPECTED_HISTORY = { sessions: 1, sessionExercises: 1, sets: 2, records: 1, routineRows: 1, progression: 1 };

afterAll(async () => {
  env.adminUserIds.splice(0, env.adminUserIds.length, ...originalAdminIds);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
  await prisma.$disconnect();
});

describe('F1 catalogue: exercises with history are archived, never deleted', () => {
  it('F1-AC01/AC02: catalogue sync archives unlisted exercises, keeps their history, and is idempotent', async () => {
    const user = await newUser('seed');
    const listed = await newExercise('listed');
    const unlisted = await newExercise('unlisted');
    await historyFor(user, unlisted.id);

    // Only touch this test's exercises: everything else in the shared test database is listed as-is.
    const others = await prisma.exercise.findMany({
      where: { id: { notIn: [listed.id, unlisted.id] } },
      select: { name: true },
    });
    const seedList = [...new Set([...others.map((e) => e.name), listed.name])].map((name) => ({ name }));
    const archivedBefore = await prisma.exercise.findMany({ where: { archivedAt: { not: null } }, select: { id: true } });

    try {
      await syncExerciseCatalog(prisma, seedList as never);
      const first = await prisma.exercise.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, archivedAt: true } });
      await syncExerciseCatalog(prisma, seedList as never);
      const second = await prisma.exercise.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, archivedAt: true } });

      expect(second.map((e) => [e.id, e.name, e.archivedAt !== null])).toEqual(first.map((e) => [e.id, e.name, e.archivedAt !== null]));
      const unlistedRow = second.find((e) => e.id === unlisted.id);
      expect(unlistedRow?.archivedAt).not.toBeNull();
      expect(second.find((e) => e.id === listed.id)?.archivedAt).toBeNull();
      expect(await historyCounts(user.id, unlisted.id)).toEqual(EXPECTED_HISTORY);
    } finally {
      // Undo archive side effects on rows owned by other suites.
      await prisma.exercise.updateMany({
        where: { id: { notIn: [...archivedBefore.map((e) => e.id), unlisted.id] } },
        data: { archivedAt: null },
      });
    }
  });

  it('F1-AC01: catalogue sync archives duplicates by name instead of deleting them', async () => {
    const user = await newUser('dup');
    const original = await newExercise('dup');
    const duplicate = await prisma.exercise.create({
      data: {
        name: original.name,
        category: original.category,
        muscleGroup: original.muscleGroup,
        equipment: original.equipment,
        difficulty: original.difficulty,
        description: original.description,
        instructions: original.instructions,
      },
    });
    exerciseIds.push(duplicate.id);
    await historyFor(user, duplicate.id);

    const all = await prisma.exercise.findMany({ select: { name: true } });
    const archivedBefore = await prisma.exercise.findMany({ where: { archivedAt: { not: null } }, select: { id: true } });
    try {
      await syncExerciseCatalog(prisma, [...new Set(all.map((e) => e.name))].map((name) => ({ name })) as never);
      const rows = await prisma.exercise.findMany({ where: { name: original.name }, orderBy: { createdAt: 'asc' } });
      expect(rows).toHaveLength(2);
      expect(rows[0].archivedAt).toBeNull();
      expect(rows[1].archivedAt).not.toBeNull();
      expect(await historyCounts(user.id, duplicate.id)).toEqual(EXPECTED_HISTORY);
    } finally {
      await prisma.exercise.updateMany({
        where: { id: { notIn: [...archivedBefore.map((e) => e.id), duplicate.id] } },
        data: { archivedAt: null },
      });
    }
  });

  it('F1-AC03: admin delete archives a referenced exercise and removes an unreferenced one', async () => {
    const admin = await newUser('admin');
    env.adminUserIds.splice(0, env.adminUserIds.length, ...originalAdminIds, admin.id);
    const user = await newUser('admin-victim');
    const referenced = await newExercise('referenced');
    const unreferenced = await newExercise('unreferenced');
    await historyFor(user, referenced.id);

    const del = (id: string) => request(app).delete(`/api/exercises/${id}`).set('Authorization', `Bearer ${admin.token}`);
    expect((await del(referenced.id)).status).toBe(204);
    expect((await del(unreferenced.id)).status).toBe(204);

    const archived = await prisma.exercise.findUnique({ where: { id: referenced.id } });
    expect(archived?.archivedAt).not.toBeNull();
    expect(await prisma.exercise.findUnique({ where: { id: unreferenced.id } })).toBeNull();
    expect(await historyCounts(user.id, referenced.id)).toEqual(EXPECTED_HISTORY);
  });

  it('F1-AC06: a direct delete of a referenced exercise fails on the foreign key', async () => {
    const user = await newUser('fk-ex');
    const exercise = await newExercise('fk');
    await historyFor(user, exercise.id);
    await expect(prisma.$executeRaw`DELETE FROM exercises WHERE id = ${exercise.id}`).rejects.toThrow(/foreign key/i);
    expect(await historyCounts(user.id, exercise.id)).toEqual(EXPECTED_HISTORY);
  });

  it('F1-AC08: archived exercises leave listings, metadata and generation candidates but stay readable by id', async () => {
    const user = await newUser('listing');
    const marker = `f1-equipment-${tag}`;
    const exercise = await newExercise('archived-listing', {
      equipment: marker,
      category: `f1-category-${tag}`,
      trainingEnvironments: ['gym'],
      archivedAt: new Date(),
    });

    const list = await request(app).get('/api/exercises').query({ equipment: marker });
    expect(list.status).toBe(200);
    expect(list.body.map((e: { id: string }) => e.id)).not.toContain(exercise.id);
    const equipment = await request(app).get('/api/exercises/meta/equipment');
    expect(equipment.body).not.toContain(marker);
    const categories = await request(app).get('/api/exercises/meta/categories');
    expect(categories.body).not.toContain(`f1-category-${tag}`);
    expect((await request(app).get(`/api/exercises/${exercise.id}`)).status).toBe(200);

    await expect(
      generateWorkout(user.id, {
        workoutType: 'strength',
        duration: 30,
        difficulty: 'beginner',
        trainingEnvironment: 'gym',
        equipment: [marker],
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe('F1 routines: routines with sessions are archived, never deleted', () => {
  it('F1-AC04: deleting a routine with sessions keeps every history row and hides the routine', async () => {
    const user = await newUser('routine');
    const exercise = await newExercise('routine');
    const { workout, sessionId } = await historyFor(user, exercise.id);

    const res = await request(app).delete(`/api/workouts/${workout.id}`).set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(204);

    expect(await historyCounts(user.id, exercise.id)).toEqual(EXPECTED_HISTORY);
    const stored = await prisma.workout.findUnique({ where: { id: workout.id } });
    expect(stored?.archivedAt).not.toBeNull();
    const session = await prisma.workoutSession.findUnique({ where: { id: sessionId }, include: { workout: true } });
    expect(session?.workout.name).toBe(workout.name);

    const list = await request(app).get('/api/workouts').set('Authorization', `Bearer ${user.token}`);
    expect(list.status).toBe(200);
    const listed = (Array.isArray(list.body) ? list.body : list.body.workouts ?? []) as Array<{ id: string }>;
    expect(listed.map((w) => w.id)).not.toContain(workout.id);
  });

  it('F1-AC05: deleting a routine without sessions removes it', async () => {
    const user = await newUser('routine-empty');
    const exercise = await newExercise('routine-empty');
    const workout = await prisma.workout.create({
      data: { userId: user.id, name: `F1 empty ${tag}`, exercises: { create: [{ exerciseId: exercise.id, sets: 3, reps: 10, rest: 60, order: 0 }] } },
    });
    const res = await request(app).delete(`/api/workouts/${workout.id}`).set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(204);
    expect(await prisma.workout.findUnique({ where: { id: workout.id } })).toBeNull();
  });

  it('F1-AC06: a direct delete of a routine with sessions fails on the foreign key', async () => {
    const user = await newUser('fk-routine');
    const exercise = await newExercise('fk-routine');
    const { workout } = await historyFor(user, exercise.id);
    await expect(prisma.$executeRaw`DELETE FROM workouts WHERE id = ${workout.id}`).rejects.toThrow(/foreign key/i);
  });

  it('F1-AC07: deleting a user still removes all of that user\'s routines and sessions', async () => {
    const user = await newUser('erase');
    const exercise = await newExercise('erase');
    await historyFor(user, exercise.id);
    await prisma.user.delete({ where: { id: user.id } });
    expect(await prisma.workout.count({ where: { userId: user.id } })).toBe(0);
    expect(await prisma.workoutSession.count({ where: { userId: user.id } })).toBe(0);
  });

  it('F1-AC09: no new session on an archived routine; no routine with an archived exercise', async () => {
    const user = await newUser('archived-use');
    const exercise = await newExercise('archived-use');
    const { workout } = await historyFor(user, exercise.id);
    await request(app).delete(`/api/workouts/${workout.id}`).set('Authorization', `Bearer ${user.token}`).expect(204);

    const session = await request(app)
      .post('/api/sessions')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ workoutId: workout.id, duration: 600, exercises: [{ exerciseId: exercise.id, sets: [{ reps: 5, weight: 10, order: 0 }] }] });
    expect(session.status).toBe(404);

    const archivedExercise = await newExercise('archived-for-routine', { archivedAt: new Date() });
    const created = await request(app)
      .post('/api/workouts')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ name: `F1 new ${tag}`, exercises: [{ exerciseId: archivedExercise.id, sets: 3, reps: 10, rest: 60, order: 0 }] });
    expect(created.status).toBe(422);
  });
});
