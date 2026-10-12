/**
 * AI-08 (D9): ownership/versioning of the lock, atomic completion, lost responses, crash windows,
 * generate idempotency, operational caps, reset communication, key enforcement and legacy transition.
 */
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/database';
import { env } from '../../src/config/env';
import { generateWorkoutIdempotent, normalizeGenerateParams } from '../../src/services/workouts.service';
import { sendCoachMessage, resetCoachRuntimeState, reconcileOrphanReservations, COACH_MESSAGE_OPERATION } from '../../src/services/coach/coach.service';
import { deterministicCoachProvider, resetDeterministicCoachProviderCalls, getDeterministicCoachProviderCalls } from '../../src/services/coach/providers/deterministic.provider';
import { beginIdempotent, completeIdempotent, hashRequest } from '../../src/services/idempotency.service';
import { avoidWindowBoundary, drainGates, gatedCall, openGate, track, waitUntil } from '../support/sync';

const generateJSON = jest.fn();
jest.mock('../../src/services/llm', () => ({
  generateJSON: (...args: unknown[]) => generateJSON(...args),
  SYSTEM_PROMPT_ES: 'system',
}));

const tag = `inc03-${randomUUID().slice(0, 8)}`;
const MUSCLE = `${tag}-m`;
const EQUIPMENT = `${tag}-e`;
const userIds: string[] = [];
let exerciseIds: string[] = [];
const original = { ...env };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const key = () => `k-${randomUUID()}`;

async function makeUser(label: string) {
  const user = await prisma.user.create({ data: { email: `${tag}-${label}@example.test`, fullName: label } });
  userIds.push(user.id);
  const conversation = await prisma.coachConversation.create({ data: { userId: user.id, title: 't' } });
  return { user, conversationId: conversation.id };
}
const usage = async (userId: string) => {
  const rows = await prisma.coachUsageWindow.findMany({ where: { userId } });
  return {
    requestCount: rows.reduce((n, r) => n + r.requestCount, 0),
    failedAttempts: rows.reduce((n, r) => n + r.failedAttempts, 0),
    providerCalls: rows.reduce((n, r) => n + r.providerCalls, 0),
  };
};
const params = { workoutType: 'strength', duration: 40, difficulty: 'beginner', trainingEnvironment: 'home', targetMuscles: [MUSCLE], equipment: [EQUIPMENT] } as const;

beforeAll(async () => {
  const rows = await Promise.all(Array.from({ length: 6 }, (_, i) =>
    prisma.exercise.create({ data: { name: `${tag}-x${i}`, category: 'c', muscleGroup: MUSCLE, equipment: EQUIPMENT, trainingEnvironments: ['home'], difficulty: 'beginner', description: 'd', instructions: ['i'] } })));
  exerciseIds = rows.map((r) => r.id);
});

beforeEach(async () => {
  await avoidWindowBoundary(60);
  env.llmCoachEnabled = true; env.llmProvider = 'deterministic'; env.llmCoachWindowLimit = 50;
  env.llmCoachCacheTtlSeconds = 0; env.llmCoachWindowMinutes = 60; env.llmCoachProviderTimeoutMs = 25000;
  env.llmCoachMaxConcurrent = 2; env.llmCoachMaxFailedAttempts = 5; env.idempotencyMaxAttempts = 3;
  env.groqApiKey = ''; env.idempotencyKeyEnforcement = 'warn'; env.idempotencyLegacySunsetAt = '';
  resetCoachRuntimeState(); resetDeterministicCoachProviderCalls();
});
afterEach(async () => { await drainGates(); jest.restoreAllMocks(); });
afterAll(async () => {
  Object.assign(env, original);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.exercise.deleteMany({ where: { id: { in: exerciseIds } } });
  await prisma.$disconnect();
});

