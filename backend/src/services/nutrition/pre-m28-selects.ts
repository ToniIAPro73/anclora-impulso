import type { Prisma } from '@prisma/client';

/**
 * Explicit M27-compatible Prisma `select` projections for nutrition models.
 * Prevents Prisma Client (generated from M28 schema) from selecting M28-only columns
 * before the M28 SQL migration is applied to Neon.
 */

export const PRE_M28_RECIPE_INGREDIENT_SELECT = {
  id: true,
  recipeId: true,
  ingredientId: true,
  quantity: true,
  ingredient: {
    select: {
      id: true,
      name: true,
      nameEn: true,
      unit: true,
    },
  },
} satisfies Prisma.RecipeIngredientSelect;

export const PRE_M28_RECIPE_BASE_SELECT = {
  id: true,
  userId: true,
  name: true,
  nameEn: true,
  description: true,
  instructions: true,
  prepTime: true,
  cookTime: true,
  servings: true,
  difficulty: true,
  calories: true,
  protein: true,
  carbs: true,
  fat: true,
  fiber: true,
  imageUrl: true,
  tags: true,
  source: true,
  isPublic: true,
  isEditable: true,
  mealTypes: true,
  dietTypes: true,
  goalTypes: true,
  editorialOverrideStatus: true,
  editorialNotes: true,
  editorialReviewedAt: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.RecipeSelect;

export const PRE_M28_RECIPE_SELECT = {
  ...PRE_M28_RECIPE_BASE_SELECT,
  ingredients: {
    select: PRE_M28_RECIPE_INGREDIENT_SELECT,
  },
} satisfies Prisma.RecipeSelect;

export const PRE_M28_MEAL_BASE_SELECT = {
  id: true,
  mealPlanId: true,
  dayOfWeek: true,
  mealType: true,
  servingMultiplier: true,
  adjustmentReason: true,
  selectedRecipeId: true,
} satisfies Prisma.MealSelect;

export const PRE_M28_MEAL_WITH_RECIPES_SELECT = {
  ...PRE_M28_MEAL_BASE_SELECT,
  selectedRecipe: {
    select: PRE_M28_RECIPE_SELECT,
  },
  recipes: {
    select: {
      id: true,
      mealId: true,
      recipeId: true,
      recipe: {
        select: PRE_M28_RECIPE_SELECT,
      },
    },
  },
} satisfies Prisma.MealSelect;

export const PRE_M28_MEAL_WITH_RECIPE_BASE_SELECT = {
  ...PRE_M28_MEAL_BASE_SELECT,
  recipes: {
    select: {
      id: true,
      mealId: true,
      recipeId: true,
      recipe: {
        select: PRE_M28_RECIPE_BASE_SELECT,
      },
    },
  },
} satisfies Prisma.MealSelect;

export const PRE_M28_MEAL_PLAN_BASE_SELECT = {
  id: true,
  userId: true,
  weekStart: true,
  goal: true,
  dietType: true,
  carryoverCaloriesApplied: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.MealPlanSelect;

export const PRE_M28_MEAL_PLAN_WITH_MEALS_SELECT = {
  ...PRE_M28_MEAL_PLAN_BASE_SELECT,
  meals: {
    select: PRE_M28_MEAL_WITH_RECIPES_SELECT,
  },
} satisfies Prisma.MealPlanSelect;

