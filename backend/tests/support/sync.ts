/** Deterministic synchronization helpers for timing-sensitive integration tests (no fixed sleeps as "barriers"). */

export function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/**
 * Wraps a provider call so the test knows exactly when it was entered and decides when it may finish.
 * `entered` resolves once the call started; `release()` lets it continue.
 */
export function gatedCall<A extends unknown[], R>(real: (...args: A) => Promise<R>) {
  const entered = deferred<void>();
  const gate = deferred<void>();
  openers.add(() => gate.resolve());
  const impl = async (...args: A): Promise<R> => {
    entered.resolve();
    await gate.promise;
    return real(...args);
  };
  return { impl, entered: entered.promise, release: () => gate.resolve() };
}

/**
 * Registry drained by `drainGates()` in `afterEach`: every gate created through `gatedCall`/`openGate` is opened and
 * every promise passed to `track()` is awaited, so a failing assertion can never leave a call stranded in a latch
 * (whose late rejection Jest would attribute to whichever unrelated test happens to be running).
 */
const openers = new Set<() => void>();
const tracked = new Set<Promise<unknown>>();

export function openGate<T = void>() {
  const d = deferred<T>();
  openers.add(() => d.resolve(undefined as T));
  return d;
}

export function track<T>(promise: Promise<T>): Promise<T> {
  tracked.add(promise);
  promise.catch(() => undefined);
  return promise;
}

export async function drainGates() {
  for (const open of openers) open();
  openers.clear();
  const pending = [...tracked];
  tracked.clear();
  await Promise.allSettled(pending);
}

/** Polls until `predicate` is true (bounded); used instead of sleeping for a guessed duration. */
export async function waitUntil(predicate: () => Promise<boolean> | boolean, timeoutMs = 10_000, stepMs = 20) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return;
    await new Promise((r) => setTimeout(r, stepMs));
  }
  throw new Error(`waitUntil timed out after ${timeoutMs}ms`);
}

/**
 * Quota windows are aligned to the wall clock. If the test would straddle a window boundary, wait it out so
 * "same window" assertions cannot be broken by the clock (a known timing hazard, not an observed failure cause).
 */
export async function avoidWindowBoundary(windowMinutes: number, marginMs = 4000) {
  const windowMs = windowMinutes * 60_000;
  const untilBoundary = windowMs - (Date.now() % windowMs);
  if (untilBoundary < marginMs) {
    await new Promise((r) => setTimeout(r, untilBoundary + 250));
  }
}

/**
 * Runs `body` and, whatever happens (including a failing assertion), opens every gate and waits for every pending
 * promise to settle before returning/throwing. A failed assertion therefore cannot leave calls stranded in a
 * latched provider whose late rejection would be attributed by Jest to an unrelated test.
 */
export async function withGatesReleased<T>(
  gates: Array<() => void>,
  pending: () => Array<Promise<unknown>>,
  body: () => Promise<T>,
): Promise<T> {
  try {
    return await body();
  } finally {
    for (const release of gates) release();
    await Promise.allSettled(pending());
  }
}
