/**
 * O-3 control: the preventive policy blocks non-allowed destinations BEFORE they are sent. The sentinels are LOCAL
 * HTTP servers outside the allow-list with a reception counter: a blocked request must leave the counter at ZERO.
 * No real provider is ever contacted to prove the block.
 */
import http from 'http';
import type { AddressInfo } from 'net';
import { test as base, expect } from '@playwright/test';
import { guardApiRequests, installNetworkPolicy, isAllowed } from './support/network-policy';

function listen(handler: http.RequestListener): Promise<{ server: http.Server; origin: string; hits: () => number; paths: string[] }> {
  let hits = 0;
  const paths: string[] = [];
  const server = http.createServer((req, res) => { hits += 1; paths.push(String(req.url)); handler(req, res); });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => {
    resolve({ server, origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, hits: () => hits, paths });
  }));
}
const close = (s: http.Server) => new Promise<void>((r) => s.close(() => r()));

base('policy aborts a LOCAL non-allowed origin: fetch, navigation, sub-resource and a redirect hop; sentinel receives ZERO', async ({ browser }) => {
  const sentinel = await listen((_req, res) => { res.setHeader('Access-Control-Allow-Origin', '*'); res.end('sentinel'); });
  // An ALLOWED origin that 302-redirects to the sentinel (the hop from an allowed to a forbidden destination).
  const redirector = await listen((_req, res) => { res.statusCode = 302; res.setHeader('Location', `${sentinel.origin}/via-redirect`); res.end(); });
  const page0 = await listen((_req, res) => { res.setHeader('Content-Type', 'text/html'); res.end(`<img src="${sentinel.origin}/img"><script src="${sentinel.origin}/s.js"></script><p>ok</p>`); });

  const context = await browser.newContext({ serviceWorkers: 'block' });
  const blocked = await installNetworkPolicy(context, { allowedOrigins: [redirector.origin, page0.origin] });
  const page = await context.newPage();

  // allowed origin works
  await page.goto(page0.origin + '/');
  await expect(page.locator('p')).toHaveText('ok');

  // 1. fetch to the sentinel from an allowed page
  const fetched = await page.evaluate(async (url) => { try { await fetch(url, { mode: 'no-cors' }); return 'sent'; } catch { return 'blocked'; } }, `${sentinel.origin}/fetch`);
  expect(fetched).toBe('blocked');
  // 2. top-level navigation to the sentinel
  await page.goto(`${sentinel.origin}/nav`).catch(() => undefined);
  // 3. redirect hop: allowed origin -> sentinel
  await page.goto(`${redirector.origin}/start`).catch(() => undefined);
  // 4. a NEW page of the same context
  const second = await context.newPage();
  await second.goto(`${sentinel.origin}/second`).catch(() => undefined);

  expect(sentinel.paths).toEqual([]);
  expect(sentinel.hits()).toBe(0);
  expect(blocked.length).toBeGreaterThanOrEqual(4);
  expect(blocked.every((entry) => entry.includes(new URL(sentinel.origin).host))).toBe(true);

  await context.close();
  await Promise.all([close(sentinel.server), close(redirector.server), close(page0.server)]);
});

base('policy blocks a MULTI-hop redirect chain (allowed -> allowed -> forbidden): the second hop is checked again; sentinel receives ZERO', async ({ browser }) => {
  const sentinel = await listen((_req, res) => res.end('sentinel'));
  const second = await listen((_req, res) => { res.statusCode = 302; res.setHeader('Location', `${sentinel.origin}/chain-end`); res.end(); });
  const first = await listen((_req, res) => { res.statusCode = 302; res.setHeader('Location', `${second.origin}/hop2`); res.end(); });
  const context = await browser.newContext({ serviceWorkers: 'block' });
  const blocked = await installNetworkPolicy(context, { allowedOrigins: [first.origin, second.origin] });
  const page = await context.newPage();
  await page.goto(`${first.origin}/hop1`).catch(() => undefined);
  expect(second.hits()).toBeGreaterThanOrEqual(0);
  expect(sentinel.paths).toEqual([]);
  expect(blocked.some((entry) => entry.includes(new URL(sentinel.origin).host))).toBe(true);
  await context.close();
  await Promise.all([close(sentinel.server), close(second.server), close(first.server)]);
});

base('API request guard refuses non-allowed origins before sending; allowed ones pass', async ({ playwright }) => {
  const sentinel = await listen((_req, res) => res.end('sentinel'));
  const local = await listen((_req, res) => res.end('local'));
  const raw = await playwright.request.newContext();
  const guarded = guardApiRequests(raw, [local.origin]);
  await expect(async () => guarded.get(`${sentinel.origin}/x`)).rejects.toThrow(/non-allowed origin/);
  expect(sentinel.hits()).toBe(0);
  const ok = await guarded.get(`${local.origin}/y`);
  expect(ok.status()).toBe(200);
  expect(local.hits()).toBe(1);
  await raw.dispose();
  await Promise.all([close(sentinel.server), close(local.server)]);
});

base('allow-list matching is exact on origin (port and host)', () => {
  expect(isAllowed('http://127.0.0.1:3100/a', ['http://127.0.0.1:3100'])).toBe(true);
  expect(isAllowed('http://127.0.0.1:3101/a', ['http://127.0.0.1:3100'])).toBe(false);
  expect(isAllowed('http://localhost:3100/a', ['http://127.0.0.1:3100'])).toBe(false);
  expect(isAllowed('https://accounts.google.com/', ['http://127.0.0.1:3100'])).toBe(false);
  expect(isAllowed('not a url', ['http://127.0.0.1:3100'])).toBe(false);
});
