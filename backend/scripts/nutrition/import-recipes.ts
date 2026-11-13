import fs from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';

import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { PUBLISHED_DIET_TYPES } from '../../src/services/nutrition/plan-import/protocol-catalog';

const prisma = new PrismaClient();

const difficultyValues = ['facil', 'medio', 'dificil'] as const;
const mealTypeValues = ['desayuno', 'almuerzo', 'cena', 'snack'] as const;
const dietTypeValues = PUBLISHED_DIET_TYPES;
const goalTypeValues = [
  'perdida_peso',
  'ganancia_muscular',
  'mantenimiento',
  'recomposicion',
  'salud_cardiometabolica',
] as const;
const allowedUnits = ['g', 'ml', 'unidad', 'rebanada', 'lata', 'cucharada', 'cucharadita'] as const;

const ingredientSchema = z.object({
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.enum(allowedUnits),
});

const recipeSchema = z.object({
  externalId: z.string().min(1),
  name: z.string().min(1),
  nameEn: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
  instructions: z.array(z.string().min(1)).min(3),
  prepTime: z.number().int().min(0).nullable().optional(),
  cookTime: z.number().int().min(0).nullable().optional(),
  servings: z.number().int().min(1).max(20),
  difficulty: z.enum(difficultyValues).nullable().optional(),
  calories: z.number().min(0).nullable().optional(),
  protein: z.number().min(0).nullable().optional(),
  carbs: z.number().min(0).nullable().optional(),
  fat: z.number().min(0).nullable().optional(),
  fiber: z.number().min(0).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string().min(1)).min(3).max(12),
  mealTypes: z.array(z.enum(mealTypeValues)).min(1),
  dietTypes: z.array(z.enum(dietTypeValues)).min(1),
  goalTypes: z.array(z.enum(goalTypeValues)).min(1).max(12),
  ingredients: z.array(ingredientSchema).min(3),
});

const importFileSchema = z.object({
  specVersion: z.literal('recipes-import-v1'),
  batchId: z.string().min(1),
  generatedAt: z.string().datetime(),
  generator: z.object({
    provider: z.string().min(1),
    model: z.string().min(1),
    notes: z.string().optional(),
  }),
  recipes: z.array(recipeSchema).min(1),
});

type ImportRecipe = z.infer<typeof recipeSchema>;
type ImportFile = z.infer<typeof importFileSchema>;

function parseArgs(argv: string[]) {
  const args = {
    file: '',
    validateOnly: false,
    source: 'ai',
    visibility: 'public',
    editable: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];
    if (current === '--file') {
      args.file = argv[index + 1] ?? '';
      index += 1;
      continue;
    }
    if (current === '--validate-only') {
      args.validateOnly = true;
      continue;
    }
    if (current === '--source') {
      args.source = argv[index + 1] ?? args.source;
      index += 1;
      continue;
    }
    if (current === '--visibility') {
      args.visibility = argv[index + 1] ?? args.visibility;
      index += 1;
      continue;
    }
    if (current === '--editable') {
      args.editable = true;
      continue;
    }
  }

  if (!args.file) {
    throw new Error(
      'Uso: npm run nutrition:import -- --file <ruta-json> [--validate-only] [--source ai|system] [--visibility public|private] [--editable]',
    );
  }

  if (!['ai', 'system'].includes(args.source)) {
    throw new Error('`--source` solo puede ser `ai` o `system`.');
  }

  if (!['public', 'private'].includes(args.visibility)) {
    throw new Error('`--visibility` solo puede ser `public` o `private`.');
  }

  return args;
}

function normalizeText(value: string) {
  return value.trim().toLowerCase();
}

