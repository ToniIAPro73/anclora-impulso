/**
 * F-1 (B1-IA): administrative privileges must not be obtainable through public registration.
 * Mechanisms reproduced: (1) registering a case variant of an existing admin address, (2) registering an allow-listed
 * address that has no account yet. Effective permission is judged on a requireAdmin route, not on `user.isAdmin`.
 * Synthetic users only; legacy ADMIN_EMAILS-style configuration is set in memory (env.adminEmails), no file is read.
 */
import { randomUUID } from 'crypto';
import request from 'supertest';
import app from '../../src/app';
import { env } from '../../src/config/env';
import { prisma } from '../../src/config/database';
import { oauthSignIn } from '../support/oauth-helpers';

const tag = `f1-${randomUUID().slice(0, 8)}`;
const createdEmails: string[] = [];
const originalAdminEmails = [...env.adminEmails];
const originalAdminIds = [...env.adminUserIds];
const ADMIN_ROUTE = '/api/dashboard/summary';

async function register(email: string, extra: Record<string, unknown> = {}) {
  createdEmails.push(email);
  const res = await request(app)
    .post('/api/auth/register')
    .send({ email, password: `pw-${randomUUID()}`, fullName: 'F1 synthetic', ...extra });
  return res;
}
const adminStatus = (token: string) => request(app).get(ADMIN_ROUTE).set('Authorization', `Bearer ${token}`).then((r) => r.status);

afterAll(async () => {
  env.adminEmails.splice(0, env.adminEmails.length, ...originalAdminEmails);
  env.adminUserIds.splice(0, env.adminUserIds.length, ...originalAdminIds);
  await prisma.user.deleteMany({ where: { email: { in: createdEmails.concat(createdEmails.map((e) => e.toLowerCase())) } } });
  await prisma.$disconnect();
});