describe('lock ownership (stale owner cannot complete or release)', () => {
  it('lock expires while the original process is still running: the recovered owner wins, the stale one leaves no effects', async () => {
    const { user, conversationId } = await makeUser('zombie');
    const k = key();
    const message = 'question while the first process hangs';
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
    const gated = gatedCall(real);
    // Only the FIRST provider call (the original execution) is held; the recovered one runs the real provider.
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(gated.impl);

    const staleRun = track(sendCoachMessage(user.id, { conversationId, message }, { idempotencyKey: k }));
    await gated.entered; // the original is provably inside the provider call
    // Lock expires (as if the owner were presumed dead) while the original is still executing.
    await prisma.idempotencyRecord.updateMany({ where: { userId: user.id, key: k }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    const recovered = await sendCoachMessage(user.id, { conversationId, message }, { idempotencyKey: k });
    expect(recovered.idempotentReplay).toBeUndefined();

    gated.release(); // now the stale owner proceeds and must fail its owner-checked completion
    await expect(staleRun).rejects.toMatchObject({ statusCode: 409 });
    const record = await prisma.idempotencyRecord.findFirstOrThrow({ where: { userId: user.id, key: k } });
    expect(record.status).toBe('completed');
    expect(record.attempts).toBe(2);
    expect(await prisma.coachMessage.count({ where: { conversationId } })).toBe(2);
    expect((await usage(user.id)).requestCount).toBe(1);
    const replay = await sendCoachMessage(user.id, { conversationId, message }, { idempotencyKey: k });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.answer).toBe(recovered.answer);
  });

  it('completion is owner-checked at SQL level', async () => {
    const { user } = await makeUser('token');
    const hash = hashRequest({ a: 1 });
    const gate = await beginIdempotent({ userId: user.id, operation: 'x.op', key: key(), requestHash: hash, lockSeconds: 30, retentionSeconds: 3600 });
    if (gate.kind !== 'owner') throw new Error('expected owner');
    expect(await completeIdempotent(prisma, gate.recordId, 'someone-else', 200, {})).toBe(false);
    expect(await completeIdempotent(prisma, gate.recordId, gate.ownerToken, 200, { ok: true })).toBe(true);
    expect(await completeIdempotent(prisma, gate.recordId, gate.ownerToken, 200, { ok: 'again' })).toBe(false); // already completed
  });
});

describe('exactly-once effects around crashes and lost responses', () => {
  it('persist + completion are one transaction: losing ownership after the inserts rolls the exchange back', async () => {
    const { user, conversationId } = await makeUser('atomic');
    const k = key();
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
    // While the provider call runs, another process takes the record over (token changes in the database).
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(async (req) => {
      await prisma.idempotencyRecord.updateMany({ where: { userId: user.id, key: k }, data: { ownerToken: 'hijacked-by-other-process' } });
      return real(req);
    });
    await expect(sendCoachMessage(user.id, { conversationId, message: 'atomicity probe' }, { idempotencyKey: k }))
      .rejects.toMatchObject({ statusCode: 409 });
    // both messages and the conversation touch were inserted inside the transaction and rolled back
    expect(await prisma.coachMessage.count({ where: { conversationId } })).toBe(0);
    // R1: the stale owner does NOT release a reservation on a record that now belongs to someone else...
    expect((await usage(user.id)).requestCount).toBe(1);
    const record = await prisma.idempotencyRecord.findFirstOrThrow({ where: { userId: user.id, key: k } });
    expect(record.ownerToken).toBe('hijacked-by-other-process'); // stale owner could not touch the record
    expect(record.status).toBe('in_progress');
    expect(record.reservedWindowId).not.toBeNull();
    // ...it is recovered exactly once when that execution's lock expires without completing.
    await prisma.idempotencyRecord.update({ where: { id: record.id }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    expect(await reconcileOrphanReservations(user.id)).toBe(1);
    expect(await reconcileOrphanReservations(user.id)).toBe(0);
    expect((await usage(user.id)).requestCount).toBe(0);
  });

  it('response lost after persisting: the retry replays, with no second provider call, message or slot', async () => {
    const { user, conversationId } = await makeUser('lost');
    const k = key();
    const first = await sendCoachMessage(user.id, { conversationId, message: 'the answer never reaches the client' }, { idempotencyKey: k });
    // (client never saw `first`) -> retry with the same key
    const retry = await sendCoachMessage(user.id, { conversationId, message: 'the answer never reaches the client' }, { idempotencyKey: k });
    expect(retry.idempotentReplay).toBe(true);
    expect(retry.answer).toBe(first.answer);
    expect(getDeterministicCoachProviderCalls()).toBe(1);
    expect((await usage(user.id)).requestCount).toBe(1);
    expect(await prisma.coachMessage.count({ where: { conversationId } })).toBe(2);
  });

  it('routine generation: double tap, network retry and lost response create exactly one routine', async () => {
    const { user } = await makeUser('gen-once');
    const k = key();
    const results = await Promise.allSettled(Array.from({ length: 5 }, () => generateWorkoutIdempotent(user.id, params as any, k)));
    const fulfilled = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');
    expect(fulfilled.filter((r) => !r.value.replayed)).toHaveLength(1);
    expect(results.filter((r) => r.status === 'rejected').every((r) => (r as PromiseRejectedResult).reason.statusCode === 409)).toBe(true);
    const retry = await generateWorkoutIdempotent(user.id, params as any, k);
    expect(retry.replayed).toBe(true);
    expect(await prisma.workout.count({ where: { userId: user.id } })).toBe(1);
    expect((retry.workout as any).id).toBe((fulfilled.find((r) => !r.value.replayed) as any).value.workout.id);
  });

  it('routine generation: same key + different content is 422 and creates nothing; a new key creates a new routine', async () => {
    const { user } = await makeUser('gen-conflict');
    const k = key();
    await generateWorkoutIdempotent(user.id, params as any, k);
    await expect(generateWorkoutIdempotent(user.id, { ...params, duration: 60 } as any, k)).rejects.toMatchObject({ statusCode: 422 });
    expect(await prisma.workout.count({ where: { userId: user.id } })).toBe(1);
    await generateWorkoutIdempotent(user.id, params as any, key());
    expect(await prisma.workout.count({ where: { userId: user.id } })).toBe(2);
  });

  it('routine generation: content normalization makes list order irrelevant', () => {
    const a = hashRequest(normalizeGenerateParams({ ...params, targetMuscles: ['b', 'a'], equipment: ['y', 'x'] } as any));
    const b = hashRequest(normalizeGenerateParams({ ...params, targetMuscles: ['a', 'b'], equipment: ['x', 'y'] } as any));
    expect(a).toBe(b);
  });

  it('routine generation: a stale owner whose lock expired creates no second routine', async () => {
    const { user } = await makeUser('gen-zombie');
    const k = key();
    env.groqApiKey = 'local-placeholder';
    env.llmWorkoutTimeoutMs = 60_000; // the original stays inside the LLM call until released
    const hold = gatedCall(async () => ({ name: 'late', exercises: [] }));
    generateJSON.mockImplementationOnce(hold.impl);
    const staleRun = track(generateWorkoutIdempotent(user.id, params as any, k));
    await hold.entered;
    await prisma.idempotencyRecord.updateMany({ where: { userId: user.id, key: k }, data: { lockedUntil: new Date(Date.now() - 1000) } });
    env.groqApiKey = ''; // recovered execution goes straight to the deterministic fallback
    const recovered = await generateWorkoutIdempotent(user.id, params as any, k);
    expect(recovered.replayed).toBe(false);
    hold.release(); // the stale owner now finishes its (invalid) AI answer -> fallback -> owner-checked commit fails
    await expect(staleRun).rejects.toMatchObject({ statusCode: 409 });
    expect(await prisma.workout.count({ where: { userId: user.id } })).toBe(1);
    env.llmWorkoutTimeoutMs = original.llmWorkoutTimeoutMs;
  });
});

describe('failure classification and operational protection', () => {
  it('timeout is an UNKNOWN outcome (not "not executed"): flagged, counted as failed attempt, retry allowed', async () => {
    const { user, conversationId } = await makeUser('unknown');
    const k = key();
    env.llmCoachProviderTimeoutMs = 50;
    let sawSignal: AbortSignal | undefined;
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
    // A cancellable provider: on abort the call stops and never completes later (no orphan side effects in the test).
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(async (req) => {
      sawSignal = req.signal;
      await new Promise<void>((resolve) => {
        const timer = setTimeout(resolve, 400);
        req.signal?.addEventListener('abort', () => { clearTimeout(timer); resolve(); });
      });
      if (req.signal?.aborted) throw new Error('aborted by caller');
      return real(req);
    });
    await expect(sendCoachMessage(user.id, { conversationId, message: 'will time out' }, { idempotencyKey: k }))
      .rejects.toMatchObject({ statusCode: 504, details: { outcome: 'unknown_result' } });
    expect(sawSignal?.aborted).toBe(true); // cancellation was requested...
    const counters = await usage(user.id);
    expect(counters.requestCount).toBe(0); // reservation released
    expect(counters.failedAttempts).toBe(1); // ...but the attempt still counts against the operational cap
    expect(counters.providerCalls).toBe(1);
    const record = await prisma.idempotencyRecord.findFirstOrThrow({ where: { userId: user.id, key: k } });
    expect(record.errorCode).toBe('provider_timeout_unknown_result');
    env.llmCoachProviderTimeoutMs = 25000;
    await expect(sendCoachMessage(user.id, { conversationId, message: 'will time out' }, { idempotencyKey: k })).resolves.toBeTruthy();
  });

  it('retries of one key are bounded (max attempts) so failures cannot be replayed without limit', async () => {
    const { user, conversationId } = await makeUser('attempts');
    const k = key();
    jest.spyOn(deterministicCoachProvider, 'complete').mockRejectedValue(new Error('provider down'));
    for (let i = 0; i < env.idempotencyMaxAttempts; i += 1) {
      await expect(sendCoachMessage(user.id, { conversationId, message: 'always fails' }, { idempotencyKey: k })).rejects.toThrow('provider down');
    }
    await expect(sendCoachMessage(user.id, { conversationId, message: 'always fails' }, { idempotencyKey: k }))
      .rejects.toMatchObject({ statusCode: 429, details: { reason: 'idempotency_attempts_exhausted' } });
    expect((await usage(user.id)).providerCalls).toBe(env.idempotencyMaxAttempts);
  });

  it('failed attempts per window are capped across keys; the commercial quota stays untouched', async () => {
    const { user, conversationId } = await makeUser('failcap');
    env.llmCoachMaxFailedAttempts = 3;
    jest.spyOn(deterministicCoachProvider, 'complete').mockRejectedValue(new Error('provider down'));
    for (let i = 0; i < 3; i += 1) {
      await expect(sendCoachMessage(user.id, { conversationId, message: `fails ${i}` }, { idempotencyKey: key() })).rejects.toThrow('provider down');
    }
    const calls = (await usage(user.id)).providerCalls;
    await expect(sendCoachMessage(user.id, { conversationId, message: 'blocked now' }, { idempotencyKey: key() }))
      .rejects.toMatchObject({ statusCode: 429, details: { reason: 'operational_failure_cap' } });
    expect((await usage(user.id)).providerCalls).toBe(calls); // no provider call was made
    expect((await usage(user.id)).requestCount).toBe(0);
  });

  it('concurrency cap: requests beyond the in-flight limit are rejected before any provider call', async () => {
    const { user, conversationId } = await makeUser('concurrency');
    env.llmCoachMaxConcurrent = 2;
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
    // Latch: providers stay "in flight" until every request has passed the concurrency gate, so the
    // outcome does not depend on scheduler timing.
    const latch = openGate(); // also opened by afterEach if an assertion below fails
    const release = () => latch.resolve();
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementation(async (req) => { await latch.promise; return real(req); });
    let rejectedNow = 0;
    const pending = Array.from({ length: 6 }, (_, i) => track(
      sendCoachMessage(user.id, { conversationId, message: `parallel ${i}` }, { idempotencyKey: key() })
        .catch((error) => { rejectedNow += 1; throw error; })));
    // admission is atomic: exactly 2 hold a permit, the other 4 are refused without creating a record
    await waitUntil(async () => {
      const inFlight = await prisma.idempotencyRecord.count({ where: { userId: user.id, status: 'in_progress' } });
      return inFlight === 2 && rejectedNow === 4;
    });
    release();
    const results = await Promise.allSettled(pending);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    const limited = results.filter((r) => r.status === 'rejected' && (r as PromiseRejectedResult).reason.details?.reason === 'concurrency_limit').length;
    // deterministic admission: exactly the two earliest of six simultaneous requests run
    expect(ok).toBe(2);
    expect(limited).toBe(4);
    expect(getDeterministicCoachProviderCalls()).toBe(2);
    expect((await usage(user.id)).requestCount).toBe(ok);
  });

  it('quota response states the exact reset instant (fixed 60-minute window) and Retry-After', async () => {
    const reg = await request(app).post('/api/auth/register').send({ email: `${tag}-reset@example.test`, password: `pw-${randomUUID()}`, fullName: 'Reset' });
    userIds.push(reg.body.user.id);
    env.llmCoachWindowLimit = 1;
    const send = (message: string) => request(app).post('/api/v1/coach/messages')
      .set('Authorization', `Bearer ${reg.body.accessToken}`).set('Idempotency-Key', key()).send({ message });
    const first = await send('first question of window');
    expect(first.status).toBe(200);
    const resetsAt = new Date(first.body.usage.windowResetsAt).getTime();
    expect(resetsAt % (60 * 60 * 1000)).toBe(0);
    expect(resetsAt).toBeGreaterThan(Date.now());
    const second = await send('second question of window');
    expect(second.status).toBe(429);
    expect(second.body.windowResetsAt).toBe(first.body.usage.windowResetsAt);
    expect(Number(second.headers['retry-after'])).toBeGreaterThan(0);
    expect(second.body.reason).toBe('quota_exhausted');
  });
});

describe('Idempotency-Key enforcement and transition of previous clients', () => {
  async function client(label: string) {
    const reg = await request(app).post('/api/auth/register').send({ email: `${tag}-${label}@example.test`, password: `pw-${randomUUID()}`, fullName: label });
    userIds.push(reg.body.user.id);
    return reg.body.accessToken as string;
  }

  it('transition (warn): no header -> server-derived key, deprecation signalled, double tap still deduped', async () => {
    const token = await client('legacy');
    const send = () => request(app).post('/api/workouts/generate').set('Authorization', `Bearer ${token}`).send(params);
    const a = await send();
    const b = await send();
    expect(a.status).toBe(201);
    expect(a.headers['deprecation']).toBe('true');
    expect(b.status).toBe(200);
    expect(b.headers['idempotent-replayed']).toBe('true');
    expect(b.body.id).toBe(a.body.id);
  });

  it('enforcement (require) and sunset date: no header -> 428; updated clients keep working', async () => {
    const token = await client('enforced');
    env.idempotencyKeyEnforcement = 'require';
    const without = await request(app).post('/api/workouts/generate').set('Authorization', `Bearer ${token}`).send(params);
    expect(without.status).toBe(428);
    const withKey = await request(app).post('/api/workouts/generate').set('Authorization', `Bearer ${token}`).set('Idempotency-Key', key()).send(params);
    expect(withKey.status).toBe(201);
    expect(withKey.body.generation.mode).toBe('fallback');

    env.idempotencyKeyEnforcement = 'warn';
    env.idempotencyLegacySunsetAt = new Date(Date.now() - 1000).toISOString(); // sunset reached
    const afterSunset = await request(app).post('/api/v1/coach/messages').set('Authorization', `Bearer ${token}`).send({ message: 'no key after sunset' });
    expect(afterSunset.status).toBe(428);
  });

  it('coach operation name is stable (part of the persisted scope)', () => {
    expect(COACH_MESSAGE_OPERATION).toBe('coach.message');
  });
});
