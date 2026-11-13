import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import logger from '../config/logger';
import { buildNutritionPersonalizationGuidance } from './forty-plus-guidance';
import {
  getPersonalizationSnapshot,
  type PersonalizationSnapshot,
} from './personalization.service';
import type { Prisma } from '@prisma/client';
import type {
  BulkUpdateRecipeEditorialInput,
  CreateFoodItemInput,
  CreateMealLogInput,
  CreateRecipeInput,
  CreateSmartMealPlanInput,
  GenerateMealPlanInput,
  ListFoodItemsQueryInput,
  ListMealLogsQueryInput,
  ListRecipesQueryInput,
  CreateNutritionLogInput,
  ReplaceMealRecipeInput,
  UpsertNutritionTargetInput,
  UpdateRecipeInput,
} from '../utils/validators';
import { env } from '../config/env';
import {
  PRE_M28_MEAL_BASE_SELECT,
  PRE_M28_MEAL_PLAN_BASE_SELECT,
  PRE_M28_MEAL_PLAN_WITH_MEALS_SELECT,
  PRE_M28_MEAL_WITH_RECIPE_BASE_SELECT,
  PRE_M28_MEAL_WITH_RECIPES_SELECT,
  PRE_M28_RECIPE_SELECT,
} from './nutrition/pre-m28-selects';

type MealPlanWithMeals = Awaited<ReturnType<typeof getMealPlanById>>;
type PrismaTx = Prisma.TransactionClient;
type RecipeWithRelations = Prisma.RecipeGetPayload<{ select: typeof PRE_M28_RECIPE_SELECT }>;
type SupportedMealType = 'desayuno' | 'almuerzo' | 'cena' | 'snack';
type SupportedDietType = 'ninguna' | 'mediterranea' | 'dash' | 'ayuno_intermitente' | 'alta_proteina';
type SupportedDifficulty = 'facil' | 'medio' | 'dificil';
type WeeklyRecipeSelection = {
  dayOfWeek: number;
  mealType: SupportedMealType;
  recipe: RecipeWithRelations;
};
type RecipeVarietyProfile = {
  familyKey: string;
  proteinKey: string;
  baseKey: string;
};

const recipeSelect = PRE_M28_RECIPE_SELECT;

function normalizeTagList(values: string[] | undefined): string[] {
  return Array.from(new Set((values ?? []).map((value) => value.trim()).filter(Boolean)));
}

function buildRecipeAccessWhere(userId: string, filters: ListRecipesQueryInput): Prisma.RecipeWhereInput {
  const accessWhere =
    filters.scope === 'mine'
      ? { userId }
      : filters.scope === 'public'
        ? { isPublic: true }
        : {
            OR: [
              { isPublic: true },
              { userId },
            ],
          };

  return {
    AND: [
      accessWhere,
      filters.query
        ? {
            OR: [
              { name: { contains: filters.query, mode: 'insensitive' } },
              { description: { contains: filters.query, mode: 'insensitive' } },
              { tags: { has: filters.query.toLowerCase() } },
            ],
          }
        : {},
      filters.mealType ? { mealTypes: { has: filters.mealType } } : {},
      filters.dietType ? { dietTypes: { has: filters.dietType } } : {},
      filters.goalType ? { goalTypes: { has: filters.goalType } } : {},
      filters.source ? { source: filters.source } : {},
    ],
  };
}

async function assertRecipeAccess(recipeId: string, userId: string) {
  const recipe = await prisma.recipe.findFirst({
    where: {
      id: recipeId,
      OR: [
        { isPublic: true },
        { userId },
      ],
    },
    select: recipeSelect,
  });

  if (!recipe) {
    throw new AppError(404, 'Receta no encontrada');
  }

  return recipe;
}

