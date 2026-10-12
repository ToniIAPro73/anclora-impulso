/** AI-08 idempotency of coach messages, against the isolated PostgreSQL (synthetic users, deterministic provider). */
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/database';
import { env } from '../../src/config/env';
import { sendCoachMessage, resetCoachRuntimeState } from '../../src/services/coach/coach.service';
import { deterministicCoachProvider, resetDeterministicCoachProviderCalls, getDeterministicCoachProviderCalls } from '../../src/services/coach/providers/deterministic.provider';
import { purgeExpiredIdempotencyRecords, hashRequest } from '../../src/services/idempotency.service';
import { gatedCall, drainGates, track } from '../support/sync';

const tag = `inc02-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
const original = { ...env };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const newKey = () => `key-${randomUUID()}`;

async function makeUser(label: string) {
  const user = await prisma.user.create({ data: { email: `${tag}-${label}@example.test`, fullName: label } });
  userIds.push(user.id);
  const conversation = await prisma.coachConversation.create({ data: { userId: user.id, title: 't' } });
  return { user, conversationId: conversation.id };
}

const quota = async (userId: string) => (await prisma.coachUsageWindow.findMany({ where: { userId } })).reduce((n, r) => n + r.requestCount, 0);
const messages = (conversationId: string) => prisma.coachMessage.count({ where: { conversationId } });

beforeEach(() => {
  env.llmCoachEnabled = true;
  env.llmProvider = 'deterministic';
  env.llmCoachWindowLimit = 50;
  env.llmCoachCacheTtlSeconds = 0; // prove persistence, not the per-process cache
  env.llmCoachWindowMinutes = 1440;
  env.llmCoachProviderTimeoutMs = 25000;
  resetCoachRuntimeState();
  resetDeterministicCoachProviderCalls();
});

afterEach(async () => { await drainGates(); jest.restoreAllMocks(); });

afterAll(async () => {
  Object.assign(env, original);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('coach idempotency', () => {
  it('same key + same content: second call replays, no quota, no new messages, no provider call', async () => {
    const { user, conversationId } = await makeUser('replay');
    const key = newKey();
    const first = await sendCoachMessage(user.id, { conversationId, message: 'how do I plan my week?' }, { idempotencyKey: key });
    const second = await sendCoachMessage(user.id, { conversationId, message: 'how do I plan my week?' }, { idempotencyKey: key });
    expect(second.idempotentReplay).toBe(true);
    expect(second.answer).toBe(first.answer);
    expect(getDeterministicCoachProviderCalls()).toBe(1);
    expect(await quota(user.id)).toBe(1);
    expect(await messages(conversationId)).toBe(2);
  });

  it('same key + different content: explicit 422 conflict and nothing consumed', async () => {
    const { user, conversationId } = await makeUser('conflict');
    const key = newKey();
    await sendCoachMessage(user.id, { conversationId, message: 'first question here' }, { idempotencyKey: key });
    await expect(
      sendCoachMessage(user.id, { conversationId, message: 'a different question' }, { idempotencyKey: key }),
    ).rejects.toMatchObject({ statusCode: 422 });
    expect(await quota(user.id)).toBe(1);
    expect(getDeterministicCoachProviderCalls()).toBe(1);
  });

  it('simultaneous requests with the same key execute exactly once', async () => {
    const { user, conversationId } = await makeUser('simultaneous');
    const key = newKey();
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementation(async (req) => { await sleep(150); return real(req); });
    const results = await Promise.allSettled(
      Array.from({ length: 10 }, () => sendCoachMessage(user.id, { conversationId, message: 'simultaneous question' }, { idempotencyKey: key })),
    );
    const fulfilled = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');
    const rejected = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
    expect(rejected.every((r) => (r.reason as any).statusCode === 409)).toBe(true);
    expect(fulfilled.filter((r) => !r.value.idempotentReplay)).toHaveLength(1);
    expect(getDeterministicCoachProviderCalls()).toBe(1);
    expect(await quota(user.id)).toBe(1);
    expect(await messages(conversationId)).toBe(2);
    // once finished, a retry replays
    const retry = await sendCoachMessage(user.id, { conversationId, message: 'simultaneous question' }, { idempotencyKey: key });
    expect(retry.idempotentReplay).toBe(true);
  });

  it('in-flight duplicate is rejected with 409 and does not consume quota', async () => {
    const { user, conversationId } = await makeUser('inflight');
    const key = newKey();
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
    const gated = gatedCall(real);
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(gated.impl);
    const owner = track(sendCoachMessage(user.id, { conversationId, message: 'slow question please' }, { idempotencyKey: key }));
    await gated.entered; // the owner is provably in flight
    await expect(
      sendCoachMessage(user.id, { conversationId, message: 'slow question please' }, { idempotencyKey: key }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(await quota(user.id)).toBe(1);
    gated.release();
    await owner;
    expect(await quota(user.id)).toBe(1);
  });

  it('provider failure releases the slot, marks the record failed, and a retry with the same key succeeds', async () => {
    const { user, conversationId } = await makeUser('failure');
    const key = newKey();
    const spy = jest.spyOn(deterministicCoachProvider, 'complete').mockRejectedValueOnce(new Error('provider down'));
    await expect(
      sendCoachMessage(user.id, { conversationId, message: 'will fail once' }, { idempotencyKey: key }),
    ).rejects.toThrow('provider down');
    expect(await quota(user.id)).toBe(0);
    expect(await messages(conversationId)).toBe(0);
    const record = await prisma.idempotencyRecord.findFirstOrThrow({ where: { userId: user.id, key } });
    expect(record.status).toBe('failed');

    spy.mockRestore();
    const retry = await sendCoachMessage(user.id, { conversationId, message: 'will fail once' }, { idempotencyKey: key });
    expect(retry.idempotentReplay).toBeUndefined();
    expect(await quota(user.id)).toBe(1);
    expect(await messages(conversationId)).toBe(2);
    expect((await prisma.idempotencyRecord.findFirstOrThrow({ where: { userId: user.id, key } })).attempts).toBe(2);
  });

  it('provider timeout returns 504, releases the slot and allows retry', async () => {
    const { user, conversationId } = await makeUser('timeout');
    const key = newKey();
    env.llmCoachProviderTimeoutMs = 50;
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(async (req) => {
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 400);
        req.signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); });
      });
      if (req.signal?.aborted) throw new Error('aborted by caller');
      return real(req);
    });
    await expect(
      sendCoachMessage(user.id, { conversationId, message: 'this one will time out' }, { idempotencyKey: key }),
    ).rejects.toMatchObject({ statusCode: 504 });
    expect(await quota(user.id)).toBe(0);
    env.llmCoachProviderTimeoutMs = 25000;
    const retry = await sendCoachMessage(user.id, { conversationId, message: 'this one will time out' }, { idempotencyKey: key });
    expect(retry.answer).toBeTruthy();
    expect(await quota(user.id)).toBe(1);
  });

  it('process restart: a stale in-progress lock is taken over; a completed result survives with a cold module state', async () => {
    const { user, conversationId } = await makeUser('restart');
    const message = 'question around a restart';
    // Simulate a crashed owner: in_progress row whose lock already expired.
    const staleKey = newKey();
    await prisma.idempotencyRecord.create({
      data: {
        userId: user.id, operation: 'coach.message', key: staleKey,
        requestHash: hashRequest({ conversationId, message }), status: 'in_progress', ownerToken: 'dead-process',
        lockedUntil: new Date(Date.now() - 1000), expiresAt: new Date(Date.now() + 3600_000),
      },
    });
    const recovered = await sendCoachMessage(user.id, { conversationId, message }, { idempotencyKey: staleKey });
    expect(recovered.idempotentReplay).toBeUndefined();
    expect(await quota(user.id)).toBe(1);

    // Cold start: fresh module registry (new in-memory cache, new Prisma client), same database.
    jest.resetModules();
    const cold = await import('../../src/services/coach/coach.service');
    const replay = await cold.sendCoachMessage(user.id, { conversationId, message }, { idempotencyKey: staleKey });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.answer).toBe(recovered.answer);
    expect(await quota(user.id)).toBe(1);
    expect(await messages(conversationId)).toBe(2);
    const { prisma: coldPrisma } = await import('../../src/config/database');
    await coldPrisma.$disconnect();
  });

  it('retention: an expired record frees the key (even for different content) and is purged', async () => {
    const { user, conversationId } = await makeUser('retention');
    const key = newKey();
    await sendCoachMessage(user.id, { conversationId, message: 'old content question' }, { idempotencyKey: key });
    await prisma.idempotencyRecord.updateMany({ where: { userId: user.id, key }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const reused = await sendCoachMessage(user.id, { conversationId, message: 'brand new content' }, { idempotencyKey: key });
    expect(reused.idempotentReplay).toBeUndefined();
    expect(await quota(user.id)).toBe(2);

    await prisma.idempotencyRecord.updateMany({ where: { userId: user.id, key }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect(await purgeExpiredIdempotencyRecords()).toBeGreaterThanOrEqual(1);
    expect(await prisma.idempotencyRecord.count({ where: { userId: user.id, key } })).toBe(0);
  });

  it('keys are scoped per user: user B never receives user A\'s result', async () => {
    const a = await makeUser('scope-a');
    const b = await makeUser('scope-b');
    const key = newKey();
    const message = 'identical text from two people';
    const resA = await sendCoachMessage(a.user.id, { conversationId: a.conversationId, message }, { idempotencyKey: key });
    const resB = await sendCoachMessage(b.user.id, { conversationId: b.conversationId, message }, { idempotencyKey: key });
    expect(resB.idempotentReplay).toBeUndefined();
    expect(resB.conversationId).toBe(b.conversationId);
    expect(resA.conversationId).toBe(a.conversationId);
    expect(await quota(a.user.id)).toBe(1);
    expect(await quota(b.user.id)).toBe(1);
  });

  it('HTTP: header is honoured, replay is flagged, invalid key is 400', async () => {
    const email = `${tag}-http@example.test`;
    const reg = await request(app).post('/api/auth/register').send({ email, password: `pw-${randomUUID()}`, fullName: 'Http' });
    expect(reg.status).toBe(201);
    userIds.push(reg.body.user.id);
    const token = reg.body.accessToken as string;
    const key = newKey();
    const send = (k: string) =>
      request(app).post('/api/v1/coach/messages').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', k).send({ message: 'http level question' });
    const first = await send(key);
    expect(first.status).toBe(200);
    const second = await send(key);
    expect(second.status).toBe(200);
    expect(second.headers['idempotent-replayed']).toBe('true');
    expect(second.body.answer).toBe(first.body.answer);
    expect((await send('short')).status).toBe(400);
  });
});
