import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import { isAdminUserId } from '../middleware/admin';
import { issueSession } from './session.service';
import type { AuthResponse } from './auth.service';

/** S256 challenge of a 32..96-byte verifier is always 43 base64url characters. */
export const HANDOFF_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const VERIFIER_PATTERN = /^[A-Za-z0-9_-]{43,128}$/;
const CODE_PATTERN = /^[A-Za-z0-9_-]{43}$/;

const sha256Hex = (value: string) => createHash('sha256').update(value).digest('hex');
const s256 = (verifier: string) => createHash('sha256').update(verifier).digest('base64url');
const invalid = () => new AppError(401, 'Código de acceso no válido o caducado');

/**
 * Called only AFTER the provider transaction (state + PKCE) was validated and the account resolved. Persists the
 * one-time code as a hash bound to the challenge the browser presented when it started the flow. No session exists yet.
 */
export async function createOAuthHandoff(
  input: { userId: string; provider: string; challenge: string },
  now: Date = new Date(),
): Promise<string> {
  if (!HANDOFF_CHALLENGE_PATTERN.test(input.challenge)) {
    throw new Error('Invalid handoff challenge');
  }
  const code = randomBytes(32).toString('base64url');
  await prisma.oAuthHandoff.create({
    data: {
      codeHash: sha256Hex(code),
      challenge: input.challenge,
      provider: input.provider,
      userId: input.userId,
      expiresAt: new Date(now.getTime() + env.oauthHandoffTtlSeconds * 1000),
    },
  });
  return code;
}

/**
 * Redeems a handoff code. The claim is ONE conditional UPDATE (unused and unexpired) and runs in the SAME transaction
 * that creates the session and its refresh token, so:
 *  - a fault anywhere before COMMIT (session row, refresh token, access-token generation, response assembly) rolls the
 *    claim back: no partial session, and the still-valid code can be retried;
 *  - concurrent redemptions yield at most one winner (the UPDATE), whatever the others do;
 *  - a code that fails verification (wrong verifier, wrong provider, disabled/missing user) is BURNED on purpose, so a
 *    verifier cannot be guessed: that outcome is returned from the transaction (committing the claim) and only then
 *    turned into the 401. Throwing inside would roll the burn back.
 * Not covered, by nature: a COMMIT whose response is lost on the way to the browser leaves a session the browser never
 * received; the code is consumed and the login must be restarted (no replay of tokens is offered).
 * Every refusal is the same 401.
 */
export async function redeemOAuthHandoff(
  input: { code: unknown; verifier: unknown; provider: unknown },
  now: Date = new Date(),
): Promise<AuthResponse> {
  const { code, verifier, provider } = input;
  if (
    typeof code !== 'string' || !CODE_PATTERN.test(code) ||
    typeof verifier !== 'string' || !VERIFIER_PATTERN.test(verifier) ||
    typeof provider !== 'string'
  ) {
    throw invalid();
  }

  const codeHash = sha256Hex(code);
  const outcome = await prisma.$transaction(async (tx): Promise<AuthResponse | null> => {
    const claimed = await tx.oAuthHandoff.updateMany({
      where: { codeHash, consumedAt: null, expiresAt: { gt: now } },
      data: { consumedAt: now },
    });
    if (claimed.count !== 1) return null;

    const record = await tx.oAuthHandoff.findUnique({ where: { codeHash } });
    if (!record) return null;

    const expected = Buffer.from(record.challenge, 'utf8');
    const received = Buffer.from(s256(verifier), 'utf8');
    if (expected.length !== received.length || !timingSafeEqual(expected, received) || record.provider !== provider) {
      return null; // committed: the code stays burned
    }

    const user = await tx.user.findUnique({
      where: { id: record.userId },
      select: { id: true, email: true, fullName: true, disabledAt: true },
    });
    if (!user || user.disabledAt) return null;

    const { accessToken, refreshToken } = await issueSession({ id: user.id, email: user.email }, now, tx);
    return {
      user: { id: user.id, email: user.email, fullName: user.fullName, isAdmin: isAdminUserId(user.id) },
      accessToken,
      refreshToken,
    };
  });

  if (!outcome) throw invalid();
  return outcome;
}

/** Physical removal of handoffs that expired `graceSeconds` ago (consumed or not). Not scheduled by the application. */
export async function purgeExpiredOAuthHandoffs(now: Date = new Date(), graceSeconds = 0): Promise<number> {
  const result = await prisma.oAuthHandoff.deleteMany({
    where: { expiresAt: { lte: new Date(now.getTime() - graceSeconds * 1000) } },
  });
  return result.count;
}
