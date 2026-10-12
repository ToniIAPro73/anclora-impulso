/**
 * F-1-A / F-1-B (review of the NF-1/F-1/F-2/F-3 delta): when SEVERAL stored accounts share one canonical e-mail, no
 * account may be selected — neither by an exact match on the normalized value (login) nor by age (OAuth linking).
 * Synthetic rows in the isolated database; OAuth is exercised through the service with a mocked profile (no provider).
 */
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { prisma } from '../../src/config/database';
import { hashPassword } from '../../src/utils/password';
import { resolveOAuthAccount } from '../../src/services/oauth.service';
import { oauthSignIn } from '../support/oauth-helpers';

const tag = `f1ab-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];
const originalIds = [...env.adminUserIds];

async function account(email: string, password: string | null, extra: Record<string, unknown> = {}) {
  const user = await prisma.user.create({
    data: { email, fullName: 'F1AB synthetic', passwordHash: password ? await hashPassword(password) : null, ...extra },
  });
  userIds.push(user.id);
  return user;
}
const sessionCount = (ids: string[]) => prisma.authSession.count({ where: { userId: { in: ids } } });
const login = (email: string, password: string) => request(app).post('/api/auth/login').send({ email, password });

afterAll(async () => {
  env.adminUserIds.splice(0, env.adminUserIds.length, ...originalIds);
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

// NOTE: /api/auth has a limiter of 5 FAILED requests per window per app instance (this suite): keep refusals <= 4.
describe('F-1-A: login with a canonical conflict', () => {
  it('normalized row + a case variant exist: credentials of EITHER are refused; no session, nothing selected or modified', async () => {
    const lower = `dup-${tag}@example.test`;
    const pwLower = `pw-${randomUUID()}`;
    const pwUpper = `pw-${randomUUID()}`;
    const a = await account(lower, pwLower);
    const b = await account(`Dup-${tag}@Example.test`, pwUpper);
    const before = await sessionCount([a.id, b.id]);
    for (const [typed, pw] of [[lower, pwLower], [lower, pwUpper], [`Dup-${tag}@Example.test`, pwUpper]] as const) {
      const res = await login(typed, pw);
      expect(res.status).toBe(401);
      expect(res.body.accessToken).toBeUndefined();
    }
    expect(await sessionCount([a.id, b.id])).toBe(before);
    const rows = await prisma.user.findMany({ where: { id: { in: [a.id, b.id] } } });
    expect(rows.map((r) => r.email).sort()).toEqual([a.email, b.email].sort());
  });

  it('two variants and no normalized row: still refused', async () => {
    const pw = `pw-${randomUUID()}`;
    const a = await account(`Two-${tag}@example.test`, pw);
    const b = await account(`TWO-${tag}@example.test`, pw);
    const res = await login(`two-${tag}@example.test`, pw);
    expect(res.status).toBe(401);
    expect(await sessionCount([a.id, b.id])).toBe(0);
  });

  it('control: a single legacy mixed-case account still logs in and keeps its id', async () => {
    const pw = `pw-${randomUUID()}`;
    const only = await account(`Only-${tag}@Example.test`, pw);
    const res = await login(`only-${tag}@example.test`, pw);
    expect(res.status).toBe(200);
    expect(res.body.user.id).toBe(only.id);
  });
});

describe('F-1-B: OAuth linking with a canonical conflict', () => {
  it('unlinked provider identity + two canonical candidates (one an administrator): refused, no link, no session, no tokens', async () => {
    const lower = `oa-${tag}@example.test`;
    const older = await account(lower, null);
    await new Promise((r) => setTimeout(r, 15));
    const newer = await account(`OA-${tag}@Example.test`, null);
    env.adminUserIds.push(older.id); // the oldest candidate is the administrator
    const providerAccountId = `gh-${tag}-conflict`;
    const before = await sessionCount([older.id, newer.id]);

    await expect(
      resolveOAuthAccount({ provider: 'github', providerAccountId, email: lower, fullName: 'Conflict' }),
    ).rejects.toMatchObject({ code: 'ambiguous_email' });

    expect(await prisma.oAuthAccount.count({ where: { providerAccountId } })).toBe(0);
    expect(await sessionCount([older.id, newer.id])).toBe(before);
    expect(await prisma.user.count({ where: { id: { in: [older.id, newer.id] } } })).toBe(2);
  });

  it('control: an identity ALREADY linked by (provider, providerAccountId) keeps its account; it is not re-assigned by e-mail', async () => {
    const lower = `lk-${tag}@example.test`;
    const linked = await account(lower, null);
    await account(`LK-${tag}@Example.test`, null);
    const providerAccountId = `gh-${tag}-linked`;
    await prisma.oAuthAccount.create({ data: { userId: linked.id, provider: 'github', providerAccountId, email: lower } });
    const res = await oauthSignIn({ provider: 'github', providerAccountId, email: lower, fullName: 'Linked' });
    expect(res.user.id).toBe(linked.id);
  });

  it('control: a previously linked identity of a disabled account stays refused', async () => {
    const disabled = await account(`dis-${tag}@example.test`, null, { disabledAt: new Date() });
    const providerAccountId = `gh-${tag}-disabled`;
    await prisma.oAuthAccount.create({ data: { userId: disabled.id, provider: 'github', providerAccountId, email: disabled.email } });
    await expect(resolveOAuthAccount({ provider: 'github', providerAccountId, email: disabled.email, fullName: 'D' })).rejects.toMatchObject({ code: 'account_disabled' });
  });

  it('POLICY CHANGE (F-4 triage): ONE existing candidate is no longer auto-linked by e-mail; the sign-in is refused', async () => {
    const single = await account(`Sg-${tag}@Example.test`, null);
    const providerAccountId = `gh-${tag}-single`;
    await expect(
      resolveOAuthAccount({ provider: 'github', providerAccountId, email: `sg-${tag}@example.test`, fullName: 'Single' }),
    ).rejects.toMatchObject({ code: 'link_requires_original_method' });
    expect(await prisma.oAuthAccount.count({ where: { providerAccountId } })).toBe(0);
    expect(await sessionCount([single.id])).toBe(0);
  });

  it('control: no candidate creates a new account with the canonical e-mail', async () => {
    const providerAccountId = `gh-${tag}-new`;
    const res = await oauthSignIn({ provider: 'github', providerAccountId, email: `NEW-${tag}@Example.test`, fullName: 'New' });
    userIds.push(res.user.id);
    expect(res.user.email).toBe(`new-${tag}@example.test`);
  });
});
