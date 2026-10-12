/**
 * Independent-review R7: a recoverable lock was read, the owner COMPLETED and committed its effect, and the
 * waiting taker then reopened the completed record (second effect / second consumption).
 * Deterministic interleaving through the `onAfterRead` seam; real PostgreSQL; synthetic data.
 */
import { randomUUID } from 'crypto';
import { prisma } from '../../src/config/database';
import { env } from '../../src/config/env';
import * as idempotency from '../../src/services/idempotency.service';
import { beginIdempotent, completeIdempotent, hashRequest } from '../../src/services/idempotency.service';
import {
  sendCoachMessage, resetCoachRuntimeState, reconcileOrphanReservations,
} from '../../src/services/coach/coach.service';
import {
  deterministicCoachProvider, resetDeterministicCoachProviderCalls, getDeterministicCoachProviderCalls,
} from '../../src/services/coach/providers/deterministic.provider';
import { avoidWindowBoundary, gatedCall, waitUntil, withGatesReleased, drainGates, track } from '../support/sync';

const tag = `r7-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
const original = { ...env };
const key = () => `k-${randomUUID()}`;

async function makeUser(label: string) {
  const user = await prisma.user.create({ data: { email: `${tag}-${label}@example.test`, fullName: label } });
  userIds.push(user.id);
  const conversation = await prisma.coachConversation.create({ data: { userId: user.id, title: 't' } });
  return { user, conversationId: conversation.id };
}
const usage = async (userId: string) => {
  const rows = await prisma.coachUsageWindow.findMany({ where: { userId } });
  return { requestCount: rows.reduce((n, r) => n + r.requestCount, 0), failedAttempts: rows.reduce((n, r) => n + r.failedAttempts, 0) };
};
const expireLock = (userId: string, k: string) =>
  prisma.idempotencyRecord.updateMany({ where: { userId, key: k }, data: { lockedUntil: new Date(Date.now() - 1000) } });

beforeEach(async () => {
  await avoidWindowBoundary(60);
  Object.assign(env, original);
  env.llmCoachEnabled = true; env.llmProvider = 'deterministic'; env.llmCoachWindowLimit = 20;
  env.llmCoachCacheTtlSeconds = 0; env.llmCoachWindowMinutes = 60; env.llmCoachProviderTimeoutMs = 20000;
  env.llmCoachMaxConcurrent = 5; env.llmCoachMaxFailedAttempts = 20; env.idempotencyMaxAttempts = 5;
  env.groqApiKey = '';
  resetCoachRuntimeState(); resetDeterministicCoachProviderCalls();
});
afterEach(async () => { await drainGates(); jest.restoreAllMocks(); });
afterAll(async () => {
  Object.assign(env, original);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('R7 — a completed operation is never reopened by a taker that read it as recoverable', () => {
  it('B reads a recoverable lock; A completes and commits; B takeover resolves to replay (record untouched)', async () => {
    const { user } = await makeUser('direct');
    const base = { userId: user.id, operation: 'r7.direct', key: key(), requestHash: hashRequest({ a: 1 }), lockSeconds: 30, retentionSeconds: 3600 };
    const a = await beginIdempotent(base);
    if (a.kind !== 'owner') throw new Error('expected owner');
    await expireLock(user.id, base.key); // A's lock is recoverable as far as B can tell

    let completedByA = false;
    const b = await beginIdempotent({
      ...base,
      onAfterRead: async (snapshot) => {
        // B has READ status in_progress + expired lock and decided to take over. Now A finishes and commits.
        expect(snapshot.status).toBe('in_progress');
        completedByA = await completeIdempotent(prisma, a.recordId, a.ownerToken, 200, { effect: 'A' }, 3600);
      },
    });

    expect(completedByA).toBe(true);
    expect(b).toMatchObject({ kind: 'replay', statusCode: 200, response: { effect: 'A' } });
    const record = await prisma.idempotencyRecord.findFirstOrThrow({ where: { userId: user.id, key: base.key } });
    expect(record.status).toBe('completed');
    expect(record.ownerToken).toBe(a.ownerToken); // never handed to B
    expect(record.attempts).toBe(1);
  });

  it('coach: slow owner completes while a retry is mid-takeover -> one effect, one unit, retry replays', async () => {
    const { user, conversationId } = await makeUser('coach');
    const k = key();
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
    const gated = gatedCall(real);
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(gated.impl);

    const slow = track(sendCoachMessage(user.id, { conversationId, message: 'slow owner' }, { idempotencyKey: k }));
    slow.catch(() => undefined);
    let retry: Promise<unknown> = Promise.resolve();
    await withGatesReleased([gated.release], () => [slow, retry], async () => {
      await gated.entered;
      await expireLock(user.id, k);

      // Wrap the real implementation (obtained before spying) so the takeover decision is interleaved.
      const realBegin = jest.requireActual<typeof idempotency>('../../src/services/idempotency.service').beginIdempotent;
      jest.spyOn(idempotency, 'beginIdempotent').mockImplementationOnce((options) =>
        realBegin({
          ...options,
          onAfterRead: async () => {
            gated.release(); // A resumes: provider answers, exchange + completion commit in ONE transaction
            await slow;
          },
        }),
      );

      retry = sendCoachMessage(user.id, { conversationId, message: 'slow owner' }, { idempotencyKey: k });
      const [first, second] = await Promise.all([slow, retry]) as Array<{ answer: string; idempotentReplay?: boolean }>;
      expect(second.idempotentReplay).toBe(true);
      expect(second.answer).toBe(first.answer);
      expect(getDeterministicCoachProviderCalls()).toBe(1);
      expect(await prisma.coachMessage.count({ where: { conversationId } })).toBe(2);
      expect((await usage(user.id)).requestCount).toBe(1);
      const record = await prisma.idempotencyRecord.findFirstOrThrow({ where: { userId: user.id, key: k } });
      expect(record.status).toBe('completed');
      expect(record.attempts).toBe(1);
    });
  });

  it('reconciliation fences a slow owner: its late completion cannot consume a unit that was already released', async () => {
    const { user, conversationId } = await makeUser('fence');
    const k = key();
    const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
    const gated = gatedCall(real);
    jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(gated.impl);

    const slow = track(sendCoachMessage(user.id, { conversationId, message: 'fenced owner' }, { idempotencyKey: k }));
    slow.catch(() => undefined);
    await withGatesReleased([gated.release], () => [slow], async () => {
      await gated.entered;
      expect((await usage(user.id)).requestCount).toBe(1);
      await expireLock(user.id, k);
      expect(await reconcileOrphanReservations(user.id)).toBe(1); // released (and the owner fenced)
      expect((await usage(user.id)).requestCount).toBe(0);

      gated.release();
      await expect(slow).rejects.toMatchObject({ statusCode: 409 }); // ownership lost: effect rolled back
      expect(await prisma.coachMessage.count({ where: { conversationId } })).toBe(0);
      expect((await usage(user.id)).requestCount).toBe(0); // no unreserved consumption, no double release
      expect(await reconcileOrphanReservations(user.id)).toBe(0);
    });
  });

  it('reserve / complete / reconcile interleavings on one record neither deadlock nor leave the counter wrong', async () => {
    const { user, conversationId } = await makeUser('locks');
    for (let round = 0; round < 6; round += 1) {
      const k = key();
      const message = `contended ${round}`;
      const real = deterministicCoachProvider.complete.bind(deterministicCoachProvider);
      const gated = gatedCall(real);
      jest.spyOn(deterministicCoachProvider, 'complete').mockImplementationOnce(gated.impl);
      const dead = track(sendCoachMessage(user.id, { conversationId, message }, { idempotencyKey: k }));
      dead.catch(() => undefined);
      await gated.entered;
      await expireLock(user.id, k);

      const attempts = await Promise.allSettled([
        sendCoachMessage(user.id, { conversationId, message }, { idempotencyKey: k }),
        reconcileOrphanReservations(user.id),
        reconcileOrphanReservations(user.id),
        sendCoachMessage(user.id, { conversationId, message }, { idempotencyKey: k }),
      ]);
      gated.release();
      await Promise.allSettled([dead]);
      jest.restoreAllMocks();

      const deadlocks = attempts.filter((r) => r.status === 'rejected' && /deadlock|40P01/i.test(String((r as PromiseRejectedResult).reason)));
      expect(deadlocks).toHaveLength(0);
      const record = await prisma.idempotencyRecord.findFirstOrThrow({ where: { userId: user.id, key: k } });
      const completed = record.status === 'completed';
      // never more than one persisted exchange per key; reservation marker consistent with the state
      const messages = await prisma.coachMessage.count({ where: { conversationId, content: message } });
      expect(messages).toBeLessThanOrEqual(1);
      if (completed) expect(record.reservedWindowId).toBeNull();
    }
    const total = await usage(user.id);
    const completedKeys = await prisma.idempotencyRecord.count({ where: { userId: user.id, status: 'completed' } });
    const stillReserved = await prisma.idempotencyRecord.count({ where: { userId: user.id, reservedWindowId: { not: null } } });
    expect(total.requestCount).toBe(completedKeys + stillReserved);
  });
});
