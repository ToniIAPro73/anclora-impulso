/**
 * Retention/purge (logical expiry vs physical deletion) and exact scope of every limit.
 * Isolated PostgreSQL, synthetic data.
 */
import { randomUUID } from 'crypto';
import { prisma } from '../../src/config/database';
import { env } from '../../src/config/env';
import { sendCoachMessage, resetCoachRuntimeState } from '../../src/services/coach/coach.service';
import { generateWorkoutIdempotent } from '../../src/services/workouts.service';
import { deterministicCoachProvider, resetDeterministicCoachProviderCalls, getDeterministicCoachProviderCalls } from '../../src/services/coach/providers/deterministic.provider';
import { beginIdempotent, completeIdempotent, hashRequest, purgeExpiredIdempotencyRecords } from '../../src/services/idempotency.service';
import { issueSession, purgeExpiredSessions } from '../../src/services/session.service';
import { avoidWindowBoundary, gatedCall, waitUntil, drainGates, track } from '../support/sync';

const tag = `inc04-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
const original = { ...env };
const key = () => `k-${randomUUID()}`;
const past = (ms = 5000) => new Date(Date.now() - ms);
const future = (ms = 600_000) => new Date(Date.now() + ms);

async function makeUser(label: string) {
  const user = await prisma.user.create({ data: { email: `${tag}-${label}@example.test`, fullName: label } });
  userIds.push(user.id);
  const conversation = await prisma.coachConversation.create({ data: { userId: user.id, title: 't' } });
  return { user, conversationId: conversation.id };
}

async function seedRecord(userId: string, data: Partial<{
  key: string; status: string; lockedUntil: Date; expiresAt: Date; operation: string; requestHash: string; ownerToken: string;
}> = {}) {
  return prisma.idempotencyRecord.create({
    data: {
      userId, operation: data.operation ?? 'coach.message', key: data.key ?? key(),
      requestHash: data.requestHash ?? hashRequest({ seeded: true }), status: data.status ?? 'completed',
      ownerToken: data.ownerToken ?? randomUUID(), lockedUntil: data.lockedUntil ?? past(),
      expiresAt: data.expiresAt ?? future(), response: { seeded: true }, statusCode: 200,
    },
  });
}

beforeEach(async () => {
  await avoidWindowBoundary(60);
  Object.assign(env, original);
  env.llmCoachEnabled = true; env.llmProvider = 'deterministic'; env.llmCoachWindowLimit = 50;
  env.llmCoachCacheTtlSeconds = 0; env.llmCoachWindowMinutes = 60; env.llmCoachProviderTimeoutMs = 25000;
  env.llmCoachMaxConcurrent = 2; env.llmCoachMaxFailedAttempts = 5; env.idempotencyMaxAttempts = 3;
  env.groqApiKey = ''; env.idempotencyKeyEnforcement = 'warn';
  resetCoachRuntimeState(); resetDeterministicCoachProviderCalls();
});
afterEach(async () => { await drainGates(); jest.restoreAllMocks(); });
afterAll(async () => {
  Object.assign(env, original);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('idempotency retention: logical expiry vs physical deletion', () => {
  it('never deletes an execution that is still held, even if its retention already elapsed', async () => {
    const { user } = await makeUser('active');
    const active = await seedRecord(user.id, { status: 'in_progress', lockedUntil: future(30_000), expiresAt: past(10_000) });
    const stale = await seedRecord(user.id, { status: 'in_progress', lockedUntil: past(1000), expiresAt: past(10_000) });
    const deleted = await purgeExpiredIdempotencyRecords(new Date(), { graceSeconds: 0 });
    expect(deleted).toBeGreaterThanOrEqual(1);
    expect(await prisma.idempotencyRecord.count({ where: { id: active.id } })).toBe(1);
    expect(await prisma.idempotencyRecord.count({ where: { id: stale.id } })).toBe(0);
  });

  it('does not touch records inside their replay guarantee: a retry after a purge still replays with no second effect', async () => {
    const { user, conversationId } = await makeUser('guarantee');
    const k = key();
    const first = await sendCoachMessage(user.id, { conversationId, message: 'guaranteed replay question' }, { idempotencyKey: k });
    await purgeExpiredIdempotencyRecords(new Date(), { graceSeconds: 0 });
    await purgeExpiredIdempotencyRecords(new Date(), { graceSeconds: 0 });
    const retry = await sendCoachMessage(user.id, { conversationId, message: 'guaranteed replay question' }, { idempotencyKey: k });
    expect(retry.idempotentReplay).toBe(true);
    expect(retry.answer).toBe(first.answer);
    expect(getDeterministicCoachProviderCalls()).toBe(1);
    expect(await prisma.coachMessage.count({ where: { conversationId } })).toBe(2);
  });

  it('logical expiry frees the key even while the row still exists (grace); physical deletion waits for the grace period', async () => {
    const { user, conversationId } = await makeUser('grace');
    const k = key();
    await sendCoachMessage(user.id, { conversationId, message: 'original content here' }, { idempotencyKey: k });
    await prisma.idempotencyRecord.updateMany({ where: { userId: user.id, key: k }, data: { expiresAt: past(60_000) } });

    // within grace: row kept...
    expect(await purgeExpiredIdempotencyRecords(new Date(), { graceSeconds: 3600 })).toBe(0);
    expect(await prisma.idempotencyRecord.count({ where: { userId: user.id, key: k } })).toBe(1);
    // ...but the guarantee has ended: the key is reusable (even with different content), executes anew
    const reused = await sendCoachMessage(user.id, { conversationId, message: 'new content after expiry' }, { idempotencyKey: k });
    expect(reused.idempotentReplay).toBeUndefined();
    // the new execution renewed the guarantee: a purge with zero grace must not remove it
    await purgeExpiredIdempotencyRecords(new Date(), { graceSeconds: 0 });
    expect(await prisma.idempotencyRecord.count({ where: { userId: user.id, key: k } })).toBe(1);
  });

  it('completion measures the replay guarantee from completion time, not from the first request', async () => {
    const { user } = await makeUser('renew');
    const k = key();
    const hash = hashRequest({ a: 1 });
    const gate = await beginIdempotent({ userId: user.id, operation: 'x.op', key: k, requestHash: hash, lockSeconds: 30, retentionSeconds: 5 });
    if (gate.kind !== 'owner') throw new Error('expected owner');
    expect(await completeIdempotent(prisma, gate.recordId, gate.ownerToken, 200, { ok: 1 }, 3600)).toBe(true);
    const row = await prisma.idempotencyRecord.findUniqueOrThrow({ where: { id: gate.recordId } });
    expect(row.expiresAt.getTime()).toBeGreaterThan(Date.now() + 3_000_000);
  });

  it('is safe under simultaneous and repeated purges, concurrently with live operations', async () => {
    const { user, conversationId } = await makeUser('concurrent-purge');
    const eligible = await Promise.all(Array.from({ length: 12 }, () => seedRecord(user.id, { expiresAt: past(10_000) })));
    const live = await Promise.all(Array.from({ length: 4 }, () => seedRecord(user.id, { expiresAt: future() })));

    const ops = Array.from({ length: 4 }, (_, i) =>
      sendCoachMessage(user.id, { conversationId, message: `live during purge ${i}` }, { idempotencyKey: key() }));
    const purges = Array.from({ length: 6 }, () => purgeExpiredIdempotencyRecords(new Date(), { graceSeconds: 0, batchSize: 3 }));
    const [counts] = await Promise.all([Promise.all(purges), Promise.allSettled(ops)]);

    // every eligible row removed exactly once across all purges; none of the live ones touched
    expect(counts.reduce((a, b) => a + b, 0)).toBe(eligible.length);
    expect(await prisma.idempotencyRecord.count({ where: { id: { in: eligible.map((r) => r.id) } } })).toBe(0);
    expect(await prisma.idempotencyRecord.count({ where: { id: { in: live.map((r) => r.id) } } })).toBe(live.length);
    // repeating is a no-op
    expect(await purgeExpiredIdempotencyRecords(new Date(), { graceSeconds: 0 })).toBe(0);
  });

  it('a purge running while an owner is mid-flight does not enable a duplicate effect', async () => {
    const { user, conversationId } = await makeUser('purge-midflight');
    const k = key();
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
    const gated = gatedCall(real);
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(gated.impl);
    const owner = track(sendCoachMessage(user.id, { conversationId, message: 'purge while in flight' }, { idempotencyKey: k }));
    await gated.entered;
    // even if its retention were already over, the held execution must survive the purge
    await prisma.idempotencyRecord.updateMany({ where: { userId: user.id, key: k }, data: { expiresAt: past(10_000) } });
    await purgeExpiredIdempotencyRecords(new Date(), { graceSeconds: 0 });
    expect(await prisma.idempotencyRecord.count({ where: { userId: user.id, key: k, status: 'in_progress' } })).toBe(1);
    // a second request with the same key must NOT take over the held execution
    await expect(
      sendCoachMessage(user.id, { conversationId, message: 'purge while in flight' }, { idempotencyKey: k }),
    ).rejects.toMatchObject({ statusCode: 409 });
    gated.release();
    await owner;
    expect(getDeterministicCoachProviderCalls()).toBe(1);
    expect(await prisma.coachMessage.count({ where: { conversationId } })).toBe(2);
  });
});

describe('session retention', () => {
  it('removes only expired sessions (tokens cascade); active and revoked-but-unexpired sessions stay', async () => {
    const { user } = await makeUser('sessions');
    const active = await issueSession({ id: user.id, email: user.email });
    const revoked = await issueSession({ id: user.id, email: user.email });
    await prisma.authSession.update({ where: { id: revoked.sessionId }, data: { revokedAt: new Date(), revokedReason: 'logout' } });
    const expired = await issueSession({ id: user.id, email: user.email });
    await prisma.authSession.update({ where: { id: expired.sessionId }, data: { expiresAt: past(10_000) } });

    const results = await Promise.all(Array.from({ length: 5 }, () => purgeExpiredSessions(new Date(), { graceSeconds: 0, batchSize: 1 })));
    expect(results.reduce((a, b) => a + b, 0)).toBe(1);
    expect(await prisma.authSession.count({ where: { id: { in: [active.sessionId, revoked.sessionId] } } })).toBe(2);
    expect(await prisma.authSession.count({ where: { id: expired.sessionId } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { sessionId: expired.sessionId } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { sessionId: active.sessionId } })).toBe(1);
  });

  it('respects the physical-deletion grace after logical expiry', async () => {
    const { user } = await makeUser('sessions-grace');
    const s = await issueSession({ id: user.id, email: user.email });
    await prisma.authSession.update({ where: { id: s.sessionId }, data: { expiresAt: past(60_000) } });
    expect(await purgeExpiredSessions(new Date(), { graceSeconds: 3600 })).toBe(0);
    expect(await prisma.authSession.count({ where: { id: s.sessionId } })).toBe(1);
    expect(await purgeExpiredSessions(new Date(), { graceSeconds: 0 })).toBe(1);
  });
});

describe('scope of each limit (changing the key never evades per-user protections)', () => {
  it('commercial window quota is per USER and window: distinct keys share it; another user is unaffected', async () => {
    const a = await makeUser('quota-a');
    const b = await makeUser('quota-b');
    env.llmCoachWindowLimit = 2;
    await sendCoachMessage(a.user.id, { conversationId: a.conversationId, message: 'quota question one' }, { idempotencyKey: key() });
    await sendCoachMessage(a.user.id, { conversationId: a.conversationId, message: 'quota question two' }, { idempotencyKey: key() });
    await expect(
      sendCoachMessage(a.user.id, { conversationId: a.conversationId, message: 'quota question three' }, { idempotencyKey: key() }),
    ).rejects.toMatchObject({ statusCode: 429, details: { reason: 'quota_exhausted' } });
    await expect(
      sendCoachMessage(b.user.id, { conversationId: b.conversationId, message: 'quota question one' }, { idempotencyKey: key() }),
    ).resolves.toBeTruthy();
  });

  it('attempts per key bound ONE key; a new key does not reset the per-user failed-attempt cap', async () => {
    const { user, conversationId } = await makeUser('attempts-scope');
    env.idempotencyMaxAttempts = 2;
    env.llmCoachMaxFailedAttempts = 3;
    jest.spyOn(deterministicCoachProvider, 'complete').mockRejectedValue(new Error('down'));
    const k1 = key();
    for (let i = 0; i < 2; i += 1) {
      await expect(sendCoachMessage(user.id, { conversationId, message: 'attempt scope' }, { idempotencyKey: k1 })).rejects.toThrow('down');
    }
    await expect(sendCoachMessage(user.id, { conversationId, message: 'attempt scope' }, { idempotencyKey: k1 }))
      .rejects.toMatchObject({ details: { reason: 'idempotency_attempts_exhausted' } });
    // a fresh key is allowed once more (per-key bound)...
    await expect(sendCoachMessage(user.id, { conversationId, message: 'attempt scope' }, { idempotencyKey: key() })).rejects.toThrow('down');
    // ...but the per-user failure cap (3 failures in this window) now blocks every key
    await expect(sendCoachMessage(user.id, { conversationId, message: 'attempt scope' }, { idempotencyKey: key() }))
      .rejects.toMatchObject({ details: { reason: 'operational_failure_cap' } });
  });

  it('concurrency is per USER and OPERATION: other keys count together; another user and another operation are independent', async () => {
    const a = await makeUser('conc-a');
    const b = await makeUser('conc-b');
    env.llmCoachMaxConcurrent = 1;
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
    const gated = gatedCall(real);
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(gated.impl);
    const inFlight = track(sendCoachMessage(a.user.id, { conversationId: a.conversationId, message: 'holds the only slot' }, { idempotencyKey: key() }));
    await gated.entered;

    // same user, different key, same operation: rejected
    await expect(
      sendCoachMessage(a.user.id, { conversationId: a.conversationId, message: 'second in flight' }, { idempotencyKey: key() }),
    ).rejects.toMatchObject({ details: { reason: 'concurrency_limit' } });
    // another user is independent
    await expect(
      sendCoachMessage(b.user.id, { conversationId: b.conversationId, message: 'other user' }, { idempotencyKey: key() }),
    ).resolves.toBeTruthy();
    // another operation (generate) for the same user is independent of the coach slot
    await prisma.exercise.create({
      data: { name: `${tag}-g`, category: 'c', muscleGroup: `${tag}-g`, equipment: `${tag}-g`, trainingEnvironments: ['home'], difficulty: 'beginner', description: 'd', instructions: ['i'] },
    });
    await expect(
      generateWorkoutIdempotent(a.user.id, { workoutType: 'strength', duration: 40, difficulty: 'beginner', trainingEnvironment: 'home', targetMuscles: [`${tag}-g`], equipment: [`${tag}-g`] } as any, key()),
    ).resolves.toBeTruthy();

    gated.release();
    await inFlight;
    await waitUntil(async () => (await prisma.idempotencyRecord.count({ where: { userId: a.user.id, operation: 'coach.message', status: 'in_progress' } })) === 0);
    await prisma.exercise.deleteMany({ where: { name: `${tag}-g` } });
  });
});
