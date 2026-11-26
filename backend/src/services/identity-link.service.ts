import { createHmac, timingSafeEqual } from 'node:crypto';
import { noteReminderTime } from './notification-schedule.service';
import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { normalizeEmail } from '../utils/email';
import { lookupAccountByCanonicalEmail } from './account-lookup.service';
import { OAuthRefusal, type ResolvedOAuthUser } from './oauth.service';
import {
  isPilotBootstrapEmailAuthorized,
  isPilotSubjectAuthorized,
} from './oauth/anclora-identity.provider';

const LINK_INTENT_DOMAIN = 'anclora-identity-link-v1';
const LINK_INTENT_TTL_MS = 5 * 60 * 1000;

export function createLinkIntentToken(userId: string, now: number = Date.now()): string {
  const payload = Buffer.from(
    JSON.stringify({ uid: userId, exp: now + LINK_INTENT_TTL_MS }),
    'utf8',
  ).toString('base64url');
  const sig = createHmac('sha256', env.jwtSecret)
    .update(`${LINK_INTENT_DOMAIN}:${payload}`)
    .digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyLinkIntentToken(token: unknown, now: number = Date.now()): string | null {
  if (typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, sig] = parts;
  if (!payload || !sig) return null;

  const expectedSig = createHmac('sha256', env.jwtSecret)
    .update(`${LINK_INTENT_DOMAIN}:${payload}`)
    .digest('base64url');

  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  const actualBuf = Buffer.from(sig, 'utf8');
  if (expectedBuf.length !== actualBuf.length || !timingSafeEqual(expectedBuf, actualBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as {
      uid?: unknown;
      exp?: unknown;
    };
    if (typeof parsed.uid !== 'string' || typeof parsed.exp !== 'number' || parsed.exp < now) {
      return null;
    }
    return parsed.uid;
  } catch {
    return null;
  }
}

export async function resolveIdentityLogin(input: {
  issuer: string;
  subject: string;
  email: string;
  fullName: string | null;
}): Promise<ResolvedOAuthUser> {
  if (!input.issuer || !input.subject) {
    throw new OAuthRefusal('identity_invalid');
  }

  const existingLink = await prisma.identityLink.findUnique({
    where: { issuer_subject: { issuer: input.issuer, subject: input.subject } },
    include: { user: true },
  });

  if (existingLink && !existingLink.revokedAt) {
    if (existingLink.user.disabledAt) {
      throw new OAuthRefusal('account_disabled');
    }
    return existingLink.user;
  }

  const email = normalizeEmail(input.email);
  const lookup = await lookupAccountByCanonicalEmail(email);

  if (lookup.status === 'conflict') {
    throw new OAuthRefusal('ambiguous_email');
  }

  if (lookup.status === 'found') {
    // Security invariant: never auto-link an external Identity subject to an existing local user by email alone.
    await prisma.identityLinkAudit.create({
      data: {
        userId: lookup.user.id,
        issuer: input.issuer,
        subject: input.subject,
        action: 'LOGIN_DENIED',
        reason: 'link_requires_explicit_link',
      },
    });
    throw new OAuthRefusal('link_requires_original_method');
  }

  if (!env.ancloraIdentityAutoProvision) {
    throw new OAuthRefusal('account_conflict');
  }

  try {
    const created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash: null,
          fullName: input.fullName || email.split('@')[0],
        },
      });
      await tx.identityLink.create({
        data: {
          userId: user.id,
          issuer: input.issuer,
          subject: input.subject,
          emailAtLink: email,
          linkedVia: 'oidc_provision',
        },
      });
      await tx.identityLinkAudit.create({
        data: {
          userId: user.id,
          issuer: input.issuer,
          subject: input.subject,
          action: 'LINKED',
          actorUserId: user.id,
          reason: 'oidc_provision',
        },
      });
      return user;
    });
    noteReminderTime(created.remindersEnabled, created.reminderTime);
    return created;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await prisma.identityLink.findUnique({
        where: { issuer_subject: { issuer: input.issuer, subject: input.subject } },
        include: { user: true },
      });
      if (raced && !raced.revokedAt && !raced.user.disabledAt) {
        return raced.user;
      }
      throw new OAuthRefusal('account_conflict');
    }
    throw error;
  }
}

export async function linkAuthenticatedUser(input: {
  userId: string;
  issuer: string;
  subject: string;
  email: string;
}): Promise<ResolvedOAuthUser> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, fullName: true, disabledAt: true },
  });
  if (!user || user.disabledAt) {
    throw new OAuthRefusal('account_disabled');
  }

  const existingBySubject = await prisma.identityLink.findUnique({
    where: { issuer_subject: { issuer: input.issuer, subject: input.subject } },
  });
  if (existingBySubject && !existingBySubject.revokedAt) {
    if (existingBySubject.userId !== input.userId) {
      throw new OAuthRefusal('account_conflict');
    }
    return user;
  }

  const existingForUser = await prisma.identityLink.findFirst({
    where: { userId: input.userId, issuer: input.issuer, revokedAt: null },
  });
  if (existingForUser && existingForUser.subject !== input.subject) {
    throw new OAuthRefusal('account_conflict');
  }

  const normalizedEmail = normalizeEmail(input.email);

  await prisma.$transaction(async (tx) => {
    if (existingBySubject) {
      await tx.identityLink.update({
        where: { id: existingBySubject.id },
        data: {
          userId: input.userId,
          emailAtLink: normalizedEmail,
          linkedVia: 'authenticated_link',
          revokedAt: null,
        },
      });
    } else {
      await tx.identityLink.create({
        data: {
          userId: input.userId,
          issuer: input.issuer,
          subject: input.subject,
          emailAtLink: normalizedEmail,
          linkedVia: 'authenticated_link',
        },
      });
    }
    await tx.identityLinkAudit.create({
      data: {
        userId: input.userId,
        issuer: input.issuer,
        subject: input.subject,
        action: 'LINKED',
        actorUserId: input.userId,
        reason: 'authenticated_link',
      },
    });
  });

  return user;
}

