/**
 * F-4 / OAuth linking, full browser flow against the isolated stack with SIMULATED providers
 * (scripts/e2e-isolated.sh with E2E_FAKE_OAUTH=1). The provider leg is intercepted in the browser and answered by the
 * API process' simulated fetch; this demonstrates the LOCAL flow, not real Google/GitHub interoperability.
 */
import { test, expect, type Page } from './support/test';
import { API, registerUser, sql, type TestUser } from './support/env';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { htmlRedirect } from './support/network-policy';

const rejectOptionalCookies = () => {
  const key = 'anclora-cookie-consent-v1';
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify({ necessary: true, analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 'v1' }));
  }
};
const b64 = (o: unknown) => Buffer.from(JSON.stringify(o)).toString('base64url');
const googleCode = (profile: Record<string, unknown>) => `g.${b64(profile)}`;
const githubCode = (p: Record<string, unknown>) => `gh.${b64(p)}`;
const stored = (page: Page) => page.evaluate(() => ({ access: localStorage.getItem('accessToken'), refresh: localStorage.getItem('refreshToken'), attempt: sessionStorage.getItem('anclora.oauth.attempt') }));
const userIdOf = (t: string | null) => { try { return JSON.parse(Buffer.from((t as string).split('.')[1], 'base64url').toString()).userId as string; } catch { return null; } };

/**
 * Plays the provider WITHOUT the browser ever leaving the local stack: the API's own redirect response (state + the
 * transaction cookie) is fetched with redirects disabled, and instead of following Location to the provider the browser is
 * redirected straight to the API callback with the synthetic code. External hosts are blocked by the context-level
 * preventive policy (e2e/support/network-policy.ts), not by a listener.
 */
async function interceptProvider(page: Page, provider: 'google' | 'github', code: string, opts: { hold?: Promise<void> } = {}) {
  await page.route(`${API}/auth/${provider}?**`, async (route) => {
    const response = await route.fetch({ maxRedirects: 0 });
    const location = response.headers()['location'];
    const state = new URL(location).searchParams.get('state')!;
    if (opts.hold) await opts.hold;
    const callback = `${API}/auth/${provider}/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`;
    // keeps the API's transaction cookie; the browser then makes a NEW (routed, policy-checked) navigation to the callback
    await route.fulfill(htmlRedirect(callback, response.headers()['set-cookie']));
  });
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(rejectOptionalCookies);
});

async function clickProvider(page: Page, provider: 'google' | 'github') {
  await page.goto('/auth/login');
  const label = provider === 'google' ? /google/i : /github/i;
  await page.getByRole('button', { name: label }).click();
}

