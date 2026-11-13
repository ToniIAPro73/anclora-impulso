import { z } from 'zod';
import {
  ALL_CATALOG_DIET_PROTOCOL_IDS,
  PUBLISHED_DIET_TYPES,
} from './protocol-catalog';

export const MEAL_PLAN_IMPORT_SPEC_VERSION = 'meal-plan-import-v1' as const;

/**
 * Shared unit & meal enums aligned with `recipes-import-v1` (`scripts/nutrition/import-recipes.ts`).
 */
export const IMPORT_MEAL_TYPES = ['desayuno', 'almuerzo', 'cena', 'snack'] as const;
export const IMPORT_DIFFICULTIES = ['facil', 'medio', 'dificil'] as const;
export const IMPORT_ALLOWED_UNITS = [
  'g',
  'ml',
  'unidad',
  'rebanada',
  'lata',
  'cucharada',
  'cucharadita',
] as const;
export const CANONICAL_CONVERTIBLE_UNITS = ['g', 'ml', 'unidad'] as const;

export const BUDGET_TIERS = ['economico', 'medio', 'elevado'] as const;
export const LOCALE_CODES = ['es-ES', 'en-GB'] as const;
export const COOKING_METHODS = [
  'airfryer',
  'microondas',
  'olla',
  'sarten',
  'crudo',
  'horno_convencional',
  'vapor',
  'plancha',
] as const;

export const QUANTITY_SOURCES = ['specified', 'estimated', 'not_provided'] as const;
export const NUTRITION_DATA_SOURCES = [
  'calculated',
  'estimated',
  'origin_declared',
  'not_provided',
] as const;
export const NUTRITION_CERTAINTY_LEVELS = ['verified', 'approximate', 'unknown'] as const;

export const NON_COUNTED_BASE_INGREDIENTS = new Set([
  'sal',
  'pimienta',
  'agua',
  'aceite base',
  'aceite de oliva base',
  'salt',
  'pepper',
  'water',
  'base oil',
]);

export const importOriginSchema = z
  .object({
    kind: z.enum(['external_skill', 'library_generator', 'user_json']),
    producer: z.string().trim().min(1).max(120),
    producerVersion: z.string().trim().min(1).max(40),
    instructionsVersion: z.string().trim().min(1).max(40).nullable().optional(),
    reference: z.string().trim().max(240).nullable().optional(),
  })
  .strict();

export const importPreferencesSchema = z
  .object({
    dietType: z.enum(ALL_CATALOG_DIET_PROTOCOL_IDS),
    locale: z.enum(LOCALE_CODES),
    daysCount: z.number().int().min(1).max(7),
    budgetTier: z.enum(BUDGET_TIERS),
    maxMainIngredients: z.number().int().min(1).max(20),
    excludedEquipment: z.array(z.string().trim().min(1).max(60)).max(12).default([]),
    excludedFoods: z.array(z.string().trim().min(1).max(80)).max(40).default([]),
    dietaryRestrictions: z.array(z.string().trim().min(1).max(80)).max(20).default([]),
    mealTimes: z
      .array(z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/))
      .min(1)
      .max(6),
    eatingWindow: z
      .object({
        start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
      })
      .strict()
      .nullable()
      .optional(),
  })
  .strict();

export const importIngredientSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    quantity: z.number().nullable(),
    unit: z.enum(IMPORT_ALLOWED_UNITS).nullable(),
    quantitySource: z.enum(QUANTITY_SOURCES),
    isCountedInLimit: z.boolean().optional(),
  })
  .strict();

export const importNutritionSchema = z
  .object({
    kcal: z.number().min(0).nullable(),
    proteinG: z.number().min(0).nullable(),
    carbsG: z.number().min(0).nullable(),
    fatG: z.number().min(0).nullable(),
    fiberG: z.number().min(0).nullable().optional(),
    dataSource: z.enum(NUTRITION_DATA_SOURCES),
    certainty: z.enum(NUTRITION_CERTAINTY_LEVELS),
  })
  .strict();

export const importMealPrepSchema = z
  .object({
    batchCookingGroup: z.string().trim().max(80).nullable().optional(),
    storageGuidance: z.string().trim().max(400).nullable().optional(),
    reheatGuidance: z.string().trim().max(400).nullable().optional(),
    transportSuitable: z.boolean().nullable().optional(),
  })
  .strict();

export const importRecipeSchema = z
  .object({
    externalId: z.string().trim().min(1).max(80),
    name: z.string().trim().min(1).max(160),
    nameEn: z.string().trim().min(1).max(160).nullable().optional(),
    description: z.string().trim().max(600).nullable().optional(),
    servings: z.number().int().min(1).max(20),
    prepTime: z.number().int().min(0).max(480).nullable().optional(),
    cookTime: z.number().int().min(0).max(480).nullable().optional(),
    difficulty: z.enum(IMPORT_DIFFICULTIES).nullable().optional(),
    cookingMethods: z.array(z.enum(COOKING_METHODS)).max(8).default([]),
    ingredients: z.array(importIngredientSchema).min(1).max(25),
    instructions: z.array(z.string().trim().min(1).max(500)).min(1).max(25),
    nutrition: importNutritionSchema,
    mealPrep: importMealPrepSchema.optional(),
  })
  .strict();

export const importMealSlotSchema = z
  .object({
    mealType: z.enum(IMPORT_MEAL_TYPES),
    scheduledTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).nullable().optional(),
    recipe: importRecipeSchema,
  })
  .strict();

export const importDaySchema = z
  .object({
    dayIndex: z.number().int().min(0).max(6),
    meals: z.array(importMealSlotSchema).min(1).max(6),
  })
  .strict();

export const batchCookingBlockSchema = z
  .object({
    id: z.string().trim().min(1).max(60),
    title: z.string().trim().min(1).max(140),
    steps: z.array(z.string().trim().min(1).max(400)).min(1).max(20),
    storageGuidance: z.string().trim().max(400).nullable().optional(),
  })
  .strict();

export const mealPlanImportSchema = z
  .object({
    specVersion: z.literal(MEAL_PLAN_IMPORT_SPEC_VERSION),
    origin: importOriginSchema,
    preferences: importPreferencesSchema,
    title: z.string().trim().min(1).max(160),
    days: z.array(importDaySchema).min(1).max(7),
    batchCooking: z.array(batchCookingBlockSchema).max(14).default([]),
    warnings: z.array(z.string().trim().max(300)).max(50).default([]),
    incompleteFields: z.array(z.string().trim().max(160)).max(50).default([]),
  })
  .strict();

export type MealPlanImportV1 = z.infer<typeof mealPlanImportSchema>;
export type MealPlanImportIngredient = z.infer<typeof importIngredientSchema>;
export { PUBLISHED_DIET_TYPES };

