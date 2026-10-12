const prismaMock = {
  coachConversation: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  coachMessage: { findMany: jest.fn(), create: jest.fn() },
  coachUsageWindow: { createMany: jest.fn(), updateMany: jest.fn(), findUniqueOrThrow: jest.fn(), update: jest.fn() },
  idempotencyRecord: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn(), updateMany: jest.fn() },
  $transaction: jest.fn(),
};
jest.mock('../../src/config/database', () => ({ prisma: prismaMock }));
jest.mock('../../src/config/env', () => ({
  env: {
    llmCoachEnabled: true, llmCoachWindowLimit: 2, llmCoachWindowMinutes: 60, llmCoachMaxFailedAttempts: 5,
    llmCoachMaxPromptChars: 6000, llmCoachMemoryMessages: 8, llmCoachCacheTtlSeconds: 0, llmCoachMaxOutputTokens: 450,
    llmCoachProviderTimeoutMs: 1000,
  },
}));
jest.mock('../../src/services/coach/context', () => ({ buildCoachContext: jest.fn().mockResolvedValue('ctx') }));

import { sendCoachMessage } from '../../src/services/coach/coach.service';

const medical = { message: 'I have pain in my knee' }; // guardrail path: no provider call

beforeEach(() => {
  jest.clearAllMocks();
  prismaMock.coachConversation.findFirst.mockResolvedValue({ id: 'c1', userId: 'u1' });
  prismaMock.coachMessage.findMany.mockResolvedValue([]);
  prismaMock.$transaction.mockImplementation(async (fn: any) =>
    fn({
      coachMessage: { create: jest.fn() },
      coachConversation: { update: jest.fn() },
      coachUsageWindow: prismaMock.coachUsageWindow,
      idempotencyRecord: prismaMock.idempotencyRecord,
    }),
  );
  prismaMock.idempotencyRecord.findMany.mockResolvedValue([]);
  prismaMock.coachUsageWindow.createMany.mockResolvedValue({ count: 0 });
});

describe('coach quota reservation (D9)', () => {
  it('reserves with a conditional update whose predicate carries both the quota and the failure cap', async () => {
    prismaMock.coachUsageWindow.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.coachUsageWindow.findUniqueOrThrow.mockResolvedValueOnce({ id: 'win1' }).mockResolvedValueOnce({ requestCount: 1 });
    const result = await sendCoachMessage('u1', medical);
    const call = prismaMock.coachUsageWindow.updateMany.mock.calls[0][0];
    expect(call.where).toEqual({ id: 'win1', requestCount: { lt: 2 }, failedAttempts: { lt: 5 } });
    expect(result.usage.remainingWindowRequests).toBe(1);
    expect(new Date(result.usage.windowResetsAt).getTime() % (60 * 60 * 1000)).toBe(0); // fixed 60-minute boundary
  });

  it('429 carries the exact reset instant and releases nothing it did not reserve', async () => {
    prismaMock.coachUsageWindow.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.coachUsageWindow.findUniqueOrThrow.mockResolvedValueOnce({ id: 'win1' }).mockResolvedValueOnce({ failedAttempts: 0 });
    await expect(sendCoachMessage('u1', medical)).rejects.toMatchObject({
      statusCode: 429,
      details: { reason: 'quota_exhausted', windowResetsAt: expect.any(String), retryAfterSeconds: expect.any(Number) },
    });
    // only the (failed) claim ran: nothing was decremented
    expect(prismaMock.coachUsageWindow.updateMany).toHaveBeenCalledTimes(1);
    expect(prismaMock.coachUsageWindow.updateMany.mock.calls[0][0].data.requestCount).toEqual({ increment: 1 });
  });

  it('distinguishes the operational failure cap from the commercial quota', async () => {
    prismaMock.coachUsageWindow.updateMany.mockResolvedValue({ count: 0 });
    prismaMock.coachUsageWindow.findUniqueOrThrow.mockResolvedValueOnce({ id: 'win1' }).mockResolvedValueOnce({ failedAttempts: 5 });
    await expect(sendCoachMessage('u1', medical)).rejects.toMatchObject({ details: { reason: 'operational_failure_cap' } });
  });

  it('releases the reservation when persistence fails', async () => {
    prismaMock.coachUsageWindow.updateMany.mockResolvedValue({ count: 1 });
    prismaMock.coachUsageWindow.findUniqueOrThrow.mockResolvedValueOnce({ id: 'win1' }).mockResolvedValueOnce({ requestCount: 1 });
    const passthrough = prismaMock.$transaction.getMockImplementation()!;
    prismaMock.$transaction
      .mockImplementationOnce(passthrough) // the claim
      .mockRejectedValueOnce(new Error('db down')); // persistence
    await expect(sendCoachMessage('u1', medical)).rejects.toThrow('db down');
    const release = prismaMock.coachUsageWindow.updateMany.mock.calls[1][0];
    expect(release.data.requestCount).toEqual({ decrement: 1 });
  });
});