test('legitimate Google sign-in: new verified account is created, session works, URL is clean', async ({ page }) => {
  const email = `oauth-new-${randomUUID().slice(0, 8)}@example.test`;
  await interceptProvider(page, 'google', googleCode({ sub: `g-${randomUUID()}`, email, email_verified: true, name: 'Oauth New' }));
  await clickProvider(page, 'google');
  await page.waitForURL((u) => u.pathname.startsWith('/dashboard'), { timeout: 30_000 });
  const s = await stored(page);
  expect(s.refresh).toBeTruthy();
  expect(s.attempt).toBeNull();
  expect(page.url()).not.toMatch(/code=|token/i);
  const me = await page.evaluate(async ([api, token]) => (await fetch(`${api}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).json(), [API, s.access] as const);
  expect(me.email).toBe(email);
  expect(me.isAdmin).toBe(false);

  // The OAuth session is an ordinary server session: access tokens last 5 s here, so a reload after that exercises the
  // silent refresh; then a server-side logout revokes it (refresh token no longer works).
  await page.waitForTimeout(6500);
  await page.reload();
  await expect(page).toHaveURL(/\/dashboard/);
  const after = await stored(page);
  expect(after.refresh).toBeTruthy();
  const out = await page.request.post(`${API}/auth/logout`, { data: { refreshToken: after.refresh } });
  expect(out.status()).toBe(200);
  const refreshed = await page.request.post(`${API}/auth/refresh`, { data: { refreshToken: after.refresh } });
  expect(refreshed.status()).toBe(401);
});

test('Google profile with email_verified=false: refused, nothing stored, no account', async ({ page }) => {
  const email = `oauth-unv-${randomUUID().slice(0, 8)}@example.test`;
  await interceptProvider(page, 'google', googleCode({ sub: `g-${randomUUID()}`, email, email_verified: false }));
  await clickProvider(page, 'google');
  await page.waitForURL((u) => u.pathname.startsWith('/auth/error'), { timeout: 30_000 });
  const s = await stored(page);
  expect(s.refresh).toBeNull();
  expect(sql(`select count(*) from users where email='${email}'`)).toBe('0');
});

test('GitHub with a public profile e-mail but no verified e-mail in /user/emails: refused', async ({ page }) => {
  const email = `oauth-gh-${randomUUID().slice(0, 8)}@example.test`;
  await interceptProvider(page, 'github', githubCode({ user: { id: 880000 + Math.floor(Math.random() * 90000), email, login: 'x' }, emails: [{ email, primary: true, verified: false }] }));
  await clickProvider(page, 'github');
  await page.waitForURL((u) => u.pathname.startsWith('/auth/error'), { timeout: 30_000 });
  expect((await stored(page)).refresh).toBeNull();
  expect(sql(`select count(*) from users where email='${email}'`)).toBe('0');
});

test('victim with a password account pre-registered by someone else: OAuth with the same verified e-mail is refused, nothing linked', async ({ page, request }) => {
  const pre: TestUser = await registerUser(request, 'oauth-pre');
  const sub = `g-${randomUUID()}`;
  await interceptProvider(page, 'google', googleCode({ sub, email: pre.email, email_verified: true, name: 'Victim' }));
  await clickProvider(page, 'google');
  await page.waitForURL((u) => u.pathname.startsWith('/auth/error'), { timeout: 30_000 });
  expect((await stored(page)).refresh).toBeNull();
  expect(sql(`select count(*) from oauth_accounts where "providerAccountId"='${sub}'`)).toBe('0');
});

test('a foreign handoff code opened in a browser without the verifier of that flow installs nothing', async ({ page, request }) => {
  // The attacker completes a flow with THEIR OWN client (plain HTTP, own cookie jar and verifier) and ends with a code.
  const attackerEmail = `oauth-att-${randomUUID().slice(0, 8)}@example.test`;
  const verifier = randomBytes(32).toString('base64url');
  const challenge = createHash('sha256').update(verifier).digest('base64url');
  const start = await request.get(`${API}/auth/google?challenge=${challenge}`, { maxRedirects: 0 });
  expect(start.status()).toBe(302);
  const state = new URL(start.headers()['location']).searchParams.get('state')!;
  const code = googleCode({ sub: `g-${randomUUID()}`, email: attackerEmail, email_verified: true });
  const callback = await request.get(`${API}/auth/google/callback?code=${encodeURIComponent(code)}&state=${state}`, { maxRedirects: 0 });
  const leaked = callback.headers()['location'];
  expect(leaked).toContain('/auth/callback#code=');
  const handoff = new URLSearchParams(new URL(leaked).hash.slice(1)).get('code')!;

  // The victim opens the attacker's URL in a browser that never started this flow.
  await page.goto(leaked);
  await page.waitForURL((u) => u.pathname.startsWith('/auth/error'), { timeout: 15_000 });
  const s = await stored(page);
  expect(s.access).toBeNull();
  expect(s.refresh).toBeNull();

  // Control: the code was genuinely valid (it was not refused because it was dead): the attacker's own verifier redeems it.
  const redeemed = await request.post(`${API}/auth/oauth/exchange`, { data: { code: handoff, verifier, provider: 'google' } });
  expect(redeemed.status()).toBe(200);
  // ... and a replay is refused.
  expect((await request.post(`${API}/auth/oauth/exchange`, { data: { code: handoff, verifier, provider: 'google' } })).status()).toBe(401);
});

test('already signed in as B: a foreign callback with a code does not replace B', async ({ page, request }) => {
  const b = await registerUser(request, 'oauth-b');
  await page.goto('/auth/login');
  await page.fill('#email', b.email);
  await page.fill('#password', b.password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !!localStorage.getItem('refreshToken'));
  await page.waitForURL((u) => !u.pathname.startsWith('/auth/login'));
  const before = await stored(page);
  await page.goto('/auth/callback#code=' + 'A'.repeat(43) + '&provider=google');
  await page.waitForURL((u) => u.pathname.startsWith('/auth/error'), { timeout: 15_000 });
  const after = await stored(page);
  expect(userIdOf(after.access)).toBe(b.id);
  expect(after.refresh).not.toBeNull();
  void before;
});

test('a flow started in a tab whose session changed meanwhile (another tab signed in) is not applied', async ({ page, request }) => {
  const other = await registerUser(request, 'oauth-other');
  const email = `oauth-late-${randomUUID().slice(0, 8)}@example.test`;
  await interceptProvider(page, 'google', googleCode({ sub: `g-${randomUUID()}`, email, email_verified: true }));
  // Simulates another tab signing in as someone else while the provider leg was in flight: the shared localStorage
  // already holds the other session when the callback page of this tab starts.
  await page.addInitScript(([access, refresh]) => {
    if (location.pathname === '/auth/callback') {
      localStorage.setItem('accessToken', access as string);
      localStorage.setItem('refreshToken', refresh as string);
    }
  }, [other.accessToken, other.refreshToken]);
  await page.goto('/auth/login');
  await page.getByRole('button', { name: /google/i }).click();
  await page.waitForURL((u) => u.pathname.startsWith('/auth/error'), { timeout: 30_000 });
  const s = await stored(page);
  expect(userIdOf(s.access)).toBe(other.id); // the OTHER session stays; the late OAuth result did not replace it
  expect(s.refresh).toBe(other.refreshToken);
  expect(sql(`select count(*) from users where email='${email}'`)).toBe('1'); // created by the provider leg, never installed
});
