import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { normalizeEmail } from '../utils/email';
import { lookupAccountByCanonicalEmail } from './account-lookup.service';

export interface OAuthProfile {
  provider: 'google' | 'github';
  providerAccountId: string;
  /** Only an e-mail the provider itself reported as VERIFIED (the provider modules return null otherwise). */
  email: string | null;
  fullName: string | null;
}

export type OAuthRefusalCode =
  | 'identity_invalid'
  | 'email_not_verified'
  | 'ambiguous_email'
  | 'link_requires_original_method'
  | 'account_disabled'
  | 'account_conflict';

/** A refusal carries a code only (never an address, token or profile data). Callers map it to a generic error page. */
export class OAuthRefusal extends Error {
  constructor(public readonly code: OAuthRefusalCode) {
    super(`OAuth sign-in refused: ${code}`);
  }
}

export interface ResolvedOAuthUser {
  id: string;
  email: string;
  fullName: string;
  disabledAt: Date | null;
}

function uniqueTarget(error: Prisma.PrismaClientKnownRequestError): string {
  const target = error.meta?.target;
  return Array.isArray(target) ? target.join(',') : String(target ?? '');
}

/**
 * Resolves WHICH local account an OAuth identity belongs to. Issues NO session (the session is created only when
 * the browser redeems its handoff code). Roots of trust:
 *  1. an existing link (provider, providerAccountId) — the identity the provider asserted before; never re-assigned by e-mail;
 *  2. otherwise a NEW account, only with an e-mail the provider verified and only when no local account holds it.
 * A new provider identity is never attached to an existing local account by e-mail: that would need proof that the
 * person controls THAT account (a pre-registered account's password may be known to someone else). There is no safe
 * linking/re-authentication flow in this product yet, so the sign-in is refused and the original method is required.
 */
export async function resolveOAuthAccount(profile: OAuthProfile): Promise<ResolvedOAuthUser> {
  if (typeof profile.providerAccountId !== 'string' || profile.providerAccountId.length === 0) {
    throw new OAuthRefusal('identity_invalid');
  }

  const identity = {
    provider_providerAccountId: { provider: profile.provider, providerAccountId: profile.providerAccountId },
  };

  const linked = await prisma.oAuthAccount.findUnique({ where: identity, include: { user: true } });
  if (linked) {
    if (linked.user.disabledAt) throw new OAuthRefusal('account_disabled');
    return linked.user;
  }

  if (!profile.email) {
    throw new OAuthRefusal('email_not_verified');
  }

  const email = normalizeEmail(profile.email);
  const lookup = await lookupAccountByCanonicalEmail(email);
  if (lookup.status === 'conflict') throw new OAuthRefusal('ambiguous_email');
  if (lookup.status === 'found') throw new OAuthRefusal('link_requires_original_method');

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email, passwordHash: null, fullName: profile.fullName || email.split('@')[0] },
      });
      await tx.oAuthAccount.create({
        data: { userId: user.id, provider: profile.provider, providerAccountId: profile.providerAccountId, email },
      });
      return user;
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      // The SAME identity completed concurrently: resolve through its link. An e-mail collision is never turned
      // into a link to the account that won the race.
      if (uniqueTarget(error).includes('providerAccountId')) {
        const raced = await prisma.oAuthAccount.findUnique({ where: identity, include: { user: true } });
        if (raced && !raced.user.disabledAt) return raced.user;
      }
      throw new OAuthRefusal('account_conflict');
    }
    throw error;
  }
}
