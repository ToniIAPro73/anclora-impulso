import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import type {
  BulkUpdateExerciseEditorialInput,
  CreateExerciseInput,
  UpdateExerciseInput,
} from '../utils/validators';
import { resolveExerciseImageUrl } from './exercise-image-resolver';

export interface ExerciseFilters {
  category?: string;
  muscleGroup?: string;
  equipment?: string;
  environment?: string;
  difficulty?: string;
  search?: string;
}

function calculateExerciseQuality(exercise: {
  name: string;
  description: string;
  instructions: string[];
  trainingEnvironments: string[];
  difficulty: string;
  editorialOverrideStatus?: string | null;
  editorialNotes?: string | null;
}) {
  const resolvedImageUrl = resolveExerciseImageUrl(exercise.name);
  const checks = {
    hasDescription: exercise.description.trim().length >= 40,
    hasEnoughInstructions: exercise.instructions.length >= 3,
    hasEnvironment: exercise.trainingEnvironments.length > 0,
    hasImage: Boolean(resolvedImageUrl),
    hasDifficulty: Boolean(exercise.difficulty),
  };

  const passedChecks = Object.values(checks).filter(Boolean).length;
  return {
    qualityScore: Math.round((passedChecks / Object.keys(checks).length) * 100),
    editorialStatus:
      exercise.editorialOverrideStatus ?? (passedChecks >= 5 ? 'ready' : passedChecks >= 3 ? 'review' : 'needs_work'),
    autoEditorialStatus: passedChecks >= 5 ? 'ready' : passedChecks >= 3 ? 'review' : 'needs_work',
    editorialNotes: exercise.editorialNotes ?? null,
    checks,
  };
}

function decorateExercise<T extends {
  name: string;
  description: string;
  instructions: string[];
  trainingEnvironments: string[];
  imageUrl: string | null;
  difficulty: string;
  editorialOverrideStatus?: string | null;
  editorialNotes?: string | null;
}>(exercise: T) {
  const resolvedImageUrl = resolveExerciseImageUrl(exercise.name);
  return {
    ...exercise,
    imageUrl: resolvedImageUrl,
    editorial: calculateExerciseQuality({
      name: exercise.name,
      description: exercise.description,
      instructions: exercise.instructions,
      trainingEnvironments: exercise.trainingEnvironments,
      difficulty: exercise.difficulty,
      editorialOverrideStatus: exercise.editorialOverrideStatus,
      editorialNotes: exercise.editorialNotes,
    }),
  };
}

/**
 * Obtener todos los ejercicios con filtros opcionales
 */
