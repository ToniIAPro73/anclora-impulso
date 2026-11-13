import { MealPlanLifecycleStatus, Prisma } from '@prisma/client';
import { prisma } from '../../../config/database';
import { env } from '../../../config/env';
import type { MealPlanImportV1 } from './meal-plan-import.contract';
import type { MealPlanValidationStatus } from './meal-plan-import.validator';
import {
  computePlanPreviewHash,
  computeRecipeFingerprint,
  type MealPlanImportRecipe,
} from './meal-plan-preview.service';
import { adaptSkillOutputToMealPlanImport } from './skill-adapter';

export class MealPlanCommitError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  public readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'MealPlanCommitError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface CommitImportedMealPlanInput {
  userId: string;
  rawPayload: unknown;
  previewHash: string;
  requestedLifecycleStatus?: 'DRAFT' | 'ACTIVE';
  weekStart?: string;
  instructionsVersion?: string;
  commitEnabled?: boolean;
  prismaClient?: typeof prisma;
}

export interface CommitImportedMealPlanResponse {
  mealPlanId: string;
  title: string | null;
  lifecycleStatus: MealPlanLifecycleStatus;
  validationStatus: MealPlanValidationStatus;
  importSchemaVersion: string;
  importFingerprint: string;
  idempotentReplay: boolean;
  createdRecipesCount: number;
  reusedRecipesCount: number;
  mealsCount: number;
}

function resolveWeekStart(weekStart?: string): Date {
  if (weekStart) {
    const parsed = new Date(weekStart);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }
  const now = new Date();
  const day = now.getUTCDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + diffToMonday)
  );
  return monday;
}

function isUniqueConstraintError(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return error.code === 'P2002';
  }
  return Boolean(
    error &&
      typeof error === 'object' &&
      'code' in error &&
      (error as { code?: unknown }).code === 'P2002'
  );
}

function isRecipeIncomplete(recipe: MealPlanImportRecipe): boolean {
  const missingNutrition =
    recipe.nutrition.certainty === 'unknown' || recipe.nutrition.kcal === null;
  const missingIngredientQty = recipe.ingredients.some(
    (ing) => ing.quantity === null || ing.quantity === undefined
  );
  return missingNutrition || missingIngredientQty;
}

function buildImportMetadata(plan: MealPlanImportV1): Prisma.InputJsonValue {
  return {
    origin: plan.origin,
    preferences: plan.preferences,
    batchCooking: plan.batchCooking,
    warnings: plan.warnings,
    incompleteFields: plan.incompleteFields,
  } as Prisma.InputJsonValue;
}

async function resolveOrCreateUserRecipe(
  tx: Prisma.TransactionClient,
  userId: string,
  recipe: MealPlanImportRecipe,
  mealType: string,
  dietType: string,
  sessionCache: Map<string, { id: string; reused: boolean }>
): Promise<{ id: string; reused: boolean }> {
  const fingerprint = computeRecipeFingerprint(recipe);
  const cached = sessionCache.get(fingerprint);
  if (cached) {
    return cached;
  }

  // Only reuse recipes owned by this exact user (never mutate global or other users' recipes).
  const existingUserRecipe = await tx.recipe.findFirst({
    where: {
      userId,
      contentFingerprint: fingerprint,
    },
    select: { id: true },
  });

  if (existingUserRecipe) {
    const entry = { id: existingUserRecipe.id, reused: true };
    sessionCache.set(fingerprint, entry);
    return entry;
  }

  const createdRecipe = await tx.recipe.create({
    data: {
      userId,
      name: recipe.name,
      nameEn: recipe.nameEn ?? null,
      description: recipe.description ?? null,
      instructions: recipe.instructions as Prisma.InputJsonValue,
      prepTime: recipe.prepTime ?? null,
      cookTime: recipe.cookTime ?? null,
      servings: recipe.servings,
      difficulty: recipe.difficulty ?? null,
      calories: recipe.nutrition.kcal ?? null,
      protein: recipe.nutrition.proteinG ?? null,
      carbs: recipe.nutrition.carbsG ?? null,
      fat: recipe.nutrition.fatG ?? null,
      fiber: recipe.nutrition.fiberG ?? null,
      tags: recipe.cookingMethods,
      source: 'user',
      isPublic: false,
      isEditable: true,
      mealTypes: [mealType],
      dietTypes: [dietType],
      goalTypes: [],
      nutritionSource: recipe.nutrition.dataSource,
      nutritionCertainty: recipe.nutrition.certainty,
      contentFingerprint: fingerprint,
      isIncomplete: isRecipeIncomplete(recipe),
    },
    select: { id: true },
  });

  // Deduplicate ingredients within the same recipe by normalized lowercase name to respect @@unique([recipeId, ingredientId])
  const seenIngredientIds = new Set<string>();
  for (const ing of recipe.ingredients) {
    const normalizedName = ing.name.trim().toLowerCase();
    let ingredient = await tx.ingredient.findUnique({
      where: { name: normalizedName },
      select: { id: true, unit: true },
    });

    if (!ingredient) {
      ingredient = await tx.ingredient.create({
        data: {
          name: normalizedName,
          unit: ing.unit ?? 'unidad',
        },
        select: { id: true, unit: true },
      });
    }

    if (seenIngredientIds.has(ingredient.id)) {
      continue;
    }
    seenIngredientIds.add(ingredient.id);

    const rawQuantityText =
      ing.quantity === null || ing.quantity === undefined
        ? 'not_provided'
        : `${ing.quantity} ${ing.unit ?? ''}`.trim();

    await tx.recipeIngredient.create({
      data: {
        recipeId: createdRecipe.id,
        ingredientId: ingredient.id,
        quantity: ing.quantity ?? null,
        unitOverride: ing.unit && ing.unit !== ingredient.unit ? ing.unit : null,
        rawQuantityText,
        isEstimated: ing.quantitySource === 'estimated',
      },
    });
  }

  const entry = { id: createdRecipe.id, reused: false };
  sessionCache.set(fingerprint, entry);
  return entry;
}

