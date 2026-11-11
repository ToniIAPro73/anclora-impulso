// Browser cookie/session probe with the QA identity (Chrome, Chromium or WebKit).
// Usage: node scripts/qa/browser-session-probe.mjs <engine> <mode> <pageUrl> [apiUrl] [--strip-csp]
//   engine: chrome | chromium | webkit        mode: ui-session | cross-site | same-site
// --strip-csp is TEST-ONLY: removes CSP headers so http:// local origins are not upgraded to https.
// Prints booleans and status codes only. Errors pass through safe().
import { config } from 'dotenv';
import { safe, report } from './safe-output.mjs';
import { createRequire } from 'node:module';

config({ path: '.env.development.local', quiet: true });
const require = createRequire(import.meta.url);
const { chromium, webkit } = require('@playwright/test');

const [engine = 'webkit', mode = 'ui-session', pageUrl = 'http://127.0.0.1:3000/auth/login', apiUrl = ''] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const stripCsp = process.argv.includes('--strip-csp');
// --csp-route: WebKit fallback. Re-issues DOCUMENT responses only (API traffic is never intercepted).
const cspRoute = process.argv.includes('--csp-route');
const email = process.env.QA_EMAIL;
const password = process.env.QA_PASSWORD;

async function launch() {
  if (engine === 'webkit') return webkit.launch();
  if (engine === 'chrome') return chromium.launch({ channel: 'chrome' });
  return chromium.launch();
}

async function uiSession(context, page, out) {
  await page.goto(pageUrl, { waitUntil: 'load', timeout: 60000 });
  await page.locator('input[type="email"]').first().waitFor({ timeout: 30000 });
  await page.waitForTimeout(2000);
  await page.locator('input[type="email"]').first().fill(email);
  await page.locator('input[type="password"]').first().fill(password);
  await page.locator('form').first().evaluate((form) => form.requestSubmit());
  out.loginRedirectedToDashboard = await page.waitForURL(/\/dashboard/, { timeout: 60000 }).then(() => true).catch(() => false);
  const cookies = await context.cookies();
  const rt = cookies.find((c) => c.name === 'refreshToken');
  out.refreshCookie = rt ? { httpOnly: rt.httpOnly, secure: rt.secure, sameSite: rt.sameSite, pathIsApiAuth: rt.path === '/api/auth' } : null;
  await page.evaluate(() => localStorage.setItem('accessToken', 'eyJhbGciOiJIUzI1NiJ9.eyJ4IjoxfQ.invalidsignature'));
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(8000);
  out.expiredAccessKeepsSession = /\/dashboard/.test(new URL(page.url()).pathname);
  out.refreshTokenInLocalStorage = await page.evaluate(() => localStorage.getItem('refreshToken') !== null);
  out.logoutStatus = await page.evaluate(async () => (await fetch('/api/auth/logout', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).catch((e) => `error:${e.name}`);
  out.refreshAfterLogoutStatus = await page.evaluate(async () => (await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status).catch((e) => `error:${e.name}`);
}

async function crossOrSameSite(page, out) {
  // --real-page: load a page served by the real frontend (correct network address space for Chrome's Private Network Access).
  if (!process.argv.includes('--real-page')) {
    await page.route(`${new URL(pageUrl).origin}/**`, (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<html><body>probe</body></html>' }));
  }
  await page.goto(pageUrl, { waitUntil: 'load' });
  out.pageOrigin = new URL(pageUrl).origin;
  out.apiOrigin = new URL(apiUrl).origin;
  out.result = await page.evaluate(async ({ apiUrl, email, password }) => {
    const login = await fetch(`${apiUrl}/auth/login`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }).then((r) => r.status).catch((e) => `error:${e.name}`);
    const refresh = await fetch(`${apiUrl}/auth/refresh`, { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: '{}' }).then((r) => r.status).catch((e) => `error:${e.name}`);
    return { login, refreshWithCookie: refresh };
  }, { apiUrl, email, password });
}

(async () => {
  const out = { engine, mode };
  let browser;
  try {
    if (!email || !password) throw new Error('QA credentials not loaded');
    browser = await launch();
    // --strip-csp uses Playwright's bypassCSP. Route-based stripping re-issues responses and distorts both
    // cookie rules (request cookies sent outside SameSite) and Chrome's Private Network Access (see 17 §13).
    const context = await browser.newContext({ bypassCSP: stripCsp && !cspRoute });
    if (stripCsp && cspRoute) {
      await context.route('**/*', async (route) => {
        if (route.request().resourceType() !== 'document') return route.continue();
        try {
          const res = await route.fetch();
          const headers = { ...res.headers() };
          delete headers['content-security-policy'];
          delete headers['content-security-policy-report-only'];
          await route.fulfill({ response: res, headers });
        } catch { /* request closed */ }
      });
    }
    const page = await context.newPage();
    if (mode === 'ui-session') await uiSession(context, page, out);
    else await crossOrSameSite(page, out);
    try { await page.unrouteAll({ behavior: 'ignoreErrors' }); } catch { /* ignore */ }
  } catch (error) {
    out.error = safe(error);
  } finally {
    if (browser) await browser.close().catch(() => {});
  }
  report(out);
})();