function dedupeList(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeTags(values: string[]) {
  return dedupeList(values.map((value) => normalizeText(value).replace(/\s+/g, '_')));
}

function normalizeGoalTypes(values: string[]) {
  return dedupeList(values.map((value) => normalizeText(value)));
}

function normalizeIngredients(items: ImportRecipe['ingredients']) {
  return items.reduce<Array<{ name: string; quantity: number; unit: string }>>((acc, item) => {
    const name = normalizeText(item.name);
    const unit = normalizeText(item.unit);
    const existing = acc.find((candidate) => candidate.name === name && candidate.unit === unit);

    if (existing) {
      existing.quantity += item.quantity;
      return acc;
    }

    acc.push({ name, quantity: item.quantity, unit });
    return acc;
  }, []);
}

function buildNearDuplicateKey(recipe: ImportRecipe) {
  const firstIngredients = normalizeIngredients(recipe.ingredients)
    .slice(0, 3)
    .map((item) => item.name)
    .sort()
    .join('|');

  return [
    normalizeText(recipe.name),
    [...recipe.mealTypes].sort().join('|'),
    [...recipe.dietTypes].sort().join('|'),
    firstIngredients,
  ].join('::');
}

function assertRecipeSemantics(data: ImportFile) {
  const externalIds = new Set<string>();
  const names = new Set<string>();
  const nearDuplicateKeys = new Set<string>();

  for (const recipe of data.recipes) {
    if (externalIds.has(recipe.externalId)) {
      throw new Error(`externalId duplicado en el lote: ${recipe.externalId}`);
    }
    externalIds.add(recipe.externalId);

    const normalizedName = normalizeText(recipe.name);
    if (names.has(normalizedName)) {
      throw new Error(`Nombre de receta duplicado en el lote: ${recipe.name}`);
    }
    names.add(normalizedName);

    const duplicateKey = buildNearDuplicateKey(recipe);
    if (nearDuplicateKeys.has(duplicateKey)) {
      throw new Error(`Receta demasiado parecida a otra del lote: ${recipe.name}`);
    }
    nearDuplicateKeys.add(duplicateKey);

    const caloriesFromMacros =
      (recipe.protein ?? 0) * 4 + (recipe.carbs ?? 0) * 4 + (recipe.fat ?? 0) * 9;

    if (recipe.calories != null && caloriesFromMacros > 0) {
      const ratio = recipe.calories / caloriesFromMacros;
      if (ratio < 0.7 || ratio > 1.3) {
        throw new Error(
          `Calorias poco plausibles en "${recipe.name}". Declaradas=${recipe.calories}, estimadas=${caloriesFromMacros.toFixed(1)}`,
        );
      }
    }

    if (recipe.tags.length < 3) {
      throw new Error(`La receta "${recipe.name}" no cumple el minimo de tags.`);
    }

    if (recipe.instructions.some((step) => step.trim().length < 8)) {
      throw new Error(`La receta "${recipe.name}" tiene instrucciones demasiado pobres.`);
    }
  }
}

async function loadImportFile(filePath: string) {
  const absolutePath = path.resolve(process.cwd(), filePath);
  const raw = await fs.readFile(absolutePath, 'utf8');
  const parsed = JSON.parse(raw) as unknown;
  return {
    absolutePath,
    parsed: importFileSchema.parse(parsed),
  };
}

async function upsertRecipe(recipe: ImportRecipe, options: { source: 'ai' | 'system'; isPublic: boolean; isEditable: boolean }) {
  const normalizedIngredients = normalizeIngredients(recipe.ingredients);
  const normalizedTags = normalizeTags(recipe.tags);
  const normalizedGoalTypes = normalizeGoalTypes(recipe.goalTypes);

  const existing = await prisma.recipe.findFirst({
    where: {
      name: recipe.name,
      source: options.source,
    },
    select: { id: true },
  });

  const recipeRecord = existing
    ? await prisma.recipe.update({
        where: { id: existing.id },
        data: {
          name: recipe.name,
          nameEn: recipe.nameEn ?? null,
          description: recipe.description ?? null,
          instructions: recipe.instructions,
          prepTime: recipe.prepTime ?? null,
          cookTime: recipe.cookTime ?? null,
          servings: recipe.servings,
          difficulty: recipe.difficulty ?? null,
          calories: recipe.calories ?? null,
          protein: recipe.protein ?? null,
          carbs: recipe.carbs ?? null,
          fat: recipe.fat ?? null,
          fiber: recipe.fiber ?? null,
          imageUrl: recipe.imageUrl ?? null,
          tags: normalizedTags,
          source: options.source,
          isPublic: options.isPublic,
          isEditable: options.isEditable,
          mealTypes: dedupeList(recipe.mealTypes),
          dietTypes: dedupeList(recipe.dietTypes),
          goalTypes: normalizedGoalTypes,
        },
      })
    : await prisma.recipe.create({
        data: {
          name: recipe.name,
          nameEn: recipe.nameEn ?? null,
          description: recipe.description ?? null,
          instructions: recipe.instructions,
          prepTime: recipe.prepTime ?? null,
          cookTime: recipe.cookTime ?? null,
          servings: recipe.servings,
          difficulty: recipe.difficulty ?? null,
          calories: recipe.calories ?? null,
          protein: recipe.protein ?? null,
          carbs: recipe.carbs ?? null,
          fat: recipe.fat ?? null,
          fiber: recipe.fiber ?? null,
          imageUrl: recipe.imageUrl ?? null,
          tags: normalizedTags,
          source: options.source,
          isPublic: options.isPublic,
          isEditable: options.isEditable,
          mealTypes: dedupeList(recipe.mealTypes),
          dietTypes: dedupeList(recipe.dietTypes),
          goalTypes: normalizedGoalTypes,
        },
      });

  await prisma.recipeIngredient.deleteMany({
    where: { recipeId: recipeRecord.id },
  });

  for (const item of normalizedIngredients) {
    let ingredient = await prisma.ingredient.findUnique({
      where: { name: item.name },
      select: { id: true },
    });

    if (!ingredient) {
      ingredient = await prisma.ingredient.create({
        data: {
          name: item.name,
          unit: item.unit,
        },
        select: { id: true },
      });
    }

    await prisma.recipeIngredient.create({
      data: {
        recipeId: recipeRecord.id,
        ingredientId: ingredient.id,
        quantity: item.quantity,
      },
    });
  }

  return { id: recipeRecord.id, name: recipe.name };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { absolutePath, parsed } = await loadImportFile(args.file);

  assertRecipeSemantics(parsed);

  console.log(`Archivo validado: ${absolutePath}`);
  console.log(`Lote: ${parsed.batchId}`);
  console.log(`Recetas: ${parsed.recipes.length}`);

  if (args.validateOnly) {
    console.log('Validacion completada. No se ha importado nada.');
    return;
  }

  let createdOrUpdated = 0;
  for (const recipe of parsed.recipes) {
    await upsertRecipe(recipe, {
      source: args.source as 'ai' | 'system',
      isPublic: args.visibility === 'public',
      isEditable: args.editable,
    });
    createdOrUpdated += 1;
  }

  console.log(`Importacion completada. Recetas procesadas: ${createdOrUpdated}`);
}

main()
  .catch((error) => {
    console.error('Error en import-recipes:', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
