import { createHash, randomBytes } from 'crypto';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { generateAccessToken, verifyRefreshToken, type JwtPayload } from '../utils/jwt';

const REFRESH_PREFIX = 'rt1.';

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

export function hashRefreshToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

function newRefreshSecret() {
  return `${REFRESH_PREFIX}${randomBytes(48).toString('base64url')}`;
}

function sessionExpiry(now: Date) {
  return new Date(now.getTime() + env.authRefreshSessionDays * 24 * 3600 * 1000);
}

const legacyUse = { total: 0, lastAt: null as Date | null };
const legacyLogged = new Map<string, number>();

/** In-process counters used to decide when AUTH_ACCEPT_LEGACY_TOKENS can be switched off (per instance). */
export function getLegacyTokenUsage() {
  return { total: legacyUse.total, lastAt: legacyUse.lastAt ? legacyUse.lastAt.toISOString() : null };
}

export function resetLegacyTokenUsage() {
  legacyUse.total = 0;
  legacyUse.lastAt = null;
  legacyLogged.clear();
}

function noteLegacyUse(userId: string, now: Date) {
  legacyUse.total += 1;
  legacyUse.lastAt = now;
  const last = legacyLogged.get(userId) ?? 0;
  if (now.getTime() - last > 3600_000) {
    legacyLogged.set(userId, now.getTime());
    logger.info('legacy_token_accepted', { userId });
  }
}

const unauthorized = (message = 'Refresh token inválido') => new AppError(401, message);

export async function issueSession(user: { id: string; email: string }, now: Date = new Date()): Promise<IssuedSession> {
  const refreshToken = newRefreshSecret();
  const expiresAt = sessionExpiry(now);

  const session = await prisma.authSession.create({
    data: {
      userId: user.id,
      expiresAt,
      refreshTokens: { create: { tokenHash: hashRefreshToken(refreshToken), expiresAt } },
    },
    select: { id: true },
  });

  return {
    sessionId: session.id,
    refreshToken,
    accessToken: generateAccessToken({ userId: user.id, email: user.email, sid: session.id }),
  };
}

/** True when the access-token claims map to a live session of an enabled user. */
export async function isSessionActive(payload: JwtPayload, now: Date = new Date()): Promise<boolean> {
  if (payload.sid) {
    const session = await prisma.authSession.findUnique({
      where: { id: payload.sid },
      select: { userId: true, revokedAt: true, expiresAt: true, user: { select: { disabledAt: true } } },
    });
    return Boolean(
      session &&
        session.userId === payload.userId &&
        !session.revokedAt &&
        session.expiresAt > now &&
        !session.user.disabledAt,
    );
  }

  // Legacy pre-session token: only during the documented transition, and the user must still exist.
  if (!env.authAcceptLegacyTokens) return false;
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { disabledAt: true } });
  if (user && !user.disabledAt) {
    noteLegacyUse(payload.userId, now);
    return true;
  }
  return false;
}

export async function revokeSession(sessionId: string, reason: string, now: Date = new Date()) {
  await prisma.authSession.updateMany({
    where: { id: sessionId, revokedAt: null },
    data: { revokedAt: now, revokedReason: reason },
  });
}

export async function revokeAllUserSessions(userId: string, reason: string, now: Date = new Date()) {
  const result = await prisma.authSession.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: now, revokedReason: reason },
  });
  return result.count;
}

/** Revokes the session that owns a presented refresh token, if any. Idempotent and silent on unknown tokens. */
export async function revokeByRefreshToken(refreshToken: string, reason: string) {
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(refreshToken) },
    select: { sessionId: true },
  });
  if (record) await revokeSession(record.sessionId, reason);
}

/**
 * Rotates a refresh token. Accepts new opaque tokens and, during the transition window, legacy refresh JWTs
 * (upgraded into a server-side session). Reuse of an already-rotated token outside the grace window
 * revokes the whole session.
 */
