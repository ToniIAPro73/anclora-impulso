/**
 * Independent-review regressions R1 (orphan quota reservation) and R2 (atomic concurrency admission).
 * Real PostgreSQL, synthetic data. These were written BEFORE the fixes and failed against the reviewed code.
 */
import { randomUUID } from 'crypto';
import { prisma } from '../../src/config/database';
import { env } from '../../src/config/env';
import { sendCoachMessage, resetCoachRuntimeState } from '../../src/services/coach/coach.service';
import {
  deterministicCoachProvider, resetDeterministicCoachProviderCalls, getDeterministicCoachProviderCalls,
} from '../../src/services/coach/providers/deterministic.provider';
import { avoidWindowBoundary, drainGates, gatedCall, openGate, track, waitUntil } from '../support/sync';

const tag = `rev-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
const original = { ...env };
const key = () => `k-${randomUUID()}`;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function makeUser(label: string) {
  const user = await prisma.user.create({ data: { email: `${tag}-${label}@example.test`, fullName: label } });
  userIds.push(user.id);
  const conversation = await prisma.coachConversation.create({ data: { userId: user.id, title: 't' } });
  return { user, conversationId: conversation.id };
}
const counters = async (userId: string) => {
  const rows = await prisma.coachUsageWindow.findMany({ where: { userId } });
  return {
    requestCount: rows.reduce((n, r) => n + r.requestCount, 0),
    failedAttempts: rows.reduce((n, r) => n + r.failedAttempts, 0),
  };
};
const expireLock = (userId: string, k: string) =>
  prisma.idempotencyRecord.updateMany({ where: { userId, key: k }, data: { lockedUntil: new Date(Date.now() - 1000) } });
const hang = () => new Promise<never>(() => undefined); // a provider call that never returns (dead process)

beforeEach(async () => {
  await avoidWindowBoundary(60);
  Object.assign(env, original);
  env.llmCoachEnabled = true; env.llmProvider = 'deterministic'; env.llmCoachWindowLimit = 20;
  env.llmCoachCacheTtlSeconds = 0; env.llmCoachWindowMinutes = 60;
  env.llmCoachProviderTimeoutMs = 1500; // the "dead" owner's deadline fires late, as a reappearing stale attempt
  env.llmCoachMaxConcurrent = 2; env.llmCoachMaxFailedAttempts = 5; env.idempotencyMaxAttempts = 5;
  env.groqApiKey = '';
  resetCoachRuntimeState(); resetDeterministicCoachProviderCalls();
});
afterEach(async () => { await drainGates(); jest.restoreAllMocks(); });
afterAll(async () => {
  Object.assign(env, original);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('R1 — a crash after reserving must not leave quota consumed without a persisted answer', () => {
  it('limit 1: retry of the same key after the owner died is accepted and ends with exactly one unit', async () => {
    const { user, conversationId } = await makeUser('r1-limit1');
    env.llmCoachWindowLimit = 1;
    const k = key();
    const message = 'crash after reserving, limit one';

    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(hang as never);
    const deadOwner = track(sendCoachMessage(user.id, { conversationId, message }, { idempotencyKey: k }));
    deadOwner.catch(() => undefined);
    await waitUntil(async () => (await counters(user.id)).requestCount === 1); // reserved, provider "running"
    await expireLock(user.id, k); // the process is gone; its lock lapses

    const retry = await sendCoachMessage(user.id, { conversationId, message }, { idempotencyKey: k });
    expect(retry.idempotentReplay).toBeUndefined();
    expect((await counters(user.id)).requestCount).toBe(1); // one persisted answer == one unit
    expect(await prisma.coachMessage.count({ where: { conversationId } })).toBe(2);

    // the old attempt "reappears" (its deadline fires) and must not move any counter
    await expect(deadOwner).rejects.toBeTruthy();
    const after = await counters(user.id);
    expect(after.requestCount).toBe(1);
    expect((await prisma.idempotencyRecord.findFirstOrThrow({ where: { userId: user.id, key: k } })).status).toBe('completed');
  });

  it('limit 20: one answer accounts for ONE unit, not two', async () => {
    const { user, conversationId } = await makeUser('r1-limit20');
    const k = key();
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(hang as never);
    const deadOwner = track(sendCoachMessage(user.id, { conversationId, message: 'crash after reserving' }, { idempotencyKey: k }));
    deadOwner.catch(() => undefined);
    await waitUntil(async () => (await counters(user.id)).requestCount === 1);
    await expireLock(user.id, k);
    await sendCoachMessage(user.id, { conversationId, message: 'crash after reserving' }, { idempotencyKey: k });
    expect((await counters(user.id)).requestCount).toBe(1);
    await deadOwner.catch(() => undefined);
    expect((await counters(user.id)).requestCount).toBe(1);
  });

  it('an orphan reservation of a dead execution does not block the same user under another key', async () => {
    const { user, conversationId } = await makeUser('r1-other-key');
    env.llmCoachWindowLimit = 1;
    const k = key();
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(hang as never);
    const deadOwner = track(sendCoachMessage(user.id, { conversationId, message: 'first question' }, { idempotencyKey: k }));
    deadOwner.catch(() => undefined);
    await waitUntil(async () => (await counters(user.id)).requestCount === 1);
    await expireLock(user.id, k);

    const other = await sendCoachMessage(user.id, { conversationId, message: 'second question' }, { idempotencyKey: key() });
    expect(other.answer).toBeTruthy();
    await deadOwner.catch(() => undefined);
    expect((await counters(user.id)).requestCount).toBe(1);
  });

  it('an execution whose lock is still valid keeps its reservation (it is not reconciled away)', async () => {
    const { user, conversationId } = await makeUser('r1-live');
    env.llmCoachWindowLimit = 1;
    env.llmCoachProviderTimeoutMs = 25000;
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
    const gated = gatedCall(real);
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(gated.impl);
    const live = track(sendCoachMessage(user.id, { conversationId, message: 'live execution' }, { idempotencyKey: key() }));
    await gated.entered;
    await expect(
      sendCoachMessage(user.id, { conversationId, message: 'competitor' }, { idempotencyKey: key() }),
    ).rejects.toMatchObject({ statusCode: 429, details: { reason: 'quota_exhausted' } });
    expect((await counters(user.id)).requestCount).toBe(1);
    gated.release();
    await live;
    expect((await counters(user.id)).requestCount).toBe(1);
  });

  it('recovery after crossing the window boundary releases the OLD window and reserves in the new one', async () => {
    const { user, conversationId } = await makeUser('r1-boundary');
    const k = key();
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(hang as never);
    const deadOwner = track(sendCoachMessage(user.id, { conversationId, message: 'before the boundary' }, { idempotencyKey: k }));
    deadOwner.catch(() => undefined);
    await waitUntil(async () => (await counters(user.id)).requestCount === 1);
    // move the orphan reservation into an earlier window, as if the clock had crossed the boundary since
    const current = await prisma.coachUsageWindow.findFirstOrThrow({ where: { userId: user.id } });
    const earlier = await prisma.coachUsageWindow.create({
      data: { userId: user.id, windowStartsAt: new Date(current.windowStartsAt.getTime() - 3600_000), requestCount: 1, tokenEstimate: 10 },
    });
    await prisma.coachUsageWindow.update({ where: { id: current.id }, data: { requestCount: 0, tokenEstimate: 0 } });
    await prisma.idempotencyRecord.updateMany({ where: { userId: user.id, key: k }, data: { reservedWindowId: earlier.id, reservedTokens: 10 } });
    await expireLock(user.id, k);

    await sendCoachMessage(user.id, { conversationId, message: 'before the boundary' }, { idempotencyKey: k });
    const rows = await prisma.coachUsageWindow.findMany({ where: { userId: user.id }, orderBy: { windowStartsAt: 'asc' } });
    expect(rows.find((r) => r.id === earlier.id)?.requestCount).toBe(0); // old window released exactly once
    expect(rows.find((r) => r.id === current.id)?.requestCount).toBe(1); // new window holds the answer
    await deadOwner.catch(() => undefined);
    const final = await prisma.coachUsageWindow.findMany({ where: { userId: user.id } });
    expect(final.reduce((n, r) => n + r.requestCount, 0)).toBe(1);
  });
});

describe('R2 — concurrency admission is atomic and survives retries of old keys', () => {
  it('retrying an OLD failed key while two calls are active does not start a third provider call', async () => {
    const { user, conversationId } = await makeUser('r2-old-key');
    env.llmCoachMaxConcurrent = 2;
    env.llmCoachProviderTimeoutMs = 25000;
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);

    // S: created first and failed (oldest createdAt)
    const s = key();
    jest.spyOn(deterministicCoachProvider, 'complete').mockRejectedValueOnce(new Error('provider down'));
    await expect(sendCoachMessage(user.id, { conversationId, message: 'S old' }, { idempotencyKey: s })).rejects.toThrow('provider down');

    // A and B: admitted and held inside the provider
    const gateA = gatedCall(real); const gateB = gatedCall(real);
    const spy = jest.spyOn(deterministicCoachProvider, 'complete')
      .mockImplementationOnce(gateA.impl).mockImplementationOnce(gateB.impl);
    const a = track(sendCoachMessage(user.id, { conversationId, message: 'A held' }, { idempotencyKey: key() }));
    await gateA.entered;
    const b = track(sendCoachMessage(user.id, { conversationId, message: 'B held' }, { idempotencyKey: key() }));
    await gateB.entered;
    const callsBefore = spy.mock.calls.length; // A and B

    // retry S: must be refused, and no third call may reach the provider
    await expect(sendCoachMessage(user.id, { conversationId, message: 'S old' }, { idempotencyKey: s }))
      .rejects.toMatchObject({ statusCode: 429, details: { reason: 'concurrency_limit' } });
    expect(spy.mock.calls.length).toBe(callsBefore);
    expect(await prisma.idempotencyRecord.count({ where: { userId: user.id, status: 'in_progress' } })).toBe(2);

    gateA.release(); gateB.release();
    await Promise.all([a, b]);
    // once capacity is back, S can run
    await expect(sendCoachMessage(user.id, { conversationId, message: 'S old' }, { idempotencyKey: s })).resolves.toBeTruthy();
  });

  it('simultaneous start of many keys admits exactly the limit', async () => {
    const { user, conversationId } = await makeUser('r2-burst');
    env.llmCoachMaxConcurrent = 2;
    env.llmCoachProviderTimeoutMs = 25000;
    const release = openGate();
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementation(async (req) => { await release.promise; return real(req); });
    const runs = Array.from({ length: 8 }, (_, i) => track(
      sendCoachMessage(user.id, { conversationId, message: `burst ${i}` }, { idempotencyKey: key() }).then(
        () => 'ok', (e) => (e.details?.reason ?? `err${e.statusCode}`) as string)));
    await waitUntil(async () => (await prisma.idempotencyRecord.count({ where: { userId: user.id, status: 'in_progress' } })) === 2);
    await sleep(150); // let the rejected ones settle
    expect(await prisma.idempotencyRecord.count({ where: { userId: user.id, status: 'in_progress' } })).toBe(2);
    release.resolve();
    const results = await Promise.all(runs);
    expect(results.filter((r) => r === 'ok')).toHaveLength(2);
    expect(results.filter((r) => r === 'concurrency_limit')).toHaveLength(6);
    expect(getDeterministicCoachProviderCalls()).toBe(2);
  });

  it('permits of a dead execution expire with its lock and capacity returns', async () => {
    const { user, conversationId } = await makeUser('r2-expiry');
    env.llmCoachMaxConcurrent = 1;
    env.llmCoachProviderTimeoutMs = 1500;
    const k = key();
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(hang as never);
    const dead = track(sendCoachMessage(user.id, { conversationId, message: 'dies holding the permit' }, { idempotencyKey: k }));
    dead.catch(() => undefined);
    await waitUntil(async () => (await prisma.idempotencyRecord.count({ where: { userId: user.id, status: 'in_progress' } })) === 1);
    await expect(
      sendCoachMessage(user.id, { conversationId, message: 'blocked while it lives' }, { idempotencyKey: key() }),
    ).rejects.toMatchObject({ details: { reason: 'concurrency_limit' } });
    await expireLock(user.id, k);
    await expect(
      sendCoachMessage(user.id, { conversationId, message: 'allowed after expiry' }, { idempotencyKey: key() }),
    ).resolves.toBeTruthy();
    await dead.catch(() => undefined);
  });
});
