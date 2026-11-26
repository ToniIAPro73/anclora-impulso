import { Request, Response, NextFunction } from 'express';
import * as sessionsService from '../services/sessions.service';
import { resolveIdempotencyKey } from '../middleware/idempotency';
import type { CreateSessionInput } from '../utils/validators';

/**
 * GET /api/sessions
 */
export async function getUserSessions(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const sessions = await sessionsService.getUserSessions(req.user.userId, limit);
    
    res.json(sessions);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/sessions/:id
 */
export async function getSessionById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const session = await sessionsService.getSessionById(req.params.id, req.user.userId);
    
    res.json(session);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/sessions
 */
export async function createSession(
  req: Request<{}, {}, CreateSessionInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    // Session save idempotency F3: one session per (user, Idempotency-Key); clients without a key get a short-window
    // derived key (double taps) until enforcement (decision D3).
    const { key } = resolveIdempotencyKey(
      req,
      res,
      req.user.userId,
      sessionsService.SESSION_CREATE_OPERATION,
      sessionsService.hashSessionRequest(req.body),
    );
    const result = await sessionsService.createSessionIdempotent(req.user.userId, req.body, key);

    if (result.replayed) {
      res.setHeader('Idempotent-Replayed', 'true');
      res.status(200).json(result.session);
      return;
    }
    res.status(201).json(result.session);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/sessions/:id
 */
export async function updateSession(
  req: Request<{ id: string }, {}, Partial<CreateSessionInput>>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const session = await sessionsService.updateSession(req.params.id, req.user.userId, req.body);
    
    res.json(session);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/sessions/:id
 */
export async function deleteSession(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    await sessionsService.deleteSession(req.params.id, req.user.userId);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}
