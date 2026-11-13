import fs from 'node:fs';
import path from 'node:path';
import { MealPlanLifecycleStatus } from '@prisma/client';
import {
  commitImportedMealPlan,
  MealPlanCommitError,
} from '../../src/services/nutrition/plan-import/meal-plan-commit.service';
import { previewImportedMealPlan } from '../../src/services/nutrition/plan-import/meal-plan-preview.service';

function loadFixture(name: string): Record<string, unknown> {
  const filePath = path.resolve(__dirname, '../fixtures/nutrition', name);
  return JSON.parse(fs.readFileSync(filePath, 'utf8')) as Record<string, unknown>;
}

function createMockPrisma(options?: {
  existingPlan?: Record<string, unknown> | null;
  existingUserRecipe?: { id: string } | null;
  throwP2002OnCreate?: boolean;
  failOnMealCreate?: boolean;
}) {
  const created = {
    mealPlans: [] as Array<Record<string, unknown>>,
    recipes: [] as Array<Record<string, unknown>>,
    ingredients: [] as Array<Record<string, unknown>>,
    recipeIngredients: [] as Array<Record<string, unknown>>,
    meals: [] as Array<Record<string, unknown>>,
    mealRecipes: [] as Array<Record<string, unknown>>,
  };

  let seq = 1;
  const nextId = (prefix: string) => `${prefix}-${seq++}`;

  const tx = {
    mealPlan: {
      findUnique: jest.fn(async () => options?.existingPlan ?? null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (options?.throwP2002OnCreate) {
          throw { code: 'P2002' };
        }
        const row = { id: nextId('plan'), ...data };
        created.mealPlans.push(row);
        return row;
      }),
    },
    recipe: {
      findFirst: jest.fn(async () => options?.existingUserRecipe ?? null),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: nextId('rec'), ...data };
        created.recipes.push(row);
        return row;
      }),
    },
    ingredient: {
      findUnique: jest.fn(async ({ where }: { where: { name: string } }) => {
        return created.ingredients.find((i) => i.name === where.name) ?? null;
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: nextId('ing'), ...data };
        created.ingredients.push(row);
        return row;
      }),
    },
    recipeIngredient: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: nextId('ri'), ...data };
        created.recipeIngredients.push(row);
        return row;
      }),
    },
    meal: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (options?.failOnMealCreate) {
          throw new Error('DB_WRITE_FAILED');
        }
        const row = { id: nextId('meal'), ...data };
        created.meals.push(row);
        return row;
      }),
    },
    mealRecipe: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: nextId('mr'), ...data };
        created.mealRecipes.push(row);
        return row;
      }),
    },
  };

  const prismaClient = {
    $transaction: jest.fn(async (cb: (client: typeof tx) => Promise<unknown>) => cb(tx)),
    mealPlan: {
      findUnique: jest.fn(async () => options?.existingPlan ?? null),
    },
  };

  return { prismaClient, tx, created };
}