function calculateRecipeQuality(recipe: {
  description?: string | null;
  instructions: unknown;
  imageUrl?: string | null;
  difficulty?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  tags: string[];
  ingredients?: Array<unknown>;
  editorialOverrideStatus?: string | null;
  editorialNotes?: string | null;
}) {
  const instructions = Array.isArray(recipe.instructions) ? recipe.instructions : [];
  const checks = {
    hasDescription: Boolean(recipe.description && recipe.description.trim().length >= 24),
    hasEnoughInstructions: instructions.length >= 3,
    hasImage: Boolean(recipe.imageUrl),
    hasDifficulty: Boolean(recipe.difficulty),
    hasMacros: [recipe.calories, recipe.protein, recipe.carbs, recipe.fat].every((value) => typeof value === 'number' && value >= 0),
    hasTags: Array.isArray(recipe.tags) && recipe.tags.length >= 2,
    hasIngredients: Array.isArray(recipe.ingredients) && recipe.ingredients.length >= 3,
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  return {
    qualityScore: Math.round((passedChecks / Object.keys(checks).length) * 100),
    editorialStatus:
      recipe.editorialOverrideStatus ?? (passedChecks >= 6 ? 'ready' : passedChecks >= 4 ? 'review' : 'needs_work'),
    autoEditorialStatus: passedChecks >= 6 ? 'ready' : passedChecks >= 4 ? 'review' : 'needs_work',
    editorialNotes: recipe.editorialNotes ?? null,
    checks,
  };
}

function decorateRecipe<T extends {
  description?: string | null;
  instructions: unknown;
  imageUrl?: string | null;
  difficulty?: string | null;
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
  tags: string[];
  ingredients?: Array<unknown>;
  editorialOverrideStatus?: string | null;
  editorialNotes?: string | null;
}>(recipe: T) {
  return {
    ...recipe,
    editorial: calculateRecipeQuality(recipe),
  };
}

const GOAL_ALIASES: Record<string, string> = {
  lose_weight: 'perdida_peso',
  perdida_peso: 'perdida_peso',
  build_muscle: 'ganancia_muscular',
  ganancia_muscular: 'ganancia_muscular',
  recomposition: 'recomposicion',
  recomposicion: 'recomposicion',
  maintain: 'mantenimiento',
  mantenimiento: 'mantenimiento',
  energia: 'mantenimiento',
};

const GOAL_LABELS_ES: Record<string, string> = {
  perdida_peso: 'pérdida de peso',
  ganancia_muscular: 'ganancia muscular',
  recomposicion: 'recomposición corporal',
  mantenimiento: 'mantenimiento',
};

function normalizeGoalKey(goal?: string | null): string | undefined {
  if (!goal) return undefined;
  return GOAL_ALIASES[goal] ?? goal;
}

function humanizeGoalLabel(goal?: string | null): string | null {
  const normalizedGoal = normalizeGoalKey(goal);
  if (!normalizedGoal) return null;
  return GOAL_LABELS_ES[normalizedGoal] ?? normalizedGoal.replaceAll('_', ' ');
}

function recipeSearchHaystack(recipe: RecipeWithRelations) {
  return [
    recipe.name,
    recipe.description,
    ...(recipe.tags ?? []),
    ...(recipe.goalTypes ?? []),
    ...(recipe.dietTypes ?? []),
    ...(recipe.ingredients ?? []).map((ingredient) => ingredient.ingredient.name),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function normalizeVarietyToken(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function detectFirstKeyword(haystack: string, groups: Record<string, string[]>) {
  for (const [key, terms] of Object.entries(groups)) {
    if (terms.some((term) => haystack.includes(term))) {
      return key;
    }
  }

  return 'other';
}

const PROTEIN_GROUPS: Record<string, string[]> = {
  chicken: ['pollo', 'chicken'],
  turkey: ['pavo', 'turkey'],
  beef: ['ternera', 'vacuno', 'beef'],
  pork: ['cerdo', 'pork'],
  fish: ['pescado', 'salmon', 'salmón', 'merluza', 'atun', 'atún', 'bacalao', 'fish'],
  egg: ['huevo', 'tortilla', 'egg'],
  dairy: ['yogur', 'yogurt', 'queso fresco', 'cottage'],
  legume: ['lenteja', 'garbanzo', 'alubia', 'tofu', 'tempeh', 'legumbre'],
};

const BASE_GROUPS: Record<string, string[]> = {
  rice: ['arroz', 'rice'],
  potato: ['patata', 'papa', 'boniato', 'potato'],
  pasta: ['pasta', 'espagueti', 'macarron'],
  quinoa: ['quinoa'],
  oats: ['avena', 'oat'],
  bread: ['pan', 'tostada', 'wrap', 'tortilla'],
  vegetable: ['verdura', 'brocoli', 'brócoli', 'ensalada', 'calabacin', 'calabacín'],
  fruit: ['fruta', 'manzana', 'platano', 'plátano', 'frutos rojos'],
};

function getRecipeVarietyProfile(recipe: RecipeWithRelations): RecipeVarietyProfile {
  const haystack = normalizeVarietyToken(recipeSearchHaystack(recipe));
  const proteinKey = detectFirstKeyword(haystack, PROTEIN_GROUPS);
  const baseKey = detectFirstKeyword(haystack, BASE_GROUPS);
  const mealKeywordSet = new Set<SupportedMealType>(['desayuno', 'almuerzo', 'cena']);
  const relevantTags = (recipe.tags ?? [])
    .map(normalizeVarietyToken)
    .filter((tag) => tag && !mealKeywordSet.has(tag as SupportedMealType))
    .slice(0, 2)
    .join('-');
  const fallbackNameFamily = normalizeVarietyToken(recipe.name).split(' ').slice(0, 3).join('-') || recipe.id;

  return {
    proteinKey,
    baseKey,
    familyKey: `${proteinKey}:${baseKey}:${relevantTags || fallbackNameFamily}`,
  };
}

function getMealTypesForPlan(dietType?: string | null): SupportedMealType[] {
  return dietType === 'ayuno_intermitente'
    ? ['almuerzo', 'cena']
    : ['desayuno', 'almuerzo', 'cena'];
}

function getMealTypeKeywords(mealType: SupportedMealType) {
  switch (mealType) {
    case 'desayuno':
      return ['desayuno'];
    case 'almuerzo':
      return ['almuerzo', 'comida'];
    case 'cena':
      return ['cena'];
    case 'snack':
      return ['snack', 'tentempie', 'entre horas'];
    default:
      return [mealType];
  }
}

function scoreRecipeForPlan(
  recipe: RecipeWithRelations,
  options: {
    mealType: SupportedMealType;
    goal?: string;
    dietType?: SupportedDietType;
    difficulty?: SupportedDifficulty;
    includeIngredients?: string[];
  }
) {
  let score = 0;

  if (recipe.mealTypes.length === 0 || recipe.mealTypes.includes(options.mealType)) {
    score += 50;
  }

  const recipeName = recipe.name.toLowerCase();
  const mealKeywords = getMealTypeKeywords(options.mealType);
  if (mealKeywords.some((keyword) => recipeName.includes(keyword))) {
    score += 24;
  } else if (recipe.tags.some((tag) => mealKeywords.includes(tag.toLowerCase()))) {
    score += 12;
  }

  if (options.goal) {
    if (recipe.goalTypes.includes(options.goal)) {
      score += 40;
    } else if (recipe.goalTypes.length === 0) {
      score += 8;
    }
  }

  if (options.dietType && options.dietType !== 'ninguna') {
    if (recipe.dietTypes.includes(options.dietType)) {
      score += 35;
    } else if (recipe.dietTypes.length === 0) {
      score += 4;
    }
  }

  if (options.difficulty) {
    if ((recipe.difficulty ?? '').toLowerCase() === options.difficulty) {
      score += 20;
    }
  } else if ((recipe.difficulty ?? '').toLowerCase() !== 'dificil') {
    score += 6;
  }

  if (options.includeIngredients && options.includeIngredients.length > 0) {
    const haystack = recipeSearchHaystack(recipe);
    for (const ingredient of options.includeIngredients) {
      if (haystack.includes(ingredient.toLowerCase())) {
        score += 12;
      }
    }
  }

  const calories = recipe.calories ?? 0;
  const protein = recipe.protein ?? 0;
  const carbs = recipe.carbs ?? 0;
  const fat = recipe.fat ?? 0;
  const prepTime = recipe.prepTime ?? 0;

  switch (options.goal) {
    case 'perdida_peso':
      score += Math.min(protein, 65) * 0.7;
      if (calories >= 350 && calories <= 720) score += 18;
      if (carbs <= 90) score += 6;
      if (prepTime <= 20) score += 5;
      break;
    case 'ganancia_muscular':
      score += Math.min(protein, 80) * 0.85;
      if (calories >= 500 && calories <= 950) score += 18;
      if (carbs >= 35) score += 8;
      break;
    case 'recomposicion':
      score += Math.min(protein, 75) * 0.8;
      if (calories >= 420 && calories <= 820) score += 15;
      if (fat <= 28) score += 5;
      break;
    default:
      score += Math.min(protein, 55) * 0.45;
      if (calories >= 350 && calories <= 850) score += 10;
  }

  if (options.dietType === 'ayuno_intermitente' && options.mealType !== 'desayuno' && calories >= 450) {
    score += 10;
  }

  return score;
}

function isRecipeAllowedForPlan(
  recipe: RecipeWithRelations,
  options: {
    mealType: SupportedMealType;
    dietType?: SupportedDietType;
    difficulty?: SupportedDifficulty;
    dietaryRestrictions?: string[];
  }
) {
  if (recipe.mealTypes.length > 0 && !recipe.mealTypes.includes(options.mealType)) {
    return false;
  }

  if (options.dietType && options.dietType !== 'ninguna' && recipe.dietTypes.length > 0 && !recipe.dietTypes.includes(options.dietType)) {
    return false;
  }

  if (options.difficulty && (recipe.difficulty ?? '').toLowerCase() !== options.difficulty) {
    return false;
  }

  if (options.dietaryRestrictions && options.dietaryRestrictions.length > 0) {
    const haystack = recipeSearchHaystack(recipe);
    for (const restrictedTerm of options.dietaryRestrictions) {
      if (haystack.includes(restrictedTerm.toLowerCase())) {
        return false;
      }
    }
  }

  return true;
}

export function selectRecipesForWeeklyPlanFromCandidates(
  accessibleRecipes: RecipeWithRelations[],
  options: {
    goal?: string;
    dietType?: SupportedDietType;
    difficulty?: SupportedDifficulty;
    includeIngredients?: string[];
    dietaryRestrictions?: string[];
  }
) {
  if (accessibleRecipes.length === 0) {
    throw new AppError(400, 'No hay recetas disponibles para generar el plan.');
  }

  const mealTypes = getMealTypesForPlan(options.dietType);
  const usageCount = new Map<string, number>();
  const lastUsedDay = new Map<string, number>();
  const familyUsageByMeal = new Map<string, number>();
  const familyLastUsedByMeal = new Map<string, number>();
  const familyUsageByPlan = new Map<string, number>();
  const familyLastUsedByPlan = new Map<string, number>();
  const proteinUsageByPlan = new Map<string, number>();
  const baseUsageByPlan = new Map<string, number>();
  const proteinLastUsedByMeal = new Map<string, number>();
  const baseLastUsedByMeal = new Map<string, number>();
  const selections: WeeklyRecipeSelection[] = [];

  for (let dayOfWeek = 0; dayOfWeek < 7; dayOfWeek += 1) {
    const dailyFamilyUsage = new Map<string, number>();
    const dailyProteinUsage = new Map<string, number>();
    const dailyBaseUsage = new Map<string, number>();

    for (const mealType of mealTypes) {
      let candidates = accessibleRecipes.filter((recipe) =>
        isRecipeAllowedForPlan(recipe, {
          mealType,
          dietType: options.dietType,
          difficulty: options.difficulty,
          dietaryRestrictions: options.dietaryRestrictions,
        })
      );

      if (candidates.length === 0) {
        candidates = accessibleRecipes.filter((recipe) =>
          isRecipeAllowedForPlan(recipe, {
            mealType,
            dietaryRestrictions: options.dietaryRestrictions,
          })
        );
      }

      if (candidates.length === 0) {
        throw new AppError(400, `No hay recetas suficientes para ${mealType}.`);
      }

      const rankedCandidates = candidates
        .map((recipe) => {
          const baseScore = scoreRecipeForPlan(recipe, {
            mealType,
            goal: options.goal,
            dietType: options.dietType,
            difficulty: options.difficulty,
            includeIngredients: options.includeIngredients,
          });
          const variety = getRecipeVarietyProfile(recipe);
          const mealFamilyKey = `${mealType}:${variety.familyKey}`;
          const mealProteinKey = `${mealType}:protein:${variety.proteinKey}`;
          const mealBaseKey = `${mealType}:base:${variety.baseKey}`;
          const familyUses = familyUsageByMeal.get(mealFamilyKey) ?? 0;
          const planFamilyUses = familyUsageByPlan.get(variety.familyKey) ?? 0;
          const planProteinUses = proteinUsageByPlan.get(variety.proteinKey) ?? 0;
          const planBaseUses = baseUsageByPlan.get(variety.baseKey) ?? 0;
          const dailyFamilyUses = dailyFamilyUsage.get(variety.familyKey) ?? 0;
          const dailyProteinUses = dailyProteinUsage.get(variety.proteinKey) ?? 0;
          const dailyBaseUses = dailyBaseUsage.get(variety.baseKey) ?? 0;
          const familyLastUsed = familyLastUsedByMeal.get(mealFamilyKey);
          const planFamilyLastUsed = familyLastUsedByPlan.get(variety.familyKey);
          const proteinLastUsed = proteinLastUsedByMeal.get(mealProteinKey);
          const baseLastUsed = baseLastUsedByMeal.get(mealBaseKey);
          const sameFamilyYesterday = familyLastUsed !== undefined && dayOfWeek - familyLastUsed <= 1;
          const samePlanFamilyYesterday = planFamilyLastUsed !== undefined && dayOfWeek - planFamilyLastUsed <= 1;
          const sameProteinYesterday =
            variety.proteinKey !== 'other' && proteinLastUsed !== undefined && dayOfWeek - proteinLastUsed <= 1;
          const sameBaseYesterday = variety.baseKey !== 'other' && baseLastUsed !== undefined && dayOfWeek - baseLastUsed <= 1;
          const sameFamilyToday = dailyFamilyUses > 0;
          const sameProteinToday = variety.proteinKey !== 'other' && dailyProteinUses > 0;
          const sameBaseToday = variety.baseKey !== 'other' && dailyBaseUses > 0;
          const planProteinPenalty = variety.proteinKey === 'other' ? 0 : planProteinUses * 8;
          const planBasePenalty = variety.baseKey === 'other' ? 0 : planBaseUses * 5;
          const varietyPenalty =
            familyUses * 55 +
            planFamilyUses * 18 +
            (sameFamilyYesterday ? 45 : 0) +
            (samePlanFamilyYesterday ? 36 : 0) +
            (sameFamilyToday ? 90 : 0) +
            (sameProteinToday ? 58 : 0) +
            (sameBaseToday ? 34 : 0) +
            (sameProteinYesterday ? 22 : 0) +
            (sameBaseYesterday ? 12 : 0) +
            planProteinPenalty +
            planBasePenalty;

          return {
            recipe,
            variety,
            score: baseScore - varietyPenalty,
            uses: usageCount.get(recipe.id) ?? 0,
            lastUsed: lastUsedDay.get(recipe.id),
          };
        })
        .sort((left, right) => {
          if (left.uses !== right.uses) return left.uses - right.uses;

          const leftGap = left.lastUsed === undefined ? Number.POSITIVE_INFINITY : dayOfWeek - left.lastUsed;
          const rightGap = right.lastUsed === undefined ? Number.POSITIVE_INFINITY : dayOfWeek - right.lastUsed;
          if (leftGap !== rightGap) return rightGap - leftGap;

          if (left.score !== right.score) return right.score - left.score;

          return left.recipe.name.localeCompare(right.recipe.name, 'es');
        });

      const chosen = rankedCandidates[0];
      const chosenMealFamilyKey = `${mealType}:${chosen.variety.familyKey}`;
      const chosenMealProteinKey = `${mealType}:protein:${chosen.variety.proteinKey}`;
      const chosenMealBaseKey = `${mealType}:base:${chosen.variety.baseKey}`;

      usageCount.set(chosen.recipe.id, (usageCount.get(chosen.recipe.id) ?? 0) + 1);
      lastUsedDay.set(chosen.recipe.id, dayOfWeek);
      familyUsageByMeal.set(chosenMealFamilyKey, (familyUsageByMeal.get(chosenMealFamilyKey) ?? 0) + 1);
      familyLastUsedByMeal.set(chosenMealFamilyKey, dayOfWeek);
      familyUsageByPlan.set(chosen.variety.familyKey, (familyUsageByPlan.get(chosen.variety.familyKey) ?? 0) + 1);
      familyLastUsedByPlan.set(chosen.variety.familyKey, dayOfWeek);
      dailyFamilyUsage.set(chosen.variety.familyKey, (dailyFamilyUsage.get(chosen.variety.familyKey) ?? 0) + 1);
      if (chosen.variety.proteinKey !== 'other') {
        proteinLastUsedByMeal.set(chosenMealProteinKey, dayOfWeek);
        proteinUsageByPlan.set(chosen.variety.proteinKey, (proteinUsageByPlan.get(chosen.variety.proteinKey) ?? 0) + 1);
        dailyProteinUsage.set(chosen.variety.proteinKey, (dailyProteinUsage.get(chosen.variety.proteinKey) ?? 0) + 1);
      }
      if (chosen.variety.baseKey !== 'other') {
        baseLastUsedByMeal.set(chosenMealBaseKey, dayOfWeek);
        baseUsageByPlan.set(chosen.variety.baseKey, (baseUsageByPlan.get(chosen.variety.baseKey) ?? 0) + 1);
        dailyBaseUsage.set(chosen.variety.baseKey, (dailyBaseUsage.get(chosen.variety.baseKey) ?? 0) + 1);
      }
      selections.push({
        dayOfWeek,
        mealType,
        recipe: chosen.recipe,
      });
    }
  }

  return selections;
}

async function selectRecipesForWeeklyPlan(
  userId: string,
  options: {
    goal?: string;
    dietType?: SupportedDietType;
    difficulty?: SupportedDifficulty;
    includeIngredients?: string[];
    dietaryRestrictions?: string[];
  }
) {
  const accessibleRecipes = await prisma.recipe.findMany({
    where: {
      AND: [
        {
          OR: [
            { isPublic: true },
            { userId },
          ],
        },
        options.difficulty ? { difficulty: options.difficulty } : {},
      ],
    },
    select: recipeSelect,
    orderBy: [
      { isPublic: 'desc' },
      { updatedAt: 'desc' },
    ],
  });

  return selectRecipesForWeeklyPlanFromCandidates(accessibleRecipes, options);
}

function buildMealPlanExplanation(snapshot: PersonalizationSnapshot, plan: {
  dietType?: string | null;
  meals: Array<{ mealType: string; recipes: Array<{ recipe: { calories?: number | null; protein?: number | null } }> }>;
}) {
  const reasons: string[] = [];
  const nutritionConsistency = snapshot.nutritionConsistencyRate ?? 0;

  if (snapshot.profile.trainingGoal) {
    reasons.push(`El plan se orienta al objetivo ${humanizeGoalLabel(snapshot.profile.trainingGoal) ?? snapshot.profile.trainingGoal}.`);
  }

  if (nutritionConsistency < 0.5) {
    reasons.push('La estructura prioriza continuidad y fricción baja porque tu registro reciente todavía es irregular.');
  } else if (nutritionConsistency > 0.85) {
    reasons.push('Tu buena constancia permite una pauta más afinada y controlada.');
  } else {
    reasons.push('La propuesta mantiene un nivel de precisión intermedio para no perder adherencia.');
  }

  if (plan.dietType === 'ayuno_intermitente') {
    reasons.push('Se respeta la ventana de ayuno intermitente y se reajustan excesos dentro de la semana.');
  }

  if (snapshot.stagnationRisk === 'high') {
    reasons.push('Hay riesgo de estancamiento, así que la pauta intenta hacer más visible el ajuste energético.');
  }

  return {
    headline: 'Por qué encaja contigo',
    summary:
      'La nutrición propuesta usa tu objetivo, tu ritmo de entrenamiento y tu constancia reciente para evitar un plan teórico difícil de sostener.',
    reasons,
    signals: [
      {
        label: 'Constancia nutricional',
        value: `${Math.round(nutritionConsistency * 100)}%`,
      },
      {
        label: 'Riesgo de estancamiento',
        value: snapshot.stagnationRisk,
      },
      {
        label: 'Objetivo semanal',
        value: snapshot.weeklyTarget ? `${snapshot.weeklyTarget} sesiones` : '—',
      },
    ],
    nextBestAction: {
      label: 'Registrar comida',
      href: '/nutrition',
    },
    adjustment:
      snapshot.nutritionAdjustment === 'reduce'
        ? 'Prioriza sencillez, saciedad y continuidad diaria.'
        : snapshot.nutritionAdjustment === 'increase'
          ? 'Tu base permite apretar algo más la precisión nutricional.'
          : 'Mantén la pauta y observa la tendencia semanal antes de corregir.',
  };
}

function decorateMealPlan<T extends { dietType?: string | null; meals: Array<{ mealType: string; recipes: Array<{ recipe: { calories?: number | null; protein?: number | null } }> }> }>(
  plan: T,
  snapshot: PersonalizationSnapshot
) {
  return {
    ...plan,
    explanation: buildMealPlanExplanation(snapshot, plan),
  };
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const IF_FASTING_TARGET_HOURS = 16;
const IF_EATING_WINDOW_HOURS = 8;
const MAX_AUTOMATIC_REDUCTION_RATIO = 0.28;
const MIN_SERVING_MULTIPLIER = 0.72;

function getWeekStart(date: Date): Date {
  const weekStart = new Date(date);
  const jsDay = weekStart.getDay();
  const diffToMonday = jsDay === 0 ? -6 : 1 - jsDay;
  weekStart.setDate(weekStart.getDate() + diffToMonday);
  weekStart.setHours(0, 0, 0, 0);
  return weekStart;
}

function getDayOfWeekFromDate(date: Date): number {
  const jsDay = date.getDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

function getWeekEnd(weekStart: Date): Date {
  return new Date(weekStart.getTime() + 7 * DAY_IN_MS);
}

async function ensureNutritionBalance(userId: string, tx: PrismaTx = prisma) {
  const existing = await tx.userNutritionBalance.findUnique({
    where: { userId },
  });

  if (existing) {
    return existing;
  }

  return tx.userNutritionBalance.create({
    data: {
      userId,
      carryoverCalories: 0,
    },
  });
}

async function getPlanWithMeals(tx: PrismaTx, planId: string) {
  return tx.mealPlan.findUnique({
    where: { id: planId },
    select: {
      ...PRE_M28_MEAL_PLAN_BASE_SELECT,
      meals: {
        select: PRE_M28_MEAL_WITH_RECIPE_BASE_SELECT,
        orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }],
      },
    },
  });
}

async function resetMealAdjustments(tx: PrismaTx, planId: string) {
  await tx.meal.updateMany({
    where: { mealPlanId: planId },
    data: {
      servingMultiplier: 1,
      adjustmentReason: null,
    },
  });
}

async function applyCalorieAdjustmentToPlan(
  tx: PrismaTx,
  planId: string,
  caloriesToCompensate: number,
  startDayOfWeek: number,
  reason: string
) {
  if (caloriesToCompensate <= 0) {
    return { absorbedCalories: 0, leftoverCalories: 0 };
  }

  const plan = await getPlanWithMeals(tx, planId);
  if (!plan) {
    return { absorbedCalories: 0, leftoverCalories: caloriesToCompensate };
  }

  const adjustableMeals = plan.meals.filter(
    (meal) =>
      meal.dayOfWeek >= startDayOfWeek &&
      meal.recipes.some((mealRecipe) => (mealRecipe.recipe.calories ?? 0) > 0)
  );

  if (adjustableMeals.length === 0) {
    return { absorbedCalories: 0, leftoverCalories: caloriesToCompensate };
  }

  const totalFutureCalories = adjustableMeals.reduce((sum, meal) => {
    const mealCalories = meal.recipes.reduce((mealSum, mealRecipe) => mealSum + (mealRecipe.recipe.calories ?? 0), 0);
    return sum + mealCalories;
  }, 0);

  if (totalFutureCalories <= 0) {
    return { absorbedCalories: 0, leftoverCalories: caloriesToCompensate };
  }

  const requestedRatio = caloriesToCompensate / totalFutureCalories;
  const appliedRatio = Math.min(requestedRatio, MAX_AUTOMATIC_REDUCTION_RATIO);

  for (const meal of adjustableMeals) {
    const updatedMultiplier = Math.max(MIN_SERVING_MULTIPLIER, 1 - appliedRatio);
    await tx.meal.update({
      where: { id: meal.id },
      data: {
        servingMultiplier: updatedMultiplier,
        adjustmentReason: reason,
      },
      select: { id: true },
    });
  }

  const absorbedCalories = Math.round(totalFutureCalories * appliedRatio);
  return {
    absorbedCalories,
    leftoverCalories: Math.max(0, caloriesToCompensate - absorbedCalories),
  };
}

async function reapplyPlanAdjustments(
  tx: PrismaTx,
  planId: string,
  baseCarryoverCalories: number,
  currentWeekExcessCalories: number,
  currentDayOfWeek: number
) {
  await resetMealAdjustments(tx, planId);

  if (baseCarryoverCalories > 0) {
    await applyCalorieAdjustmentToPlan(
      tx,
      planId,
      baseCarryoverCalories,
      0,
      `Compensación arrastrada de la semana anterior (${Math.round(baseCarryoverCalories)} kcal)`
    );
  }

  if (currentWeekExcessCalories <= 0) {
    return 0;
  }

  const { leftoverCalories } = await applyCalorieAdjustmentToPlan(
    tx,
    planId,
    currentWeekExcessCalories,
    currentDayOfWeek + 1,
    `Ajuste por exceso acumulado de la semana (${Math.round(currentWeekExcessCalories)} kcal)`
  );

  return leftoverCalories;
}

async function reconcileIntermittentFastingBalance(
  tx: PrismaTx,
  userId: string,
  referenceDate: Date
) {
  const activeWeekStart = getWeekStart(referenceDate);
  const activeWeekEnd = getWeekEnd(activeWeekStart);
  const currentDayOfWeek = getDayOfWeekFromDate(referenceDate);

  const activePlan = await tx.mealPlan.findFirst({
    where: {
      userId,
      weekStart: {
        lte: referenceDate,
      },
      dietType: 'ayuno_intermitente',
    },
    orderBy: { weekStart: 'desc' },
    select: {
      ...PRE_M28_MEAL_PLAN_BASE_SELECT,
      meals: {
        select: PRE_M28_MEAL_WITH_RECIPE_BASE_SELECT,
      },
    },
  });

  if (!activePlan || activePlan.weekStart.getTime() < activeWeekStart.getTime()) {
    return;
  }

  const weekLogs = await tx.nutritionLog.findMany({
    where: {
      userId,
      date: {
        gte: activeWeekStart,
        lt: activeWeekEnd,
      },
    },
  });

  const plannedCaloriesByDay = new Map<number, number>();
  for (const meal of activePlan.meals) {
    const mealCalories = meal.recipes.reduce(
      (sum, mealRecipe) => sum + (mealRecipe.recipe.calories ?? 0) * (meal.servingMultiplier || 1),
      0
    );
    plannedCaloriesByDay.set(meal.dayOfWeek, (plannedCaloriesByDay.get(meal.dayOfWeek) ?? 0) + mealCalories);
  }

  const actualCaloriesByDay = new Map<number, number>();
  for (const log of weekLogs) {
    const logDay = getDayOfWeekFromDate(log.date);
    actualCaloriesByDay.set(logDay, (actualCaloriesByDay.get(logDay) ?? 0) + log.calories);
  }

  let cumulativeExcess = 0;
  for (let day = 0; day <= currentDayOfWeek; day += 1) {
    const planned = plannedCaloriesByDay.get(day) ?? 0;
    const actual = actualCaloriesByDay.get(day) ?? 0;
    if (actual > planned) {
      cumulativeExcess += actual - planned;
    }
  }

  let leftoverCalories = await reapplyPlanAdjustments(
    tx,
    activePlan.id,
    activePlan.carryoverCaloriesApplied,
    cumulativeExcess,
    currentDayOfWeek
  );

  const nextPlan = await tx.mealPlan.findFirst({
    where: {
      userId,
      dietType: 'ayuno_intermitente',
      weekStart: {
        gt: activePlan.weekStart,
      },
    },
    orderBy: { weekStart: 'asc' },
    select: PRE_M28_MEAL_PLAN_BASE_SELECT,
  });

  if (nextPlan && leftoverCalories > 0) {
    await resetMealAdjustments(tx, nextPlan.id);
    if (nextPlan.carryoverCaloriesApplied > 0) {
      await applyCalorieAdjustmentToPlan(
        tx,
        nextPlan.id,
        nextPlan.carryoverCaloriesApplied,
        0,
        `Compensación arrastrada de la semana anterior (${Math.round(nextPlan.carryoverCaloriesApplied)} kcal)`
      );
    }

    const nextAdjustment = await applyCalorieAdjustmentToPlan(
      tx,
      nextPlan.id,
      leftoverCalories,
      0,
      `Compensación por exceso pendiente de la semana previa (${Math.round(leftoverCalories)} kcal)`
    );
    leftoverCalories = nextAdjustment.leftoverCalories;
  }

  await tx.userNutritionBalance.upsert({
    where: { userId },
    update: { carryoverCalories: leftoverCalories },
    create: { userId, carryoverCalories: leftoverCalories },
  });
}

async function getIntermittentFastingState(userId: string, referenceDate: Date) {
  const weekStart = getWeekStart(referenceDate);
  const weekEnd = getWeekEnd(weekStart);
  const activePlan = await prisma.mealPlan.findFirst({
    where: {
      userId,
      weekStart: {
        lte: referenceDate,
      },
    },
    orderBy: { weekStart: 'desc' },
    select: PRE_M28_MEAL_PLAN_BASE_SELECT,
  });

  const balance = await ensureNutritionBalance(userId);

  if (!activePlan || activePlan.weekStart.getTime() < weekStart.getTime() || activePlan.dietType !== 'ayuno_intermitente') {
    return {
      enabled: false,
      targetFastingHours: IF_FASTING_TARGET_HOURS,
      eatingWindowHours: null,
      fastingHours: null,
      firstIntakeAt: null,
      lastIntakeAt: null,
      snackCount: 0,
      exceededWindow: false,
      carryoverCalories: balance.carryoverCalories,
    };
  }

  const dayStart = new Date(referenceDate);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart.getTime() + DAY_IN_MS);

  const todayLogs = await prisma.nutritionLog.findMany({
    where: {
      userId,
      date: {
        gte: dayStart,
        lt: dayEnd,
      },
    },
    orderBy: { consumedAt: 'asc' },
  });

  const timestamps = todayLogs
    .map((log) => log.consumedAt ?? log.date)
    .filter(Boolean)
    .sort((a, b) => a.getTime() - b.getTime());

  const first = timestamps[0] ?? null;
  const last = timestamps[timestamps.length - 1] ?? null;
  const eatingWindowHours = first && last ? Number(((last.getTime() - first.getTime()) / (1000 * 60 * 60)).toFixed(2)) : null;
  const fastingHours =
    eatingWindowHours !== null ? Number(Math.max(0, 24 - eatingWindowHours).toFixed(2)) : null;

  return {
    enabled: true,
    targetFastingHours: IF_FASTING_TARGET_HOURS,
    eatingWindowHours,
    fastingHours,
    firstIntakeAt: first ? first.toISOString() : null,
    lastIntakeAt: last ? last.toISOString() : null,
    snackCount: todayLogs.filter((log) => log.mealType === 'snack').length,
    exceededWindow: eatingWindowHours !== null ? eatingWindowHours > IF_EATING_WINDOW_HOURS : false,
    carryoverCalories: balance.carryoverCalories,
  };
}

/**
 * Generar un plan de comidas con IA
 */
export async function generateMealPlan(userId: string, params: GenerateMealPlanInput) {
  const snapshot = await getPersonalizationSnapshot(userId);
  const effectiveGoal = normalizeGoalKey(params.goal ?? snapshot.profile.trainingGoal) ?? 'mantenimiento';
  const effectiveAge = params.age ?? snapshot.profile.age ?? undefined;
  const effectiveSex = params.sex ?? snapshot.profile.sex ?? undefined;
  const effectiveWeightKg = params.weightKg ?? snapshot.profile.weightKg ?? undefined;
  const effectiveTargetWeightKg = params.targetWeightKg ?? snapshot.profile.targetWeightKg ?? undefined;
  const effectiveTrainingDays =
    params.trainingDaysPerWeek ?? snapshot.profile.trainingDaysPerWeek ?? undefined;

  const ageAwareGuidance = buildNutritionPersonalizationGuidance({
    age: effectiveAge,
    sex: effectiveSex ?? null,
    weightKg: effectiveWeightKg,
    targetWeightKg: effectiveTargetWeightKg,
    trainingDaysPerWeek: effectiveTrainingDays,
  });
  const selectedRecipes = await selectRecipesForWeeklyPlan(userId, {
    goal: effectiveGoal,
    dietType: (params.dietType ?? 'ninguna') as SupportedDietType,
    difficulty: params.difficulty as SupportedDifficulty | undefined,
    includeIngredients: params.includeIngredients,
    dietaryRestrictions: params.dietaryRestrictions,
  });

  const nutritionBalance = await ensureNutritionBalance(userId);
  const pendingCarryoverCalories = nutritionBalance.carryoverCalories ?? 0;

  // Calcular weekStart (próximo lunes)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilMonday = dayOfWeek === 0 ? 1 : dayOfWeek === 1 ? 0 : 8 - dayOfWeek;
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() + daysUntilMonday);
  weekStart.setHours(0, 0, 0, 0);

  // Crear el meal plan en la base de datos con transacción
  const mealPlan = await prisma.$transaction(async (tx) => {
    const plan = await tx.mealPlan.create({
      data: {
        userId,
        weekStart,
        goal: effectiveGoal,
        dietType: params.dietType || 'ninguna',
        carryoverCaloriesApplied: pendingCarryoverCalories,
      },
      select: { id: true },
    });

    for (const selectedMeal of selectedRecipes) {
      const meal = await tx.meal.create({
        data: {
          mealPlanId: plan.id,
          dayOfWeek: selectedMeal.dayOfWeek,
          mealType: selectedMeal.mealType,
          selectedRecipeId: selectedMeal.recipe.id,
          adjustmentReason: ageAwareGuidance
            ? 'Orientación general 40+: prioridad a saciedad, energía estable y adherencia (no sustituye criterio profesional).'
            : null,
        },
        select: { id: true },
      });

      await tx.mealRecipe.create({
        data: {
          mealId: meal.id,
          recipeId: selectedMeal.recipe.id,
        },
      });
    }

    await tx.productEvent.create({
      data: {
        userId,
        action: 'meal_plan_generated_from_library',
        category: 'nutrition',
        source: 'nutrition_service',
        metadata: {
          goal: effectiveGoal,
          dietType: params.dietType || 'ninguna',
          difficulty: params.difficulty ?? null,
          usedRecipeLibrary: true,
          mealCount: selectedRecipes.length,
        } as Prisma.InputJsonValue,
      },
    }).catch(() => null);

    return plan;
  }, { timeout: 60000 });

  if (pendingCarryoverCalories > 0) {
    await prisma.$transaction(async (tx) => {
      await applyCalorieAdjustmentToPlan(
        tx,
        mealPlan.id,
        pendingCarryoverCalories,
        0,
        `Compensación arrastrada de la semana anterior (${Math.round(pendingCarryoverCalories)} kcal)`
      );
      await tx.userNutritionBalance.update({
        where: { userId },
        data: { carryoverCalories: 0 },
      });
    });
  }

  logger.info('Meal plan generated from recipe library', {
    userId,
    mealPlanId: mealPlan.id,
    goal: effectiveGoal,
    dietType: params.dietType || 'ninguna',
    selectedRecipeCount: selectedRecipes.length,
  });

  // Retornar el plan completo
  return getMealPlanById(mealPlan.id, userId);
}

/**
 * Obtener todos los planes de comida de un usuario
 */
export async function getUserMealPlans(userId: string) {
  const [plans, snapshot] = await Promise.all([
    prisma.mealPlan.findMany({
      where: { userId },
      select: PRE_M28_MEAL_PLAN_WITH_MEALS_SELECT,
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    getPersonalizationSnapshot(userId),
  ]);

  return plans.map((plan) => decorateMealPlan(plan, snapshot));
}

/**
 * Obtener un plan de comida por ID
 */
export async function getMealPlanById(id: string, userId: string) {
  const [plan, snapshot] = await Promise.all([
    prisma.mealPlan.findFirst({
      where: { id, userId },
      select: {
        ...PRE_M28_MEAL_PLAN_BASE_SELECT,
        meals: {
          select: PRE_M28_MEAL_WITH_RECIPES_SELECT,
          orderBy: [{ dayOfWeek: 'asc' }, { mealType: 'asc' }],
        },
      },
    }),
    getPersonalizationSnapshot(userId),
  ]);

  if (!plan) {
    throw new AppError(404, 'Plan de comidas no encontrado');
  }

  return decorateMealPlan(plan, snapshot);
}

export async function deleteMealPlan(id: string, userId: string) {
  const existingPlan = await prisma.mealPlan.findFirst({
    where: { id, userId },
    select: { id: true },
  });

  if (!existingPlan) {
    throw new AppError(404, 'Plan de comidas no encontrado');
  }

  await prisma.mealPlan.delete({
    where: { id },
    select: { id: true },
  });
}

export async function listRecipes(userId: string, filters: ListRecipesQueryInput) {
  const where = buildRecipeAccessWhere(userId, filters);
  const limit = filters.limit ?? 24;
  const offset = filters.offset ?? 0;

  const [total, recipes] = await prisma.$transaction([
    prisma.recipe.count({ where }),
    prisma.recipe.findMany({
      where,
      select: recipeSelect,
      orderBy: [
        { isPublic: 'desc' },
        { updatedAt: 'desc' },
      ],
      skip: offset,
      take: limit,
    }),
  ]);

  return {
    recipes: recipes.map((recipe) => decorateRecipe(recipe)),
    pagination: {
      total,
      limit,
      offset,
      hasMore: offset + recipes.length < total,
    },
  };
}

export async function createRecipe(userId: string, data: CreateRecipeInput) {
  const recipe = await prisma.$transaction(async (tx) => {
    const createdRecipe = await tx.recipe.create({
      data: {
        userId,
        name: data.name,
        nameEn: data.nameEn ?? null,
        description: data.description ?? null,
        instructions: data.instructions,
        prepTime: data.prepTime ?? null,
        cookTime: data.cookTime ?? null,
        servings: data.servings ?? 1,
        difficulty: data.difficulty ?? null,
        calories: data.calories ?? null,
        protein: data.protein ?? null,
        carbs: data.carbs ?? null,
        fat: data.fat ?? null,
        fiber: data.fiber ?? null,
        imageUrl: data.imageUrl ?? null,
        tags: normalizeTagList(data.tags ?? []),
        source: 'user',
        isPublic: false,
        isEditable: true,
        mealTypes: data.mealTypes ?? [],
        dietTypes: data.dietTypes ?? [],
        goalTypes: normalizeTagList(data.goalTypes ?? []),
      },
    });

    for (const ingredientInput of data.ingredients) {
      const normalizedName = ingredientInput.name.trim().toLowerCase();
      const normalizedUnit = ingredientInput.unit.trim().toLowerCase();

      let ingredient = await tx.ingredient.findUnique({
        where: {
          name: normalizedName,
        },
      });

      if (!ingredient) {
        ingredient = await tx.ingredient.create({
          data: {
            name: normalizedName,
            unit: normalizedUnit,
          },
        });
      }

      await tx.recipeIngredient.create({
        data: {
          recipeId: createdRecipe.id,
          ingredientId: ingredient.id,
          quantity: ingredientInput.quantity,
        },
        select: { id: true },
      });
    }

    return tx.recipe.findUniqueOrThrow({
      where: { id: createdRecipe.id },
      select: recipeSelect,
    });
  });

  return decorateRecipe(recipe);
}

export async function replaceMealRecipe(userId: string, mealId: string, data: ReplaceMealRecipeInput) {
  const nextRecipe = await assertRecipeAccess(data.recipeId, userId);

  const meal = await prisma.meal.findFirst({
    where: {
      id: mealId,
      mealPlan: {
        userId,
      },
    },
    select: {
      ...PRE_M28_MEAL_BASE_SELECT,
      mealPlan: {
        select: PRE_M28_MEAL_PLAN_BASE_SELECT,
      },
      recipes: {
        select: {
          id: true,
          mealId: true,
          recipeId: true,
        },
      },
    },
  });

  if (!meal) {
    throw new AppError(404, 'Comida no encontrada');
  }

  if (nextRecipe.mealTypes.length > 0 && !nextRecipe.mealTypes.includes(meal.mealType)) {
    throw new AppError(400, 'La receta seleccionada no es compatible con este tipo de comida');
  }

  const previousRecipeId = meal.selectedRecipeId ?? meal.recipes[0]?.recipeId ?? null;

  await prisma.$transaction(async (tx) => {
    await tx.mealRecipe.deleteMany({
      where: { mealId },
    });

    await tx.mealRecipe.create({
      data: {
        mealId,
        recipeId: nextRecipe.id,
      },
    });

    await tx.meal.update({
      where: { id: mealId },
      data: {
        selectedRecipeId: nextRecipe.id,
      },
      select: { id: true },
    });

    await tx.mealSwapHistory.create({
      data: {
        mealId,
        previousRecipeId,
        newRecipeId: nextRecipe.id,
        swapSource: nextRecipe.source === 'ai' ? 'ai' : nextRecipe.source === 'system' ? 'system' : 'user',
        reason: data.reason ?? null,
      },
    });
  });

  return getMealPlanById(meal.mealPlanId, userId);
}

/**
 * Obtener detalle de una receta
 */
export async function getRecipeById(id: string, userId: string) {
  const recipe = await assertRecipeAccess(id, userId);
  return decorateRecipe(recipe);
}

export async function updateRecipe(id: string, data: UpdateRecipeInput) {
  const existingRecipe = await prisma.recipe.findUnique({
    where: { id },
    select: { id: true },
  });

  if (!existingRecipe) {
    throw new AppError(404, 'Receta no encontrada');
  }

  const recipe = await prisma.recipe.update({
    where: { id },
    data: {
      name: data.name,
      nameEn: data.nameEn,
      description: data.description,
      instructions: data.instructions,
      prepTime: data.prepTime,
      cookTime: data.cookTime,
      difficulty: data.difficulty,
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fat: data.fat,
      fiber: data.fiber,
      imageUrl: data.imageUrl,
      tags: data.tags,
      editorialOverrideStatus: data.editorialOverrideStatus,
      editorialNotes: data.editorialNotes,
      editorialReviewedAt: data.editorialOverrideStatus || data.editorialNotes ? new Date() : undefined,
    },
    select: recipeSelect,
  });

  return decorateRecipe(recipe);
}

export async function bulkUpdateRecipeEditorial(data: BulkUpdateRecipeEditorialInput) {
  await prisma.recipe.updateMany({
    where: { id: { in: data.ids } },
    data: {
      editorialOverrideStatus: data.editorialOverrideStatus,
      editorialNotes: data.editorialNotes ?? null,
      editorialReviewedAt: new Date(),
    },
  });

  const recipes = await prisma.recipe.findMany({
    where: { id: { in: data.ids } },
    select: recipeSelect,
    orderBy: { updatedAt: 'desc' },
  });

  return recipes.map((recipe) => decorateRecipe(recipe));
}

export async function getRecipeEditorialSummary() {
  const recipes = await prisma.recipe.findMany({
    select: recipeSelect,
    orderBy: { updatedAt: 'desc' },
    take: 100,
  });

  const decorated = recipes.map((recipe) => decorateRecipe(recipe));

  return {
    total: decorated.length,
    averageQualityScore: decorated.length > 0
      ? Math.round(decorated.reduce((sum, recipe) => sum + recipe.editorial.qualityScore, 0) / decorated.length)
      : 0,
    byStatus: {
      ready: decorated.filter((recipe) => recipe.editorial.editorialStatus === 'ready').length,
      review: decorated.filter((recipe) => recipe.editorial.editorialStatus === 'review').length,
      needs_work: decorated.filter((recipe) => recipe.editorial.editorialStatus === 'needs_work').length,
    },
    recipes: decorated,
  };
}

/**
 * Registrar un log de nutrición
 */
export async function createNutritionLog(userId: string, data: CreateNutritionLogInput) {
  const logDate = data.date ? new Date(data.date) : new Date();
  const consumedAt = data.consumedAt ? new Date(data.consumedAt) : logDate;

  return prisma.$transaction(async (tx) => {
    const createdLog = await tx.nutritionLog.create({
      data: {
        userId,
        date: logDate,
        consumedAt,
        mealType: data.mealType,
        recipeId: data.recipeId,
        name: data.name,
        calories: data.calories,
        protein: data.protein,
        carbs: data.carbs,
        fat: data.fat,
        notes: data.notes,
      },
    });

    await reconcileIntermittentFastingBalance(tx, userId, logDate);
    return createdLog;
  });
}

/**
 * Obtener logs de nutrición de un usuario
 */
export async function getNutritionLogs(userId: string, period: 'day' | 'week' = 'day') {
  const now = new Date();
  let startDate: Date;

  if (period === 'day') {
    startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  } else {
    startDate = new Date(now);
    startDate.setDate(now.getDate() - 7);
  }

  return prisma.nutritionLog.findMany({
    where: {
      userId,
      date: { gte: startDate },
    },
    orderBy: { date: 'desc' },
  });
}

/**
 * Resumen de macros (diario o semanal)
 */
export async function getNutritionSummary(userId: string, period: 'day' | 'week' = 'day') {
  const logs = await getNutritionLogs(userId, period);
  const fasting = await getIntermittentFastingState(userId, new Date());

  const totals = logs.reduce(
    (acc, log) => ({
      calories: acc.calories + log.calories,
      protein: acc.protein + log.protein,
      carbs: acc.carbs + log.carbs,
      fat: acc.fat + log.fat,
      count: acc.count + 1,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, count: 0 }
  );

  const days = period === 'day' ? 1 : 7;

  return {
    period,
    totals,
    averages: {
      calories: Math.round(totals.calories / days),
      protein: Math.round(totals.protein / days),
      carbs: Math.round(totals.carbs / days),
      fat: Math.round(totals.fat / days),
    },
    logCount: totals.count,
    intermittentFasting: fasting,
  };
}

function roundMacro(value: number) {
  return Number(value.toFixed(2));
}

export async function createFoodItem(userId: string, data: CreateFoodItemInput) {
  return prisma.foodItem.create({
    data: {
      userId,
      name: data.name,
      brand: data.brand ?? null,
      barcode: data.barcode ?? null,
      servingSizeG: data.servingSizeG,
      calories: data.calories,
      protein: data.protein,
      carbs: data.carbs,
      fat: data.fat,
      fiber: data.fiber ?? 0,
      source: 'user',
    },
  });
}

export async function listFoodItems(userId: string, query: ListFoodItemsQueryInput) {
  const limit = query.limit ?? 20;
  const items = await prisma.foodItem.findMany({
    where: {
      AND: [
        {
          OR: [
            { userId },
            { verified: true },
          ],
        },
        query.query
          ? {
              OR: [
                { name: { contains: query.query, mode: 'insensitive' } },
                { brand: { contains: query.query, mode: 'insensitive' } },
                { barcode: query.query },
              ],
            }
          : {},
      ],
    },
    orderBy: [{ verified: 'desc' }, { name: 'asc' }],
    take: limit,
  });

  return { items };
}

export async function upsertNutritionTarget(userId: string, data: UpsertNutritionTargetInput) {
  return prisma.nutritionTarget.upsert({
    where: { userId },
    update: data,
    create: {
      userId,
      ...data,
    },
  });
}

export async function getNutritionTarget(userId: string) {
  return prisma.nutritionTarget.findUnique({
    where: { userId },
  });
}

export async function createMealLog(userId: string, data: CreateMealLogInput) {
  const consumedAt = data.consumedAt ? new Date(data.consumedAt) : new Date();

  if (data.foodItemId) {
    const foodItem = await prisma.foodItem.findFirst({
      where: {
        id: data.foodItemId,
        OR: [
          { userId },
          { verified: true },
        ],
      },
    });

    if (!foodItem) {
      throw new AppError(404, 'Food item not found');
    }

    const quantityG = data.quantityG ?? foodItem.servingSizeG;
    const multiplier = quantityG / foodItem.servingSizeG;

    return prisma.mealLog.create({
      data: {
        userId,
        foodItemId: foodItem.id,
        mealType: data.mealType,
        consumedAt,
        quantityG,
        name: foodItem.name,
        calories: roundMacro(foodItem.calories * multiplier),
        protein: roundMacro(foodItem.protein * multiplier),
        carbs: roundMacro(foodItem.carbs * multiplier),
        fat: roundMacro(foodItem.fat * multiplier),
        fiber: roundMacro(foodItem.fiber * multiplier),
        notes: data.notes,
      },
    });
  }

  return prisma.mealLog.create({
    data: {
      userId,
      mealType: data.mealType,
      consumedAt,
      quantityG: data.quantityG,
      name: data.name ?? 'Custom meal',
      calories: data.calories ?? 0,
      protein: data.protein ?? 0,
      carbs: data.carbs ?? 0,
      fat: data.fat ?? 0,
      fiber: data.fiber ?? 0,
      notes: data.notes,
    },
  });
}

export async function listMealLogs(userId: string, query: ListMealLogsQueryInput) {
  const baseDate = query.date ? new Date(`${query.date}T00:00:00.000Z`) : new Date();
  const start = new Date(Date.UTC(baseDate.getUTCFullYear(), baseDate.getUTCMonth(), baseDate.getUTCDate()));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 1);

  const items = await prisma.mealLog.findMany({
    where: {
      userId,
      consumedAt: {
        gte: start,
        lt: end,
      },
    },
    orderBy: { consumedAt: 'desc' },
  });

  return { items };
}

export async function createSmartMealPlan(userId: string, data: CreateSmartMealPlanInput) {
  const target = await prisma.nutritionTarget.findUnique({
    where: { userId },
  });

  if (!target) {
    throw new AppError(400, 'Nutrition target is required before creating a smart meal plan');
  }

  const weekStart = data.weekStart ? new Date(data.weekStart) : new Date();
  const plan = await prisma.mealPlan.create({
    data: {
      userId,
      weekStart,
      goal: target.goal,
      dietType: 'target_aligned',
    },
    select: PRE_M28_MEAL_PLAN_BASE_SELECT,
  });

  return {
    id: plan.id,
    userId: plan.userId,
    weekStart: plan.weekStart,
    goal: target.goal,
    targetCalories: target.calories,
    targetProtein: target.protein,
    targetCarbs: target.carbs,
    targetFat: target.fat,
    targetFiber: target.fiber,
    strategy: 'target_aligned',
  };
}

export function getHealthImportStatus() {
  const enabled = env.healthDataImportEnabled;

  return {
    enabled,
    providers: [
      { provider: 'google_fit', available: enabled },
      { provider: 'health_connect', available: enabled },
    ],
  };
}
