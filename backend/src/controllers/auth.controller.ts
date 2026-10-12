import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/auth.service';
import { verifyAccessTokenIgnoringExpiry } from '../utils/jwt';
import { revokeByRefreshToken, revokeSession, rotateRefreshToken } from '../services/session.service';
import type { RegisterInput, LoginInput } from '../utils/validators';
import logger from '../config/logger';

/**
 * POST /api/auth/register
 */
export async function register(
  req: Request<{}, {}, RegisterInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.register(req.body);
    
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/login
 */
export async function login(
  req: Request<{}, {}, LoginInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const result = await authService.login(req.body);
    
    res.json(result);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/auth/me
 */
export async function getCurrentUser(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const user = await authService.getCurrentUser(req.user.userId);
    
    res.json(user);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/refresh
 */
export async function refreshToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token requerido' });
      return;
    }

    if (typeof refreshToken !== 'string' || refreshToken.length > 4096) {
      res.status(400).json({ error: 'Refresh token requerido' });
      return;
    }

    // Rotación: el refresh presentado queda consumido y se entrega uno nuevo.
    const rotated = await rotateRefreshToken(refreshToken);

    res.json({ accessToken: rotated.accessToken, refreshToken: rotated.refreshToken });
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/auth/logout
 */
export async function logout(
  req: Request,
  res: Response
): Promise<void> {
  // Idempotent: always 200. Revokes the server-side session identified by the refresh token
  // and/or the access token's session id (an expired access token is still honoured here).
  try {
    // Attribution only (no token material): which client path asked for this logout.
    const reason = ['user_action', 'session_invalid', 'unspecified'].includes(req.body?.reason) ? req.body.reason : 'unspecified';
    const origin = typeof req.body?.origin === 'string' && /^[A-Za-z0-9._:-]{1,64}$/.test(req.body.origin) ? req.body.origin : 'unspecified';
    logger.info('auth.logout', { reason, origin });

    const refreshToken = req.body?.refreshToken;
    if (typeof refreshToken === 'string' && refreshToken.length <= 4096) {
      await revokeByRefreshToken(refreshToken, 'logout');
    }

    const header = req.headers.authorization;
    if (header?.startsWith('Bearer ')) {
      try {
        const claims = verifyAccessTokenIgnoringExpiry(header.substring(7));
        if (claims.sid) await revokeSession(claims.sid, 'logout');
      } catch {
        // invalid token: nothing to revoke
      }
    }
  } catch {
    // Never leak internals from logout.
  }

  res.json({ message: 'Sesión cerrada exitosamente' });
}