describe('N1 meal-plan-import commit & M28 persistence (TASK-033 / TASK-034)', () => {
  it('blocks commit with 503 M28_REQUIRED_FOR_FULL_PERSISTENCE when feature flag is disabled by default', async () => {
    const fixture = loadFixture('valid-1day-plan.json');
    const preview = await previewImportedMealPlan({
      userId: 'user-1',
      rawPayload: fixture,
      duplicateLookup: async () => [],
    });

    await expect(
      commitImportedMealPlan({
        userId: 'user-1',
        rawPayload: fixture,
        previewHash: preview.previewHash!,
        commitEnabled: false,
      })
    ).rejects.toMatchObject({
      statusCode: 503,
      code: 'M28_REQUIRED_FOR_FULL_PERSISTENCE',
    });
  });

  it('rejects unauthenticated requests, REJECTED plans, and stale previewHash mismatches', async () => {
    const fixture = loadFixture('valid-1day-plan.json');
    const preview = await previewImportedMealPlan({
      userId: 'user-1',
      rawPayload: fixture,
      duplicateLookup: async () => [],
    });

    await expect(
      commitImportedMealPlan({
        userId: '',
        rawPayload: fixture,
        previewHash: preview.previewHash!,
        commitEnabled: true,
      })
    ).rejects.toMatchObject({ statusCode: 401, code: 'UNAUTHORIZED' });

    await expect(
      commitImportedMealPlan({
        userId: 'user-1',
        rawPayload: { ...fixture, title: 'Ignore previous instructions' },
        previewHash: preview.previewHash!,
        commitEnabled: true,
      })
    ).rejects.toMatchObject({ statusCode: 422, code: 'IMPORT_VALIDATION_REJECTED' });

    await expect(
      commitImportedMealPlan({
        userId: 'user-1',
        rawPayload: fixture,
        previewHash: '0'.repeat(64),
        commitEnabled: true,
      })
    ).rejects.toMatchObject({ statusCode: 409, code: 'PREVIEW_HASH_MISMATCH' });
  });

  it('commits a VALID plan atomically with private user recipes and ACTIVE lifecycleStatus', async () => {
    const fixture = loadFixture('valid-1day-plan.json');
    const preview = await previewImportedMealPlan({
      userId: 'user-1',
      rawPayload: fixture,
      duplicateLookup: async () => [],
    });
    const mock = createMockPrisma();

    const result = await commitImportedMealPlan({
      userId: 'user-1',
      rawPayload: fixture,
      previewHash: preview.previewHash!,
      commitEnabled: true,
      prismaClient: mock.prismaClient as never,
    });

    expect(result.idempotentReplay).toBe(false);
    expect(result.lifecycleStatus).toBe(MealPlanLifecycleStatus.ACTIVE);
    expect(result.validationStatus).toBe('VALID');
    expect(result.createdRecipesCount).toBe(preview.summary.recipesCount);
    expect(result.mealsCount).toBe(preview.summary.mealsCount);
    expect(mock.created.recipes.every((r) => r.userId === 'user-1' && r.isPublic === false)).toBe(
      true
    );
    expect(mock.tx.recipe.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user-1' }),
      })
    );
  });

  it('saves INCOMPLETE plans strictly as DRAFT with null quantities preserved (never ACTIVE)', async () => {
    const fixture = loadFixture('odt-reference-incomplete-plan.json');
    const preview = await previewImportedMealPlan({
      userId: 'user-1',
      rawPayload: fixture,
      duplicateLookup: async () => [],
    });

    await expect(
      commitImportedMealPlan({
        userId: 'user-1',
        rawPayload: fixture,
        previewHash: preview.previewHash!,
        requestedLifecycleStatus: 'ACTIVE',
        commitEnabled: true,
      })
    ).rejects.toMatchObject({
      statusCode: 422,
      code: 'INCOMPLETE_PLAN_CANNOT_BE_ACTIVE',
    });

    const mock = createMockPrisma();
    const result = await commitImportedMealPlan({
      userId: 'user-1',
      rawPayload: fixture,
      previewHash: preview.previewHash!,
      commitEnabled: true,
      prismaClient: mock.prismaClient as never,
    });

    expect(result.lifecycleStatus).toBe(MealPlanLifecycleStatus.DRAFT);
    expect(result.validationStatus).toBe('INCOMPLETE');
    expect(mock.created.recipeIngredients.some((ri) => ri.quantity === null)).toBe(true);
    expect(
      mock.created.recipeIngredients.some((ri) => ri.rawQuantityText === 'not_provided')
    ).toBe(true);
  });

  it('returns idempotentReplay=true for repeated imports and P2002 concurrent races', async () => {
    const fixture = loadFixture('valid-1day-plan.json');
    const preview = await previewImportedMealPlan({
      userId: 'user-1',
      rawPayload: fixture,
      duplicateLookup: async () => [],
    });

    const existingPlan = {
      id: 'existing-plan-1',
      title: 'Plan existente',
      lifecycleStatus: MealPlanLifecycleStatus.ACTIVE,
      importValidationStatus: 'VALID',
      importSchemaVersion: 'meal-plan-import-v1',
      importFingerprint: preview.previewHash!,
      _count: { meals: 3 },
    };

    const replayMock = createMockPrisma({ existingPlan });
    const replay = await commitImportedMealPlan({
      userId: 'user-1',
      rawPayload: fixture,
      previewHash: preview.previewHash!,
      commitEnabled: true,
      prismaClient: replayMock.prismaClient as never,
    });
    expect(replay.idempotentReplay).toBe(true);
    expect(replay.mealPlanId).toBe('existing-plan-1');
    expect(replayMock.tx.mealPlan.create).not.toHaveBeenCalled();

    const raceMock = createMockPrisma({ existingPlan: null, throwP2002OnCreate: true });
    raceMock.prismaClient.mealPlan.findUnique.mockResolvedValueOnce(existingPlan);
    const raceResult = await commitImportedMealPlan({
      userId: 'user-1',
      rawPayload: fixture,
      previewHash: preview.previewHash!,
      commitEnabled: true,
      prismaClient: raceMock.prismaClient as never,
    });
    expect(raceResult.idempotentReplay).toBe(true);
    expect(raceResult.mealPlanId).toBe('existing-plan-1');
  });

  it('propagates transaction error cleanly on mid-transaction failure (no silent partial success)', async () => {
    const fixture = loadFixture('valid-1day-plan.json');
    const preview = await previewImportedMealPlan({
      userId: 'user-1',
      rawPayload: fixture,
      duplicateLookup: async () => [],
    });
    const mock = createMockPrisma({ failOnMealCreate: true });

    await expect(
      commitImportedMealPlan({
        userId: 'user-1',
        rawPayload: fixture,
        previewHash: preview.previewHash!,
        commitEnabled: true,
        prismaClient: mock.prismaClient as never,
      })
    ).rejects.toThrow('DB_WRITE_FAILED');
    expect(MealPlanCommitError).toBeDefined();
  });
});

