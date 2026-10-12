import { type Request, type Response, type NextFunction } from 'express';
import { env } from '../config/env';

/**
 * Administrator designation (F-1). The root of trust is the operator-managed ADMIN_USER_IDS list of user ids.
 * An e-mail address is never evidence of privilege: registration is public and the address is client-supplied.
 */
export function isAdminUserId(userId?: string | null): boolean {
  if (!userId) {
    return false;
  }

  return env.adminUserIds.includes(userId.trim().toLowerCase());
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.userId || !isAdminUserId(req.user.userId)) {
    res.status(403).json({ error: 'Acceso restringido a administradores' });
    return;
  }

  next();
}
