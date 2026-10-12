import { createHash, randomUUID } from 'crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';

export const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

export type IdempotencyBegin =
  | { kind: 'owner'; recordId: string; ownerToken: string; attempts: number }
  | { kind: 'replay'; statusCode: number; response: unknown }
  | { kind: 'in_progress'; retryAfterSeconds: number }
  | { kind: 'conflict' }
  | { kind: 'exhausted'; attempts: number }
  | { kind: 'concurrency_limited'; retryAfterSeconds: number };

export interface IdempotencyScope {
  userId: string;
  operation: string;
  key: string;
}

/** Prisma client or interactive-transaction client. */
export type DbClient = Prisma.TransactionClient | typeof prisma;

export function assertValidIdempotencyKey(key: string) {
  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    throw new AppError(400, 'Idempotency-Key must be 8-128 characters of [A-Za-z0-9._:-]');
  }
}

/** Stable hash of normalized request content; object keys are sorted so key order never changes the hash. */
export function hashRequest(payload: unknown): string {
  const canonical = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(canonical);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>)
          .filter(([, v]) => v !== undefined)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, canonical(v)]),
      );
    }
    return value;
  };
  return createHash('sha256').update(JSON.stringify(canonical(payload))).digest('hex');
}

/** Short-window key derived server-side for clients that do not send Idempotency-Key (transition only). */
export function deriveLegacyKey(userId: string, operation: string, requestHash: string, now: Date = new Date(), bucketSeconds = 30) {
  const bucket = Math.floor(now.getTime() / (bucketSeconds * 1000));
  return `legacy-${createHash('sha256').update(`${userId}|${operation}|${requestHash}|${bucket}`).digest('hex').slice(0, 48)}`;
}

interface BeginOptions extends IdempotencyScope {
  requestHash: string;
  /** How long an owner may hold the key before another attempt may take over (crash/timeout recovery). */
  lockSeconds: number;
  /** Record retention; after this the key is treated as unused. */
  retentionSeconds: number;
  /** Upper bound of executions per key, so failures/timeouts cannot be retried without limit. */
  maxAttempts?: number;
  /**
   * Upper bound of simultaneously ACTIVE executions (unexpired in_progress) of this user and operation. It is
   * enforced atomically: every transition into in_progress (new key, retry of an old failed key, takeover of an
   * expired lock) runs under a per-(user, operation) advisory lock and counts the executions that are active
   * at that moment, so an old key cannot jump the queue and nothing already running is ever evicted.
   */
  maxConcurrent?: number;
  now?: Date;
  /**
   * Test seam (no production caller): invoked after a record state was read and a takeover was decided, and
   * before the compare-and-set that applies it. Lets a regression interleave a competing commit deterministically.
   */
  onAfterRead?: (snapshot: { recordId: string; status: string; ownerToken: string; round: number }) => Promise<void>;
}

/**
 * Persistent idempotency gate. Exactly one caller becomes `owner` for a (user, operation, key). The whole decision
 * runs in one transaction under a per-(user, operation) advisory lock, which makes both the key state machine and
 * the concurrency admission atomic. Ownership is proven by a per-takeover `ownerToken` that must accompany
 * completion/failure, so a superseded (stale) owner can neither complete nor release the record.
 * Rules: same key + same hash -> replay of the completed result (never re-executes);
 * same key + different hash -> conflict; in-flight -> in_progress; failed or stale lock -> takeover (bounded
 * attempts, and only if a concurrency permit is available).
 */
