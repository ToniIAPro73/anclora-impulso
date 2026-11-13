import {
  CANONICAL_CONVERTIBLE_UNITS,
  NON_COUNTED_BASE_INGREDIENTS,
  mealPlanImportSchema,
  type MealPlanImportIngredient,
  type MealPlanImportV1,
} from './meal-plan-import.contract';
import {
  getDietProtocol,
  isImportSupportedDietProtocol,
} from './protocol-catalog';

export type MealPlanValidationStatus =
  | 'VALID'
  | 'VALID_WITH_WARNINGS'
  | 'INCOMPLETE'
  | 'REJECTED';

export interface ValidationIssue {
  code: string;
  message: string;
  path?: string;
}

export interface MealPlanValidationResult {
  status: MealPlanValidationStatus;
  normalizedPlan: MealPlanImportV1 | null;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  missingData: ValidationIssue[];
  safetyFlags: string[];
}

const UNTRUSTED_CONTENT_PATTERNS: readonly RegExp[] = [
  /<\s*script\b/i,
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /system\s*prompt/i,
  /you\s+are\s+now\s+/i,
  /;\s*drop\s+table\b/i,
];

const UNJUSTIFIED_CLINICAL_CLAIM_PATTERNS: readonly RegExp[] = [
  /\bcura\s+(la\s+)?(diabetes|cancer|hipertension|obesidad)\b/i,
  /\btratamiento\s+m[eé]dico\b/i,
  /\bprescripci[oó]n\s+cl[ií]nica\b/i,
  /\bcures?\s+(diabetes|cancer|hypertension)\b/i,
];