export async function rotateRefreshToken(presented: string, now: Date = new Date()): Promise<IssuedSession & { user: { id: string; email: string } }> {
  if (!presented.startsWith(REFRESH_PREFIX)) {
    return upgradeLegacyRefreshToken(presented, now);
  }

  const tokenHash = hashRefreshToken(presented);
  const record = await prisma.refreshToken.findUnique({
    where: { tokenHash },
    include: { session: { include: { user: { select: { id: true, email: true, disabledAt: true } } } } },
  });

  if (!record) throw unauthorized();
  const { session } = record;
  const { user } = session;

  if (session.revokedAt) throw unauthorized('Sesión revocada');
  if (session.expiresAt <= now || record.expiresAt <= now) throw unauthorized('Sesión expirada');
  if (user.disabledAt) {
    await revokeSession(session.id, 'user_disabled', now);
    throw unauthorized('Sesión revocada');
  }

  const newSecret = newRefreshSecret();

  const rotated = await prisma.$transaction(async (tx) => {
    const claim = await tx.refreshToken.updateMany({
      where: { id: record.id, usedAt: null },
      data: { usedAt: now },
    });
    if (claim.count !== 1) return false;

    const successor = await tx.refreshToken.create({
      data: { sessionId: session.id, tokenHash: hashRefreshToken(newSecret), expiresAt: session.expiresAt },
      select: { id: true },
    });
    await tx.refreshToken.update({ where: { id: record.id }, data: { replacedById: successor.id } });
    await tx.authSession.update({ where: { id: session.id }, data: { lastUsedAt: now } });
    return true;
  });

  if (!rotated) {
    // Token was already used. Re-read: a concurrent legitimate refresh (two tabs) is tolerated briefly.
    const fresh = await prisma.refreshToken.findUnique({ where: { id: record.id }, select: { usedAt: true } });
    const usedAt = fresh?.usedAt ?? now;
    const withinGrace = now.getTime() - usedAt.getTime() <= env.authRefreshReuseGraceSeconds * 1000;

    if (!withinGrace) {
      await revokeSession(session.id, 'refresh_token_reuse_detected', now);
      throw unauthorized('Sesión revocada');
    }

    await prisma.refreshToken.create({
      data: { sessionId: session.id, tokenHash: hashRefreshToken(newSecret), expiresAt: session.expiresAt },
    });
  }

  return {
    sessionId: session.id,
    refreshToken: newSecret,
    accessToken: generateAccessToken({ userId: user.id, email: user.email, sid: session.id }),
    user: { id: user.id, email: user.email },
  };
}

async function upgradeLegacyRefreshToken(presented: string, now: Date) {
  if (!env.authAcceptLegacyTokens) throw unauthorized();

  let payload: JwtPayload;
  try {
    payload = verifyRefreshToken(presented);
  } catch {
    throw unauthorized();
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
    select: { id: true, email: true, disabledAt: true },
  });
  if (!user || user.disabledAt) throw unauthorized('Sesión revocada');

  const issued = await issueSession(user, now);
  return { ...issued, user: { id: user.id, email: user.email } };
}

/**
 * Physical deletion of expired sessions (refresh tokens cascade). A session is logically dead at `expiresAt`
 * (every check compares it); rows are removed `graceSeconds` later. Active sessions (expiresAt in the future) are
 * never touched, revoked-but-unexpired sessions are kept so reuse detection keeps working until they expire.
 */
export async function purgeExpiredSessions(
  now: Date = new Date(),
  options: { graceSeconds?: number; batchSize?: number; maxBatches?: number } = {},
) {
  const cutoff = new Date(now.getTime() - (options.graceSeconds ?? 0) * 1000);
  const batchSize = options.batchSize ?? 500;
  const maxBatches = options.maxBatches ?? 100;
  let deleted = 0;

  for (let batch = 0; batch < maxBatches; batch += 1) {
    const rows = await prisma.authSession.findMany({
      where: { expiresAt: { lte: cutoff } },
      select: { id: true },
      take: batchSize,
    });
    if (rows.length === 0) break;
    const result = await prisma.authSession.deleteMany({
      where: { id: { in: rows.map((row) => row.id) }, expiresAt: { lte: cutoff } },
    });
    deleted += result.count;
    if (rows.length < batchSize) break;
  }
  return deleted;
}
