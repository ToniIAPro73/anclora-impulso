// Authenticated API probe with the QA identity. Usage: node scripts/qa/auth-probe.mjs <apiBase>
// Prints status codes and cookie attribute booleans only. Never prints headers, bodies, tokens or passwords.
import { config } from 'dotenv';
import { safe, report } from './safe-output.mjs';

config({ path: '.env.development.local', quiet: true });
const apiBase = (process.argv[2] || 'http://127.0.0.1:3001/api').replace(/\/+$/, '');
const email = process.env.QA_EMAIL;
const password = process.env.QA_PASSWORD;

const flags = (setCookie) => {
  if (!setCookie) return null;
  const parts = setCookie.split(';').map((p) => p.trim());
  const attr = (k) => (parts.find((p) => p.toLowerCase().startsWith(`${k}=`)) || '').split('=')[1] || null;
  return {
    named: parts[0].split('=')[0] === 'refreshToken',
    httpOnly: parts.some((p) => p.toLowerCase() === 'httponly'),
    secure: parts.some((p) => p.toLowerCase() === 'secure'),
    sameSite: attr('samesite'),
    path: attr('path'),
  };
};

(async () => {
  const result = { apiBaseHost: new URL(apiBase).host };
  try {
    if (!email || !password) throw new Error('QA credentials not loaded from .env.development.local');
    const login = await fetch(`${apiBase}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const loginBody = await login.json().catch(() => ({}));
    const loginCookie = login.headers.getSetCookie()[0];
    result.login = { status: login.status, bodyHasAccessToken: typeof loginBody.accessToken === 'string', bodyHasRefreshToken: typeof loginBody.refreshToken === 'string', cookie: flags(loginCookie) };
    const cookieHeader = loginCookie ? loginCookie.split(';')[0] : '';
    result.meWithBearer = (await fetch(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${loginBody.accessToken || ''}` } })).status;
    const refresh = await fetch(`${apiBase}/auth/refresh`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader }, body: '{}' });
    result.refreshWithCookie = refresh.status;
    result.logoutWithCookie = (await fetch(`${apiBase}/auth/logout`, { method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookieHeader }, body: '{}' })).status;
  } catch (error) {
    result.error = safe(error);
  }
  report(result);
})();
