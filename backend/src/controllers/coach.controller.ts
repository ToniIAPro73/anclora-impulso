import { Request, Response, NextFunction } from 'express';
import { resolveIdempotencyKey } from '../middleware/idempotency';
import { hashRequest } from '../services/idempotency.service';
import * as coachService from '../services/coach/coach.service';
import type { SendCoachMessageInput } from '../utils/validators';

export async function sendMessage(
  req: Request<{}, {}, SendCoachMessageInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const { key } = resolveIdempotencyKey(
      req,
      res,
      req.user.userId,
      coachService.COACH_MESSAGE_OPERATION,
      hashRequest({ conversationId: req.body.conversationId ?? null, message: req.body.message.trim() }),
    );
    const response = await coachService.sendCoachMessage(req.user.userId, req.body, { idempotencyKey: key });
    if (response.idempotentReplay) {
      res.setHeader('Idempotent-Replayed', 'true');
    }
    res.json(response);
  } catch (error) {
    next(error);
  }
}
