/**
 * E2E against the isolated stack (scripts/e2e-isolated.sh): API :3101 + Next :3100 + test PostgreSQL.
 * Access tokens last 5 s here so silent refresh is exercised for real. Synthetic users only.
 */
import { test, expect, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { API, apiLogin, registerUser, sql, type TestUser } from './support/env';

test.describe.configure({ mode: 'serial' });

const SHOTS = process.env.E2E_ARTIFACT_DIR
  ? path.join(process.env.E2E_ARTIFACT_DIR, 'screenshots')
  : path.resolve(__dirname, `../artifacts/qa/adhoc/${new Date().toISOString().replace(/[:.]/g, '-')}`);
const EXPIRY_WAIT_MS = Number(process.env.E2E_JWT_EXPIRES_IN?.replace(/\D/g, '') || 5) * 1000 + 1500;

async function uiLogin(page: Page, user: TestUser) {
  await page.goto('/auth/login');
  await page.fill('#email', user.email);
  await page.fill('#password', user.password);
  await page.click('button[type="submit"]');
  await page.waitForFunction(() => !!localStorage.getItem('refreshToken'));
  await page.waitForURL((url) => !url.pathname.startsWith('/auth/login'));
}

const stored = (page: Page) =>
  page.evaluate(() => ({ access: localStorage.getItem('accessToken'), refresh: localStorage.getItem('refreshToken') }));

function countRefreshCalls(page: Page) {
  const counter = { n: 0 };
  page.on('request', (r) => {
    if (r.url().endsWith('/auth/refresh') && r.method() === 'POST') counter.n += 1;
  });
  return counter;
}

test.beforeAll(() => fs.mkdirSync(SHOTS, { recursive: true }));

// A returning visitor who already rejected optional cookies (keeps the consent dialog out of the way).
const rejectOptionalCookies = () => {
  const key = 'anclora-cookie-consent-v1';
  if (!localStorage.getItem(key)) {
    localStorage.setItem(key, JSON.stringify({ necessary: true, analytics: false, marketing: false, updatedAt: new Date().toISOString(), version: 'v1' }));
  }
};

/**
 * Attribution of every logout/discard in the browser (R8). Records only reason + origin: the request body also
 * carries the refresh token and is deliberately NOT stored. Attached to each test as auth-events.json.
 */
const authEventsByPage = new WeakMap<Page, Array<Record<string, unknown>>>();
function trackAuthEvents(page: Page) {
  const events: Array<Record<string, unknown>> = [];
  authEventsByPage.set(page, events);
  const t0 = Date.now();
  page.on('console', (msg) => {
    const text = msg.text();
    if (text.startsWith('[auth]')) events.push({ t: Date.now() - t0, source: 'console', text });
  });
  page.on('request', (req) => {
    if (req.method() === 'POST' && req.url().endsWith('/auth/logout')) {
      let reason = 'unspecified', origin = 'unspecified';
      try { const b = JSON.parse(req.postData() ?? '{}'); reason = b.reason ?? reason; origin = b.origin ?? origin; } catch { /* no body */ }
      events.push({ t: Date.now() - t0, source: 'request', method: 'POST', path: '/auth/logout', reason, origin });
    }
  });
  return events;
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(rejectOptionalCookies);
  trackAuthEvents(page);
});

test.afterEach(async ({ page }, testInfo) => {
  const events = authEventsByPage.get(page) ?? [];
  // written to the test's output dir so it is kept with the run evidence (reason + origin only, never tokens)
  const file = testInfo.outputPath('auth-events.json');
  fs.writeFileSync(file, JSON.stringify({ test: testInfo.title, status: testInfo.status, events }, null, 2));
  await testInfo.attach('auth-events.json', { path: file, contentType: 'application/json' });
});

test('login, then silent refresh after the access token expires (rotated opaque refresh token)', async ({ page, request }) => {
  const user = await registerUser(request, 'refresh');
  await uiLogin(page, user);
  const before = await stored(page);
  expect(before.refresh?.startsWith('rt1.')).toBe(true);

  await page.waitForTimeout(EXPIRY_WAIT_MS);
  const calls = countRefreshCalls(page);
  await page.reload();
  await page.waitForLoadState('networkidle');

  expect(page.url()).not.toContain('/auth/login');
  const after = await stored(page);
  expect(after.refresh).not.toBe(before.refresh);
  expect(after.access).not.toBe(before.access);
  expect(calls.n).toBeGreaterThanOrEqual(1);
});

