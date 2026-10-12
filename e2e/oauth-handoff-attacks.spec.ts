/**
 * F-4: login CSRF / session fixation through /auth/callback. A victim's browser must never install credentials that
 * arrive in the URL (fragment or query) unless it started that very flow. Isolated stack, synthetic users, NO provider.
 * Before the correction these tests FAIL (the attacker's session is installed); after it they pass.
 */
import { test, expect, type Page } from './support/test';
import { registerUser, type TestUser } from './support/env';


const rejectOptionalCookies = () => {
  const key = 'anclora-cookie-consent-v1';
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify({ necessary: true, analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 'v1' }));
  }
};

const stored = (page: Page) =>
  page.evaluate(() => ({ access: localStorage.getItem('accessToken'), refresh: localStorage.getItem('refreshToken') }));

function userIdOf(token: string | null): string | null {
  if (!token) return null;
  try {
    return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')).userId ?? null;
  } catch {
    return null;
  }
}

async function uiLogin(page: Page, user: TestUser) {
  await page.goto('/auth/login');
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !!localStorage.getItem('refreshToken'));
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'));
}

async function openForeignCallback(page: Page, hash: string, search = '') {
  await page.goto(`/auth/callback${search}${hash}`);
  // Either the old flow reloads to /dashboard or the new one lands on the error page; wait for the callback to finish.
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/callback'), { timeout: 15_000 });
  await page.waitForLoadState('load');
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(rejectOptionalCookies);
});

test('victim without any started OAuth flow: attacker tokens in the FRAGMENT are not installed', async ({ page, request }) => {
  const attacker = await registerUser(request, 'f4-attacker-frag');
  const hash = `#accessToken=${encodeURIComponent(attacker.accessToken)}&refreshToken=${encodeURIComponent(attacker.refreshToken)}`;
  await openForeignCallback(page, hash);
  const s = await stored(page);
  expect(userIdOf(s.access)).not.toBe(attacker.id);
  expect(s.refresh).toBeNull();
  expect(s.access).toBeNull();
});

test('victim without any started OAuth flow: attacker tokens in the QUERY are not installed', async ({ page, request }) => {
  const attacker = await registerUser(request, 'f4-attacker-query');
  const search = `?accessToken=${encodeURIComponent(attacker.accessToken)}&refreshToken=${encodeURIComponent(attacker.refreshToken)}`;
  await openForeignCallback(page, '', search);
  const s = await stored(page);
  expect(userIdOf(s.access)).not.toBe(attacker.id);
  expect(s.refresh).toBeNull();
  expect(s.access).toBeNull();
});

test('victim already signed in as B: a foreign callback URL does not replace B or B\'s tokens', async ({ page, request }) => {
  const victim = await registerUser(request, 'f4-victim');
  const attacker = await registerUser(request, 'f4-attacker-b');
  await uiLogin(page, victim);
  const before = await stored(page);
  expect(userIdOf(before.access)).toBe(victim.id);
  const hash = `#accessToken=${encodeURIComponent(attacker.accessToken)}&refreshToken=${encodeURIComponent(attacker.refreshToken)}`;
  await page.goto(`/auth/callback${hash}`);
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/callback'), { timeout: 15_000 });
  await page.waitForLoadState('load');
  const after = await stored(page);
  expect(after.refresh).not.toBe(attacker.refreshToken);
  expect(userIdOf(after.access)).not.toBe(attacker.id);
  // B's session is still B's: the stored refresh token is B's (it may have rotated, never the attacker's).
  expect(after.refresh).not.toBeNull();
});

test('the callback never leaves credentials in the address bar or history', async ({ page, request }) => {
  const attacker = await registerUser(request, 'f4-url');
  const hash = `#accessToken=${encodeURIComponent(attacker.accessToken)}&refreshToken=${encodeURIComponent(attacker.refreshToken)}&code=x`;
  await openForeignCallback(page, hash);
  expect(page.url()).not.toContain('refreshToken');
  expect(page.url()).not.toContain(attacker.refreshToken);
});