describe('F-1: administrative privileges are not obtainable by registration', () => {
  it('a case variant of a configured admin address does not receive admin permissions', async () => {
    const canonical = `admin-${tag}@example.test`;
    env.adminEmails.splice(0, env.adminEmails.length, canonical);
    const first = await register(canonical);
    expect(first.status).toBe(201);
    const variant = await register(`Admin-${tag}@Example.test`);
    expect([201, 409]).toContain(variant.status); // either rejected as duplicate or created WITHOUT privileges
    if (variant.status === 201) {
      expect(variant.body.user.isAdmin).toBe(false);
      expect(await adminStatus(variant.body.accessToken)).toBe(403);
    }
  });

  it('registering an allow-listed address that has no account yet does not grant admin permissions', async () => {
    const reserved = `pre-${tag}@example.test`;
    env.adminEmails.splice(0, env.adminEmails.length, reserved);
    const res = await register(reserved);
    expect(res.status).toBe(201);
    expect(res.body.user.isAdmin).toBe(false);
    expect(await adminStatus(res.body.accessToken)).toBe(403);
  });

  it('role fields injected in the registration body do not elevate', async () => {
    const res = await register(`inject-${tag}@example.test`, { isAdmin: true, role: 'admin', roles: ['admin'] });
    expect(res.status).toBe(201);
    expect(res.body.user.isAdmin).toBe(false);
    expect(await adminStatus(res.body.accessToken)).toBe(403);
    const row = await prisma.user.findUniqueOrThrow({ where: { id: res.body.user.id } });
    expect(JSON.stringify(row)).not.toMatch(/admin/i);
  });

  it('an ordinary user keeps working (register + login + authenticated route) but is not admin', async () => {
    const email = `normal-${tag}@example.test`;
    const password = `pw-${randomUUID()}`;
    createdEmails.push(email);
    const reg = await request(app).post('/api/auth/register').send({ email, password, fullName: 'Normal' });
    expect(reg.status).toBe(201);
    const login = await request(app).post('/api/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    expect(login.body.user.isAdmin).toBe(false);
    expect((await request(app).get('/api/workouts').set('Authorization', `Bearer ${login.body.accessToken}`)).status).toBe(200);
    expect(await adminStatus(login.body.accessToken)).toBe(403);
  });
});

describe('F-1: explicit designation by user id, normalization and non-conversion', () => {
  beforeEach(() => {
    env.adminEmails.splice(0, env.adminEmails.length);
    env.adminUserIds.splice(0, env.adminUserIds.length);
  });

  it('a user explicitly designated by id has admin permissions; the same account is not admin once undesignated', async () => {
    const res = await register(`designated-${tag}@example.test`);
    expect(res.status).toBe(201);
    expect(res.body.user.isAdmin).toBe(false);
    env.adminUserIds.push(res.body.user.id);
    expect(await adminStatus(res.body.accessToken)).toBe(200);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.body.isAdmin).toBe(true);
    env.adminUserIds.splice(0, env.adminUserIds.length);
    expect(await adminStatus(res.body.accessToken)).toBe(403);
  });

  it('a pre-existing account whose address is in the legacy ADMIN_EMAILS list is NOT silently converted', async () => {
    const email = `legacy-${tag}@example.test`;
    const res = await register(email);
    expect(res.status).toBe(201);
    env.adminEmails.push(email); // old-style configuration, no designation by id
    expect(await adminStatus(res.body.accessToken)).toBe(403);
    const me = await request(app).get('/api/auth/me').set('Authorization', `Bearer ${res.body.accessToken}`);
    expect(me.body.isAdmin).toBe(false);
  });

  it('ADMIN_USER_IDS matching is by id only: another user with a similar id or same email does not qualify', async () => {
    const a = await register(`idA-${tag}@example.test`);
    const b = await register(`idB-${tag}@example.test`);
    env.adminUserIds.push(a.body.user.id);
    expect(await adminStatus(a.body.accessToken)).toBe(200);
    expect(await adminStatus(b.body.accessToken)).toBe(403);
  });

  it('registration stores the canonical address; login works with any case of it', async () => {
    const mixed = `Mixed-${tag}@Example.TEST`;
    const password = `pw-${randomUUID()}`;
    createdEmails.push(mixed);
    const reg = await request(app).post('/api/auth/register').send({ email: mixed, password, fullName: 'Mixed' });
    expect(reg.status).toBe(201);
    expect(reg.body.user.email).toBe(mixed.toLowerCase());
    const row = await prisma.user.findUniqueOrThrow({ where: { id: reg.body.user.id } });
    expect(row.email).toBe(mixed.toLowerCase());
    for (const typed of [mixed, mixed.toLowerCase(), mixed.toUpperCase()]) {
      const login = await request(app).post('/api/auth/login').send({ email: typed, password });
      expect(login.status).toBe(200);
      expect(login.body.user.id).toBe(reg.body.user.id);
    }
    const dup = await request(app).post('/api/auth/register').send({ email: mixed.toUpperCase(), password, fullName: 'Dup' });
    expect(dup.status).toBe(409);
  });

  it('a legacy mixed-case account still logs in, and registering its lower-case form is refused as duplicate', async () => {
    const legacy = `Oldcase-${tag}@Example.test`;
    const password = `pw-${randomUUID()}`;
    const { hashPassword } = await import('../../src/utils/password');
    const user = await prisma.user.create({ data: { email: legacy, fullName: 'Legacy', passwordHash: await hashPassword(password) } });
    createdEmails.push(legacy);
    const login = await request(app).post('/api/auth/login').send({ email: legacy.toLowerCase(), password });
    expect(login.status).toBe(200);
    expect(login.body.user.id).toBe(user.id);
    const reg = await request(app).post('/api/auth/register').send({ email: legacy.toLowerCase(), password, fullName: 'Xx' });
    expect(reg.status).toBe(409);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).email).toBe(legacy); // not converted
  });

  it('canonical duplicates already stored are reported as a conflict: login selects none, nothing is merged or changed', async () => {
    const base = `dup-${tag}@example.test`;
    const password = `pw-${randomUUID()}`;
    const { hashPassword } = await import('../../src/utils/password');
    const hash = await hashPassword(password);
    const one = await prisma.user.create({ data: { email: base.toUpperCase(), fullName: 'Dup upper', passwordHash: hash } });
    const two = await prisma.user.create({ data: { email: `Dup-${tag}@Example.test`, fullName: 'Dup mixed', passwordHash: hash } });
    createdEmails.push(one.email, two.email);
    const login = await request(app).post('/api/auth/login').send({ email: base, password });
    expect(login.status).toBe(401);
    const rows = await prisma.user.findMany({ where: { id: { in: [one.id, two.id] } }, orderBy: { createdAt: 'asc' } });
    expect(rows.map((r) => r.email).sort()).toEqual([one.email, two.email].sort());
  });

  it('OAuth: an allow-listed address without an account does not become admin; designation by id still applies', async () => {
    const email = `oauth-${tag}@example.test`;
    createdEmails.push(email);
    env.adminEmails.push(email);
    const first = await oauthSignIn({ provider: 'github', providerAccountId: `gh-${tag}`, email: email.toUpperCase(), fullName: 'OAuth' });
    expect(first.user.isAdmin).toBe(false);
    expect(first.user.email).toBe(email);
    env.adminUserIds.push(first.user.id);
    const again = await oauthSignIn({ provider: 'github', providerAccountId: `gh-${tag}`, email, fullName: 'OAuth' });
    expect(again.user.isAdmin).toBe(true);
    expect(await adminStatus(first.accessToken)).toBe(200);
  });
});
