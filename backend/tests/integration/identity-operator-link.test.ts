/**
 * QA identity account (L1): explicit, audited operator link between an existing Impulso user and an Anclora Identity
 * subject. Never links by email. Spec: sdd/features/qa-identity-account/qa-identity-account-spec-v1.md (QA-ID-AC02, AC03).
 * Synthetic users only, isolated PostgreSQL.
 */
import { randomUUID } from 'crypto';
import { prisma } from '../../src/config/database';
import { linkIdentityByOperator } from '../../src/services/identity-link.service';

const ISSUER = 'https://identity.example.test';
const tag = `op-link-${randomUUID().slice(0, 8)}`;
const userIds: string[] = [];

async function newUser(label: string, data: Record<string, unknown> = {}) {
  const user = await prisma.user.create({
    data: { email: `${tag}-${label}@example.test`, fullName: label, passwordHash: null, ...data },
  });
  userIds.push(user.id);
  return user;
}

const link = (userId: string, subject: string, operator = 'test-operator: QA account') =>
  linkIdentityByOperator({ userId, issuer: ISSUER, subject, operator });

afterAll(async () => {
  await prisma.identityLinkAudit.deleteMany({ where: { userId: { in: userIds } } });
  await prisma.user.deleteMany({ where: { id: { in: userIds } } });
  await prisma.$disconnect();
});

describe('linkIdentityByOperator', () => {
  it('links an existing user to a subject and writes one link and one audit row', async () => {
    const user = await newUser('linked');
    const subject = randomUUID();

    expect(await link(user.id, subject)).toEqual({ outcome: 'LINKED', userId: user.id });

    const links = await prisma.identityLink.findMany({ where: { userId: user.id } });
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ issuer: ISSUER, subject, linkedVia: 'operator_link', revokedAt: null, emailAtLink: user.email });
    const audits = await prisma.identityLinkAudit.findMany({ where: { userId: user.id } });
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ action: 'LINKED', reason: 'operator_link', subject, actorUserId: null });
    expect(audits[0].metadata).toEqual({ operator: 'test-operator: QA account' });
  });

  it('is idempotent for the same user and subject (no second link or audit row)', async () => {
    const user = await newUser('idempotent');
    const subject = randomUUID();
    await link(user.id, subject);

    expect(await link(user.id, subject)).toEqual({ outcome: 'ALREADY_LINKED', userId: user.id });
    expect(await prisma.identityLink.count({ where: { userId: user.id } })).toBe(1);
    expect(await prisma.identityLinkAudit.count({ where: { userId: user.id } })).toBe(1);
  });

  it('refuses a subject already linked to another user', async () => {
    const owner = await newUser('owner');
    const other = await newUser('other');
    const subject = randomUUID();
    await link(owner.id, subject);

    expect(await link(other.id, subject)).toEqual({ outcome: 'SUBJECT_LINKED_TO_OTHER_USER' });
    expect(await prisma.identityLink.count({ where: { userId: other.id } })).toBe(0);
  });

  it('refuses a user that already has an active link for the issuer with another subject', async () => {
    const user = await newUser('twice');
    await link(user.id, randomUUID());

    expect(await link(user.id, randomUUID())).toEqual({ outcome: 'USER_ALREADY_LINKED' });
    expect(await prisma.identityLink.count({ where: { userId: user.id } })).toBe(1);
  });

  it('refuses unknown or disabled users and invalid input', async () => {
    const disabled = await newUser('disabled', { disabledAt: new Date() });

    expect(await link(randomUUID(), randomUUID())).toEqual({ outcome: 'USER_NOT_FOUND' });
    expect(await link(disabled.id, randomUUID())).toEqual({ outcome: 'USER_DISABLED' });
    expect(await link(disabled.id, '')).toEqual({ outcome: 'INVALID_INPUT' });
    expect(
      await linkIdentityByOperator({ userId: disabled.id, issuer: 'not a url', subject: randomUUID(), operator: 'x: y' }),
    ).toEqual({ outcome: 'INVALID_INPUT' });
    expect(await linkIdentityByOperator({ userId: disabled.id, issuer: ISSUER, subject: randomUUID(), operator: ' ' })).toEqual({
      outcome: 'INVALID_INPUT',
    });
    expect(await prisma.identityLink.count({ where: { userId: disabled.id } })).toBe(0);
  });

  it('reactivates a revoked link of the same subject for the same user', async () => {
    const user = await newUser('revoked');
    const subject = randomUUID();
    await link(user.id, subject);
    await prisma.identityLink.updateMany({ where: { userId: user.id }, data: { revokedAt: new Date() } });

    expect(await link(user.id, subject)).toEqual({ outcome: 'LINKED', userId: user.id });
    const links = await prisma.identityLink.findMany({ where: { userId: user.id } });
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ revokedAt: null, linkedVia: 'operator_link' });
  });
});