export async function getAllExercises(filters: ExerciseFilters = {}) {
  // Archived entries (history integrity F1) stay out of the catalogue but remain readable by id.
  const where: any = { archivedAt: null };

  if (filters.category) {
    where.category = filters.category;
  }

  if (filters.muscleGroup) {
    where.muscleGroup = filters.muscleGroup;
  }

  if (filters.equipment) {
    where.equipment = filters.equipment;
  }

  if (filters.environment) {
    where.trainingEnvironments = { has: filters.environment };
  }

  if (filters.difficulty) {
    where.difficulty = filters.difficulty;
  }

  if (filters.search) {
    where.OR = [
      { name: { contains: filters.search, mode: 'insensitive' } },
      { description: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const exercises = await prisma.exercise.findMany({
    where,
    orderBy: { name: 'asc' },
  });

  return exercises.map((exercise) => decorateExercise(exercise));
}

/**
 * Obtener un ejercicio por ID
 */
export async function getExerciseById(id: string) {
  const exercise = await prisma.exercise.findUnique({
    where: { id },
  });

  if (!exercise) {
    throw new AppError(404, 'Ejercicio no encontrado');
  }

  return decorateExercise(exercise);
}

/**
 * Crear un nuevo ejercicio
 */
export async function createExercise(data: CreateExerciseInput) {
  const exercise = await prisma.exercise.create({
    data,
  });

  return decorateExercise(exercise);
}

/**
 * Actualizar un ejercicio
 */
export async function updateExercise(id: string, data: UpdateExerciseInput) {
  const exercise = await prisma.exercise.update({
    where: { id },
    data,
  });

  return decorateExercise(exercise);
}

export async function bulkUpdateExerciseEditorial(data: BulkUpdateExerciseEditorialInput) {
  await prisma.exercise.updateMany({
    where: { id: { in: data.ids } },
    data: {
      editorialOverrideStatus: data.editorialOverrideStatus,
      editorialNotes: data.editorialNotes ?? null,
      editorialReviewedAt: new Date(),
    },
  });

  const exercises = await prisma.exercise.findMany({
    where: { id: { in: data.ids } },
    orderBy: { updatedAt: 'desc' },
  });

  return exercises.map((exercise) => decorateExercise(exercise));
}

/**
 * Eliminar un ejercicio
 */
export async function deleteExercise(id: string) {
  // History integrity F1: an exercise that sessions, records, routines or progression state point to is archived;
  // only an unreferenced exercise is physically deleted. The database refuses to delete referenced ones (NO ACTION).
  const exercise = await prisma.exercise.findUnique({
    where: { id },
    select: {
      id: true,
      archivedAt: true,
      _count: {
        select: { sessionExercises: true, personalRecords: true, workoutExercises: true, progressionStates: true },
      },
    },
  });

  if (!exercise) {
    throw new AppError(404, 'Ejercicio no encontrado');
  }

  const referenced = Object.values(exercise._count).some((count) => count > 0);
  if (!referenced) {
    try {
      await prisma.exercise.delete({ where: { id } });
      return;
    } catch (error) {
      // A reference created between the check and the delete trips the foreign key: fall through and archive.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003')) {
        throw error;
      }
    }
  }

  if (exercise.archivedAt === null) {
    await prisma.exercise.update({ where: { id }, data: { archivedAt: new Date() } });
  }
}

/**
 * Obtener categorías únicas
 */
export async function getCategories() {
  const exercises = await prisma.exercise.findMany({
    where: { archivedAt: null },
    select: { category: true },
    distinct: ['category'],
  });

  return exercises.map((e) => e.category);
}

/**
 * Obtener grupos musculares únicos
 */
export async function getMuscleGroups() {
  const exercises = await prisma.exercise.findMany({
    where: { archivedAt: null },
    select: { muscleGroup: true },
    distinct: ['muscleGroup'],
  });

  return exercises.map((e) => e.muscleGroup);
}

/**
 * Obtener equipos únicos
 */
export async function getEquipment() {
  const exercises = await prisma.exercise.findMany({
    where: { archivedAt: null },
    select: { equipment: true },
    distinct: ['equipment'],
  });

  return exercises.map((e) => e.equipment);
}

/**
 * Obtener entornos de entrenamiento únicos
 */
export async function getTrainingEnvironments() {
  const exercises = await prisma.exercise.findMany({
    where: { archivedAt: null },
    select: { trainingEnvironments: true },
  });

  return Array.from(new Set(exercises.flatMap((exercise) => exercise.trainingEnvironments))).sort();
}

export async function getEditorialSummary() {
  const exercises = await prisma.exercise.findMany({
    where: { archivedAt: null },
    orderBy: { updatedAt: 'desc' },
  });

  const decorated = exercises.map((exercise) => decorateExercise(exercise));
  const byStatus = {
    ready: decorated.filter((exercise) => exercise.editorial.editorialStatus === 'ready').length,
    review: decorated.filter((exercise) => exercise.editorial.editorialStatus === 'review').length,
    needs_work: decorated.filter((exercise) => exercise.editorial.editorialStatus === 'needs_work').length,
  };
  const averageQualityScore =
    decorated.length > 0
      ? Math.round(decorated.reduce((sum, exercise) => sum + exercise.editorial.qualityScore, 0) / decorated.length)
      : 0;

  return {
    total: decorated.length,
    averageQualityScore,
    byStatus,
    exercises: decorated,
  };
}
