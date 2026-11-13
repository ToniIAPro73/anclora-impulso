import {
  MEAL_PLAN_IMPORT_SPEC_VERSION,
  type MealPlanImportV1,
} from './meal-plan-import.contract';
import {
  validateMealPlanImport,
  type MealPlanValidationResult,
} from './meal-plan-import.validator';

export interface SkillAdapterInput {
  rawPayload: unknown;
  instructionsVersion?: string;
}

/**
 * Adapts external `planificador-nutricion-mealprep-50` v2 JSON output into
 * `meal-plan-import-v1` and runs full server-side validation.
 * Unknown quantities/macros remain explicitly `null` / `not_provided`.
 */
export function adaptSkillOutputToMealPlanImport(
  input: SkillAdapterInput
): MealPlanValidationResult {
  let candidate: unknown = input.rawPayload;
  if (typeof candidate === 'string') {
    try {
      candidate = JSON.parse(candidate);
    } catch {
      return validateMealPlanImport(candidate);
    }
  }

  if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
    const record = { ...(candidate as Record<string, unknown>) };
    if (!record.specVersion) {
      record.specVersion = MEAL_PLAN_IMPORT_SPEC_VERSION;
    }
    if (record.origin && typeof record.origin === 'object' && !Array.isArray(record.origin)) {
      const origin = { ...(record.origin as Record<string, unknown>) };
      if (!origin.instructionsVersion && input.instructionsVersion) {
        origin.instructionsVersion = input.instructionsVersion;
      }
      record.origin = origin;
    }
    candidate = record;
  }

  return validateMealPlanImport(candidate);
}

export type AdaptedMealPlan = MealPlanImportV1;

