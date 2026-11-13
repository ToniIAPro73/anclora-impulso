import crypto from 'node:crypto';
import { prisma } from '../../../config/database';
import { env } from '../../../config/env';
import {
  CANONICAL_CONVERTIBLE_UNITS,
  NON_COUNTED_BASE_INGREDIENTS,
  type MealPlanImportIngredient,
  type MealPlanImportV1,
} from './meal-plan-import.contract';
import type { MealPlanValidationResult } from './meal-plan-import.validator';
import { adaptSkillOutputToMealPlanImport } from './skill-adapter';

export type MealPlanImportRecipe = MealPlanImportV1['days'][number]['meals'][number]['recipe'];

export interface ShoppingListAggregatedItem {
  name: string;
  unit: 'g' | 'ml' | 'unidad';
  totalQuantity: number;
  occurrences: number;
  isBasePantry: boolean;
}

export interface ShoppingListUnconvertibleItem {
  name: string;
  unit: string | null;
  quantity: number | null;
  reason: 'missing_quantity' | 'non_canonical_unit';
  recipeName: string;
  dayIndex: number;
}

export interface ShoppingListPreview {
  aggregatedItems: ShoppingListAggregatedItem[];
  unconvertibleItems: ShoppingListUnconvertibleItem[];
  isExact: boolean;
}

export interface RecipeDuplicateMatch {
  importedRecipeName: string;
  fingerprint: string;
  matchedRecipeId: string;
  matchedRecipeName: string;
  scope: 'user_private' | 'public_catalog';
}

export interface ExistingRecipeCandidate {
  id: string;
  name: string;
  userId: string | null;
  isPublic: boolean;
}

export type DuplicateLookupFn = (
  userId: string,
  normalizedRecipeNames: string[]
) => Promise<ExistingRecipeCandidate[]>;

export interface MealPlanPreviewResponse {
  status: MealPlanValidationResult['status'];
  canImportPreview: boolean;
  canCommitToDatabase: boolean;
  persistenceBlockedReason: 'M28_REQUIRED_FOR_FULL_PERSISTENCE' | null;
  previewHash: string | null;
  validation: MealPlanValidationResult;
  summary: {
    title: string | null;
    dietType: string | null;
    locale: string | null;
    daysCount: number;
    mealsCount: number;
    recipesCount: number;
    hasIncompleteNutrition: boolean;
    hasIncompleteIngredients: boolean;
  };
  shoppingList: ShoppingListPreview;
  duplicateMatches: RecipeDuplicateMatch[];
  batchCookingWarnings: string[];
}

export interface PreviewMealPlanInput {
  userId: string;
  rawPayload: unknown;
  instructionsVersion?: string;
  duplicateLookup?: DuplicateLookupFn;
}

