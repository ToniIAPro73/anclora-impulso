import { Router } from 'express';
import * as nutritionController from '../controllers/nutrition.controller';
import { validateBody, validateQuery } from '../middleware/validate';
import { authenticate } from '../middleware/auth';
import {
  bulkUpdateRecipeEditorialSchema,
  commitImportedMealPlanSchema,
  createFoodItemSchema,
  createMealLogSchema,
  createNutritionLogSchema,
  createRecipeSchema,
  createSmartMealPlanSchema,
  generateMealPlanSchema,
  listFoodItemsQuerySchema,
  listMealLogsQuerySchema,
  listRecipesQuerySchema,
  previewImportedMealPlanSchema,
  replaceMealRecipeSchema,
  upsertNutritionTargetSchema,
  updateRecipeSchema,
} from '../utils/validators';
import { requireAdmin } from '../middleware/admin';

const router: Router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

// Planes de comida
router.post('/meal-plans/smart', validateBody(createSmartMealPlanSchema), nutritionController.createSmartMealPlan);
router.post(
  '/meal-plans/import/preview',
  validateBody(previewImportedMealPlanSchema),
  nutritionController.previewImportedMealPlan
);
router.post(
  '/meal-plans/import/commit',
  validateBody(commitImportedMealPlanSchema),
  nutritionController.commitImportedMealPlan
);
router.post(
  '/meal-plans/generate',
  validateBody(generateMealPlanSchema),
  nutritionController.generateMealPlan
);
router.get('/meal-plans', nutritionController.getUserMealPlans);
router.get('/meal-plans/:id', nutritionController.getMealPlanById);
router.delete('/meal-plans/:id', nutritionController.deleteMealPlan);

// Recetas
router.get('/recipes', validateQuery(listRecipesQuerySchema), nutritionController.listRecipes);
router.post('/recipes', validateBody(createRecipeSchema), nutritionController.createRecipe);
router.get('/editorial/summary', requireAdmin, nutritionController.getRecipeEditorialSummary);
router.get('/recipes/:id', nutritionController.getRecipeById);
router.put('/recipes/:id', requireAdmin, validateBody(updateRecipeSchema), nutritionController.updateRecipe);
router.post('/recipes/editorial/bulk-update', requireAdmin, validateBody(bulkUpdateRecipeEditorialSchema), nutritionController.bulkUpdateRecipeEditorial);
router.post('/meals/:mealId/replace', validateBody(replaceMealRecipeSchema), nutritionController.replaceMealRecipe);

// Logs de nutrición
router.post('/log', validateBody(createNutritionLogSchema), nutritionController.createNutritionLog);
router.get('/logs', nutritionController.getNutritionLogs);
router.get('/summary', nutritionController.getNutritionSummary);

// Smart nutrition
router.get('/foods', validateQuery(listFoodItemsQuerySchema), nutritionController.listFoodItems);
router.post('/foods', validateBody(createFoodItemSchema), nutritionController.createFoodItem);
router.get('/targets', nutritionController.getNutritionTarget);
router.put('/targets', validateBody(upsertNutritionTargetSchema), nutritionController.upsertNutritionTarget);
router.get('/meal-logs', validateQuery(listMealLogsQuerySchema), nutritionController.listMealLogs);
router.post('/meal-logs', validateBody(createMealLogSchema), nutritionController.createMealLog);
router.get('/health-import/status', nutritionController.getHealthImportStatus);

export default router;
