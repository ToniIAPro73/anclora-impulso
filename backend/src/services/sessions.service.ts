import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import { AppError } from '../middleware/errorHandler';
import type { CreateSessionInput } from '../utils/validators';
import { awardXP, updateStreak } from './gamification.service';
import { recordStrengthProgressForSession } from './strength-progress.service';
import { recordWorkoutCompletedActivity } from './social.service';

/**
 * Obtener todas las sesiones de un usuario
 */
export async function getUserSessions(userId: string, limit?: number) {
  const sessions = await prisma.workoutSession.findMany({
    where: { userId },
    include: {
      workout: {
        select: {
          id: true,
          name: true,
        },
      },
      exercises: {
        include: {
          exercise: {
            select: {
              id: true,
              name: true,
              muscleGroup: true,
            },
          },
          sets: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
    orderBy: { completedAt: 'desc' },
    ...(limit && { take: limit }),
  });

  return sessions;
}

/**
 * Obtener una sesión por ID
 */
export async function getSessionById(id: string, userId: string) {
  const session = await prisma.workoutSession.findFirst({
    where: { id, userId },
    include: {
      workout: true,
      exercises: {
        include: {
          exercise: true,
          sets: {
            orderBy: { order: 'asc' },
          },
        },
      },
    },
  });

  if (!session) {
    throw new AppError(404, 'Sesión no encontrada');
  }

  return session;
}

/**
 * Crear una nueva sesión de entrenamiento
 */
export async function createSession(userId: string, data: CreateSessionInput) {
  // F-2: the workout must belong to the caller BEFORE it is connected or returned. Missing and foreign workouts get the
  // same 404 (no existence oracle). Check and insert share one transaction; a workout deleted in between trips the
  // foreign key and is mapped to the same 404. Post-commit side effects below keep their pre-existing, non-atomic form.
  let session;
  try {
    session = await prisma.$transaction(async (tx) => {
      const owned = await tx.workout.findFirst({ where: { id: data.workoutId, userId }, select: { id: true } });
      if (!owned) {
        throw new AppError(404, 'Entrenamiento no encontrado');
      }

      return tx.workoutSession.create({
        data: {
          userId,
          workoutId: data.workoutId,
          duration: data.duration,
          notes: data.notes,
          exercises: {
            create: data.exercises.map((exercise) => ({
              exerciseId: exercise.exerciseId,
              sets: {
                create: exercise.sets,
              },
            })),
          },
        },
        include: {
          workout: true,
          exercises: {
            include: {
              exercise: true,
              sets: true,
            },
          },
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2003' &&
      String(error.meta?.field_name ?? '').includes('workoutId')
    ) {
      throw new AppError(404, 'Entrenamiento no encontrado');
    }
    throw error;
  }

  await updateStreak(userId);
  await awardXP(userId, 'complete_workout');
  await recordStrengthProgressForSession(userId, session.id);
  await recordWorkoutCompletedActivity({
    userId,
    sessionId: session.id,
    workoutName: session.workout.name,
    durationSeconds: session.duration,
  });

  return session;
}

/**
 * Actualizar una sesión
 */
export async function updateSession(id: string, userId: string, data: Partial<CreateSessionInput>) {
  const existingSession = await prisma.workoutSession.findFirst({
    where: { id, userId },
  });

  if (!existingSession) {
    throw new AppError(404, 'Sesión no encontrada');
  }

  const session = await prisma.workoutSession.update({
    where: { id },
    data: {
      duration: data.duration,
      notes: data.notes,
    },
    include: {
      workout: true,
      exercises: {
        include: {
          exercise: true,
          sets: true,
        },
      },
    },
  });

  return session;
}

/**
 * Eliminar una sesión
 */
export async function deleteSession(id: string, userId: string) {
  const session = await prisma.workoutSession.findFirst({
    where: { id, userId },
  });

  if (!session) {
    throw new AppError(404, 'Sesión no encontrada');
  }

  await prisma.workoutSession.delete({
    where: { id },
  });
}

/**
 * Obtener estadísticas de progreso
 */
export async function getProgressStats(userId: string) {
  // Total de entrenamientos
  const totalWorkouts = await prisma.workoutSession.count({
    where: { userId },
  });

  // Entrenamientos esta semana
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const workoutsThisWeek = await prisma.workoutSession.count({
    where: {
      userId,
      completedAt: { gte: oneWeekAgo },
    },
  });

  // Entrenamientos este mes
  const oneMonthAgo = new Date();
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

  const workoutsThisMonth = await prisma.workoutSession.count({
    where: {
      userId,
      completedAt: { gte: oneMonthAgo },
    },
  });

  // Tiempo total de entrenamiento
  const sessions = await prisma.workoutSession.findMany({
    where: { userId },
    select: { duration: true },
  });

  const totalDuration = sessions.reduce((sum, s) => sum + s.duration, 0);
  const avgDuration = sessions.length > 0 ? totalDuration / sessions.length : 0;

  // Récords personales (peso máximo por ejercicio)
  const personalRecords = await prisma.$queryRaw<Array<{
    exercise_id: string;
    exercise_name: string;
    max_weight: number;
    date: Date;
  }>>`
    SELECT 
      e.id as exercise_id,
      e.name as exercise_name,
      MAX(ss.weight) as max_weight,
      MAX(ws."completedAt") as date
    FROM "session_sets" ss
    JOIN "session_exercises" se ON ss."sessionExerciseId" = se.id
    JOIN "exercises" e ON se."exerciseId" = e.id
    JOIN "workout_sessions" ws ON se."sessionId" = ws.id
    WHERE ws."userId" = ${userId}
    GROUP BY e.id, e.name
    ORDER BY max_weight DESC
    LIMIT 10
  `;

  return {
    totalWorkouts,
    workoutsThisWeek,
    workoutsThisMonth,
    totalDuration,
    avgDuration: Math.round(avgDuration),
    personalRecords,
  };
}
