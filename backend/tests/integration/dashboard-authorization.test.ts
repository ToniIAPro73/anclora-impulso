/** D8: /api/dashboard/* authorization and log hygiene, against the isolated DB with synthetic users. */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { prisma } from '../../src/config/database';
import { logDateStamp } from '../support/log-date';

const tag = `d8-${randomUUID().slice(0, 8)}`;
const routes = ['/api/dashboard/metrics', '/api/dashboard/db-metrics', '/api/dashboard/logs-stats', '/api/dashboard/logs', '/api/dashboard/summary'];
const emails: string[] = [];
const originalAdmins = [...env.adminUserIds];

async function register(label: string) {
  const email = `${tag}-${label}@example.test`;
  emails.push(email);
  const password = `pw-${randomUUID()}`;
  const res = await request(app).post('/api/auth/register').send({ email, password, fullName: `D8 ${label}` });
  expect(res.status).toBe(201);
  return { email, password, token: res.body.accessToken as string, userId: res.body.user.id as string };
}

afterAll(async () => {
  env.adminUserIds.splice(0, env.adminUserIds.length, ...originalAdmins);
  await prisma.user.deleteMany({ where: { email: { in: emails } } });
  await prisma.$disconnect();
});

describe('dashboard authorization', () => {
  it.each(routes)('anonymous → 401 on %s', async (route) => {
    const res = await request(app).get(route);
    expect(res.status).toBe(401);
    expect(JSON.stringify(res.body)).not.toMatch(/cpu|memory|pid|level|message/i);
  });

  it.each(routes)('authenticated non-admin → 403 on %s', async (route) => {
    const user = await register(`user-${routes.indexOf(route)}`);
    const res = await request(app).get(route).set('Authorization', `Bearer ${user.token}`);
    expect(res.status).toBe(403);
  });

  it('admin → 200 with operational data only', async () => {
    const admin = await register('admin');
    env.adminUserIds.push(admin.userId);
    for (const route of routes) {
      const res = await request(app).get(route).set('Authorization', `Bearer ${admin.token}`);
      expect(res.status).toBe(200);
    }
    const summary = await request(app).get('/api/dashboard/summary').set('Authorization', `Bearer ${admin.token}`);
    expect(Object.keys(summary.body).sort()).toEqual(['database', 'logs', 'security', 'system', 'timestamp']);
  });

  it('logs endpoint caps the limit and rejects unknown levels', async () => {
    const admin = await register('admin-limits');
    env.adminUserIds.push(admin.userId);
    const big = await request(app).get('/api/dashboard/logs?limit=999999').set('Authorization', `Bearer ${admin.token}`);
    expect(big.status).toBe(200);
    expect(big.body.length).toBeLessThanOrEqual(500);
    const bad = await request(app).get('/api/dashboard/logs?level=%3Cscript%3E').set('Authorization', `Bearer ${admin.token}`);
    expect(bad.status).toBe(400);
  });
});

describe('error logs do not contain secrets', () => {
  const logFile = () => path.join(__dirname, '../../logs', `combined-${logDateStamp()}.log`);
  const waitFor = async (needle: string) => {
    for (let i = 0; i < 40; i += 1) {
      if (fs.existsSync(logFile()) && fs.readFileSync(logFile(), 'utf-8').includes(needle)) return true;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    return false;
  };

  it('failed login with a synthetic password does not write the password to logs', async () => {
    const email = `${tag}-logtest@example.test`;
    const password = `SYNTH-PW-${randomUUID()}`;
    await request(app).post('/api/auth/login').send({ email, password }).expect(401);
    expect(await waitFor(email)).toBe(true); // the error entry was written
    expect(fs.readFileSync(logFile(), 'utf-8').includes(password)).toBe(false);
  });

  it('query-string secrets are not written to HTTP logs', async () => {
    const secret = `SYNTH-CODE-${randomUUID()}`;
    await request(app).get(`/api/auth/google/callback?code=${secret}&state=x`);
    await new Promise((resolve) => setTimeout(resolve, 800));
    expect((fs.existsSync(logFile()) ? fs.readFileSync(logFile(), 'utf-8') : '').includes(secret)).toBe(false);
  });
});
