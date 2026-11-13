import fs from 'node:fs';
import path from 'node:path';
import {
  PRE_M28_MEAL_BASE_SELECT,
  PRE_M28_MEAL_PLAN_BASE_SELECT,
  PRE_M28_MEAL_PLAN_WITH_MEALS_SELECT,
  PRE_M28_MEAL_WITH_RECIPE_BASE_SELECT,
  PRE_M28_MEAL_WITH_RECIPES_SELECT,
  PRE_M28_RECIPE_BASE_SELECT,
  PRE_M28_RECIPE_INGREDIENT_SELECT,
  PRE_M28_RECIPE_SELECT,
} from '../../src/services/nutrition/pre-m28-selects';

const M28_ONLY_FIELDS = [
  'title',
  'origin',
  'lifecycleStatus',
  'importValidationStatus',
  'importSchemaVersion',
  'importFingerprint',
  'importMetadata',
  'scheduledTime',
  'prepMode',
  'notes',
  'nutritionSource',
  'nutritionCertainty',
  'contentFingerprint',
  'isIncomplete',
  'unitOverride',
  'rawQuantityText',
  'isEstimated',
];

function collectKeys(obj: unknown, out = new Set<string>()): Set<string> {
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj)) {
    out.add(k);
    if (v && typeof v === 'object') {
      collectKeys(v, out);
    }
  }
  return out;
}

describe('Pre-M28 Prisma compatibility guardrails', () => {
  it('excludes all M28-only columns from PRE_M28_* select projections', () => {
    const projections = [
      PRE_M28_RECIPE_INGREDIENT_SELECT,
      PRE_M28_RECIPE_BASE_SELECT,
      PRE_M28_RECIPE_SELECT,
      PRE_M28_MEAL_BASE_SELECT,
      PRE_M28_MEAL_WITH_RECIPE_BASE_SELECT,
      PRE_M28_MEAL_WITH_RECIPES_SELECT,
      PRE_M28_MEAL_PLAN_BASE_SELECT,
      PRE_M28_MEAL_PLAN_WITH_MEALS_SELECT,
    ];

    for (const proj of projections) {
      const keys = collectKeys(proj);
      for (const m28Field of M28_ONLY_FIELDS) {
        expect(keys.has(m28Field)).toBe(false);
      }
    }
  });

  it('ensures nutrition.service.ts has no bare include on M28-extended models', () => {
    const filePath = path.resolve(__dirname, '../../src/services/nutrition.service.ts');
    const source = fs.readFileSync(filePath, 'utf8');
    expect(source).not.toMatch(/recipeInclude/);
  });
});

