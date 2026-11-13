import { Request, Response, NextFunction } from 'express';
import * as nutritionService from '../services/nutrition.service';
import { previewImportedMealPlan as previewImportedMealPlanService } from '../services/nutrition/plan-import/meal-plan-preview.service';
import {
  commitImportedMealPlan as commitImportedMealPlanService,
  MealPlanCommitError,
} from '../services/nutrition/plan-import/meal-plan-commit.service';
import type {
  BulkUpdateRecipeEditorialInput,
  CommitImportedMealPlanInput,
  CreateFoodItemInput,
  CreateMealLogInput,
  CreateRecipeInput,
  CreateNutritionLogInput,
  CreateSmartMealPlanInput,
  GenerateMealPlanInput,
  ListFoodItemsQueryInput,
  ListMealLogsQueryInput,
  ListRecipesQueryInput,
  PreviewImportedMealPlanInput,
  ReplaceMealRecipeInput,
  UpsertNutritionTargetInput,
  UpdateRecipeInput,
} from '../utils/validators';
import { listRecipesQuerySchema } from '../utils/validators';

/**
 * POST /api/nutrition/meal-plans/import/preview
 */
export async function previewImportedMealPlan(
  req: Request<{}, {}, PreviewImportedMealPlanInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const preview = await previewImportedMealPlanService({
      userId: req.user.userId,
      rawPayload: req.body.rawPayload,
      instructionsVersion: req.body.instructionsVersion,
    });
    res.status(preview.status === 'REJECTED' ? 422 : 200).json(preview);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/nutrition/meal-plans/import/commit
 */
export async function commitImportedMealPlan(
  req: Request<{}, {}, CommitImportedMealPlanInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const result = await commitImportedMealPlanService({
      userId: req.user.userId,
      rawPayload: req.body.rawPayload,
      previewHash: req.body.previewHash,
      requestedLifecycleStatus: req.body.requestedLifecycleStatus,
      weekStart: req.body.weekStart,
      instructionsVersion: req.body.instructionsVersion,
    });
    res.status(result.idempotentReplay ? 200 : 201).json(result);
  } catch (error) {
    if (error instanceof MealPlanCommitError) {
      res.status(error.statusCode).json({
        error: error.message,
        code: error.code,
        details: error.details,
      });
      return;
    }
    next(error);
  }
}

/**
 * POST /api/nutrition/meal-plans/generate
 */
export async function generateMealPlan(
  req: Request<{}, {}, GenerateMealPlanInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const mealPlan = await nutritionService.generateMealPlan(req.user.userId, req.body);
    res.status(201).json(mealPlan);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/nutrition/meal-plans
 */
export async function getUserMealPlans(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const plans = await nutritionService.getUserMealPlans(req.user.userId);
    res.json(plans);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/nutrition/meal-plans/:id
 */
export async function getMealPlanById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const plan = await nutritionService.getMealPlanById(req.params.id, req.user.userId);
    res.json(plan);
  } catch (error) {
    next(error);
  }
}

/**
 * DELETE /api/nutrition/meal-plans/:id
 */
export async function deleteMealPlan(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    await nutritionService.deleteMealPlan(req.params.id, req.user.userId);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
}

export async function listRecipes(
  req: Request<{}, {}, {}, ListRecipesQueryInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const filters = listRecipesQuerySchema.parse(req.query);
    const recipes = await nutritionService.listRecipes(req.user.userId, filters);
    res.json(recipes);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/nutrition/recipes/:id
 */
export async function getRecipeById(
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const recipe = await nutritionService.getRecipeById(req.params.id, req.user.userId);
    res.json(recipe);
  } catch (error) {
    next(error);
  }
}

export async function createRecipe(
  req: Request<{}, {}, CreateRecipeInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const recipe = await nutritionService.createRecipe(req.user.userId, req.body);
    res.status(201).json(recipe);
  } catch (error) {
    next(error);
  }
}

export async function updateRecipe(
  req: Request<{ id: string }, {}, UpdateRecipeInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const recipe = await nutritionService.updateRecipe(req.params.id, req.body);
    res.json(recipe);
  } catch (error) {
    next(error);
  }
}

export async function replaceMealRecipe(
  req: Request<{ mealId: string }, {}, ReplaceMealRecipeInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const mealPlan = await nutritionService.replaceMealRecipe(req.user.userId, req.params.mealId, req.body);
    res.json(mealPlan);
  } catch (error) {
    next(error);
  }
}

export async function getRecipeEditorialSummary(
  _req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const summary = await nutritionService.getRecipeEditorialSummary();
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

export async function bulkUpdateRecipeEditorial(
  req: Request<{}, {}, BulkUpdateRecipeEditorialInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const recipes = await nutritionService.bulkUpdateRecipeEditorial(req.body);
    res.json(recipes);
  } catch (error) {
    next(error);
  }
}

/**
 * POST /api/nutrition/log
 */
export async function createNutritionLog(
  req: Request<{}, {}, CreateNutritionLogInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const log = await nutritionService.createNutritionLog(req.user.userId, req.body);
    res.status(201).json(log);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/nutrition/logs
 */
export async function getNutritionLogs(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const period = (req.query.period as 'day' | 'week') || 'day';
    const logs = await nutritionService.getNutritionLogs(req.user.userId, period);
    res.json(logs);
  } catch (error) {
    next(error);
  }
}

/**
 * GET /api/nutrition/summary
 */
export async function getNutritionSummary(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'No autenticado' });
      return;
    }

    const period = (req.query.period as 'day' | 'week') || 'day';
    const summary = await nutritionService.getNutritionSummary(req.user.userId, period);
    res.json(summary);
  } catch (error) {
    next(error);
  }
}

export async function createFoodItem(
  req: Request<{}, {}, CreateFoodItemInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const foodItem = await nutritionService.createFoodItem(req.user.userId, req.body);
    res.status(201).json(foodItem);
  } catch (error) {
    next(error);
  }
}

export async function listFoodItems(
  req: Request<{}, {}, {}, ListFoodItemsQueryInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const foodItems = await nutritionService.listFoodItems(req.user.userId, req.query);
    res.json(foodItems);
  } catch (error) {
    next(error);
  }
}

export async function upsertNutritionTarget(
  req: Request<{}, {}, UpsertNutritionTargetInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const target = await nutritionService.upsertNutritionTarget(req.user.userId, req.body);
    res.json(target);
  } catch (error) {
    next(error);
  }
}

export async function getNutritionTarget(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const target = await nutritionService.getNutritionTarget(req.user.userId);
    res.json(target);
  } catch (error) {
    next(error);
  }
}

export async function createMealLog(
  req: Request<{}, {}, CreateMealLogInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const mealLog = await nutritionService.createMealLog(req.user.userId, req.body);
    res.status(201).json(mealLog);
  } catch (error) {
    next(error);
  }
}

export async function listMealLogs(
  req: Request<{}, {}, {}, ListMealLogsQueryInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const mealLogs = await nutritionService.listMealLogs(req.user.userId, req.query);
    res.json(mealLogs);
  } catch (error) {
    next(error);
  }
}

export async function createSmartMealPlan(
  req: Request<{}, {}, CreateSmartMealPlanInput>,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    const plan = await nutritionService.createSmartMealPlan(req.user.userId, req.body);
    res.status(201).json(plan);
  } catch (error) {
    next(error);
  }
}

export async function getHealthImportStatus(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    res.json(nutritionService.getHealthImportStatus());
  } catch (error) {
    next(error);
  }
}
