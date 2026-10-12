/** @jest-environment jsdom */
import { webcrypto, createHash } from 'crypto';
import { TextEncoder as NodeTextEncoder } from 'util';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
(globalThis as any).TextEncoder = (globalThis as any).TextEncoder ?? NodeTextEncoder;

import * as navigate from '@/lib/auth/navigate';
jest.mock('@/lib/auth/navigate', () => ({ goTo: jest.fn(), replaceWith: jest.fn() }));
import { beginOAuth, takeOAuthAttempt, OAUTH_ATTEMPT_KEY, OAUTH_ATTEMPT_MAX_AGE_MS, storedIdentity } from '@/lib/auth/oauth';

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
