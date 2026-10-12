import { randomUUID } from 'crypto';
import crypto from 'crypto';
import { env } from '../../config/env';
import { prisma } from '../../config/database';
import { AppError } from '../../middleware/errorHandler';
import { buildCoachContext } from './context';
import { evaluateCoachSafety } from './guardrails';
import { getCoachProvider } from './providers';
import type { CoachChatMessage, CoachResponse } from './types';
import { Prisma } from '@prisma/client';
import {
  IdempotencyOwnershipLostError,
  assertValidIdempotencyKey,
  beginIdempotent,
  completeIdempotent,
  failIdempotent,
  hashRequest,
} from '../idempotency.service';

export const COACH_MESSAGE_OPERATION = 'coach.message';

interface SendCoachMessageInput {
  conversationId?: string;
  message: string;
}

interface CacheEntry {
  expiresAt: number;
  response: CoachResponse;
}

const responseCache = new Map<string, CacheEntry>();

export function resetCoachRuntimeState() {
  responseCache.clear();
}

function estimateTokens(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

function getWindowStart(now: Date) {
  const windowMs = env.llmCoachWindowMinutes * 60 * 1000;
  return new Date(Math.floor(now.getTime() / windowMs) * windowMs);
}

function hashCacheKey(parts: string[]) {
  return crypto.createHash('sha256').update(parts.join('\n---\n')).digest('hex');
}

function trimPrompt(text: string) {
  if (text.length <= env.llmCoachMaxPromptChars) {
    return text;
  }

  return text.slice(0, env.llmCoachMaxPromptChars);
}

async function resolveConversation(userId: string, conversationId?: string) {
  if (conversationId) {
    const existing = await prisma.coachConversation.findFirst({
      where: {
        id: conversationId,
        userId,
      },
    });

    if (!existing) {
      throw new AppError(404, 'Coach conversation not found');
    }

    return existing;
  }

  const latest = await prisma.coachConversation.findFirst({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });

  if (latest) {
    return latest;
  }

  return prisma.coachConversation.create({
    data: {
      userId,
      title: 'Coach conversation',
    },
  });
}

async function loadBoundedMemory(conversationId: string): Promise<CoachChatMessage[]> {
  const messages = await prisma.coachMessage.findMany({
    where: { conversationId },
    orderBy: { createdAt: 'desc' },
    take: env.llmCoachMemoryMessages,
  });

  return messages
    .reverse()
    .map((message) => ({
      role: message.role === 'assistant' ? 'assistant' : 'user',
      content: message.content,
    }));
}


function getWindowEnd(windowStart: Date) {
  return new Date(windowStart.getTime() + env.llmCoachWindowMinutes * 60 * 1000);
}

interface UsageClaim {
  remaining: number;
  windowId: string;
  resetsAt: Date;
}

/** The idempotent operation that owns a reservation. Absent for callers without a ledger (legacy service calls). */
interface ReservationOwner {
  recordId: string;
  ownerToken: string;
}

interface ReleaseOptions {
  /** Only the current owner may release its own reservation (the row's owner AND the reservation's owner). */
  ownerToken?: string;
  /** Release only reservations that belong to a PREVIOUS owner of the operation (recovery of a dead attempt). */
  previousOwnerOf?: string;
  /** Release only when the owning execution's lock has expired (orphan reconciliation). */
  lockExpiredBefore?: Date;
  countAsFailure: boolean;
}

/**
 * Releases the quota unit reserved by an operation EXACTLY ONCE. The reservation is a persisted fact on the
 * idempotency record; clearing that fact and decrementing the window happen in one transaction, and the clearing
 * is a conditional UPDATE, so whichever caller (owner after a failure, recovered owner, reconciliation) clears
 * it first performs the decrement and every other caller finds nothing to release.
 */
async function releaseRecordReservation(recordId: string, options: ReleaseOptions): Promise<boolean> {
  // Snapshot WITHOUT locks, only to learn which window to lock first. Every decision is re-checked by the
  // conditional UPDATE below, so a stale snapshot can only make us do nothing, never the wrong thing.
  const snapshot = await prisma.idempotencyRecord.findFirst({
    where: { id: recordId, reservedWindowId: { not: null } },
    select: { reservedWindowId: true, reservedOwnerToken: true, reservedTokens: true, ownerToken: true, status: true, lockedUntil: true },
  });
  if (!snapshot || !snapshot.reservedWindowId) return false;

  if (options.ownerToken && (snapshot.ownerToken !== options.ownerToken || snapshot.reservedOwnerToken !== options.ownerToken)) return false;
  if (options.previousOwnerOf && (snapshot.ownerToken !== options.previousOwnerOf || snapshot.reservedOwnerToken === options.previousOwnerOf)) return false;
  if (options.lockExpiredBefore && (snapshot.status === 'completed' || (snapshot.status === 'in_progress' && snapshot.lockedUntil > options.lockExpiredBefore))) return false;

  return prisma.$transaction(async (tx) => {
    // Lock order everywhere: usage window row FIRST, idempotency record row SECOND (reserveUsage does the same).
    await tx.$queryRaw`SELECT id FROM coach_usage_windows WHERE id = ${snapshot.reservedWindowId} FOR UPDATE`;

    const fence = options.lockExpiredBefore
      ? { ownerToken: randomUUID(), status: 'failed', errorCode: 'reservation_reconciled' }
      : {};
    const cleared = await tx.idempotencyRecord.updateMany({
      where: {
        id: recordId,
        reservedWindowId: snapshot.reservedWindowId,
        reservedOwnerToken: snapshot.reservedOwnerToken,
        ownerToken: snapshot.ownerToken,
        // never touch a completed operation: its unit is the consumed unit
        status: { not: 'completed' },
        ...(options.lockExpiredBefore
          ? { OR: [{ status: 'failed' }, { status: 'in_progress', lockedUntil: { lte: options.lockExpiredBefore } }] }
          : {}),
      },
      // Reconciliation FENCES the dead execution (new ownerToken, failed): if it was merely slow, its late
      // completion now fails ownership and rolls its effect back instead of consuming an unreserved unit.
      data: { reservedWindowId: null, reservedOwnerToken: null, reservedTokens: 0, reservedAt: null, ...fence },
    });
    if (cleared.count !== 1) return false;

    await tx.coachUsageWindow.updateMany({
      where: { id: snapshot.reservedWindowId!, requestCount: { gt: 0 } },
      data: {
        requestCount: { decrement: 1 },
        tokenEstimate: { decrement: snapshot.reservedTokens },
        ...(options.countAsFailure ? { failedAttempts: { increment: 1 } } : {}),
      },
    });
    return true;
  });
}

/**
 * Gives back the reservations of executions that died: their lock expired and they never completed. Safe to call
 * from the request path and from a maintenance job; each reservation is released at most once.
 */
export async function reconcileOrphanReservations(userId: string | undefined, now: Date = new Date(), limit = 100): Promise<number> {
  const orphans = await prisma.idempotencyRecord.findMany({
    where: {
      ...(userId ? { userId } : {}),
      operation: COACH_MESSAGE_OPERATION,
      reservedWindowId: { not: null },
      status: { not: 'completed' },
      NOT: { status: 'in_progress', lockedUntil: { gt: now } },
    },
    select: { id: true },
    take: limit,
  });
  let released = 0;
  for (const orphan of orphans) {
    if (await releaseRecordReservation(orphan.id, { lockExpiredBefore: now, countAsFailure: true })) released += 1;
  }
  return released;
}

/**
 * Reserves one slot of the fixed window. The reservation counts as consumed while the request is in flight and
 * stays consumed only if an answer is produced and persisted (D9). Two independent guards apply atomically:
 * the commercial limit (`requestCount < llmCoachWindowLimit`) and an operational cap on failed attempts, so that
 * errors/timeouts (which release their reservation) cannot be retried to generate unbounded provider spend.
 * When the call belongs to an idempotent operation, the reservation is persisted on its record in the SAME
 * transaction as the increment, so a crash can never leave an unaccounted unit.
 */
async function reserveUsage(userId: string, tokenEstimate: number, now: Date, owner?: ReservationOwner): Promise<UsageClaim> {
  const windowStartsAt = getWindowStart(now);
  const resetsAt = getWindowEnd(windowStartsAt);

  // Prisma's upsert is not race-safe on first creation (P2002): INSERT .. ON CONFLICT DO NOTHING, then read.
  await prisma.coachUsageWindow.createMany({ data: [{ userId, windowStartsAt }], skipDuplicates: true });
  const windowRow = await prisma.coachUsageWindow.findUniqueOrThrow({
    where: { userId_windowStartsAt: { userId, windowStartsAt } },
    select: { id: true },
  });

  // A previous attempt of THIS operation died holding a unit: give it back before reserving again.
  if (owner) {
    await releaseRecordReservation(owner.recordId, { previousOwnerOf: owner.ownerToken, countAsFailure: true });
  }

  const tryClaim = () =>
    prisma.$transaction(async (tx) => {
      const claimed = await tx.coachUsageWindow.updateMany({
        where: {
          id: windowRow.id,
          requestCount: { lt: env.llmCoachWindowLimit },
          failedAttempts: { lt: env.llmCoachMaxFailedAttempts },
        },
        data: { requestCount: { increment: 1 }, tokenEstimate: { increment: tokenEstimate } },
      });
      if (claimed.count === 0) return false;

      if (owner) {
        const marked = await tx.idempotencyRecord.updateMany({
          // lock order: window row (above) then record row; never overwrite a marker that still holds a unit
          where: { id: owner.recordId, ownerToken: owner.ownerToken, status: 'in_progress', reservedWindowId: null },
          data: { reservedWindowId: windowRow.id, reservedOwnerToken: owner.ownerToken, reservedTokens: tokenEstimate, reservedAt: now },
        });
        // superseded while reserving: roll the increment back with the transaction
        if (marked.count !== 1) throw new IdempotencyOwnershipLostError();
      }
      return true;
    });

  let claimed = await tryClaim();
  if (!claimed && (await reconcileOrphanReservations(userId, now)) > 0) {
    claimed = await tryClaim();
  }

  if (!claimed) {
    const row = await prisma.coachUsageWindow.findUniqueOrThrow({
      where: { id: windowRow.id },
      select: { failedAttempts: true },
    });
    const retryAfterSeconds = Math.max(1, Math.ceil((resetsAt.getTime() - now.getTime()) / 1000));
    const operational = row.failedAttempts >= env.llmCoachMaxFailedAttempts;
    throw new AppError(
      429,
      operational ? 'Coach temporarily unavailable after repeated failed attempts' : 'LLM coach rate limit exceeded',
      true,
      {
        reason: operational ? 'operational_failure_cap' : 'quota_exhausted',
        windowResetsAt: resetsAt.toISOString(),
        retryAfterSeconds,
      },
    );
  }

  const updated = await prisma.coachUsageWindow.findUniqueOrThrow({
    where: { id: windowRow.id },
    select: { requestCount: true },
  });

  return {
    remaining: Math.max(0, env.llmCoachWindowLimit - updated.requestCount),
    windowId: windowRow.id,
    resetsAt,
  };
}

async function giveBack(claim: UsageClaim, tokens: number, countAsFailure: boolean, owner?: ReservationOwner) {
  if (owner) {
    await releaseRecordReservation(owner.recordId, { ownerToken: owner.ownerToken, countAsFailure });
  } else {
    await releaseUsage(claim.windowId, tokens, countAsFailure);
  }
}

/** Non-idempotent callers (no ledger): in-process release of the unit just reserved. */
async function releaseUsage(windowId: string, tokenEstimate: number, countAsFailure: boolean) {
  await prisma.coachUsageWindow.updateMany({
    where: { id: windowId, requestCount: { gt: 0 } },
    data: {
      requestCount: { decrement: 1 },
      tokenEstimate: { decrement: tokenEstimate },
      ...(countAsFailure ? { failedAttempts: { increment: 1 } } : {}),
    },
  });
}

class ProviderTimeoutError extends AppError {
  constructor(ms: number) {
    super(504, 'Coach provider timed out; the provider outcome is unknown', true, {
      outcome: 'unknown_result',
      timeoutMs: ms,
    });
  }
}

/**
 * Runs `work` with an AbortSignal that fires at the deadline. Aborting asks the provider SDK to stop, but
 * a request may already have been processed (and billed) remotely, so a timeout is reported as an UNKNOWN
 * outcome, never as "not executed".
 */
async function withDeadline<T>(ms: number, work: (signal: AbortSignal) => Promise<T>): Promise<T> {
  const controller = new AbortController();
  let timer: NodeJS.Timeout | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new ProviderTimeoutError(ms));
    }, ms);
  });
  try {
    return await Promise.race([work(controller.signal), deadline]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

type Finalize = (tx: Prisma.TransactionClient, response: CoachResponse) => Promise<boolean>;

/**
 * Persists the exchange and, in the SAME transaction, runs `finalize` (idempotency completion). If finalize
 * reports that this owner was superseded, the transaction is rolled back: a stale owner leaves no effects.
 */
async function persistExchangeAtomically(
  params: {
    conversationId: string;
    userMessage: string;
    answer: string;
    provider: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    safetyFlags: string[];
  },
  response: CoachResponse,
  finalize?: Finalize,
) {
  await prisma.$transaction(async (tx) => {
    await tx.coachMessage.create({
      data: {
        conversationId: params.conversationId,
        role: 'user',
        content: params.userMessage,
        estimatedTokens: params.inputTokens,
        safetyFlags: params.safetyFlags,
      },
    });
    await tx.coachMessage.create({
      data: {
        conversationId: params.conversationId,
        role: 'assistant',
        content: params.answer,
        provider: params.provider,
        model: params.model,
        estimatedTokens: params.outputTokens,
        safetyFlags: params.safetyFlags,
      },
    });
    await tx.coachConversation.update({
      where: { id: params.conversationId },
      data: { updatedAt: new Date() },
    });

    if (finalize && !(await finalize(tx, response))) {
      throw new IdempotencyOwnershipLostError();
    }
  });
}

async function executeCoachMessage(
  userId: string,
  input: SendCoachMessageInput,
  finalize?: Finalize,
  owner?: ReservationOwner,
): Promise<CoachResponse> {
  if (!env.llmCoachEnabled) {
    throw new AppError(503, 'LLM coach is disabled');
  }

  const now = new Date();
  const conversation = await resolveConversation(userId, input.conversationId);
  const safety = evaluateCoachSafety(input.message);
  const context = await buildCoachContext(userId);
  const memory = await loadBoundedMemory(conversation.id);
  const systemPrompt = trimPrompt([
    'You are Anclora Impulso Coach.',
    'Stay inside fitness, training, recovery, adherence, and general nutrition habits.',
    'Do not provide medical diagnosis. For pain, injury, or symptoms, direct the user to a qualified professional.',
    'Give concise, practical, measurable advice.',
    context,
  ].join('\n'));
  const inputTokens = estimateTokens(`${systemPrompt}\n${memory.map((message) => message.content).join('\n')}\n${input.message}`);

  const buildResponse = (
    answer: string, provider: string, model: string, outputTokens: number, claim: UsageClaim,
  ): CoachResponse => ({
    conversationId: conversation.id,
    answer,
    provider,
    model,
    cached: false,
    safety,
    usage: {
      estimatedInputTokens: inputTokens,
      estimatedOutputTokens: outputTokens,
      estimatedTotalTokens: inputTokens + outputTokens,
      remainingWindowRequests: claim.remaining,
      windowResetsAt: claim.resetsAt.toISOString(),
    },
  });

  if (safety.directAnswer) {
    const claim = await reserveUsage(userId, inputTokens, now, owner);
    const outputTokens = estimateTokens(safety.directAnswer);
    const response = buildResponse(safety.directAnswer, 'guardrail', 'rule-based', outputTokens, claim);
    try {
      await persistExchangeAtomically({
        conversationId: conversation.id,
        userMessage: input.message,
        answer: safety.directAnswer,
        provider: 'guardrail',
        model: 'rule-based',
        inputTokens,
        outputTokens,
        safetyFlags: safety.flags,
      }, response, finalize);
    } catch (error) {
      await giveBack(claim, inputTokens, false, owner);
      throw error;
    }
    return response;
  }

  // Per-process cache: only for callers without an idempotency gate (persistent idempotency supersedes it).
  const cacheKey = hashCacheKey([userId, conversation.id, input.message, context]);
  if (!finalize) {
    const cached = responseCache.get(cacheKey);
    if (cached && cached.expiresAt > now.getTime()) {
      return { ...cached.response, cached: true };
    }
  }

  const claim = await reserveUsage(userId, inputTokens, now, owner);
  let response: CoachResponse;
  try {
    const provider = getCoachProvider();
    await prisma.coachUsageWindow.update({ where: { id: claim.windowId }, data: { providerCalls: { increment: 1 } } });
    const providerResponse = await withDeadline(env.llmCoachProviderTimeoutMs, (signal) =>
      provider.complete({
        maxOutputTokens: env.llmCoachMaxOutputTokens,
        signal,
        messages: [
          { role: 'system', content: systemPrompt },
          ...memory,
          { role: 'user', content: input.message },
        ],
      }),
    );
    const outputTokens = providerResponse.estimatedOutputTokens;
    response = buildResponse(providerResponse.answer, providerResponse.provider, providerResponse.model, outputTokens, claim);

    await persistExchangeAtomically({
      conversationId: conversation.id,
      userMessage: input.message,
      answer: providerResponse.answer,
      provider: providerResponse.provider,
      model: providerResponse.model,
      inputTokens,
      outputTokens,
      safetyFlags: safety.flags,
    }, response, finalize);
  } catch (error) {
    // No answer was persisted: release the reservation (D9) and count the failed attempt (operational cap).
    await giveBack(claim, inputTokens, true, owner);
    throw error;
  }

  if (!finalize && env.llmCoachCacheTtlSeconds > 0) {
    responseCache.set(cacheKey, {
      expiresAt: now.getTime() + env.llmCoachCacheTtlSeconds * 1000,
      response,
    });
  }

  return response;
}

export interface SendCoachMessageOptions {
  /** Idempotency-Key (client supplied, or derived by the controller during the transition). */
  idempotencyKey?: string;
}

function errorCodeFor(error: unknown) {
  if (error instanceof IdempotencyOwnershipLostError) return 'ownership_lost';
  // AppError resets its prototype, so subclasses are identified by their details.
  if (error instanceof AppError && error.details?.outcome === 'unknown_result') return 'provider_timeout_unknown_result';
  if (error instanceof AppError) return `http_${error.statusCode}`;
  return 'error';
}

/**
 * D9 quota policy: quota counts completed, persisted answers; an in-flight request reserves capacity; a failure
 * without a persisted answer releases the reservation; repeating a completed operation with the same key never
 * consumes quota. Fixed windows of `LLM_COACH_WINDOW_MINUTES` (60); `usage.windowResetsAt` is the exact reset.
 */
export async function sendCoachMessage(
  userId: string,
  input: SendCoachMessageInput,
  options: SendCoachMessageOptions = {},
): Promise<CoachResponse> {
  if (!options.idempotencyKey) {
    return executeCoachMessage(userId, input);
  }

  assertValidIdempotencyKey(options.idempotencyKey);
  const lockSeconds = Math.ceil(env.llmCoachProviderTimeoutMs / 1000) + 15;
  const gate = await beginIdempotent({
    userId,
    operation: COACH_MESSAGE_OPERATION,
    key: options.idempotencyKey,
    requestHash: hashRequest({ conversationId: input.conversationId ?? null, message: input.message.trim() }),
    lockSeconds,
    retentionSeconds: env.idempotencyRetentionHours * 3600,
    maxAttempts: env.idempotencyMaxAttempts,
    maxConcurrent: env.llmCoachMaxConcurrent,
  });

  if (gate.kind === 'replay') {
    return { ...(gate.response as CoachResponse), idempotentReplay: true };
  }
  if (gate.kind === 'conflict') {
    throw new AppError(422, 'Idempotency-Key was already used with a different request');
  }
  if (gate.kind === 'in_progress') {
    throw new AppError(409, `A request with this Idempotency-Key is still in progress; retry in ${gate.retryAfterSeconds}s`, true, {
      retryAfterSeconds: gate.retryAfterSeconds,
    });
  }
  if (gate.kind === 'exhausted') {
    throw new AppError(429, 'Too many attempts for this Idempotency-Key; start a new request later', true, {
      reason: 'idempotency_attempts_exhausted',
      attempts: gate.attempts,
    });
  }

  if (gate.kind === 'concurrency_limited') {
    throw new AppError(429, 'Too many coach requests in flight; retry shortly', true, {
      reason: 'concurrency_limit',
      retryAfterSeconds: gate.retryAfterSeconds,
    });
  }

  try {
    // Completion runs inside the transaction that persists the exchange (atomic; owner-checked).
    return await executeCoachMessage(userId, input, (tx, response) =>
      completeIdempotent(tx, gate.recordId, gate.ownerToken, 200, response, env.idempotencyRetentionHours * 3600),
      { recordId: gate.recordId, ownerToken: gate.ownerToken },
    );
  } catch (error) {
    await failIdempotent(gate.recordId, gate.ownerToken, errorCodeFor(error));
    if (error instanceof IdempotencyOwnershipLostError) {
      throw new AppError(409, 'This operation was taken over by another attempt; retry with the same Idempotency-Key', true, {
        retryAfterSeconds: 1,
      });
    }
    throw error;
  }
}
