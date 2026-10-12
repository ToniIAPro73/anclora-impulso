import { prisma } from '../config/database';
import logger from '../config/logger';
import { normalizeEmail } from '../utils/email';

export type CanonicalAccountLookup =
  | { status: 'none' }
  | { status: 'found'; user: NonNullable<Awaited<ReturnType<typeof prisma.user.findFirst>>> }
  | { status: 'conflict'; accounts: number };

/**
 * Single policy for resolving an account by e-mail (login and OAuth linking). The CANONICAL set is read as a whole:
 * an exact match on the normalized value does not prove the set is unique, so uniqueness is checked first. With more
 * than one candidate NO account is selected (not by exact match, not by age) and the conflict is logged with the
 * count only. Nothing is merged, deleted or rewritten.
 */
export async function lookupAccountByCanonicalEmail(rawEmail: string): Promise<CanonicalAccountLookup> {
  const email = normalizeEmail(rawEmail);
  const candidates = await prisma.user.findMany({
    where: { email: { equals: email, mode: 'insensitive' } },
    take: 3,
  });

  if (candidates.length > 1) {
    logger.warn('auth.email_canonical_conflict', { accounts: candidates.length });
    return { status: 'conflict', accounts: candidates.length };
  }

  return candidates[0] ? { status: 'found', user: candidates[0] } : { status: 'none' };
}
