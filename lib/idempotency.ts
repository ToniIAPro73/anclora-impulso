import { ApiError } from '@/lib/api/client';

/**
 * Client side of the Idempotency-Key contract.
 *
 * A key identifies one LOGICAL operation (e.g. "generate this routine"):
 *  - created once, when the operation starts;
 *  - reused for every retry of that same operation (same normalized content);
 *  - replaced when the content changes, the previous attempt succeeded/was definitively rejected, or the user
 *    EXPLICITLY asks for a new operation (discardPendingOperation / { newOperation: true });
 *  - NEVER replaced merely because time passed: an unresolved operation may have succeeded server side with its
 *    response lost, and the server keeps its result for the whole retention period;
 *  - scoped by user and operation, and kept in sessionStorage so a reload does not turn a retry into a new operation.
 */

const PREFIX = 'impulso:idem:';

interface StoredKey {
  key: string;
  fingerprint: string;
  createdAt: number;
}

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) {
    const mapped = value.map(canonical);
    return mapped.every((v) => typeof v === 'string' || typeof v === 'number')
      ? [...mapped].sort()
      : mapped;
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => [k, canonical(v)]),
    );
  }
  return value;
}

export function fingerprintOf(payload: unknown): string {
  return JSON.stringify(canonical(payload));
}

function storageKey(operation: string, scope: string) {
  return `${PREFIX}${scope}:${operation}`;
}

function storage(): Storage | null {
  try {
    return typeof window !== 'undefined' ? window.sessionStorage : null;
  } catch {
    return null;
  }
}

// Fallback when sessionStorage is unavailable (private mode, SSR): in-memory for this page lifetime.
const memory = new Map<string, StoredKey>();

function newKey(): string {
  const random =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
  return `op-${random}`;
}

function read(k: string): StoredKey | null {
  const s = storage();
  try {
    const raw = s?.getItem(k);
    if (raw) return JSON.parse(raw) as StoredKey;
  } catch {
    // fall through to memory
  }
  return memory.get(k) ?? null;
}

function write(k: string, value: StoredKey) {
  memory.set(k, value);
  try {
    storage()?.setItem(k, JSON.stringify(value));
  } catch {
    // memory copy is enough
  }
}

export function acquireOperationKey(operation: string, scope: string, payload: unknown, now = Date.now()): string {
  const k = storageKey(operation, scope);
  const fingerprint = fingerprintOf(payload);
  const existing = read(k);

  if (existing && existing.fingerprint === fingerprint) {
    return existing.key;
  }

  const created: StoredKey = { key: newKey(), fingerprint, createdAt: now };
  write(k, created);
  return created.key;
}

/** The user explicitly asks for a NEW operation: the pending one (if any) is abandoned, not retried. */
export function discardPendingOperation(operation: string, scope: string) {
  releaseOperationKey(operation, scope);
}

export function releaseOperationKey(operation: string, scope: string) {
  const k = storageKey(operation, scope);
  memory.delete(k);
  try {
    storage()?.removeItem(k);
  } catch {
    // ignore
  }
}

/** Called on logout: keys must not outlive the session that created them. */
export function clearAllOperationKeys() {
  memory.clear();
  const s = storage();
  if (!s) return;
  try {
    for (let i = s.length - 1; i >= 0; i -= 1) {
      const name = s.key(i);
      if (name?.startsWith(PREFIX)) s.removeItem(name);
    }
  } catch {
    // ignore
  }
}

/** A definitive rejection means the same content will never succeed: the next attempt is a new operation. */
function isDefinitiveRejection(error: unknown) {
  return error instanceof ApiError && error.status >= 400 && error.status < 500 && ![408, 409, 429].includes(error.status);
}

function isRetriable(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 409 || error.status >= 502) return true;
    if (error.status === 429 && error.details?.reason === 'concurrency_limit') return true;
    return false;
  }
  return error instanceof TypeError; // network failure
}

function delayFor(error: unknown, attempt: number) {
  const retryAfter = error instanceof ApiError ? Number(error.details?.retryAfterSeconds) : NaN;
  if (Number.isFinite(retryAfter) && retryAfter > 0) return Math.min(retryAfter, 5) * 1000;
  return 400 * 2 ** attempt;
}

export interface RunIdempotentOptions {
  /** Start a new logical operation even if an unresolved one with the same content exists. */
  newOperation?: boolean;
  maxRetries?: number;
  sleep?: (ms: number) => Promise<void>;
}

/**
 * Runs `send(key)` with a stable key. Transient failures (network, in-progress 409, 5xx, concurrency 429) are
 * retried with the SAME key; success or a definitive rejection releases the key.
 */
export async function runIdempotent<T>(
  operation: string,
  scope: string,
  payload: unknown,
  send: (key: string) => Promise<T>,
  options: RunIdempotentOptions = {},
): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  if (options.newOperation) discardPendingOperation(operation, scope);
  const key = acquireOperationKey(operation, scope, payload);

  for (let attempt = 0; ; attempt += 1) {
    try {
      const result = await send(key);
      releaseOperationKey(operation, scope);
      return result;
    } catch (error) {
      if (isDefinitiveRejection(error)) {
        releaseOperationKey(operation, scope);
        throw error;
      }
      if (!isRetriable(error) || attempt >= maxRetries) {
        throw error; // key is kept: a manual retry of the same content continues the same operation
      }
      await sleep(delayFor(error, attempt));
    }
  }
}
