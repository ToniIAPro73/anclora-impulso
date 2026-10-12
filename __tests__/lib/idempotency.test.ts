/** @jest-environment jsdom */
import { ApiError } from '@/lib/api/client';
import {
  acquireOperationKey, clearAllOperationKeys, discardPendingOperation, fingerprintOf, releaseOperationKey, runIdempotent,
} from '@/lib/idempotency';

const noSleep = async () => undefined;

beforeEach(() => {
  clearAllOperationKeys();
  sessionStorage.clear();
});

describe('operation keys', () => {
  it('is stable for the same normalized content (list order and undefined fields are irrelevant)', () => {
    const a = acquireOperationKey('op', 'u1', { x: 1, tags: ['b', 'a'], y: undefined });
    const b = acquireOperationKey('op', 'u1', { tags: ['a', 'b'], x: 1 });
    expect(b).toBe(a);
    expect(fingerprintOf({ a: [2, 1] })).toBe(fingerprintOf({ a: [1, 2] }));
  });

  it('changes when the content changes, per user and per operation', () => {
    const base = acquireOperationKey('op', 'u1', { x: 1 });
    expect(acquireOperationKey('op', 'u1', { x: 2 })).not.toBe(base);
    expect(acquireOperationKey('op', 'u2', { x: 1 })).not.toBe(base);
    expect(acquireOperationKey('other', 'u1', { x: 1 })).not.toBe(base);
  });

  it('survives a reload (sessionStorage) and is NOT replaced merely because time passed (review R3)', () => {
    const k = acquireOperationKey('op', 'u1', { x: 1 }, 1_000);
    expect(acquireOperationKey('op', 'u1', { x: 1 }, 2_000)).toBe(k);
    // ten minutes, one hour, a day later: the operation is still unresolved, so it is still the same operation
    expect(acquireOperationKey('op', 'u1', { x: 1 }, 1_000 + 10 * 60 * 1000 + 1)).toBe(k);
    expect(acquireOperationKey('op', 'u1', { x: 1 }, 1_000 + 60 * 60 * 1000)).toBe(k);
    expect(acquireOperationKey('op', 'u1', { x: 1 }, 1_000 + 24 * 60 * 60 * 1000)).toBe(k);
  });

  it('an explicit new operation gets a new key (discardPendingOperation), and so does changed content', () => {
    const k = acquireOperationKey('op', 'u1', { x: 1 });
    discardPendingOperation('op', 'u1');
    expect(acquireOperationKey('op', 'u1', { x: 1 })).not.toBe(k);
  });

  it('is released explicitly and cleared on logout', () => {
    const k = acquireOperationKey('op', 'u1', { x: 1 });
    releaseOperationKey('op', 'u1');
    expect(acquireOperationKey('op', 'u1', { x: 1 })).not.toBe(k);
    const k2 = acquireOperationKey('op', 'u1', { x: 1 });
    clearAllOperationKeys();
    expect(acquireOperationKey('op', 'u1', { x: 1 })).not.toBe(k2);
  });
});

describe('runIdempotent', () => {
  it('retries transient failures with the SAME key and releases it on success', async () => {
    const keys: string[] = [];
    let n = 0;
    const result = await runIdempotent('op', 'u1', { x: 1 }, async (key) => {
      keys.push(key);
      n += 1;
      if (n === 1) throw new TypeError('network');
      if (n === 2) throw new ApiError('in progress', 409, { retryAfterSeconds: 1 });
      return 'ok';
    }, { sleep: noSleep });
    expect(result).toBe('ok');
    expect(new Set(keys).size).toBe(1);
    expect(keys).toHaveLength(3);
    // success finished the logical operation: the next request is a new operation
    expect(acquireOperationKey('op', 'u1', { x: 1 })).not.toBe(keys[0]);
  });

  it('keeps the key after exhausted retries so a manual retry continues the same operation', async () => {
    let first = '';
    await expect(runIdempotent('op', 'u1', { x: 1 }, async (key) => { first = first || key; throw new ApiError('boom', 504); }, { sleep: noSleep, maxRetries: 1 }))
      .rejects.toBeInstanceOf(ApiError);
    expect(acquireOperationKey('op', 'u1', { x: 1 })).toBe(first);
  });

  it('does not retry definitive rejections and starts a new operation afterwards', async () => {
    const calls: string[] = [];
    await expect(runIdempotent('op', 'u1', { x: 1 }, async (key) => { calls.push(key); throw new ApiError('invalid', 400); }, { sleep: noSleep }))
      .rejects.toMatchObject({ status: 400 });
    expect(calls).toHaveLength(1);
    expect(acquireOperationKey('op', 'u1', { x: 1 })).not.toBe(calls[0]);
  });

  it('treats 422 (key reused with different content) as definitive and quota 429 as non-retriable but key-preserving', async () => {
    await expect(runIdempotent('op', 'u1', { x: 1 }, async () => { throw new ApiError('conflict', 422); }, { sleep: noSleep })).rejects.toBeTruthy();
    let kept = '';
    await expect(runIdempotent('op', 'u1', { x: 9 }, async (key) => { kept = key; throw new ApiError('quota', 429, { reason: 'quota_exhausted' }); }, { sleep: noSleep }))
      .rejects.toMatchObject({ status: 429 });
    expect(acquireOperationKey('op', 'u1', { x: 9 })).toBe(kept);
  });

  it('retries a concurrency-limit 429 but honours retryAfterSeconds for the delay', async () => {
    const delays: number[] = [];
    let n = 0;
    await runIdempotent('op', 'u1', { x: 1 }, async () => {
      n += 1;
      if (n === 1) throw new ApiError('busy', 429, { reason: 'concurrency_limit', retryAfterSeconds: 2 });
      return 1;
    }, { sleep: async (ms) => { delays.push(ms); } });
    expect(delays).toEqual([2000]);
  });
});
