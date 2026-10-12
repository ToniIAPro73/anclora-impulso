/**
 * F-4 and OAuth linking triage. Providers are SIMULATED (fetch mock); PostgreSQL is the isolated test database.
 * Covers: handoff (one-time, bound to the browser's verifier, concurrent redemption), the callback leg through the real
 * controller (no tokens leave it), and the link policy (verified e-mail, no auto-link, no selection under conflict).
 */
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { prisma } from '../../src/config/database';
import { hashPassword } from '../../src/utils/password';
import { resolveOAuthAccount } from '../../src/services/oauth.service';
import { createOAuthHandoff, redeemOAuthHandoff, purgeExpiredOAuthHandoffs } from '../../src/services/oauth-handoff.service';
import { challengeOf, newVerifier, oauthSignIn } from '../support/oauth-helpers';

const tag = `f4-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
const originalIds = [...env.adminUserIds];

async function localAccount(email: string, withPassword = true, extra: Record<string, unknown> = {}) {
  const u = await prisma.user.create({
    data: { email, fullName: 'F4 synthetic', passwordHash: withPassword ? await hashPassword(`pw-${randomUUID()}`) : null, ...extra },
  });
  userIds.push(u.id);
  return u;
}
const sessions = (ids: string[]) => prisma.authSession.count({ where: { userId: { in: ids } } });
const handoffRows = (ids: string[]) => prisma.oAuthHandoff.findMany({ where: { userId: { in: ids } } });

afterAll(async () => {
  env.adminUserIds.splice(0, env.adminUserIds.length, ...originalIds);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('handoff: one-time code bound to the browser that started the flow', () => {
  async function fresh() {
    const user = await localAccount(`h-${randomUUID().slice(0, 6)}-${tag}@example.test`, false);
    const verifier = newVerifier();
    const code = await createOAuthHandoff({ userId: user.id, provider: 'google', challenge: challengeOf(verifier) });
    return { user, verifier, code };
  }

  it('no session exists until redemption; the code is stored only as a hash', async () => {
    const { user, code } = await fresh();
    expect(await sessions([user.id])).toBe(0);
    const rows = await handoffRows([user.id]);
    expect(rows).toHaveLength(1);
    expect(rows[0].codeHash).not.toBe(code);
    expect(JSON.stringify(rows[0])).not.toContain(code);
    expect(rows[0].expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(rows[0].expiresAt.getTime() - rows[0].createdAt.getTime()).toBeLessThanOrEqual(300_000);
  });

  it('correct verifier + provider redeems once and issues exactly one session; replay fails', async () => {
    const { user, verifier, code } = await fresh();
    const auth = await redeemOAuthHandoff({ code, verifier, provider: 'google' });
    expect(auth.user.id).toBe(user.id);
    expect(auth.accessToken && auth.refreshToken).toBeTruthy();
    expect(await sessions([user.id])).toBe(1);
    await expect(redeemOAuthHandoff({ code, verifier, provider: 'google' })).rejects.toMatchObject({ statusCode: 401 });
    expect(await sessions([user.id])).toBe(1);
  });

  it('wrong, missing or malformed verifier / provider never yields tokens, and burns the code', async () => {
    for (const bad of [newVerifier(), undefined, '', 'short', 42, null] as unknown[]) {
      const { user, verifier, code } = await fresh();
      await expect(redeemOAuthHandoff({ code, verifier: bad, provider: 'google' })).rejects.toMatchObject({ statusCode: 401 });
      // even the right verifier cannot redeem a code that was already presented wrongly with a well-formed verifier
      if (typeof bad === 'string' && /^[A-Za-z0-9_-]{43,128}$/.test(bad)) {
        await expect(redeemOAuthHandoff({ code, verifier, provider: 'google' })).rejects.toMatchObject({ statusCode: 401 });
      }
      expect(await sessions([user.id])).toBe(0);
    }
    const { user, verifier, code } = await fresh();
    await expect(redeemOAuthHandoff({ code, verifier, provider: 'github' })).rejects.toMatchObject({ statusCode: 401 });
    expect(await sessions([user.id])).toBe(0);
  });

  it('an expired code does not redeem', async () => {
    const { user, verifier, code } = await fresh();
    await prisma.oAuthHandoff.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    await expect(redeemOAuthHandoff({ code, verifier, provider: 'google' })).rejects.toMatchObject({ statusCode: 401 });
    expect(await sessions([user.id])).toBe(0);
    expect(await purgeExpiredOAuthHandoffs(new Date(), 0)).toBeGreaterThanOrEqual(1);
    expect(await handoffRows([user.id])).toHaveLength(0);
  });

  it('concurrent redemptions of one code produce exactly one session', async () => {
    const { user, verifier, code } = await fresh();
    const results = await Promise.allSettled(
      Array.from({ length: 6 }, () => redeemOAuthHandoff({ code, verifier, provider: 'google' })),
    );
    expect(results.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(await sessions([user.id])).toBe(1);
  });

  it('a disabled user cannot redeem', async () => {
    const { user, verifier, code } = await fresh();
    await prisma.user.update({ where: { id: user.id }, data: { disabledAt: new Date() } });
    await expect(redeemOAuthHandoff({ code, verifier, provider: 'google' })).rejects.toMatchObject({ statusCode: 401 });
    expect(await sessions([user.id])).toBe(0);
  });
});

describe('callback leg through the real controller (provider simulated)', () => {
  const profile = (over: Record<string, unknown> = {}) => ({
    sub: `g-${randomUUID()}`, email: `cb-${randomUUID().slice(0, 6)}-${tag}@example.test`, email_verified: true, name: 'CB', ...over,
  });
  function simulateGoogle(userinfo: Record<string, unknown>) {
    return jest.spyOn(globalThis, 'fetch').mockImplementation((async (input: any) => {
      const url = String(input);
      const body = url.includes('/token') ? { access_token: 't' } : userinfo;
      return { ok: true, status: 200, json: async () => body } as unknown as Response;
    }) as any);
  }
  const stateOf = (location: string) => new URL(location).searchParams.get('state')!;
  beforeEach(() => {
    process.env.GOOGLE_OAUTH_CLIENT_ID = 'synthetic'; process.env.GOOGLE_OAUTH_CLIENT_SECRET = 'synthetic';
    process.env.GOOGLE_OAUTH_CALLBACK_URL = 'http://127.0.0.1:3001/api/auth/google/callback';
  });
  afterEach(() => { jest.restoreAllMocks(); delete process.env.GOOGLE_OAUTH_CLIENT_ID; delete process.env.GOOGLE_OAUTH_CLIENT_SECRET; delete process.env.GOOGLE_OAUTH_CALLBACK_URL; });

  it('start without a valid challenge is refused before any provider redirect', async () => {
    for (const q of ['', '?challenge=short', '?challenge=' + 'a'.repeat(44), '?challenge=%3Cscript%3E']) {
      const res = await request(app).get(`/api/auth/google${q}`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toContain('/auth/error');
      expect(res.headers['set-cookie']).toBeUndefined();
    }
  });

  it('valid flow: the callback hands over ONLY a code (no token, no session); redemption needs the verifier', async () => {
    const info = profile();
    simulateGoogle(info);
    const verifier = newVerifier();
    const agent = request.agent(app);
    const start = await agent.get(`/api/auth/google?challenge=${challengeOf(verifier)}`);
    expect(start.status).toBe(302);
    const state = stateOf(start.headers.location);
    const cb = await agent.get(`/api/auth/google/callback?code=provider-code&state=${state}`);
    expect(cb.status).toBe(302);
    const loc = cb.headers.location as string;
    expect(loc).toContain('/auth/callback#code=');
    expect(loc).not.toMatch(/accessToken|refreshToken|eyJ/);
    expect(new URL(loc).search).toBe('');
    const user = await prisma.user.findUniqueOrThrow({ where: { email: info.email } });
    userIds.push(user.id);
    expect(await sessions([user.id])).toBe(0);

    const code = new URLSearchParams(new URL(loc).hash.slice(1)).get('code')!;
    const wrong = await request(app).post('/api/auth/oauth/exchange').send({ code, verifier: newVerifier(), provider: 'google' });
    expect(wrong.status).toBe(401);
    expect(wrong.body.accessToken).toBeUndefined();
    const again = await request(app).post('/api/auth/oauth/exchange').send({ code, verifier, provider: 'google' });
    expect(again.status).toBe(401); // burned by the wrong attempt: no guessing
    expect(await sessions([user.id])).toBe(0);
  });

  it('valid flow end to end: correct redemption works once and the session authenticates', async () => {
    const info = profile();
    simulateGoogle(info);
    const verifier = newVerifier();
    const agent = request.agent(app);
    const start = await agent.get(`/api/auth/google?challenge=${challengeOf(verifier)}`);
    const cb = await agent.get(`/api/auth/google/callback?code=provider-code&state=${stateOf(start.headers.location)}`);
    const code = new URLSearchParams(new URL(cb.headers.location as string).hash.slice(1)).get('code')!;
    const ok = await request(app).post('/api/auth/oauth/exchange').send({ code, verifier, provider: 'google' });
    expect(ok.status).toBe(200);
    expect(ok.headers['cache-control']).toBe('no-store');
    userIds.push(ok.body.user.id);
    expect((await request(app).get('/api/workouts').set('Authorization', `Bearer ${ok.body.accessToken}`)).status).toBe(200);
    expect((await request(app).post('/api/auth/oauth/exchange').send({ code, verifier, provider: 'google' })).status).toBe(401);
  });

  it('wrong state, replayed callback and a callback without the browser cookie create no handoff', async () => {
    const info = profile();
    simulateGoogle(info);
    const agent = request.agent(app);
    const start = await agent.get(`/api/auth/google?challenge=${challengeOf(newVerifier())}`);
    const state = stateOf(start.headers.location);
    const before = await prisma.oAuthHandoff.count();
    const badState = await agent.get(`/api/auth/google/callback?code=c&state=${state}x`);
    expect(badState.headers.location).toContain('/auth/error');
    // the failed attempt consumed the transaction cookie: replaying even the right state now fails
    const replay = await agent.get(`/api/auth/google/callback?code=c&state=${state}`);
    expect(replay.headers.location).toContain('/auth/error');
    const noCookie = await request(app).get(`/api/auth/google/callback?code=c&state=${state}`);
    expect(noCookie.headers.location).toContain('/auth/error');
    expect(await prisma.oAuthHandoff.count()).toBe(before);
    expect(await prisma.user.count({ where: { email: info.email } })).toBe(0);
  });

  it('unverified provider e-mail: no account, no link, no handoff, no session', async () => {
    const info = profile({ email_verified: false });
    simulateGoogle(info);
    const agent = request.agent(app);
    const start = await agent.get(`/api/auth/google?challenge=${challengeOf(newVerifier())}`);
    const before = await prisma.oAuthHandoff.count();
    const cb = await agent.get(`/api/auth/google/callback?code=c&state=${stateOf(start.headers.location)}`);
    expect(cb.headers.location).toContain('/auth/error');
    expect(await prisma.oAuthHandoff.count()).toBe(before);
    expect(await prisma.user.count({ where: { email: info.email } })).toBe(0);
    expect(await prisma.oAuthAccount.count({ where: { providerAccountId: info.sub } })).toBe(0);
  });
});

describe('link policy', () => {
  const p = (over: Partial<Parameters<typeof resolveOAuthAccount>[0]> = {}) => ({
    provider: 'google' as const, providerAccountId: `pa-${randomUUID()}`, email: `lp-${randomUUID().slice(0, 6)}-${tag}@example.test`, fullName: 'LP', ...over,
  });

  it('victim signs in with OAuth after an attacker pre-registered a password account with the victim\'s e-mail: refused, nothing linked', async () => {
    const email = `pre-${tag}@example.test`;
    const attackerOwned = await localAccount(email, true);
    const before = await sessions([attackerOwned.id]);
    await expect(resolveOAuthAccount(p({ email }))).rejects.toMatchObject({ code: 'link_requires_original_method' });
    await expect(resolveOAuthAccount(p({ email: email.toUpperCase() }))).rejects.toMatchObject({ code: 'link_requires_original_method' });
    expect(await prisma.oAuthAccount.count({ where: { userId: attackerOwned.id } })).toBe(0);
    expect(await sessions([attackerOwned.id])).toBe(before);
  });

  it('an administrator-designated account is not linkable by e-mail either', async () => {
    const admin = await localAccount(`adm-${tag}@example.test`, true);
    env.adminUserIds.push(admin.id);
    await expect(resolveOAuthAccount(p({ email: admin.email }))).rejects.toMatchObject({ code: 'link_requires_original_method' });
    expect(await prisma.oAuthAccount.count({ where: { userId: admin.id } })).toBe(0);
  });

  it('a profile without a verified e-mail, or with an invalid identity, creates nothing', async () => {
    const pa = `pa-${randomUUID()}`;
    await expect(resolveOAuthAccount(p({ providerAccountId: pa, email: null }))).rejects.toMatchObject({ code: 'email_not_verified' });
    await expect(resolveOAuthAccount(p({ providerAccountId: '' }))).rejects.toMatchObject({ code: 'identity_invalid' });
    await expect(resolveOAuthAccount(p({ providerAccountId: undefined as unknown as string }))).rejects.toMatchObject({ code: 'identity_invalid' });
    expect(await prisma.oAuthAccount.count({ where: { providerAccountId: pa } })).toBe(0);
  });

  it('new verified identity creates one account and a stable link; the next sign-in resolves by identity, even if the e-mail changed', async () => {
    const profile = p();
    const first = await resolveOAuthAccount(profile);
    userIds.push(first.id);
    const second = await resolveOAuthAccount({ ...profile, email: `changed-${tag}@example.test` });
    expect(second.id).toBe(first.id);
    expect(await prisma.oAuthAccount.count({ where: { providerAccountId: profile.providerAccountId } })).toBe(1);
  });

  it('a linked identity is not re-assigned by e-mail and a disabled owner is refused', async () => {
    const owner = await localAccount(`own-${tag}@example.test`, false);
    const other = await localAccount(`oth-${tag}@example.test`, true);
    const profile = p({ email: other.email });
    await prisma.oAuthAccount.create({ data: { userId: owner.id, provider: 'google', providerAccountId: profile.providerAccountId, email: owner.email } });
    expect((await resolveOAuthAccount(profile)).id).toBe(owner.id);
    await prisma.user.update({ where: { id: owner.id }, data: { disabledAt: new Date() } });
    await expect(resolveOAuthAccount(profile)).rejects.toMatchObject({ code: 'account_disabled' });
  });

  it('two canonical accounts: refused (no selection)', async () => {
    const lower = `cc-${tag}@example.test`;
    await localAccount(lower, true);
    await localAccount(`CC-${tag}@Example.test`, true);
    await expect(resolveOAuthAccount(p({ email: lower }))).rejects.toMatchObject({ code: 'ambiguous_email' });
  });

  it('race: two NEW identities with the same e-mail: one account, the other is refused (never linked to the winner)', async () => {
    const email = `race-${tag}@example.test`;
    const a = p({ provider: 'google', email });
    const b = p({ provider: 'github', email });
    const results = await Promise.allSettled([resolveOAuthAccount(a), resolveOAuthAccount(b)]);
    const ok = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');
    expect(ok.length).toBe(1);
    userIds.push(ok[0].value.id);
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    const links = await prisma.oAuthAccount.count({ where: { providerAccountId: { in: [a.providerAccountId, b.providerAccountId] } } });
    expect(links).toBe(1);
  });

  it('race: the SAME identity completed twice at once resolves to one account and one link', async () => {
    const profile = p();
    const results = await Promise.allSettled([resolveOAuthAccount(profile), resolveOAuthAccount(profile), resolveOAuthAccount(profile)]);
    const ok = results.filter((r): r is PromiseFulfilledResult<any> => r.status === 'fulfilled');
    expect(ok.length).toBeGreaterThanOrEqual(1);
    expect(new Set(ok.map((r) => r.value.id)).size).toBe(1);
    userIds.push(ok[0].value.id);
    expect(await prisma.oAuthAccount.count({ where: { providerAccountId: profile.providerAccountId } })).toBe(1);
    // the full sign-in works afterwards
    expect((await oauthSignIn(profile)).user.id).toBe(ok[0].value.id);
  });
});
