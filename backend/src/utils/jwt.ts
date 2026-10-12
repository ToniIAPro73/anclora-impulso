import jwt, { type SignOptions } from 'jsonwebtoken';
import { env } from '../config/env';

export interface JwtPayload {
  userId: string;
  email: string;
  /** Server-side session id. Absent only on pre-session (legacy) tokens. */
  sid?: string;
}

const ALGORITHM = 'HS256' as const;

/**
 * Generar un token de acceso JWT
 */
export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload as jwt.JwtPayload, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn,
    algorithm: ALGORITHM,
  } as SignOptions);
}

/**
 * Legacy refresh JWT. Only used to issue pre-session tokens in tests and during the migration window;
 * new logins receive opaque, server-stored refresh tokens (see session.service).
 */
export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload as jwt.JwtPayload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn,
    algorithm: ALGORITHM,
  } as SignOptions);
}

/**
 * Verificar y decodificar un token de acceso (algorithm pinned: no alg confusion)
 */
export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITHM] }) as JwtPayload;
}

/** Verify signature but accept an expired token (used by logout to learn which session to revoke). */
export function verifyAccessTokenIgnoringExpiry(token: string): JwtPayload {
  return jwt.verify(token, env.jwtSecret, { algorithms: [ALGORITHM], ignoreExpiration: true }) as JwtPayload;
}

/**
 * Verificar y decodificar un token de refresco legacy
 */
export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.jwtRefreshSecret, { algorithms: [ALGORITHM] }) as JwtPayload;
}