export async function unlinkAuthenticatedUser(input: {
  userId: string;
  issuer: string;
}): Promise<{ unlinked: boolean }> {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      passwordHash: true,
      oauthAccounts: { select: { id: true } },
    },
  });
  if (!user) {
    throw new OAuthRefusal('identity_invalid');
  }

  const hasAlternativeAuth = Boolean(user.passwordHash) || user.oauthAccounts.length > 0;
  if (!hasAlternativeAuth) {
    throw new OAuthRefusal('link_requires_original_method');
  }

  const existing = await prisma.identityLink.findFirst({
    where: { userId: input.userId, issuer: input.issuer, revokedAt: null },
  });
  if (!existing) {
    return { unlinked: false };
  }

  await prisma.$transaction(async (tx) => {
    await tx.identityLink.delete({ where: { id: existing.id } });
    await tx.identityLinkAudit.create({
      data: {
        userId: input.userId,
        issuer: existing.issuer,
        subject: existing.subject,
        action: 'UNLINKED',
        actorUserId: input.userId,
        reason: 'user_requested',
      },
    });
  });

  return { unlinked: true };
}

export async function getIdentityLinkStatus(userId: string, issuer?: string) {
  const link = await prisma.identityLink.findFirst({
    where: {
      userId,
      ...(issuer ? { issuer } : {}),
      revokedAt: null,
    },
    select: {
      issuer: true,
      subject: true,
      emailAtLink: true,
      linkedVia: true,
      createdAt: true,
    },
  });
  return link;
}

export async function hasActiveIdentityLink(issuer: string, subject: string): Promise<boolean> {
  const link = await prisma.identityLink.findUnique({
    where: { issuer_subject: { issuer, subject } },
    select: { revokedAt: true },
  });
  return Boolean(link && !link.revokedAt);
}

export async function isLocalUserEligibleForPilot(userId: string, issuer: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, disabledAt: true },
  });
  if (!user || user.disabledAt) return false;

  const activeLink = await prisma.identityLink.findFirst({
    where: { userId, issuer, revokedAt: null },
    select: { issuer: true, subject: true },
  });
  if (activeLink && isPilotSubjectAuthorized(activeLink.issuer, activeLink.subject)) {
    return true;
  }
  return isPilotBootstrapEmailAuthorized(user.email);
}

export type OperatorLinkOutcome =
  | { outcome: 'LINKED'; userId: string }
  | { outcome: 'ALREADY_LINKED'; userId: string }
  | { outcome: 'INVALID_INPUT' }
  | { outcome: 'USER_NOT_FOUND' }
  | { outcome: 'USER_DISABLED' }
  | { outcome: 'SUBJECT_LINKED_TO_OTHER_USER' }
  | { outcome: 'USER_ALREADY_LINKED' };

/**
 * QA identity account (L1): explicit operator link between an existing user and an Anclora Identity subject.
 * Used only from the audited CLI `scripts/maintenance/link-identity.ts`, run by Toni. It never links by email:
 * the operator names both the user id and the subject. Refuses every conflict; idempotent for the same pair.
 */
export async function linkIdentityByOperator(input: {
  userId: string;
  issuer: string;
  subject: string;
  operator: string;
}): Promise<OperatorLinkOutcome> {
  const subject = input.subject.trim();
  const operator = input.operator.trim();
  let issuer: string;
  try {
    const url = new URL(input.issuer.trim());
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return { outcome: 'INVALID_INPUT' };
    issuer = input.issuer.trim();
  } catch {
    return { outcome: 'INVALID_INPUT' };
  }
  if (!subject || /\s|\|/.test(subject) || !operator) return { outcome: 'INVALID_INPUT' };

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, email: true, disabledAt: true } });
    if (!user) return { outcome: 'USER_NOT_FOUND' } as const;
    if (user.disabledAt) return { outcome: 'USER_DISABLED' } as const;

    const bySubject = await tx.identityLink.findUnique({ where: { issuer_subject: { issuer, subject } } });
    if (bySubject && !bySubject.revokedAt) {
      return bySubject.userId === user.id
        ? ({ outcome: 'ALREADY_LINKED', userId: user.id } as const)
        : ({ outcome: 'SUBJECT_LINKED_TO_OTHER_USER' } as const);
    }
    if (bySubject && bySubject.userId !== user.id) return { outcome: 'SUBJECT_LINKED_TO_OTHER_USER' } as const;

    const activeForUser = await tx.identityLink.findFirst({ where: { userId: user.id, issuer, revokedAt: null } });
    if (activeForUser) return { outcome: 'USER_ALREADY_LINKED' } as const;

    const emailAtLink = normalizeEmail(user.email);
    if (bySubject) {
      await tx.identityLink.update({
        where: { id: bySubject.id },
        data: { revokedAt: null, linkedVia: 'operator_link', emailAtLink },
      });
    } else {
      await tx.identityLink.create({
        data: { userId: user.id, issuer, subject, emailAtLink, linkedVia: 'operator_link' },
      });
    }
    await tx.identityLinkAudit.create({
      data: {
        userId: user.id,
        issuer,
        subject,
        action: 'LINKED',
        actorUserId: null,
        reason: 'operator_link',
        metadata: { operator },
      },
    });
    return { outcome: 'LINKED', userId: user.id } as const;
  });
}
