import type { Request, Response } from 'express';
import { env } from '../config/env';
import { AppError } from './errorHandler';
import { assertValidIdempotencyKey, deriveLegacyKey } from '../services/idempotency.service';

export interface ResolvedIdempotencyKey {
  key: string;
  /** True when the key was derived by the server because the client did not send one. */
  derived: boolean;
}

function enforcementIsRequired(now: Date) {
  if (env.idempotencyKeyEnforcement === 'require') return true;
  if (env.idempotencyLegacySunsetAt) {
    const sunset = Date.parse(env.idempotencyLegacySunsetAt);
    if (Number.isFinite(sunset) && now.getTime() >= sunset) return true;
  }
  return false;
}

/**
 * Reads Idempotency-Key. Updated clients always send it. For previous clients: until enforcement/sunset the
 * server derives a short-window key (dedupes double taps only) and flags the response as deprecated;
 * afterwards the request is refused with 428.
 */
export function resolveIdempotencyKey(
  req: Request,
  res: Response,
  userId: string,
  operation: string,
  requestHash: string,
  now: Date = new Date(),
): ResolvedIdempotencyKey {
  const raw = req.get('Idempotency-Key')?.trim();

  if (raw) {
    assertValidIdempotencyKey(raw);
    return { key: raw, derived: false };
  }

  if (enforcementIsRequired(now)) {
    throw new AppError(428, 'Idempotency-Key header is required for this operation');
  }

  res.setHeader('Deprecation', 'true');
  res.setHeader('Warning', '299 - "Idempotency-Key will become mandatory for this endpoint"');
  return { key: deriveLegacyKey(userId, operation, requestHash, now), derived: true };
}