/**
 * Atomically persists a validated `meal-plan-import-v1` plan into M28 tables.
 * Enforces feature-flag gating, server-side revalidation, canonical hash verification,
 * user isolation, and idempotent concurrency handling.
 */
export async function commitImportedMealPlan(
  input: CommitImportedMealPlanInput
): Promise<CommitImportedMealPlanResponse> {
  const isEnabled = input.commitEnabled ?? env.nutritionPlanImportCommitEnabled;
  if (!isEnabled) {
    throw new MealPlanCommitError(
      503,
      'M28_REQUIRED_FOR_FULL_PERSISTENCE',
      'La persistencia de importación nutricional está deshabilitada hasta activar M28.'
    );
  }

  if (!input.userId || typeof input.userId !== 'string') {
    throw new MealPlanCommitError(401, 'UNAUTHORIZED', 'Autenticación requerida.');
  }

  const validation = adaptSkillOutputToMealPlanImport({
    rawPayload: input.rawPayload,
    instructionsVersion: input.instructionsVersion,
  });

  const plan = validation.normalizedPlan;
  if (!plan || validation.status === 'REJECTED') {
    throw new MealPlanCommitError(
      422,
      'IMPORT_VALIDATION_REJECTED',
      'El plan nutricional ha sido rechazado por seguridad o contrato inválido y no puede guardarse.',
      { errors: validation.errors, safetyFlags: validation.safetyFlags }
    );
  }

  const canonicalHash = computePlanPreviewHash(plan);
  if (!input.previewHash || input.previewHash !== canonicalHash) {
    throw new MealPlanCommitError(
      409,
      'PREVIEW_HASH_MISMATCH',
      'El preview ha quedado desactualizado respecto al payload; genera una nueva previsualización antes de guardar.'
    );
  }

  if (validation.status === 'INCOMPLETE' && input.requestedLifecycleStatus === 'ACTIVE') {
    throw new MealPlanCommitError(
      422,
      'INCOMPLETE_PLAN_CANNOT_BE_ACTIVE',
      'Un plan INCOMPLETE solo puede guardarse como borrador (DRAFT) hasta completar sus datos.'
    );
  }

  const targetLifecycleStatus: MealPlanLifecycleStatus =
    validation.status === 'INCOMPLETE'
      ? MealPlanLifecycleStatus.DRAFT
      : input.requestedLifecycleStatus === 'DRAFT'
        ? MealPlanLifecycleStatus.DRAFT
        : MealPlanLifecycleStatus.ACTIVE;

  const db = input.prismaClient ?? prisma;
  const weekStart = resolveWeekStart(input.weekStart);

  try {
    return await db.$transaction(async (tx) => {
      const existing = await tx.mealPlan.findUnique({
        where: {
          userId_importFingerprint: {
            userId: input.userId,
            importFingerprint: canonicalHash,
          },
        },
        select: {
          id: true,
          title: true,
          lifecycleStatus: true,
          importValidationStatus: true,
          importSchemaVersion: true,
          importFingerprint: true,
          _count: { select: { meals: true } },
        },
      });

      if (existing) {
        return {
          mealPlanId: existing.id,
          title: existing.title,
          lifecycleStatus: existing.lifecycleStatus,
          validationStatus:
            (existing.importValidationStatus as MealPlanValidationStatus | null) ??
            validation.status,
          importSchemaVersion: existing.importSchemaVersion ?? plan.specVersion,
          importFingerprint: existing.importFingerprint ?? canonicalHash,
          idempotentReplay: true,
          createdRecipesCount: 0,
          reusedRecipesCount: 0,
          mealsCount: existing._count.meals,
        };
      }

      const createdPlan = await tx.mealPlan.create({
        data: {
          userId: input.userId,
          weekStart,
          dietType: plan.preferences.dietType,
          title: plan.title,
          origin: plan.origin.kind,
          lifecycleStatus: targetLifecycleStatus,
          importValidationStatus: validation.status,
          importSchemaVersion: plan.specVersion,
          importFingerprint: canonicalHash,
          importMetadata: buildImportMetadata(plan),
        },
        select: {
          id: true,
          title: true,
          lifecycleStatus: true,
        },
      });

      const sessionRecipeCache = new Map<string, { id: string; reused: boolean }>();
      let createdRecipesCount = 0;
      let reusedRecipesCount = 0;
      let mealsCount = 0;
      const countedFingerprints = new Set<string>();

      for (const day of plan.days) {
        for (const slot of day.meals) {
          const fp = computeRecipeFingerprint(slot.recipe);
          const resolved = await resolveOrCreateUserRecipe(
            tx,
            input.userId,
            slot.recipe,
            slot.mealType,
            plan.preferences.dietType,
            sessionRecipeCache
          );

          if (!countedFingerprints.has(fp)) {
            countedFingerprints.add(fp);
            if (resolved.reused) {
              reusedRecipesCount += 1;
            } else {
              createdRecipesCount += 1;
            }
          }

          const createdMeal = await tx.meal.create({
            data: {
              mealPlanId: createdPlan.id,
              dayOfWeek: day.dayIndex,
              mealType: slot.mealType,
              selectedRecipeId: resolved.id,
              scheduledTime: slot.scheduledTime ?? null,
              prepMode: slot.recipe.mealPrep?.batchCookingGroup ? 'batch_prep' : 'fresh',
            },
            select: { id: true },
          });

          await tx.mealRecipe.create({
            data: {
              mealId: createdMeal.id,
              recipeId: resolved.id,
            },
          });

          mealsCount += 1;
        }
      }

      return {
        mealPlanId: createdPlan.id,
        title: createdPlan.title,
        lifecycleStatus: createdPlan.lifecycleStatus,
        validationStatus: validation.status,
        importSchemaVersion: plan.specVersion,
        importFingerprint: canonicalHash,
        idempotentReplay: false,
        createdRecipesCount,
        reusedRecipesCount,
        mealsCount,
      };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      const winner = await db.mealPlan.findUnique({
        where: {
          userId_importFingerprint: {
            userId: input.userId,
            importFingerprint: canonicalHash,
          },
        },
        select: {
          id: true,
          title: true,
          lifecycleStatus: true,
          importValidationStatus: true,
          importSchemaVersion: true,
          importFingerprint: true,
          _count: { select: { meals: true } },
        },
      });
      if (winner) {
        return {
          mealPlanId: winner.id,
          title: winner.title,
          lifecycleStatus: winner.lifecycleStatus,
          validationStatus:
            (winner.importValidationStatus as MealPlanValidationStatus | null) ??
            validation.status,
          importSchemaVersion: winner.importSchemaVersion ?? plan.specVersion,
          importFingerprint: winner.importFingerprint ?? canonicalHash,
          idempotentReplay: true,
          createdRecipesCount: 0,
          reusedRecipesCount: 0,
          mealsCount: winner._count.meals,
        };
      }
    }
    throw error;
  }
}

