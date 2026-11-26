import { PrismaClient } from '@prisma/client';
import { buildNormalizedExercises } from './exercise-classification';
import { SYSTEM_RECIPES } from './nutrition-library';
import { syncExerciseCatalog } from './exercise-catalog-sync';

const prisma = new PrismaClient();

async function seedRecipes() {
  console.log(`🥗 Sincronizando ${SYSTEM_RECIPES.length} recetas del sistema...`);

  for (const recipe of SYSTEM_RECIPES) {
    const existing = await prisma.recipe.findFirst({
      where: {
        name: recipe.name,
        source: 'system',
      },
      select: { id: true },
    });

    const recipeRecord = existing
      ? await prisma.recipe.update({
          where: { id: existing.id },
          data: {
            name: recipe.name,
            description: recipe.description,
            instructions: recipe.instructions,
            prepTime: recipe.prepTime,
            cookTime: recipe.cookTime,
            servings: recipe.servings,
            difficulty: recipe.difficulty,
            calories: recipe.calories,
            protein: recipe.protein,
            carbs: recipe.carbs,
            fat: recipe.fat,
            fiber: recipe.fiber ?? null,
            tags: recipe.tags,
            source: 'system',
            isPublic: true,
            isEditable: false,
            mealTypes: recipe.mealTypes,
            dietTypes: recipe.dietTypes,
            goalTypes: recipe.goalTypes,
          },
        })
      : await prisma.recipe.create({
          data: {
            name: recipe.name,
            description: recipe.description,
            instructions: recipe.instructions,
            prepTime: recipe.prepTime,
            cookTime: recipe.cookTime,
            servings: recipe.servings,
            difficulty: recipe.difficulty,
            calories: recipe.calories,
            protein: recipe.protein,
            carbs: recipe.carbs,
            fat: recipe.fat,
            fiber: recipe.fiber ?? null,
            tags: recipe.tags,
            source: 'system',
            isPublic: true,
            isEditable: false,
            mealTypes: recipe.mealTypes,
            dietTypes: recipe.dietTypes,
            goalTypes: recipe.goalTypes,
          },
        });

    await prisma.recipeIngredient.deleteMany({
      where: { recipeId: recipeRecord.id },
    });

    const mergedIngredients = recipe.ingredients.reduce<
      Array<{ name: string; quantity: number; unit: string }>
    >((acc, item) => {
      const normalizedName = item.name.trim().toLowerCase();
      const normalizedUnit = item.unit.trim().toLowerCase();
      const existingItem = acc.find(
        (candidate) => candidate.name === normalizedName && candidate.unit === normalizedUnit,
      );

      if (existingItem) {
        existingItem.quantity += item.quantity;
        return acc;
      }

      acc.push({
        name: normalizedName,
        quantity: item.quantity,
        unit: normalizedUnit,
      });
      return acc;
    }, []);

    for (const item of mergedIngredients) {
      const normalizedName = item.name.trim().toLowerCase();
      const normalizedUnit = item.unit.trim().toLowerCase();

      let ingredient = await prisma.ingredient.findUnique({
        where: {
          name: normalizedName,
        },
        select: { id: true },
      });

      if (!ingredient) {
        ingredient = await prisma.ingredient.create({
          data: {
            name: normalizedName,
            unit: normalizedUnit,
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
  }
}

async function main() {
  console.log('🌱 Iniciando seed base...');

  const normalizedExercises = buildNormalizedExercises();

  console.log(`📝 Sincronizando ${normalizedExercises.length} ejercicios (sin borrar historial)...`);
  const result = await syncExerciseCatalog(prisma, normalizedExercises);
  console.log(
    `   creados: ${result.created}, actualizados: ${result.updated}, archivados (retirados o duplicados): ${result.archived}`,
  );

  await seedRecipes();

  console.log(`✅ Seed completado. Total sincronizado: ${normalizedExercises.length} ejercicios y ${SYSTEM_RECIPES.length} recetas`);
}

main()
  .catch((error) => {
    console.error('❌ Error durante el seed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
