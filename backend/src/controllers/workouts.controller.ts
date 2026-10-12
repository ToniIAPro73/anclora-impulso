import { Request, Response, NextFunction } from 'express';
import { resolveIdempotencyKey } from '../middleware/idempotency';
import { hashRequest } from '../services/idempotency.service';
import * as workoutsService from '../services/workouts.service';
import type { CreateWorkoutInput, GenerateWorkoutInput } from '../utils/validators';

/**
 * GET /api/workouts
 */
export async function getUserWorkouts(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const workouts = await workoutsService.getUserWorkouts(req.user.userId);
    
    res.json(workouts);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/workouts/:id
 */
export async function getWorkoutById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const workout = await workoutsService.getWorkoutById(req.params.id, req.user.userId);
    
    res.json(workout);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/workouts
 */
export async function createWorkout(
  req: Request<{}, {}, CreateWorkoutInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const workout = await workoutsService.createWorkout(req.user.userId, req.body);
    
    res.status(201).json(workout);
  } catch (error) {
    next(error);
  }
}

/**
 * PUT /api/workouts/:id
 */
export async function updateWorkout(
  req: Request<{ id: string }, {}, Partial<CreateWorkoutInput>>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const workout = await workoutsService.updateWorkout(req.params.id, req.user.userId, req.body);
    
    res.json(workout);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/workouts/:id
 */
export async function deleteWorkout(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    await workoutsService.deleteWorkout(req.params.id, req.user.userId);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/workouts/generate
 */
export async function generateWorkout(
  req: Request<{}, {}, GenerateWorkoutInput>,
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
      workoutsService.WORKOUT_GENERATE_OPERATION,
      hashRequest(workoutsService.normalizeGenerateParams(req.body)),
    );

    const result = await workoutsService.generateWorkoutIdempotent(req.user.userId, req.body, key);

    if (result.replayed) {
      res.setHeader('Idempotent-Replayed', 'true');
      res.status(200).json(result.workout);
      return;
    }

    res.status(201).json(result.workout);
  } catch (error) {
    next(error);
  }
}