function normalizeToken(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function collectStrings(value: unknown, path = '', out: Array<{ path: string; text: string }> = []) {
  if (typeof value === 'string') {
    out.push({ path, text: value });
    return out;
  }
  if (Array.isArray(value)) {
    value.forEach((item, idx) => collectStrings(item, `${path}[${idx}]`, out));
    return out;
  }
  if (value && typeof value === 'object') {
    for (const [key, val] of Object.entries(value)) {
      collectStrings(val, path ? `${path}.${key}` : key, out);
    }
  }
  return out;
}

function isCountedMainIngredient(ing: MealPlanImportIngredient): boolean {
  if (ing.isCountedInLimit === false) return false;
  const normalized = normalizeToken(ing.name);
  return !NON_COUNTED_BASE_INGREDIENTS.has(normalized);
}

const canonicalUnitSet = new Set<string>(CANONICAL_CONVERTIBLE_UNITS);

export function validateMealPlanImport(rawInput: unknown): MealPlanValidationResult {
  let parsedJson: unknown = rawInput;
  if (typeof rawInput === 'string') {
    try {
      parsedJson = JSON.parse(rawInput);
    } catch {
      return {
        status: 'REJECTED',
        normalizedPlan: null,
        errors: [{ code: 'INVALID_JSON', message: 'El contenido no es un JSON válido.' }],
        warnings: [],
        missingData: [],
        safetyFlags: [],
      };
    }
  }

  // Untrusted content & unjustified clinical claim scan before/alongside schema check
  const allStrings = collectStrings(parsedJson);
  for (const entry of allStrings) {
    for (const pattern of UNTRUSTED_CONTENT_PATTERNS) {
      if (pattern.test(entry.text)) {
        return {
          status: 'REJECTED',
          normalizedPlan: null,
          errors: [
            {
              code: 'UNTRUSTED_CONTENT_DETECTED',
              message: 'Contenido externo potencialmente hostil o instrucción incrustada detectada.',
              path: entry.path,
            },
          ],
          warnings: [],
          missingData: [],
          safetyFlags: ['UNTRUSTED_PAYLOAD'],
        };
      }
    }
    for (const pattern of UNJUSTIFIED_CLINICAL_CLAIM_PATTERNS) {
      if (pattern.test(entry.text)) {
        return {
          status: 'REJECTED',
          normalizedPlan: null,
          errors: [
            {
              code: 'CLINICAL_CLAIM_DETECTED',
              message: 'Afirmación clínica o terapéutica no justificada detectada en contenido externo.',
              path: entry.path,
            },
          ],
          warnings: [],
          missingData: [],
          safetyFlags: ['UNJUSTIFIED_CLINICAL_CLAIM'],
        };
      }
    }
  }

  const parsed = mealPlanImportSchema.safeParse(parsedJson);
  if (!parsed.success) {
    return {
      status: 'REJECTED',
      normalizedPlan: null,
      errors: parsed.error.issues.map((issue) => ({
        code: 'SCHEMA_VALIDATION_ERROR',
        message: issue.message,
        path: issue.path.join('.'),
      })),
      warnings: [],
      missingData: [],
      safetyFlags: [],
    };
  }

  const plan = parsed.data;
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const missingData: ValidationIssue[] = [];
  const safetyFlags = new Set<string>();

  // Protocol check against single source of truth
  const protocol = getDietProtocol(plan.preferences.dietType);
  if (!protocol || !isImportSupportedDietProtocol(plan.preferences.dietType)) {
    errors.push({
      code: 'UNSUPPORTED_OR_UNREVIEWED_PROTOCOL',
      message: `El protocolo '${plan.preferences.dietType}' no está habilitado para importación productiva.`,
      path: 'preferences.dietType',
    });
    if (protocol?.requiresProfessionalReview) {
      safetyFlags.add('PROTOCOL_PENDING_PROFESSIONAL_REVIEW');
    }
  }

  // Days contiguity check (0..daysCount-1)
  if (plan.days.length !== plan.preferences.daysCount) {
    errors.push({
      code: 'DAYS_COUNT_MISMATCH',
      message: `daysCount=${plan.preferences.daysCount} no coincide con days.length=${plan.days.length}.`,
      path: 'days',
    });
  }
  const seenDayIndices = new Set<number>();
  plan.days.forEach((day, idx) => {
    if (seenDayIndices.has(day.dayIndex) || day.dayIndex !== idx) {
      errors.push({
        code: 'NON_CONTIGUOUS_DAY_INDEX',
        message: `Índice de día inválido o duplicado en days[${idx}]: ${day.dayIndex}.`,
        path: `days[${idx}].dayIndex`,
      });
    }
    seenDayIndices.add(day.dayIndex);
  });

  const excludedEquipment = plan.preferences.excludedEquipment.map(normalizeToken);
  const excludedFoods = plan.preferences.excludedFoods.map(normalizeToken);

  plan.days.forEach((day, dIdx) => {
    day.meals.forEach((meal, mIdx) => {
      const basePath = `days[${dIdx}].meals[${mIdx}].recipe`;
      const recipe = meal.recipe;

      // Excluded equipment check
      for (const method of recipe.cookingMethods) {
        if (excludedEquipment.includes(normalizeToken(method))) {
          errors.push({
            code: 'EXCLUDED_EQUIPMENT_VIOLATION',
            message: `La receta '${recipe.name}' usa equipamiento excluido: ${method}.`,
            path: `${basePath}.cookingMethods`,
          });
        }
      }
      if (excludedEquipment.includes('horno_convencional')) {
        const joinedInstructions = normalizeToken(recipe.instructions.join(' '));
        if (/\bhorno\b|\boven\b/.test(joinedInstructions) && !/sin horno|no oven/.test(joinedInstructions)) {
          errors.push({
            code: 'EXCLUDED_EQUIPMENT_VIOLATION',
            message: `Las instrucciones de '${recipe.name}' mencionan horno convencional excluido.`,
            path: `${basePath}.instructions`,
          });
        }
      }

      // Main ingredients count rule
      const countedIngredients = recipe.ingredients.filter(isCountedMainIngredient);
      if (countedIngredients.length > plan.preferences.maxMainIngredients) {
        errors.push({
          code: 'MAX_MAIN_INGREDIENTS_EXCEEDED',
          message: `La receta '${recipe.name}' tiene ${countedIngredients.length} ingredientes principales (máximo ${plan.preferences.maxMainIngredients}).`,
          path: `${basePath}.ingredients`,
        });
      }

      // Ingredients validation: excluded foods, duplicates, quantities, units
      const seenIngredients = new Map<string, string | null>();
      recipe.ingredients.forEach((ing, iIdx) => {
        const ingPath = `${basePath}.ingredients[${iIdx}]`;
        const normName = normalizeToken(ing.name);

        for (const banned of excludedFoods) {
          if (banned && normName.includes(banned)) {
            errors.push({
              code: 'EXCLUDED_FOOD_VIOLATION',
              message: `Ingrediente excluido '${ing.name}' detectado en '${recipe.name}'.`,
              path: ingPath,
            });
          }
        }

        if (seenIngredients.has(normName)) {
          const prevUnit = seenIngredients.get(normName) ?? null;
          if (prevUnit !== ing.unit) {
            errors.push({
              code: 'CONFLICTING_DUPLICATE_INGREDIENT_UNITS',
              message: `Ingrediente duplicado '${ing.name}' con unidades incompatibles (${prevUnit} vs ${ing.unit}).`,
              path: ingPath,
            });
          } else {
            warnings.push({
              code: 'DUPLICATE_INGREDIENT',
              message: `Ingrediente duplicado '${ing.name}' en '${recipe.name}'.`,
              path: ingPath,
            });
          }
        } else {
          seenIngredients.set(normName, ing.unit);
        }

        if (ing.quantity !== null && ing.quantity <= 0) {
          errors.push({
            code: 'INVALID_QUANTITY',
            message: `Cantidad no positiva (${ing.quantity}) para '${ing.name}'.`,
            path: `${ingPath}.quantity`,
          });
        }

        if (ing.quantity === null || ing.unit === null || ing.quantitySource === 'not_provided') {
          missingData.push({
            code: 'MISSING_INGREDIENT_QUANTITY',
            message: `Falta cantidad o unidad explícita para '${ing.name}' en '${recipe.name}'.`,
            path: ingPath,
          });
        } else if (!canonicalUnitSet.has(ing.unit)) {
          missingData.push({
            code: 'NON_CONVERTIBLE_UNIT',
            message: `La unidad '${ing.unit}' de '${ing.name}' no tiene conversión canónica automática a g/ml/unidad.`,
            path: `${ingPath}.unit`,
          });
        }
      });

      // Nutrition provenance and 4-4-9 energy-macro coherence screening
      const nut = recipe.nutrition;
      const allMacrosPresent =
        nut.kcal !== null &&
        nut.proteinG !== null &&
        nut.carbsG !== null &&
        nut.fatG !== null;

      if (nut.dataSource === 'not_provided' || nut.certainty === 'unknown' || !allMacrosPresent) {
        missingData.push({
          code: 'MISSING_NUTRITION_DATA',
          message: `Información nutricional incompleta o no proporcionada en '${recipe.name}'.`,
          path: `${basePath}.nutrition`,
        });
      } else {
        if (nut.dataSource === 'estimated' || nut.certainty === 'approximate') {
          warnings.push({
            code: 'ESTIMATED_NUTRITION_DATA',
            message: `Valores nutricionales estimados en '${recipe.name}'.`,
            path: `${basePath}.nutrition`,
          });
        }

        const expectedKcal = 4 * nut.proteinG! + 4 * nut.carbsG! + 9 * nut.fatG!;
        const diff = Math.abs(nut.kcal! - expectedKcal);
        const ratio = diff / Math.max(nut.kcal!, expectedKcal, 1);

        if (diff > 100 && ratio > 0.5) {
          errors.push({
            code: 'INCOMPATIBLE_NUTRITION_VALUES',
            message: `Incoherencia grave kcal (${nut.kcal}) vs macros 4-4-9 (~${Math.round(expectedKcal)} kcal) en '${recipe.name}'.`,
            path: `${basePath}.nutrition`,
          });
          safetyFlags.add('NUTRITION_ARITHMETIC_MISMATCH');
        } else if (diff > 50 && ratio > 0.25) {
          warnings.push({
            code: 'NUTRITION_MACRO_DISCREPANCY',
            message: `Desviación moderada kcal (${nut.kcal}) vs macros 4-4-9 (~${Math.round(expectedKcal)} kcal) en '${recipe.name}'.`,
            path: `${basePath}.nutrition`,
          });
        }
      }
    });
  });

  let status: MealPlanValidationStatus = 'VALID';
  if (errors.length > 0) {
    status = 'REJECTED';
  } else if (missingData.length > 0) {
    status = 'INCOMPLETE';
  } else if (warnings.length > 0) {
    status = 'VALID_WITH_WARNINGS';
  }

  return {
    status,
    normalizedPlan: errors.length > 0 ? null : plan,
    errors,
    warnings,
    missingData,
    safetyFlags: [...safetyFlags],
  };
}