export async function beginIdempotent(options: BeginOptions): Promise<IdempotencyBegin> {
  const now = options.now ?? new Date();
  const lockedUntil = new Date(now.getTime() + options.lockSeconds * 1000);
  const expiresAt = new Date(now.getTime() + options.retentionSeconds * 1000);
  const where = { userId_operation_key: { userId: options.userId, operation: options.operation, key: options.key } };
  const lockKey = `idem:${options.userId}:${options.operation}`;

  return prisma.$transaction(async (tx): Promise<IdempotencyBegin> => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

    const ownerToken = randomUUID();
    const limited = async (excludeId?: string) => {
      if (options.maxConcurrent === undefined) return false;
      const active = await tx.idempotencyRecord.count({
        where: {
          userId: options.userId,
          operation: options.operation,
          status: 'in_progress',
          lockedUntil: { gt: now },
          ...(excludeId ? { id: { not: excludeId } } : {}),
        },
      });
      return active >= options.maxConcurrent;
    };
    const busy: IdempotencyBegin = { kind: 'concurrency_limited', retryAfterSeconds: 2 };

    // Optimistic re-evaluation: completion/failure of a record is NOT serialized by the advisory lock (it commits
    // inside the effect's own transaction), so any state read here can be stale by the time we act on it. Every
    // transition out of a read state is therefore a compare-and-set on exactly that state; when it loses, the row
    // is read again and the decision is re-taken (replay, in_progress, ...), never applied blindly.
    for (let round = 0; round < 4; round += 1) {
      const existing = await tx.idempotencyRecord.findUnique({ where });

      if (!existing) {
        if (await limited()) return busy;
        const row = await tx.idempotencyRecord.create({
          data: {
            userId: options.userId, operation: options.operation, key: options.key,
            requestHash: options.requestHash, status: 'in_progress', ownerToken, lockedUntil, expiresAt,
          },
          select: { id: true },
        });
        return { kind: 'owner', recordId: row.id, ownerToken, attempts: 1 };
      }

      // Returns the owner decision when the CAS wins, or null when the row changed under us (-> read again).
      const takeover = async (extra: Record<string, unknown>, attemptsAfter: number): Promise<IdempotencyBegin | null> => {
        await options.onAfterRead?.({ recordId: existing.id, status: existing.status, ownerToken: existing.ownerToken, round });
        const won = await tx.idempotencyRecord.updateMany({
          where: {
            id: existing.id,
            ownerToken: existing.ownerToken,
            status: existing.status,
            lockedUntil: existing.lockedUntil,
            attempts: existing.attempts,
          },
          data: {
            ownerToken, status: 'in_progress', lockedUntil, attempts: attemptsAfter,
            statusCode: null, errorCode: null, ...extra,
          } as never,
        });
        if (won.count !== 1) return null;
        return { kind: 'owner', recordId: existing.id, ownerToken, attempts: attemptsAfter };
      };

      const heldNow = existing.status === 'in_progress' && existing.lockedUntil > now;

      // A held execution is never taken over, even if its retention elapsed while it was running.
      if (heldNow) {
        if (existing.requestHash !== options.requestHash) return { kind: 'conflict' };
        return {
          kind: 'in_progress',
          retryAfterSeconds: Math.max(1, Math.ceil((existing.lockedUntil.getTime() - now.getTime()) / 1000)),
        };
      }

      if (existing.expiresAt <= now && existing.status !== 'completed') {
        // Retention elapsed on a non-completed record: the key is reusable, even with different content.
        if (await limited(existing.id)) return busy;
        const taken = await takeover({ requestHash: options.requestHash, expiresAt, response: Prisma.DbNull }, 1);
        if (taken) return taken;
        continue;
      }

      if (existing.expiresAt <= now) {
        // Completed and past retention: reusable. Guarded by the same CAS (a concurrent re-completion loses).
        if (await limited(existing.id)) return busy;
        const taken = await takeover({ requestHash: options.requestHash, expiresAt, response: Prisma.DbNull, reservedWindowId: null, reservedOwnerToken: null, reservedTokens: 0, reservedAt: null }, 1);
        if (taken) return taken;
        continue;
      }

      if (existing.requestHash !== options.requestHash) return { kind: 'conflict' };

      if (existing.status === 'completed') {
        return { kind: 'replay', statusCode: existing.statusCode ?? 200, response: existing.response };
      }

      // failed, or in_progress with an expired lock: retry, bounded and only with a free permit
      const mayRetry = options.maxAttempts === undefined || existing.attempts < options.maxAttempts;
      if (!mayRetry) return { kind: 'exhausted', attempts: existing.attempts };
      if (await limited(existing.id)) return busy;
      const taken = await takeover({}, existing.attempts + 1);
      if (taken) return taken;
    }

    // The row kept changing under us; do not guess. The caller retries with the same key.
    return { kind: 'in_progress', retryAfterSeconds: 1 };
  });
}

/**
 * Completes the record only if `ownerToken` still holds it. Pass the transaction client so the effect it
 * guards (e.g. persisting messages or a routine) commits atomically with the completion.
 */
export async function completeIdempotent(
  client: DbClient,
  recordId: string,
  ownerToken: string,
  statusCode: number,
  response: unknown,
  /** When given, the replay guarantee is measured from completion (not from the first request). */
  retentionSeconds?: number,
  now: Date = new Date(),
): Promise<boolean> {
  const result = await client.idempotencyRecord.updateMany({
    where: { id: recordId, ownerToken, status: 'in_progress' },
    data: {
      status: 'completed',
      statusCode,
      response: response as never,
      errorCode: null,
      // the reserved quota unit becomes the consumed unit: nothing is left to release
      reservedWindowId: null,
      reservedOwnerToken: null,
      reservedTokens: 0,
      reservedAt: null,
      ...(retentionSeconds ? { expiresAt: new Date(now.getTime() + retentionSeconds * 1000) } : {}),
    },
  });
  return result.count === 1;
}

export async function failIdempotent(recordId: string, ownerToken: string, errorCode: string) {
  await prisma.idempotencyRecord.updateMany({
    where: { id: recordId, ownerToken, status: 'in_progress' },
    data: { status: 'failed', errorCode: errorCode.slice(0, 80) },
  });
}

/**
 * Physical deletion of idempotency records.
 *
 * Logical expiry (`expiresAt`) is when the replay guarantee ENDS: from then on the key is reusable, whether or not
 * the row still exists. Physical deletion only happens `graceSeconds` after that, and never for an execution that
 * is still held (`in_progress` with an unexpired lock). Safe to run concurrently and repeatedly: it deletes by id
 * in bounded batches, and deleting an already-deleted row is a no-op.
 */
export async function purgeExpiredIdempotencyRecords(
  now: Date = new Date(),
  options: { graceSeconds?: number; batchSize?: number; maxBatches?: number } = {},
) {
  const graceSeconds = options.graceSeconds ?? 0;
  const batchSize = options.batchSize ?? 500;
  const maxBatches = options.maxBatches ?? 100;
  const cutoff = new Date(now.getTime() - graceSeconds * 1000);
  let deleted = 0;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const rows = await prisma.idempotencyRecord.findMany({
      where: {
        expiresAt: { lte: cutoff },
        NOT: { status: 'in_progress', lockedUntil: { gt: now } },
      },
      select: { id: true },
      take: batchSize,
    });
    if (rows.length === 0) break;
    const result = await prisma.idempotencyRecord.deleteMany({
      where: {
        id: { in: rows.map((row) => row.id) },
        // re-check inside the delete so a record revived between SELECT and DELETE is kept
        expiresAt: { lte: cutoff },
        NOT: { status: 'in_progress', lockedUntil: { gt: now } },
      },
    });
    deleted += result.count;
    if (rows.length < batchSize) break;
  }
  return deleted;
}

/** Thrown inside a transaction when the idempotency owner was superseded, forcing a full rollback. */
export class IdempotencyOwnershipLostError extends Error {
  constructor() {
    super('Idempotency ownership lost');
  }
}
