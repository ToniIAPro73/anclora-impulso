import { Request, Response, NextFunction } from 'express';
import * as progressService from '../services/progress.service';
import * as sessionsService from '../services/sessions.service';
import * as strengthProgressService from '../services/strength-progress.service';
import type { CreateMeasurementInput, UpdateMeasurementInput } from '../utils/validators';

/**
 * GET /api/progress/measurements
 */
export async function getUserMeasurements(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const measurements = await progressService.getUserMeasurements(req.user.userId);
    
    res.json(measurements);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/progress/measurements
 */
export async function createMeasurement(
  req: Request<{}, {}, CreateMeasurementInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const measurement = await progressService.createMeasurement(req.user.userId, req.body);
    
    res.status(201).json(measurement);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/progress/measurements/:id
 */
export async function updateMeasurement(
  req: Request<{ id: string }, {}, UpdateMeasurementInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const measurement = await progressService.updateMeasurement(req.params.id, req.user.userId, req.body);
    
    res.json(measurement);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/progress/measurements/:id
 */
export async function deleteMeasurement(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    await progressService.deleteMeasurement(req.params.id, req.user.userId);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/progress/stats
 */
export async function getProgressStats(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const stats = await sessionsService.getProgressStats(req.user.userId);
    
    res.json(stats);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/progress/complete
 */
export async function getCompleteProgress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const progress = await progressService.getCompleteProgress(req.user.userId);
    
    res.json(progress);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/progress/strength
 */
export async function getStrengthProgress(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const progress = await strengthProgressService.getStrengthProgress(req.user.userId);

    res.json(progress);
  } catch (error) {
    next(error);
  }
}