test('simultaneous refresh: one request per tab, two tabs both survive, session is not revoked', async ({ browser, request }) => {
  const user = await registerUser(request, 'concurrent');
  const context = await browser.newContext();
  await context.addInitScript(rejectOptionalCookies);
  const p1 = await context.newPage();
  await uiLogin(p1, user);
  const p2 = await context.newPage();
  await p2.goto('/dashboard');
  await p2.waitForLoadState('networkidle');

  await p1.waitForTimeout(EXPIRY_WAIT_MS);
  const c1 = countRefreshCalls(p1);
  const c2 = countRefreshCalls(p2);
  await Promise.all([p1.reload(), p2.reload()]);
  await Promise.all([p1.waitForLoadState('networkidle'), p2.waitForLoadState('networkidle')]);

  expect(p1.url()).not.toContain('/auth/login');
  expect(p2.url()).not.toContain('/auth/login');
  expect(c1.n).toBeLessThanOrEqual(1);
  expect(c2.n).toBeLessThanOrEqual(1);
  expect(sql(`select count(*) from auth_sessions where "userId"='${user.id}' and "revokedAt" is not null`)).toBe('0');
  await context.close();
});

test('logout revokes the session on the server: old tokens are useless afterwards', async ({ page, request }) => {
  const user = await registerUser(request, 'logout');
  await uiLogin(page, user);
  const tokens = await stored(page);

  await page.getByTestId('user-menu').click();
  await page.getByTestId('logout').click();
  await page.waitForURL(/\/auth\/login/);
  const cleared = await stored(page);
  expect(cleared.access).toBeNull();
  expect(cleared.refresh).toBeNull();

  await expect.poll(() => sql(`select count(*) from auth_sessions where "userId"='${user.id}' and "revokedReason"='logout'`)).toBe('1');
  // the only logout request came from the explicit click, and says so
  const logouts = (authEventsByPage.get(page) ?? []).filter((e) => e.source === 'request');
  expect(logouts).toHaveLength(1);
  expect(logouts[0]).toMatchObject({ reason: 'user_action', origin: 'auth-context.logout' });
  const me = await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${tokens.access}` } });
  expect(me.status()).toBe(401);
  const refresh = await request.post(`${API}/auth/refresh`, { data: { refreshToken: tokens.refresh } });
  expect(refresh.status()).toBe(401);
});

test('a failing or aborted profile load does not revoke a valid session (500, network abort)', async ({ page, request }) => {
  const user = await registerUser(request, 'profilefail');
  await uiLogin(page, user);
  const before = await stored(page);
  expect(before.refresh).toBeTruthy();
  const revoked = () => sql(`select count(*) from auth_sessions where "userId"='${user.id}' and "revokedAt" is not null`);

  // 1) profile answers 500
  await page.route('**/api/profile', (route) => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"boom"}' }));
  await page.goto('/dashboard');
  await page.waitForLoadState('networkidle');
  expect(await revoked()).toBe('0');
  expect((await stored(page)).refresh).toBeTruthy();

  // 2) profile request is aborted (network failure / interrupted navigation)
  await page.unroute('**/api/profile');
  await page.route('**/api/profile', (route) => route.abort('failed'));
  await page.goto('/workouts/generate');
  await page.waitForLoadState('networkidle');
  expect(await revoked()).toBe('0');
  expect((await stored(page)).refresh).toBeTruthy();

  // no logout request of any kind was issued by the client
  expect((authEventsByPage.get(page) ?? []).filter((e) => e.source === 'request')).toHaveLength(0);

  // and the session is still good once the profile endpoint works again
  await page.unroute('**/api/profile');
  const token = await apiLogin(request, user);
  expect((await request.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } })).status()).toBe(200);
});

test('disabled user: next refresh fails, the app returns to login and the API rejects the tokens', async ({ page, request }) => {
  const user = await registerUser(request, 'disabled');
  await uiLogin(page, user);
  const tokens = await stored(page);
  sql(`update users set "disabledAt"=now() where id='${user.id}'`);

  await page.waitForTimeout(EXPIRY_WAIT_MS);
  await page.reload();
  await page.waitForURL(/\/auth\/login/);
  expect((await stored(page)).refresh).toBeNull();
  const refresh = await request.post(`${API}/auth/refresh`, { data: { refreshToken: tokens.refresh } });
  expect(refresh.status()).toBe(401);
  const login = await request.post(`${API}/auth/login`, { data: { email: user.email, password: user.password } });
  expect(login.status()).toBe(401);
});

test('A/B isolation: user B cannot see or fetch user A\'s routine', async ({ page, request }) => {
  const a = await registerUser(request, 'owner');
  const b = await registerUser(request, 'intruder');
  const exerciseId = sql(`select id from exercises where name like 'E2E beginner home%' limit 1`);
  const token = await apiLogin(request, a);
  const created = await request.post(`${API}/workouts`, {
    headers: { Authorization: `Bearer ${token}` },
    data: { name: 'A-PRIVATE-ROUTINE-MARKER', exercises: [{ exerciseId, sets: 3, reps: 10, rest: 60, order: 0 }] },
  });
  expect(created.status()).toBe(201);
  const workoutId = (await created.json()).id as string;

  await uiLogin(page, b);
  await page.goto(`/workouts/${workoutId}`);
  await page.waitForLoadState('networkidle');
  await expect(page.locator('body')).not.toContainText('A-PRIVATE-ROUTINE-MARKER');

  const bToken = await apiLogin(request, b);
  const direct = await request.get(`${API}/workouts/${workoutId}`, { headers: { Authorization: `Bearer ${bToken}` } });
  expect(direct.status()).toBe(404);
});

test('coach (API level; the product has no coach UI yet): retry with the same key does not consume quota twice', async ({ request }) => {
  const user = await registerUser(request, 'coach');
  const headers = (key?: string) => ({ Authorization: `Bearer ${user.accessToken}`, ...(key ? { 'Idempotency-Key': key } : {}) });
  const key = `e2e-${Date.now()}-coach-retry`;
  const body = { message: 'How should I plan this week of training?' };

  const first = await request.post(`${API}/v1/coach/messages`, { headers: headers(key), data: body });
  expect(first.status()).toBe(200);
  const second = await request.post(`${API}/v1/coach/messages`, { headers: headers(key), data: body });
  expect(second.status()).toBe(200);
  expect(second.headers()['idempotent-replayed']).toBe('true');
  expect((await second.json()).answer).toBe((await first.json()).answer);
  expect(sql(`select coalesce(sum("requestCount"),0) from coach_usage_windows where "userId"='${user.id}'`)).toBe('1');

  const different = await request.post(`${API}/v1/coach/messages`, { headers: headers(key), data: { message: 'A completely different question' } });
  expect(different.status()).toBe(422);
  const missing = await request.post(`${API}/v1/coach/messages`, { headers: headers(), data: body });
  expect(missing.status()).toBe(428);
});

async function readyGeneratorPage(page: Page, request: Parameters<typeof registerUser>[0], label: string) {
  const user = await registerUser(request, label);
  await uiLogin(page, user);
  await page.goto('/workouts/generate');
  await expect(page.getByTestId('generate-workout')).toBeEnabled({ timeout: 20_000 });
  return user;
}

test('generation: a lost response is retried with the same key and creates exactly one routine', async ({ page, request }) => {
  const user = await readyGeneratorPage(page, request, 'generate');
  const keys: string[] = [];
  let first = true;
  await page.route('**/workouts/generate', async (route) => {
    keys.push(route.request().headers()['idempotency-key'] ?? '');
    if (first) {
      first = false;
      await route.fetch(); // the server processes and persists...
      await route.abort('failed'); // ...but the response never reaches the page
      return;
    }
    await route.continue();
  });

  // Before the outcome is known the label must not promise AI generation.
  await expect(page.getByTestId('generate-workout')).not.toContainText(/\bIA\b|\bAI\b/);
  await page.getByTestId('generate-workout').click();
  await expect(page.getByTestId('fallback-notice')).toBeVisible({ timeout: 30_000 });
  // After: the real mode is shown, and the fallback is not presented as an error.
  await expect(page.getByTestId('generation-mode')).toHaveAttribute('data-mode', 'fallback');
  await expect(page.getByTestId('generate-error')).toHaveCount(0);
  await expect(page.getByTestId('fallback-notice')).not.toContainText(/error|fall[oó]/i);
  // Hermes gate (2026-10-13): honest for every fallback cause (unavailable, timeout, error, rejected by validation).
  await expect(page.getByTestId('fallback-notice')).toContainText(/no pudo completarse|could not complete/);
  await expect(page.getByTestId('fallback-notice')).not.toContainText(/no estaba disponible|was not available/);

  expect(keys.length).toBeGreaterThanOrEqual(2);
  expect(new Set(keys).size).toBe(1);
  expect(sql(`select count(*) from workouts where "userId"='${user.id}'`)).toBe('1');
  expect(sql(`select "generationMode" from workouts where "userId"='${user.id}'`)).toBe('fallback');
});

for (const viewport of [{ name: 'mobile', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 800 }]) {
  for (const theme of ['light', 'dark']) {
    test(`fallback notice is visible and fits: ${viewport.name} / ${theme}`, async ({ page, request }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.addInitScript((t) => localStorage.setItem('theme', t), theme);
      await readyGeneratorPage(page, request, `fb-${viewport.name}-${theme}`);

      await page.getByTestId('generate-workout').click();
      const notice = page.getByTestId('fallback-notice');
      await expect(notice).toBeVisible({ timeout: 30_000 });
      await notice.scrollIntoViewIfNeeded();

      expect(await page.evaluate(() => document.documentElement.classList.contains('dark'))).toBe(theme === 'dark');
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow).toBeLessThanOrEqual(0);
      const box = await notice.boundingBox();
      expect(box && box.x >= 0 && box.x + box.width <= viewport.width + 1).toBe(true);
      await expect(notice).toHaveAttribute('role', 'status');

      await page.screenshot({ path: path.join(SHOTS, `fallback-${viewport.name}-${theme}.png`), fullPage: false });
    });
  }
}

test('error states: server failure and quota exhaustion are explained and create nothing', async ({ page, request }) => {
  const user = await readyGeneratorPage(page, request, 'errors');

  await page.route('**/workouts/generate', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Error interno del servidor' }) }),
  );
  await page.getByTestId('generate-workout').click();
  await expect(page.getByTestId('generate-error')).toBeVisible();
  await expect(page.getByTestId('generate-error')).toContainText(/Error interno|Internal/i);

  await page.unroute('**/workouts/generate');
  const resetsAt = new Date(Date.now() + 25 * 60_000).toISOString();
  await page.route('**/workouts/generate', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'rate limit', reason: 'quota_exhausted', windowResetsAt: resetsAt, retryAfterSeconds: 1500 }),
    }),
  );
  await page.getByTestId('generate-workout').click();
  const expected = new Date(resetsAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const expectedEn = new Date(resetsAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  await expect(page.getByTestId('generate-error')).toContainText(new RegExp(`${expected}|${expectedEn}`));
  // Hermes gate (2026-10-13): the window is rolling, so at that time ONE generation frees up, not the whole allowance.
  await expect(page.getByTestId('generate-error')).toContainText(/Podrás generar otra|You can generate another/);
  await expect(page.getByTestId('generate-error')).not.toContainText(/restablece|resets/i);

  // Hermes gate (round 4): other 429 reasons are explained in the user's language, not with the server's English text.
  await page.unroute('**/workouts/generate');
  await page.route('**/workouts/generate', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Too many generation requests in flight; retry shortly', reason: 'concurrency_limit', retryAfterSeconds: 1 }),
    }),
  );
  await page.getByTestId('generate-workout').click();
  await expect(page.getByTestId('generate-error')).toContainText(/solicitudes simultáneas|simultaneous requests/, { timeout: 30_000 });
  await expect(page.getByTestId('generate-error')).not.toContainText(/in flight|Idempotency/);

  await page.unroute('**/workouts/generate');
  await page.route('**/workouts/generate', (route) =>
    route.fulfill({
      status: 429,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Too many attempts for this Idempotency-Key; start a new request later', reason: 'idempotency_attempts_exhausted', attempts: 3 }),
    }),
  );
  await page.getByTestId('generate-workout').click();
  await expect(page.getByTestId('generate-error')).toContainText(/Demasiados intentos fallidos|Too many failed attempts/);
  await expect(page.getByTestId('generate-error')).not.toContainText(/Idempotency|new request/);

  expect(sql(`select count(*) from workouts where "userId"='${user.id}'`)).toBe('0');
});
