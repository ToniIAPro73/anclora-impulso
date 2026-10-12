/** Review R4 end to end: decoy secrets sent through real routes must not appear in the log FILES. */
import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/database';

const logsDir = path.join(__dirname, '../../logs');
const today = () => new Date().toISOString().split('T')[0];
const allLogs = () =>
  fs.existsSync(logsDir)
    ? fs.readdirSync(logsDir).filter((f) => f.includes(today())).map((f) => fs.readFileSync(path.join(logsDir, f), 'utf8')).join('\n')
    : '';
const settle = async (marker: string) => {
  for (let i = 0; i < 40; i += 1) { if (allLogs().includes(marker)) return; await new Promise((r) => setTimeout(r, 100)); }
};

afterAll(async () => { await prisma.$disconnect(); });

describe('log files never contain decoy secrets sent in URLs', () => {
  const id = randomUUID().replace(/-/g, '');
  const D = { notFound: `DECOYNF${id}`, login: `DECOYLG${id}`, oauth: `DECOYOA${id}`, token: `DECOYTK${id}` };

  it('unknown route with secret-looking query', async () => {
    const path404 = `/no-such-route-${id}`;
    const res = await request(app).get(`${path404}?code=${D.notFound}&accessToken=${D.token}`);
    expect(res.status).toBe(404);
    await settle(path404);
    const logs = allLogs();
    expect(logs).toContain(path404); // the 404 itself was logged
    expect(logs.includes(D.notFound)).toBe(false);
    expect(logs.includes(D.token)).toBe(false);
  });

  it('application error (failed login) with secret-looking query', async () => {
    const res = await request(app).post(`/api/auth/login?code=${D.login}`).send({ email: `${id}@example.test`, password: 'definitely-wrong' });
    expect([401, 429]).toContain(res.status);
    await settle('/api/auth/login');
    expect(allLogs().includes(D.login)).toBe(false);
  });

  it('OAuth callback with code and state', async () => {
    await request(app).get(`/api/auth/google/callback?code=${D.oauth}&state=s-${id}`);
    await settle('/api/auth/google/callback');
    const logs = allLogs();
    expect(logs).toContain('/api/auth/google/callback');
    expect(logs.includes(D.oauth)).toBe(false);
  });
});
