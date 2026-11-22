/** @jest-environment jsdom */
import { webcrypto, createHash } from 'crypto';
import { TextEncoder as NodeTextEncoder } from 'util';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
(globalThis as any).TextEncoder = (globalThis as any).TextEncoder ?? NodeTextEncoder;

import * as navigate from '@/lib/auth/navigate';
jest.mock('@/lib/auth/navigate', () => ({ goTo: jest.fn(), replaceWith: jest.fn() }));
import {
  beginOAuth,
  takeOAuthAttempt,
  OAUTH_ATTEMPT_KEY,
  OAUTH_ATTEMPT_MAX_AGE_MS,
  storedIdentity,
  resolveWarmUpHealthUrl,
  warmUpBackend,
} from '@/lib/auth/oauth';

const jwtFor = (userId: string) => `h.${Buffer.from(JSON.stringify({ userId })).toString('base64url')}.s`;

describe('OAuth attempt (F-4)', () => {
  beforeEach(() => { sessionStorage.clear(); localStorage.clear(); });

  it('begin: stores the verifier in sessionStorage only and sends only its S256 challenge', async () => {
    const hrefSet = jest.fn();
    (navigate.goTo as jest.Mock).mockImplementation(hrefSet);
    await beginOAuth('google');

    const attempt = JSON.parse(sessionStorage.getItem(OAUTH_ATTEMPT_KEY)!);
    expect(attempt.verifier).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const target = new URL(hrefSet.mock.calls[0][0]);
    expect(target.pathname.endsWith('/auth/google')).toBe(true);
    expect(target.searchParams.get('challenge')).toBe(createHash('sha256').update(attempt.verifier).digest('base64url'));
    expect(target.href).not.toContain(attempt.verifier);
    expect(localStorage.length).toBe(0);
  });

  it('records the identity held when the flow started', async () => {
    localStorage.setItem('accessToken', jwtFor('user-A'));
    expect(storedIdentity()).toBe('user-A');
  });

  it('take is single use and enforces expiry and shape', () => {
    const good = { verifier: 'v'.repeat(43), provider: 'github', startedAt: 1_000, identity: null };
    sessionStorage.setItem(OAUTH_ATTEMPT_KEY, JSON.stringify(good));
    expect(takeOAuthAttempt(2_000)).toEqual(good);
    expect(takeOAuthAttempt(2_000)).toBeNull(); // consumed

    sessionStorage.setItem(OAUTH_ATTEMPT_KEY, JSON.stringify(good));
    expect(takeOAuthAttempt(1_000 + OAUTH_ATTEMPT_MAX_AGE_MS + 1)).toBeNull(); // expired
    sessionStorage.setItem(OAUTH_ATTEMPT_KEY, JSON.stringify({ ...good, verifier: 'short' }));
    expect(takeOAuthAttempt(2_000)).toBeNull();
    sessionStorage.setItem(OAUTH_ATTEMPT_KEY, '{not json');
    expect(takeOAuthAttempt(2_000)).toBeNull();
    sessionStorage.setItem(OAUTH_ATTEMPT_KEY, JSON.stringify({ ...good, provider: 'evil' }));
    expect(takeOAuthAttempt(2_000)).toBeNull();
  });
});

describe('warmUpBackend health URL', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    if (originalFetch) {
      globalThis.fetch = originalFetch;
    } else {
      delete (globalThis as { fetch?: typeof fetch }).fetch;
    }
    jest.restoreAllMocks();
  });

  it('targets /health/live (never /health/ready or ?deep) in both proxy and direct modes', () => {
    const proxyUrl = resolveWarmUpHealthUrl('/api', 'https://backend.example.test/api');
    const proxyFallbackUrl = resolveWarmUpHealthUrl('/api', 'http://localhost:3001/api');
    const directUrl = resolveWarmUpHealthUrl('https://backend.example.test/api', 'https://backend.example.test/api');
    const directFallbackUrl = resolveWarmUpHealthUrl('http://localhost:3001/api', 'http://localhost:3001/api');

    expect(proxyUrl).toBe('https://backend.example.test/health/live');
    expect(proxyFallbackUrl).toBe('http://localhost:3001/health/live');
    expect(directUrl).toBe('https://backend.example.test/health/live');
    expect(directFallbackUrl).toBe('http://localhost:3001/health/live');

    for (const url of [proxyUrl, proxyFallbackUrl, directUrl, directFallbackUrl]) {
      expect(url).not.toContain('/health/ready');
      expect(url).not.toContain('deep');
    }
  });

  it('reuses in-flight warmUpPromise and resolves silently on network error', async () => {
    let rejectFetch!: (err: Error) => void;
    const fetchMock = jest.fn(
      () => new Promise<Response>((_resolve, reject) => {
        rejectFetch = reject;
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const p1 = warmUpBackend(60_000);
    const p2 = warmUpBackend(60_000);
    expect(p1).toBe(p2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const calledUrl = fetchMock.mock.calls[0][0] as string;
    expect(calledUrl.endsWith('/health/live')).toBe(true);
    expect(calledUrl).not.toContain('/health/ready');
    expect(calledUrl).not.toContain('deep');

    rejectFetch(new Error('network down'));
    await expect(p1).resolves.toBeUndefined();
  });
});
