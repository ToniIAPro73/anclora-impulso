/**
 * F-3 (B1-IA): measurements — only the documented measurement fields are editable; identity/ownership fields,
 * unknown keys and nested relations never reach Prisma. Synthetic users A and B, isolated database.
 */
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/database';
import { createMeasurement, updateMeasurement } from '../../src/services/progress.service';

const tag = `f3-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];

async function newUser(label: string) {
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email: `${tag}-${label}@example.test`, password: `pw-${randomUUID()}`, fullName: `F3 ${label}` });
  expect(res.status).toBe(201);
  userIds.push(res.body.user.id);
  return { id: res.body.user.id as string, token: res.body.accessToken as string };
}
const auth = (t: string) => ({ Authorization: `Bearer ${t}` });
const row = (id: string) => prisma.bodyMeasurement.findUniqueOrThrow({ where: { id } });

afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('F-3: measurement update contract', () => {
  it('valid editable fields update', async () => {
    const a = await newUser('valid');
    const m = await prisma.bodyMeasurement.create({ data: { userId: a.id, weight: 80 } });
    const res = await request(app).put(`/api/progress/measurements/${m.id}`).set(auth(a.token)).send({ weight: 79.5, waist: 90, date: '2026-10-01T00:00:00.000Z' });
    expect(res.status).toBe(200);
    const after = await row(m.id);
    expect(after.weight).toBe(79.5);
    expect(after.waist).toBe(90);
    expect(after.userId).toBe(a.id);
  });

  it.each([
    ['userId of another user', (b: string) => ({ weight: 70, userId: b })],
    ['id', () => ({ weight: 70, id: randomUUID() })],
    ['nested relation connect', (b: string) => ({ weight: 70, user: { connect: { id: b } } })],
    ['unknown key', () => ({ weight: 70, isAdmin: true })],
  ])('rejects %s with 4xx and no partial mutation', async (_label, make) => {
    const a = await newUser(`rej-${_label.replace(/\W/g, '')}`);
    const b = await newUser(`rejb-${_label.replace(/\W/g, '')}`);
    const m = await prisma.bodyMeasurement.create({ data: { userId: a.id, weight: 80, waist: 85 } });
    const res = await request(app).put(`/api/progress/measurements/${m.id}`).set(auth(a.token)).send((make as any)(b.id));
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(500);
    const after = await row(m.id);
    expect(after.userId).toBe(a.id);
    expect(after.id).toBe(m.id);
    expect(after.weight).toBe(80);
    expect(await prisma.bodyMeasurement.count({ where: { userId: b.id } })).toBe(0);
  });

  it('rejects invalid values and types', async () => {
    const a = await newUser('types');
    const m = await prisma.bodyMeasurement.create({ data: { userId: a.id, weight: 80 } });
    for (const bad of [{ weight: 'heavy' }, { weight: -3 }, { bodyFat: 120 }, { date: 'yesterday' }, {}]) {
      const res = await request(app).put(`/api/progress/measurements/${m.id}`).set(auth(a.token)).send(bad);
      expect(res.status).toBe(400);
    }
    expect((await row(m.id)).weight).toBe(80);
  });

  it("A cannot update B's measurement (404, B's row unchanged)", async () => {
    const a = await newUser('xa');
    const b = await newUser('xb');
    const mb = await prisma.bodyMeasurement.create({ data: { userId: b.id, weight: 60 } });
    const res = await request(app).put(`/api/progress/measurements/${mb.id}`).set(auth(a.token)).send({ weight: 1 });
    expect(res.status).toBe(404);
    const after = await row(mb.id);
    expect(after.weight).toBe(60);
    expect(after.userId).toBe(b.id);
  });

  it('the contract also holds for direct service calls (no reliance on the route)', async () => {
    const a = await newUser('svc');
    const b = await newUser('svcb');
    const m = await prisma.bodyMeasurement.create({ data: { userId: a.id, weight: 80 } });
    await expect(updateMeasurement(m.id, a.id, { weight: 70, userId: b.id } as any)).rejects.toMatchObject({ statusCode: 400 });
    await expect(updateMeasurement(m.id, a.id, { user: { connect: { id: b.id } } } as any)).rejects.toMatchObject({ statusCode: 400 });
    expect((await row(m.id)).userId).toBe(a.id);
    expect((await row(m.id)).weight).toBe(80);
  });
});

describe('F-3 (same defect class, create path): userId in the body cannot override the authenticated owner', () => {
  it('POST with userId of B creates the row for the caller only', async () => {
    const a = await newUser('create-a');
    const b = await newUser('create-b');
    const res = await request(app).post('/api/progress/measurements').set(auth(a.token)).send({ weight: 71, userId: b.id });
    expect(res.status).toBe(201);
    expect(res.body.userId).toBe(a.id);
    expect(await prisma.bodyMeasurement.count({ where: { userId: b.id } })).toBe(0);
    expect(await prisma.bodyMeasurement.count({ where: { userId: a.id } })).toBe(1);
  });

  it('direct service call ignores/rejects ownership fields', async () => {
    const a = await newUser('create-svc-a');
    const b = await newUser('create-svc-b');
    const m = await createMeasurement(a.id, { weight: 72, userId: b.id } as any);
    expect(m.userId).toBe(a.id);
    expect(await prisma.bodyMeasurement.count({ where: { userId: b.id } })).toBe(0);
  });
});
