import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';
import logger from '../config/logger';
import { env } from '../config/env';
import {
  assertValidIdempotencyKey,
  beginIdempotent,
  completeIdempotent,
  failIdempotent,
  hashRequest,
  IdempotencyOwnershipLostError,
} from './idempotency.service';
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
export async function createSession(
  userId: string,
  data: CreateSessionInput,
  /** F3: runs inside the creating transaction (e.g. completes the idempotency record atomically with the insert). */
  onCreated?: (tx: Prisma.TransactionClient, session: unknown) => Promise<void>,
) {
  // F-2: the workout must belong to the caller BEFORE it is connected or returned. Missing and foreign workouts get the
  // same 404 (no existence oracle). Check and insert share one transaction; a workout deleted in between trips the
  // foreign key and is mapped to the same 404. Post-commit side effects below keep their pre-existing, non-atomic form.
  let session;
  try {
    session = await prisma.$transaction(async (tx) => {
      const owned = await tx.workout.findFirst({ where: { id: data.workoutId, userId, archivedAt: null }, select: { id: true } });
      if (!owned) {
        throw new AppError(404, 'Entrenamiento no encontrado');
      }

      const created = await tx.workoutSession.create({
        data: {
          userId,
          workoutId: data.workoutId,
          duration: data.duration,
          notes: data.notes,
          // Session recording F2: clients without the field are legacy (decision D4).
          recordingVersion: data.recordingVersion ?? 1,
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
      if (onCreated) await onCreated(tx, created);
      return created;
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

  if (data.recordingVersion === undefined) {
    // Decision D4: a pre-F2 client is still served; the counter shows when the legacy path can be retired.
    logger.info('legacy_session_payload', { sessionId: session.id });
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

/** Session save idempotency F3: idempotency operation name of POST /api/sessions. */
export const SESSION_CREATE_OPERATION = 'sessions.create';

/** Request hash of a session body: the validated fields only, so key order and unknown fields never change it. */
export function hashSessionRequest(data: CreateSessionInput): string {
  return hashRequest({
    workoutId: data.workoutId,
    duration: data.duration,
    notes: data.notes ?? null,
    recordingVersion: data.recordingVersion ?? null,
    exercises: data.exercises.map((exercise) => ({
      exerciseId: exercise.exerciseId,
      sets: exercise.sets.map((set) => ({
        reps: set.reps,
        weight: set.weight,
        rir: set.rir ?? null,
        rpe: set.rpe ?? null,
        restSeconds: set.restSeconds ?? null,
        order: set.order,
      })),
    })),
  });
}

/**
 * F3: idempotent POST /api/sessions. Exactly one session per (user, key). Same key + same body replays the stored
 * response without creating anything or re-running side effects; same key + different body is a conflict. The insert
 * and the completion of the idempotency record commit in one transaction.
 */
export async function createSessionIdempotent(userId: string, data: CreateSessionInput, idempotencyKey: string) {
  assertValidIdempotencyKey(idempotencyKey);
  const retentionSeconds = env.idempotencyRetentionHours * 3600;
  const gate = await beginIdempotent({
    userId,
    operation: SESSION_CREATE_OPERATION,
    key: idempotencyKey,
    requestHash: hashSessionRequest(data),
    lockSeconds: 30,
    retentionSeconds,
    maxAttempts: env.idempotencyMaxAttempts,
  });

  if (gate.kind === 'replay') {
    return { session: gate.response, replayed: true };
  }
  if (gate.kind === 'conflict') {
    throw new AppError(422, 'Idempotency-Key was already used with a different session', true, {
      reason: 'idempotency_conflict',
    });
  }
  if (gate.kind === 'in_progress') {
    throw new AppError(409, `This session is still being saved; retry in ${gate.retryAfterSeconds}s`, true, {
      retryAfterSeconds: gate.retryAfterSeconds,
    });
  }
  if (gate.kind === 'exhausted') {
    throw new AppError(429, 'Too many attempts for this Idempotency-Key; start a new request later', true, {
      reason: 'idempotency_attempts_exhausted',
      attempts: gate.attempts,
    });
  }
  if (gate.kind !== 'owner') {
    // concurrency/quota gates are not configured for sessions; treat any other outcome as a transient refusal
    throw new AppError(429, 'Session save temporarily refused; retry shortly', true, { reason: gate.kind });
  }

  try {
    const session = await createSession(userId, data, async (tx, created) => {
      const completed = await completeIdempotent(tx, gate.recordId, gate.ownerToken, 201, created, retentionSeconds);
      if (!completed) throw new IdempotencyOwnershipLostError();
    });
    return { session, replayed: false };
  } catch (error) {
    await failIdempotent(
      gate.recordId,
      gate.ownerToken,
      error instanceof IdempotencyOwnershipLostError ? 'ownership_lost' : error instanceof AppError ? `http_${error.statusCode}` : 'error',
    );
    if (error instanceof IdempotencyOwnershipLostError) {
      throw new AppError(409, 'This session save was taken over by another attempt; retry with the same Idempotency-Key', true, {
        retryAfterSeconds: 1,
      });
    }
    throw error;
  }
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