const canonicalUnits = new Set<string>(CANONICAL_CONVERTIBLE_UNITS);

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function computeRecipeFingerprint(recipe: MealPlanImportRecipe): string {
  const canonicalPayload = {
    name: normalizeText(recipe.name),
    ingredients: recipe.ingredients
      .map((ing) => ({
        name: normalizeText(ing.name),
        unit: ing.unit ?? null,
        quantity: ing.quantity ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  };
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(canonicalPayload))
    .digest('hex')
    .slice(0, 16);
}

export function computePlanPreviewHash(plan: MealPlanImportV1): string {
  return crypto
    .createHash('sha256')
    .update(JSON.stringify(plan))
    .digest('hex');
}

function isBasePantryIngredient(ing: MealPlanImportIngredient): boolean {
  if (ing.isCountedInLimit === false) return true;
  return NON_COUNTED_BASE_INGREDIENTS.has(normalizeText(ing.name));
}

export function buildShoppingListPreview(plan: MealPlanImportV1): ShoppingListPreview {
  const aggregatedMap = new Map<string, ShoppingListAggregatedItem>();
  const unconvertibleItems: ShoppingListUnconvertibleItem[] = [];

  for (const day of plan.days) {
    for (const meal of day.meals) {
      for (const ing of meal.recipe.ingredients) {
        if (ing.quantity === null || ing.quantity === undefined) {
          unconvertibleItems.push({
            name: ing.name,
            unit: ing.unit ?? null,
            quantity: null,
            reason: 'missing_quantity',
            recipeName: meal.recipe.name,
            dayIndex: day.dayIndex,
          });
          continue;
        }

        if (!ing.unit || !canonicalUnits.has(ing.unit)) {
          unconvertibleItems.push({
            name: ing.name,
            unit: ing.unit ?? null,
            quantity: ing.quantity,
            reason: 'non_canonical_unit',
            recipeName: meal.recipe.name,
            dayIndex: day.dayIndex,
          });
          continue;
        }

        const unit = ing.unit as 'g' | 'ml' | 'unidad';
        const key = `${normalizeText(ing.name)}::${unit}`;
        const existing = aggregatedMap.get(key);
        if (existing) {
          existing.totalQuantity = Number((existing.totalQuantity + ing.quantity).toFixed(2));
          existing.occurrences += 1;
        } else {
          aggregatedMap.set(key, {
            name: ing.name.trim(),
            unit,
            totalQuantity: Number(ing.quantity.toFixed(2)),
            occurrences: 1,
            isBasePantry: isBasePantryIngredient(ing),
          });
        }
      }
    }
  }

  const aggregatedItems = Array.from(aggregatedMap.values()).sort((a, b) =>
    a.name.localeCompare(b.name)
  );

  return {
    aggregatedItems,
    unconvertibleItems,
    isExact: unconvertibleItems.length === 0,
  };
}

async function defaultDuplicateLookup(
  userId: string,
  normalizedRecipeNames: string[]
): Promise<ExistingRecipeCandidate[]> {
  if (normalizedRecipeNames.length === 0) return [];
  const candidates = await prisma.recipe.findMany({
    where: {
      OR: [{ userId }, { isPublic: true }],
    },
    select: {
      id: true,
      name: true,
      userId: true,
      isPublic: true,
    },
    take: 250,
  });

  const nameSet = new Set(normalizedRecipeNames);
  return candidates.filter((c: ExistingRecipeCandidate) => nameSet.has(normalizeText(c.name)));
}

/**
 * Generates an authoritative, zero-DB-write preview for an imported meal plan.
 * Enforces user isolation on duplicate lookup and blocks persistence commit until M28.
 */
export async function previewImportedMealPlan(
  input: PreviewMealPlanInput
): Promise<MealPlanPreviewResponse> {
  if (!input.userId || typeof input.userId !== 'string') {
    throw new Error('Autenticación requerida para previsualizar planes importados');
  }

  const validation = adaptSkillOutputToMealPlanImport({
    rawPayload: input.rawPayload,
    instructionsVersion: input.instructionsVersion,
  });

  const plan = validation.normalizedPlan;
  if (!plan || validation.status === 'REJECTED') {
    return {
      status: validation.status,
      canImportPreview: false,
      canCommitToDatabase: false,
      persistenceBlockedReason: 'M28_REQUIRED_FOR_FULL_PERSISTENCE',
      previewHash: null,
      validation,
      summary: {
        title: plan?.title ?? null,
        dietType: plan?.preferences.dietType ?? null,
        locale: plan?.preferences.locale ?? null,
        daysCount: plan?.days.length ?? 0,
        mealsCount: 0,
        recipesCount: 0,
        hasIncompleteNutrition: true,
        hasIncompleteIngredients: true,
      },
      shoppingList: {
        aggregatedItems: [],
        unconvertibleItems: [],
        isExact: false,
      },
      duplicateMatches: [],
      batchCookingWarnings: [],
    };
  }

  const recipesByFingerprint = new Map<string, MealPlanImportRecipe>();
  const normalizedNames: string[] = [];
  let mealsCount = 0;
  let hasIncompleteNutrition = false;
  let hasIncompleteIngredients = false;
  const batchCookingWarnings: string[] = [];

  for (const day of plan.days) {
    for (const meal of day.meals) {
      mealsCount += 1;
      const fp = computeRecipeFingerprint(meal.recipe);
      if (!recipesByFingerprint.has(fp)) {
        recipesByFingerprint.set(fp, meal.recipe);
        normalizedNames.push(normalizeText(meal.recipe.name));
      }
      if (meal.recipe.nutrition.certainty === 'unknown' || meal.recipe.nutrition.kcal === null) {
        hasIncompleteNutrition = true;
      }
      if (meal.recipe.ingredients.some((ing) => ing.quantity === null || ing.quantity === undefined)) {
        hasIncompleteIngredients = true;
      }
    }
  }

  if (plan.batchCooking.length === 0 && plan.days.length >= 3) {
    batchCookingWarnings.push(
      'Plan multi-día sin bloques de batch cooking definidos; revisa la preparación por bloques si deseas cocinar por adelantado.'
    );
  }

  const lookup = input.duplicateLookup ?? defaultDuplicateLookup;
  const candidates = await lookup(input.userId, Array.from(new Set(normalizedNames)));

  // Enforce strict user isolation: ignore private recipes belonging to other users even if a custom lookup returned them.
  const authorizedCandidates = candidates.filter(
    (c) => c.userId === input.userId || c.isPublic === true
  );

  const candidateByNormalizedName = new Map<string, ExistingRecipeCandidate>();
  for (const candidate of authorizedCandidates) {
    const key = normalizeText(candidate.name);
    const prev = candidateByNormalizedName.get(key);
    // Prefer user's own recipe over public catalog if both share a name
    if (!prev || candidate.userId === input.userId) {
      candidateByNormalizedName.set(key, candidate);
    }
  }

  const duplicateMatches: RecipeDuplicateMatch[] = [];
  for (const [fp, recipe] of recipesByFingerprint.entries()) {
    const match = candidateByNormalizedName.get(normalizeText(recipe.name));
    if (match) {
      duplicateMatches.push({
        importedRecipeName: recipe.name,
        fingerprint: fp,
        matchedRecipeId: match.id,
        matchedRecipeName: match.name,
        scope: match.userId === input.userId ? 'user_private' : 'public_catalog',
      });
    }
  }

  const shoppingList = buildShoppingListPreview(plan);

  return {
    status: validation.status,
    canImportPreview: true,
    canCommitToDatabase: env.nutritionPlanImportCommitEnabled,
    persistenceBlockedReason: env.nutritionPlanImportCommitEnabled
      ? null
      : 'M28_REQUIRED_FOR_FULL_PERSISTENCE',
    previewHash: computePlanPreviewHash(plan),
    validation,
    summary: {
      title: plan.title,
      dietType: plan.preferences.dietType,
      locale: plan.preferences.locale,
      daysCount: plan.days.length,
      mealsCount,
      recipesCount: recipesByFingerprint.size,
      hasIncompleteNutrition,
      hasIncompleteIngredients,
    },
    shoppingList,
    duplicateMatches,
    batchCookingWarnings,
  };
}
