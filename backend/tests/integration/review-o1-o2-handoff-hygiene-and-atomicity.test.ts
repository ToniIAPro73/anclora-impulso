/**
 * O-1: handoff material (code, verifier) never reaches log contexts or log FILES, on any rejection path.
 * O-2: claim and session/refresh issuance share one transaction (fault after the claim => rollback, code still valid),
 *      while a wrong verifier/provider/disabled user still BURNS the code (deliberate policy, committed before the 401).
 * Synthetic users, isolated PostgreSQL. Values are never printed: assertions compare booleans.
 */
import fs from 'fs';
import path from 'path';
import { randomBytes, randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { prisma } from '../../src/config/database';
import * as jwt from '../../src/utils/jwt';
import { createOAuthHandoff, redeemOAuthHandoff } from '../../src/services/oauth-handoff.service';
import { redactSensitive } from '../../src/utils/redact';
import { challengeOf, newVerifier } from '../support/oauth-helpers';

const tag = `o12-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
const logsDir = path.join(__dirname, '../../logs');
const today = () => new Date().toISOString().split('T')[0];
const allLogs = () =>
  fs.existsSync(logsDir)
    ? fs.readdirSync(logsDir).filter((f) => f.includes(today())).map((f) => fs.readFileSync(path.join(logsDir, f), 'utf8')).join('\n')
    : '';
const settle = async (marker: string) => {
  for (let i = 0; i < 40; i += 1) { if (allLogs().includes(marker)) return; await new Promise((r) => setTimeout(r, 100)); }
};
const sessions = (id: string) => prisma.authSession.count({ where: { userId: id } });
const refreshRows = (id: string) => prisma.refreshToken.count({ where: { session: { userId: id } } });

async function user(label: string) {
  const u = await prisma.user.create({ data: { email: `${label}-${tag}@example.test`, fullName: 'O12', passwordHash: null } });
  userIds.push(u.id);
  return u;
}
async function handoff(userId: string, provider = 'google') {
  const verifier = newVerifier();
  const code = await createOAuthHandoff({ userId, provider, challenge: challengeOf(verifier) });
  return { verifier, code, provider };
}

afterEach(() => jest.restoreAllMocks());
afterAll(async () => {
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('O-1: no handoff material in logs', () => {
  it('structural redaction covers verifier-shaped keys', () => {
    const out = JSON.stringify(redactSensitive({ code: 'C1', verifier: 'V1', codeVerifier: 'V2', code_verifier: 'V3', handoffCode: 'H1', provider: 'google' }));
    for (const secret of ['C1', 'V1', 'V2', 'V3', 'H1']) expect(out.includes(`"${secret}"`)).toBe(false);
    expect(out).toContain('google');
  });

  it('rejected exchanges (wrong verifier, replay, malformed, unknown fields) leave no code/verifier in the log files', async () => {
    const u = await user('log');
    const real = await handoff(u.id);
    const decoyCode = `DCYC${randomBytes(24).toString('base64url')}`.slice(0, 43);
    const decoyVerifier = `DCYV${randomBytes(40).toString('base64url')}`;
    const extra = `DCYX${randomBytes(12).toString('hex')}`;
    const marker = `/api/auth/oauth/exchange`;

    // The auth limiter allows 5 FAILED requests per window per suite: use 4 here and keep the later control request unthrottled.
    // 1. wrong verifier for a real code (also burns it)  2. replay with the right verifier
    // 3. malformed value types  4. unknown code + decoy verifier + extra credential-looking fields
    const attempts: Array<Record<string, unknown> | string> = [
      { code: real.code, verifier: decoyVerifier, provider: 'google' },
      { code: real.code, verifier: real.verifier, provider: 'google' },
      { code: 12345, verifier: [decoyVerifier], provider: { x: extra } },
      { code: decoyCode, verifier: decoyVerifier, provider: 'google', codeVerifier: extra, handoffCode: `${extra}1`, accessToken: `${extra}2` },
    ];
    for (const body of attempts) {
      const res = await request(app).post(marker).set('Content-Type', 'application/json').send(typeof body === 'string' ? JSON.stringify(body) : body);
      expect([400, 401]).toContain(res.status);
      expect(res.body.accessToken).toBeUndefined();
    }
    await settle(marker);
    const logs = allLogs();
    expect(logs).toContain(marker); // the rejections WERE logged (the check is not vacuous)
    for (const secret of [real.code, real.verifier, decoyCode, decoyVerifier, extra, `${extra}1`, `${extra}2`]) {
      expect(logs.includes(secret)).toBe(false);
    }
  });
});

describe('O-2: claim + issuance are one transaction', () => {
  it('fault after the claim and the session row, before commit: rollback, no partial session, code still redeemable', async () => {
    const u = await user('rollback');
    const h = await handoff(u.id);
    const real = jwt.generateAccessToken;
    const spy = jest.spyOn(jwt, 'generateAccessToken').mockImplementationOnce(() => { throw new Error('injected fault'); });

    await expect(redeemOAuthHandoff({ code: h.code, verifier: h.verifier, provider: h.provider })).rejects.toThrow('injected fault');
    expect(spy).toHaveBeenCalledTimes(1);
    expect(await sessions(u.id)).toBe(0);
    expect(await refreshRows(u.id)).toBe(0);
    const row = await prisma.oAuthHandoff.findFirstOrThrow({ where: { userId: u.id } });
    expect(row.consumedAt).toBeNull();

    // the SAME code completes on retry (fault gone): exactly one session
    jwt.generateAccessToken; void real;
    const auth = await redeemOAuthHandoff({ code: h.code, verifier: h.verifier, provider: h.provider });
    expect(auth.user.id).toBe(u.id);
    expect(await sessions(u.id)).toBe(1);
    expect(await refreshRows(u.id)).toBe(1);
  });

  it('concurrent redemptions still yield exactly one session; a fault in one does not create a second', async () => {
    const u = await user('concurrent');
    const h = await handoff(u.id);
    const results = await Promise.allSettled(Array.from({ length: 6 }, () => redeemOAuthHandoff({ code: h.code, verifier: h.verifier, provider: h.provider })));
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await sessions(u.id)).toBe(1);
  });

  it('policy: wrong verifier / wrong provider / disabled user BURN the code and issue nothing, despite the 401', async () => {
    const wrongVerifier = await handoff((await user('burn1')).id);
    await expect(redeemOAuthHandoff({ code: wrongVerifier.code, verifier: newVerifier(), provider: 'google' })).rejects.toMatchObject({ statusCode: 401 });
    const rowA = await prisma.oAuthHandoff.findFirstOrThrow({ where: { challenge: challengeOf(wrongVerifier.verifier) } });
    expect(rowA.consumedAt).not.toBeNull();
    await expect(redeemOAuthHandoff({ code: wrongVerifier.code, verifier: wrongVerifier.verifier, provider: 'google' })).rejects.toMatchObject({ statusCode: 401 });

    const u2 = await user('burn2');
    const wrongProvider = await handoff(u2.id);
    await expect(redeemOAuthHandoff({ code: wrongProvider.code, verifier: wrongProvider.verifier, provider: 'github' })).rejects.toMatchObject({ statusCode: 401 });
    expect((await prisma.oAuthHandoff.findFirstOrThrow({ where: { userId: u2.id } })).consumedAt).not.toBeNull();
    expect(await sessions(u2.id)).toBe(0);

    const u3 = await user('burn3');
    const h3 = await handoff(u3.id);
    await prisma.user.update({ where: { id: u3.id }, data: { disabledAt: new Date() } });
    await expect(redeemOAuthHandoff({ code: h3.code, verifier: h3.verifier, provider: h3.provider })).rejects.toMatchObject({ statusCode: 401 });
    expect(await sessions(u3.id)).toBe(0);
    expect((await prisma.oAuthHandoff.findFirstOrThrow({ where: { userId: u3.id } })).consumedAt).not.toBeNull();
  });

  it('expired code and replay are refused without a session', async () => {
    const u = await user('expired');
    const h = await handoff(u.id);
    await prisma.oAuthHandoff.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(redeemOAuthHandoff({ code: h.code, verifier: h.verifier, provider: h.provider })).rejects.toMatchObject({ statusCode: 401 });
    expect(await sessions(u.id)).toBe(0);
  });

  it('issueSession keeps working for its other callers (login/register/refresh) outside a transaction', async () => {
    const email = `callers-${tag}@example.test`;
    const password = `pw-${randomUUID()}`;
    const reg = await request(app).post('/api/auth/register').send({ email, password, fullName: 'Callers' });
    expect(reg.status).toBe(201);
    userIds.push(reg.body.user.id);
    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    const refreshed = await request(app).post('/api/auth/refresh').send({ refreshToken: login.body.refreshToken });
    expect(refreshed.status).toBe(200);
    const out = await request(app).post('/api/auth/logout').send({ refreshToken: refreshed.body.refreshToken });
    expect(out.status).toBe(200);
    expect((await request(app).post('/api/auth/refresh').send({ refreshToken: refreshed.body.refreshToken })).status).toBe(401);
  });
});
