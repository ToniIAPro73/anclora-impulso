/** AI-06: server-side sessions, rotating refresh tokens, revocation, legacy transition, A/B isolation. */
import { randomUUID } from 'crypto';
import fs from 'fs';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { prisma } from '../../src/config/database';
import { generateAccessToken, generateRefreshToken } from '../../src/utils/jwt';
import {
  hashRefreshToken, issueSession, revokeAllUserSessions, rotateRefreshToken,
} from '../../src/services/session.service';
import { login } from '../../src/services/auth.service';

const tag = `ai06-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
const original = { grace: env.authRefreshReuseGraceSeconds, legacy: env.authAcceptLegacyTokens };

async function newUser(label: string, withPassword = false) {
  const user = await prisma.user.create({
    data: { email: `${tag}-${label}@example.test`, fullName: label, passwordHash: withPassword ? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinv' : null },
  });
  userIds.push(user.id);
  return user;
}

const get = (token: string, path = '/api/workouts') => request(app).get(path).set('Authorization', `Bearer ${token}`);
const later = (ms: number) => new Date(Date.now() + ms);

beforeEach(() => {
  env.authRefreshReuseGraceSeconds = 10;
  env.authAcceptLegacyTokens = true;
});

afterAll(async () => {
  Object.assign(env, { authRefreshReuseGraceSeconds: original.grace, authAcceptLegacyTokens: original.legacy });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('issuing', () => {
  it('registration returns an sid-bound access token and an opaque refresh token; only its hash is stored', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: `${tag}-reg@example.test`, password: `pw-${randomUUID()}`, fullName: 'Reg' });
    expect(res.status).toBe(201);
    userIds.push(res.body.user.id);
    const claims = jwt.decode(res.body.accessToken) as any;
    expect(claims.sid).toBeTruthy();
    expect(res.body.refreshToken.startsWith('rt1.')).toBe(true);
    expect(await prisma.refreshToken.count({ where: { tokenHash: res.body.refreshToken } })).toBe(0);
    const row = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashRefreshToken(res.body.refreshToken) } });
    expect(row.tokenHash).toHaveLength(64);
    expect(row.sessionId).toBe(claims.sid);
    expect((await get(res.body.accessToken)).status).toBe(200);
  });
});

describe('rotation and reuse detection', () => {
  it('rotates: old token consumed, new pair works', async () => {
    const user = await newUser('rotate');
    const s = await issueSession(user);
    const r = await rotateRefreshToken(s.refreshToken);
    expect(r.refreshToken).not.toBe(s.refreshToken);
    expect(r.sessionId).toBe(s.sessionId);
    expect((await get(r.accessToken)).status).toBe(200);
    const old = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashRefreshToken(s.refreshToken) } });
    expect(old.usedAt).not.toBeNull();
    expect(old.replacedById).not.toBeNull();
  });

  it('reuse beyond the grace window revokes the whole session (family)', async () => {
    const user = await newUser('reuse');
    const s = await issueSession(user);
    const r = await rotateRefreshToken(s.refreshToken);
    await expect(rotateRefreshToken(s.refreshToken, later(60_000))).rejects.toMatchObject({ statusCode: 401 });
    const session = await prisma.authSession.findUniqueOrThrow({ where: { id: s.sessionId } });
    expect(session.revokedReason).toBe('refresh_token_reuse_detected');
    expect((await get(r.accessToken)).status).toBe(401);
    await expect(rotateRefreshToken(r.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('legitimate concurrent refreshes (two tabs) all succeed inside the grace window and keep the session', async () => {
    const user = await newUser('concurrent');
    const s = await issueSession(user);
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => rotateRefreshToken(s.refreshToken)));
    expect(results.every((r) => r.status === 'fulfilled')).toBe(true);
    const tokens = results.map((r) => (r as PromiseFulfilledResult<any>).value.refreshToken);
    expect(new Set(tokens).size).toBe(6);
    const parent = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashRefreshToken(s.refreshToken) } });
    expect(parent.usedAt).not.toBeNull();
    expect((await prisma.authSession.findUniqueOrThrow({ where: { id: s.sessionId } })).revokedAt).toBeNull();
    // each issued token is itself usable
    await expect(rotateRefreshToken(tokens[0])).resolves.toBeTruthy();
  });

  it('exactly one concurrent refresh wins the rotation claim', async () => {
    const user = await newUser('claim');
    const s = await issueSession(user);
    await Promise.all(Array.from({ length: 6 }, () => rotateRefreshToken(s.refreshToken)));
    const parent = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashRefreshToken(s.refreshToken) } });
    expect(parent.replacedById).not.toBeNull();
    expect(await prisma.refreshToken.count({ where: { sessionId: s.sessionId } })).toBe(7); // parent + winner + 5 grace siblings
  });
});

describe('grace window: documented limits', () => {
  it('LIMIT: a replay inside the grace window is indistinguishable from a legitimate second tab and obtains a valid token', async () => {
    const user = await newUser('grace-limit');
    const s = await issueSession(user);
    const legit = await rotateRefreshToken(s.refreshToken); // the real client rotates
    const replayInGrace = await rotateRefreshToken(s.refreshToken); // a thief replays the old token within 10 s
    expect(replayInGrace.refreshToken).not.toBe(legit.refreshToken);
    expect((await get(replayInGrace.accessToken)).status).toBe(200); // accepted: this is the cost of tolerating two tabs
    expect((await prisma.authSession.findUniqueOrThrow({ where: { id: s.sessionId } })).revokedAt).toBeNull();
  });

  it('after the window, replaying the parent revokes the session and with it BOTH tokens issued in the grace window', async () => {
    const user = await newUser('grace-detect');
    const s = await issueSession(user);
    const legit = await rotateRefreshToken(s.refreshToken);
    const sibling = await rotateRefreshToken(s.refreshToken);
    await expect(rotateRefreshToken(s.refreshToken, later(60_000))).rejects.toMatchObject({ statusCode: 401 });
    await expect(rotateRefreshToken(legit.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
    await expect(rotateRefreshToken(sibling.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
    expect((await get(sibling.accessToken)).status).toBe(401);
  });

  it('a zero grace window rejects any second use of a consumed token', async () => {
    env.authRefreshReuseGraceSeconds = 0;
    const user = await newUser('grace-zero');
    const s = await issueSession(user);
    await rotateRefreshToken(s.refreshToken);
    await expect(rotateRefreshToken(s.refreshToken, later(50))).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('revocation and lifecycle', () => {
  it('logout revokes server-side; access and refresh both stop working; logout is idempotent', async () => {
    const user = await newUser('logout');
    const s = await issueSession(user);
    const out = await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${s.accessToken}`).send({ refreshToken: s.refreshToken });
    expect(out.status).toBe(200);
    expect((await get(s.accessToken)).status).toBe(401);
    await expect(rotateRefreshToken(s.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
    expect((await request(app).post('/api/auth/logout').send({ refreshToken: s.refreshToken })).status).toBe(200);
    expect((await request(app).post('/api/auth/logout').send({})).status).toBe(200);
  });

  it('logout works with an expired access token plus the refresh token', async () => {
    const user = await newUser('logout-expired');
    const s = await issueSession(user);
    const expired = jwt.sign({ userId: user.id, email: user.email, sid: s.sessionId }, env.jwtSecret, { expiresIn: -10 });
    await request(app).post('/api/auth/logout').set('Authorization', `Bearer ${expired}`).send({}).expect(200);
    const session = await prisma.authSession.findUniqueOrThrow({ where: { id: s.sessionId } });
    expect(session.revokedReason).toBe('logout');
  });

  it('revokeAllUserSessions kills every session of that user only', async () => {
    const a = await newUser('all-a');
    const b = await newUser('all-b');
    const a1 = await issueSession(a);
    const a2 = await issueSession(a);
    const b1 = await issueSession(b);
    expect(await revokeAllUserSessions(a.id, 'credential_reset')).toBe(2);
    expect((await get(a1.accessToken)).status).toBe(401);
    expect((await get(a2.accessToken)).status).toBe(401);
    expect((await get(b1.accessToken)).status).toBe(200);
  });

  it('deleted user: access and refresh are rejected', async () => {
    const user = await newUser('deleted');
    const s = await issueSession(user);
    await prisma.user.delete({ where: { id: user.id } });
    expect((await get(s.accessToken)).status).toBe(401);
    await expect(rotateRefreshToken(s.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });

  it('disabled user: access, refresh and login are rejected', async () => {
    const user = await newUser('disabled', true);
    const s = await issueSession(user);
    await prisma.user.update({ where: { id: user.id }, data: { disabledAt: new Date() } });
    expect((await get(s.accessToken)).status).toBe(401);
    await expect(rotateRefreshToken(s.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
    expect((await prisma.authSession.findUniqueOrThrow({ where: { id: s.sessionId } })).revokedReason).toBe('user_disabled');
    await expect(login({ email: user.email, password: 'whatever' })).rejects.toMatchObject({ statusCode: 401 });
  });

  it('expired session: access and refresh are rejected', async () => {
    const user = await newUser('expired');
    const s = await issueSession(user);
    await prisma.authSession.update({ where: { id: s.sessionId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await get(s.accessToken)).status).toBe(401);
    await expect(rotateRefreshToken(s.refreshToken)).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('token forgery and misuse', () => {
  it('rejects expired, alg=none, wrong-secret, mismatched-user and refresh-as-access tokens', async () => {
    const a = await newUser('forge-a');
    const b = await newUser('forge-b');
    const sa = await issueSession(a);
    const claims = { userId: a.id, email: a.email, sid: sa.sessionId };

    const expired = jwt.sign(claims, env.jwtSecret, { expiresIn: -10 });
    const none = `${Buffer.from('{"alg":"none","typ":"JWT"}').toString('base64url')}.${Buffer.from(JSON.stringify({ ...claims, exp: 9999999999 })).toString('base64url')}.`;
    const wrongSecret = jwt.sign(claims, 'not-the-secret-' + randomUUID());
    const signedWithRefreshSecret = jwt.sign(claims, env.jwtRefreshSecret);
    const userMismatch = jwt.sign({ userId: b.id, email: b.email, sid: sa.sessionId }, env.jwtSecret, { expiresIn: '5m' });

    for (const token of [expired, none, wrongSecret, signedWithRefreshSecret, userMismatch, sa.refreshToken, 'garbage']) {
      expect((await get(token)).status).toBe(401);
    }
    expect((await get(sa.accessToken)).status).toBe(200);
  });
});

describe('legacy (pre-session) token transition', () => {
  it('accepted while the flag is on, rejected when it is off', async () => {
    const user = await newUser('legacy');
    const legacy = generateAccessToken({ userId: user.id, email: user.email });
    expect((await get(legacy)).status).toBe(200);
    env.authAcceptLegacyTokens = false;
    expect((await get(legacy)).status).toBe(401);
  });

  it('legacy tokens of deleted or disabled users are rejected', async () => {
    const gone = await newUser('legacy-gone');
    const off = await newUser('legacy-off');
    const goneToken = generateAccessToken({ userId: gone.id, email: gone.email });
    const offToken = generateAccessToken({ userId: off.id, email: off.email });
    await prisma.user.delete({ where: { id: gone.id } });
    await prisma.user.update({ where: { id: off.id }, data: { disabledAt: new Date() } });
    expect((await get(goneToken)).status).toBe(401);
    expect((await get(offToken)).status).toBe(401);
  });

  it('a legacy refresh JWT is upgraded into a server-side session; refused when transition is closed', async () => {
    const user = await newUser('legacy-refresh');
    const legacyRefresh = generateRefreshToken({ userId: user.id, email: user.email });
    const upgraded = await rotateRefreshToken(legacyRefresh);
    expect(upgraded.refreshToken.startsWith('rt1.')).toBe(true);
    expect((jwt.decode(upgraded.accessToken) as any).sid).toBe(upgraded.sessionId);
    env.authAcceptLegacyTokens = false;
    await expect(rotateRefreshToken(legacyRefresh)).rejects.toMatchObject({ statusCode: 401 });
    await expect(rotateRefreshToken('rt1.unknown-token')).rejects.toMatchObject({ statusCode: 401 });
  });
});

describe('A/B isolation (AC07) with route inventory', () => {
  function walk(stack: any[], prefix = ''): string[] {
    const out: string[] = [];
    for (const layer of stack) {
      if (layer.route) {
        for (const m of Object.keys(layer.route.methods)) out.push(`${m.toUpperCase()} ${prefix}${layer.route.path}`);
      } else if (layer.name === 'router' && layer.handle.stack) {
        const src = layer.regexp.source.replace('^\\/', '/').replace('\\/?(?=\\/|$)', '').replace(/\\\//g, '/');
        out.push(...walk(layer.handle.stack, prefix + src.replace(/\$$/, '')));
      }
    }
    return out;
  }

  // Routes taking an id of a user-owned resource: each MUST appear in OWNED and be exercised below.
  const OWNED = [
    'GET /api/workouts/:id', 'PUT /api/workouts/:id', 'DELETE /api/workouts/:id',
    'GET /api/sessions/:id', 'PUT /api/sessions/:id', 'DELETE /api/sessions/:id',
    'PUT /api/progress/measurements/:id', 'DELETE /api/progress/measurements/:id',
    'GET /api/nutrition/meal-plans/:id', 'DELETE /api/nutrition/meal-plans/:id',
    'POST /api/nutrition/meals/:mealId/replace',
  ];
  // Parametrised routes that are NOT per-user resources, with the reason they are exempt.
  const EXEMPT: Record<string, string> = {
    'GET /api/exercises/:id': 'shared public catalogue (read-only)',
    'PUT /api/exercises/:id': 'shared catalogue, admin only',
    'DELETE /api/exercises/:id': 'shared catalogue, admin only',
    'GET /api/nutrition/recipes/:id': 'shared catalogue (read-only)',
    'PUT /api/nutrition/recipes/:id': 'shared catalogue, admin only',
    'POST /api/social/follows/:userId': 'targets another user by design; actor is the authenticated user',
    'DELETE /api/social/follows/:userId': 'actor-scoped relation',
    'POST /api/social/feed/:feedItemId/kudos': 'public feed item; reaction keyed to the actor',
    'DELETE /api/social/feed/:feedItemId/kudos': 'actor-scoped reaction',
    'POST /api/social/challenges/:challengeId/join': 'public challenge; membership keyed to the actor',
    'GET /api/social/challenges/:challengeId/leaderboard': 'public challenge leaderboard (reviewed under AI-07)',
    'PUT /api/wearables/connections/:provider': ':provider is an enum, not a resource id; row keyed to the actor',
    'POST /api/health-plans/actions/:actionId/complete': 'catalogue action; completion keyed to the actor enrollment',
  };

  it('every parametrised route is classified (new routes cannot silently skip isolation review)', () => {
    const parametrised = walk((app as any)._router.stack).filter((r) => r.includes(':') && r.includes('/api/'));
    const unclassified = parametrised.filter((r) => !OWNED.includes(r) && !(r in EXEMPT));
    expect(unclassified).toEqual([]);
    for (const route of OWNED) expect(parametrised).toContain(route);
  });

  it('user A can neither read, modify nor delete user B resources on owned routes', async () => {
    const [a, b] = [await newUser('ab-a'), await newUser('ab-b')];
    const tokenA = (await issueSession(a)).accessToken;
    const exercise = await prisma.exercise.create({
      data: { name: `${tag}-ex`, category: 'c', muscleGroup: 'm', equipment: 'e', difficulty: 'beginner', description: 'd', instructions: ['i'] },
    });
    const workout = await prisma.workout.create({
      data: { userId: b.id, name: 'B workout', exercises: { create: [{ exerciseId: exercise.id, sets: 3, reps: 10, rest: 60, order: 0 }] } },
    });
    const session = await prisma.workoutSession.create({ data: { userId: b.id, workoutId: workout.id, duration: 1200, notes: 'B notes' } });
    const measurement = await prisma.bodyMeasurement.create({ data: { userId: b.id, weight: 70 } });
    const plan = await prisma.mealPlan.create({ data: { userId: b.id, weekStart: new Date() } });
    const meal = await prisma.meal.create({ data: { mealPlanId: plan.id, dayOfWeek: 0, mealType: 'desayuno' } });

    const auth = (r: request.Test) => r.set('Authorization', `Bearer ${tokenA}`);
    const attempts: Array<[string, request.Test]> = [
      ['GET workout', auth(request(app).get(`/api/workouts/${workout.id}`))],
      ['PUT workout', auth(request(app).put(`/api/workouts/${workout.id}`)).send({ name: 'hacked' })],
      ['DELETE workout', auth(request(app).delete(`/api/workouts/${workout.id}`))],
      ['GET session', auth(request(app).get(`/api/sessions/${session.id}`))],
      ['PUT session', auth(request(app).put(`/api/sessions/${session.id}`)).send({ notes: 'hacked' })],
      ['DELETE session', auth(request(app).delete(`/api/sessions/${session.id}`))],
      ['PUT measurement', auth(request(app).put(`/api/progress/measurements/${measurement.id}`)).send({ weight: 1 })],
      ['DELETE measurement', auth(request(app).delete(`/api/progress/measurements/${measurement.id}`))],
      ['GET meal plan', auth(request(app).get(`/api/nutrition/meal-plans/${plan.id}`))],
      ['DELETE meal plan', auth(request(app).delete(`/api/nutrition/meal-plans/${plan.id}`))],
      ['replace meal recipe', auth(request(app).post(`/api/nutrition/meals/${meal.id}/replace`)).send({ recipeId: randomUUID() })],
    ];
    for (const [label, req] of attempts) {
      const res = await req;
      expect([label, [403, 404].includes(res.status)]).toEqual([label, true]);
      expect(JSON.stringify(res.body)).not.toContain('B workout');
      expect(JSON.stringify(res.body)).not.toContain('B notes');
    }

    // B's data is untouched
    expect((await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })).name).toBe('B workout');
    expect((await prisma.workoutSession.findUniqueOrThrow({ where: { id: session.id } })).notes).toBe('B notes');
    expect((await prisma.bodyMeasurement.findUniqueOrThrow({ where: { id: measurement.id } })).weight).toBe(70);
    expect(await prisma.mealPlan.count({ where: { id: plan.id } })).toBe(1);
    await prisma.exercise.delete({ where: { id: exercise.id } }).catch(() => undefined);
  });

  it('PUT /workouts/:id validates its body (unknown shapes are rejected, not passed to the ORM)', async () => {
    const a = await newUser('put-validate');
    const token = (await issueSession(a)).accessToken;
    const workout = await prisma.workout.create({ data: { userId: a.id, name: 'mine' } });
    const bad = await request(app).put(`/api/workouts/${workout.id}`).set('Authorization', `Bearer ${token}`).send({ exercises: [{ exerciseId: 'not-a-uuid' }] });
    expect(bad.status).toBe(400);
    expect((await prisma.workout.findUniqueOrThrow({ where: { id: workout.id } })).name).toBe('mine');
  });
});
