import { Request, Response, NextFunction } from 'express';
import { verifyAccessToken, JwtPayload } from '../utils/jwt';
import { isSessionActive } from '../services/session.service';

// Extender el tipo Request para incluir el usuario
declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

/**
 * Middleware para verificar autenticación: firma + expiración del JWT y sesión del servidor activa.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Token no proporcionado' });
    return;
  }

  let payload: JwtPayload;
  try {
    payload = verifyAccessToken(authHeader.substring(7));
  } catch (error) {
    if (error instanceof Error && error.name === 'TokenExpiredError') {
      res.status(401).json({ error: 'Token expirado' });
      return;
    }
    res.status(401).json({ error: 'Token inválido' });
    return;
  }

  try {
    if (!(await isSessionActive(payload))) {
      res.status(401).json({ error: 'Sesión no válida' });
      return;
    }
  } catch (error) {
    next(error);
    return;
  }

  req.user = payload;
  next();
}

/**
 * Middleware opcional de autenticación (no falla si no hay token)
 */
export async function optionalAuthenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      const payload = verifyAccessToken(authHeader.substring(7));
      if (await isSessionActive(payload)) {
        req.user = payload;
      }
    }
  } catch {
    // Ignorar errores y continuar sin usuario
  }
  next();
}
