import { prisma } from "../config/database";
import { AppError } from "../middleware/errorHandler";
import type {
  CreateWorkoutInput,
  GenerateWorkoutInput,
} from "../utils/validators";
import { env } from "../config/env";
import type { Prisma } from "@prisma/client";
import {
  IdempotencyOwnershipLostError,
  assertValidIdempotencyKey,
  beginIdempotent,
  completeIdempotent,
  failIdempotent,
  hashRequest,
} from "./idempotency.service";
import logger from "../config/logger";
import { validateWorkoutPlan } from "./workouts/plan-validator";
import { buildDeterministicFallbackPlan } from "./workouts/deterministic-fallback";
import { FALLBACK_VERSION } from "./workouts/plan-limits";
import { buildWorkoutPersonalizationGuidance } from "./forty-plus-guidance";
import {
  getPersonalizationSnapshot,
  type PersonalizationSnapshot,
} from "./personalization.service";

function buildWorkoutExplanation(
  snapshot: PersonalizationSnapshot,
  workout: {
    exercises: Array<{
      exercise: {
        muscleGroup: string;
        trainingEnvironments?: string[];
      };
      rest: number;
    }>;
  }
) {
  const reasons: string[] = [];

  if (snapshot.profile.trainingGoal) {
    reasons.push(`Se ha priorizado el objetivo ${snapshot.profile.trainingGoal}.`);
  }

  if (snapshot.preferredMuscleGroups.length > 0) {
    reasons.push(
      `Se repiten grupos musculares donde ya hay más adherencia: ${snapshot.preferredMuscleGroups.join(", ")}.`
    );
  }

  if (snapshot.workoutAdjustment === "reduce") {
    reasons.push("Tu ritmo reciente pide bajar fricción: menos densidad, descansos más amables y ejecución más sostenible.");
  } else if (snapshot.workoutAdjustment === "increase") {
    reasons.push("Tu consistencia reciente permite subir un poco la exigencia sin romper adherencia.");
  } else {
    reasons.push("La carga se mantiene estable porque tu patrón reciente no pide una corrección brusca.");
  }

  if (snapshot.profile.preferredTrainingEnvironment) {
    reasons.push(`La propuesta respeta tu entorno preferido: ${snapshot.profile.preferredTrainingEnvironment}.`);
  }

  if (snapshot.stagnationRisk === "high") {
    reasons.push("Hay señales de estancamiento, así que la selección intenta reactivar progreso sin disparar fatiga.");
  }

  const targetMuscles = Array.from(
    new Set(workout.exercises.map((entry) => entry.exercise.muscleGroup))
  ).slice(0, 4);
  const averageRest =
    workout.exercises.length > 0
      ? Math.round(workout.exercises.reduce((sum, entry) => sum + entry.rest, 0) / workout.exercises.length)
      : null;

  return {
    headline: "Por qué encaja contigo",
    summary:
      snapshot.workoutsLast28Days > 0
        ? "La rutina combina tu objetivo, tu consistencia reciente y el tipo de esfuerzo que más probablemente mantendrá adherencia."
        : "La rutina parte de tu onboarding y crea una primera propuesta segura para empezar con claridad.",
    reasons,
    signals: [
      {
        label: "Adherencia semanal",
        value: snapshot.weeklyTarget ? `${snapshot.workoutsLast7Days}/${snapshot.weeklyTarget}` : `${snapshot.workoutsLast7Days}`,
      },
      {
        label: "Riesgo de estancamiento",
        value: snapshot.stagnationRisk,
      },
      {
        label: "Duración media",
        value: snapshot.averageSessionDuration ? `${Math.round(snapshot.averageSessionDuration)} min` : "—",
      },
    ],
    nextBestAction: {
      label: "Ejecutar esta sesión",
      href: "",
    },
    focusMuscles: targetMuscles,
    averageRest,
  };
}

export type GenerationProvenance =
  | { mode: "ai"; version: string }
  | { mode: "fallback"; version: string; reason: string }
  | { mode: "manual" };

/** Public shape of a workout's origin. Rows that predate the column report mode "unknown". */
export function toGeneration(row: {
  generationMode?: string | null;
  generationVersion?: string | null;
  generationReason?: string | null;
}) {
  return {
    mode: row.generationMode ?? "unknown",
    version: row.generationVersion ?? null,
    reason: row.generationReason ?? null,
  };
}

function decorateWorkout<T extends { exercises: Array<{ exercise: { muscleGroup: string; trainingEnvironments?: string[] }; rest: number }> }>(
  workout: T,
  snapshot: PersonalizationSnapshot
) {
  const explanation = buildWorkoutExplanation(snapshot, workout);
  return {
    ...workout,
    generation: toGeneration(workout as Parameters<typeof toGeneration>[0]),
    explanation: {
      ...explanation,
      nextBestAction: 'id' in workout
        ? {
            label: 'Empezar entrenamiento',
            href: `/workouts/${String((workout as { id: string }).id)}/start`,
          }
        : explanation.nextBestAction,
    },
  };
}

/**
 * Obtener todos los entrenamientos de un usuario
 */
export async function getUserWorkouts(userId: string) {
  const [workouts, snapshot] = await Promise.all([
    prisma.workout.findMany({
      where: { userId },
      include: {
        exercises: {
          include: {
            exercise: true,
          },
          orderBy: { order: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    getPersonalizationSnapshot(userId),
  ]);

  return workouts.map((workout) => decorateWorkout(workout, snapshot));
}

/**
 * Obtener un entrenamiento por ID
 */
export async function getWorkoutById(id: string, userId: string) {
  const [workout, snapshot] = await Promise.all([
    prisma.workout.findFirst({
      where: { id, userId },
      include: {
        exercises: {
          include: {
            exercise: true,
          },
          orderBy: { order: "asc" },
        },
      },
    }),
    getPersonalizationSnapshot(userId),
  ]);

  if (!workout) {
    throw new AppError(404, "Entrenamiento no encontrado");
  }

  return decorateWorkout(workout, snapshot);
}

/**
 * Crear un nuevo entrenamiento
 */
function createWorkoutRow(
  client: Pick<typeof prisma, "workout">,
  userId: string,
  data: CreateWorkoutInput,
  provenance: GenerationProvenance,
) {
  return client.workout.create({
    data: {
      userId,
      name: data.name,
      generationMode: provenance.mode,
      generationVersion: "version" in provenance ? provenance.version : null,
      generationReason: "reason" in provenance ? provenance.reason : null,
      exercises: {
        create: data.exercises,
      },
    },
    include: {
      exercises: {
        include: {
          exercise: true,
        },
      },
    },
  });
}

export async function createWorkout(
  userId: string,
  data: CreateWorkoutInput,
  provenance: GenerationProvenance = { mode: "manual" },
) {
  const workout = await createWorkoutRow(prisma, userId, data, provenance);
  const snapshot = await getPersonalizationSnapshot(userId);
  return decorateWorkout(workout, snapshot);
}

/** Runs inside the transaction that creates a generated routine; returns false if the idempotent owner was superseded. */
export type GenerationFinalize = (tx: Prisma.TransactionClient, response: unknown) => Promise<boolean>;

async function createGeneratedWorkout(
  userId: string,
  data: CreateWorkoutInput,
  provenance: GenerationProvenance,
  snapshot: PersonalizationSnapshot,
  finalize?: GenerationFinalize,
) {
  if (!finalize) {
    return createWorkout(userId, data, provenance);
  }

  // Routine creation and idempotency completion commit together; a superseded owner rolls everything back.
  return prisma.$transaction(async (tx) => {
    const workout = await createWorkoutRow(tx, userId, data, provenance);
    const response = decorateWorkout(workout, snapshot);
    if (!(await finalize(tx, JSON.parse(JSON.stringify(response))))) {
      throw new IdempotencyOwnershipLostError();
    }
    return response;
  });
}

/**
 * Actualizar un entrenamiento
 */
export async function updateWorkout(
  id: string,
  userId: string,
  data: Partial<CreateWorkoutInput>,
) {
  // Verificar que el entrenamiento pertenece al usuario
  const existingWorkout = await prisma.workout.findFirst({
    where: { id, userId },
  });

  if (!existingWorkout) {
    throw new AppError(404, "Entrenamiento no encontrado");
  }

  // Replace exercises and update the workout in one transaction so a failure
  // after the delete cannot leave the routine without exercises (AI-08).
  const workout = await prisma.$transaction(async (tx) => {
    if (data.exercises) {
      await tx.workoutExercise.deleteMany({
        where: { workoutId: id },
      });
    }

    return tx.workout.update({
      where: { id },
      data: {
        name: data.name,
        ...(data.exercises && {
          exercises: {
            create: data.exercises,
          },
        }),
      },
      include: {
        exercises: {
          include: {
            exercise: true,
          },
        },
      },
    });
  });

  const snapshot = await getPersonalizationSnapshot(userId);
  return decorateWorkout(workout, snapshot);
}

/**
 * Eliminar un entrenamiento
 */
export async function deleteWorkout(id: string, userId: string) {
  const workout = await prisma.workout.findFirst({
    where: { id, userId },
  });

  if (!workout) {
    throw new AppError(404, "Entrenamiento no encontrado");
  }

  await prisma.workout.delete({
    where: { id },
  });
}

/**
 * Generar un entrenamiento con IA
 */
export async function generateWorkout(
  userId: string,
  params: GenerateWorkoutInput,
  finalize?: GenerationFinalize,
) {
  const snapshot = await getPersonalizationSnapshot(userId);
  const effectiveAge = params.age ?? snapshot.profile.age ?? undefined;
  const effectiveSex = params.sex ?? snapshot.profile.sex ?? undefined;
  const effectiveEnvironment =
    params.trainingEnvironment ?? snapshot.profile.preferredTrainingEnvironment ?? 'gym';
  const effectiveTargetMuscles =
    params.targetMuscles && params.targetMuscles.length > 0
      ? params.targetMuscles
      : snapshot.preferredMuscleGroups.length > 0
        ? snapshot.preferredMuscleGroups
        : undefined;

  const difficultyFromProfile = snapshot.profile.experienceLevel ?? params.difficulty;
  const effectiveDifficulty =
    snapshot.workoutAdjustment === 'reduce' && difficultyFromProfile === 'advanced'
      ? 'intermediate'
      : snapshot.workoutAdjustment === 'reduce' && difficultyFromProfile === 'intermediate'
        ? 'beginner'
        : difficultyFromProfile;

  const baseDuration = params.duration;
  const durationFromHistory =
    snapshot.averageSessionDuration && snapshot.averageSessionDuration > 0
      ? Math.round(snapshot.averageSessionDuration / 60 / 5) * 5
      : baseDuration;
  const effectiveDuration =
    snapshot.workoutAdjustment === 'reduce'
      ? Math.max(25, Math.min(baseDuration, durationFromHistory || baseDuration, 40))
      : snapshot.workoutAdjustment === 'increase'
        ? Math.min(75, Math.max(baseDuration, durationFromHistory || baseDuration))
        : Math.min(baseDuration, durationFromHistory || baseDuration);

  const ageAwareGuidance = buildWorkoutPersonalizationGuidance(
    effectiveAge,
    effectiveSex ?? null,
  );

  // Obtener ejercicios según los parámetros
  const where: any = {
    difficulty: effectiveDifficulty,
    trainingEnvironments: { has: effectiveEnvironment },
  };

  if (effectiveTargetMuscles && effectiveTargetMuscles.length > 0) {
    where.muscleGroup = { in: effectiveTargetMuscles };
  }

  if (params.equipment && params.equipment.length > 0) {
    where.equipment = { in: params.equipment };
  }

  const availableExercises = await prisma.exercise.findMany({
    where,
  });

  if (availableExercises.length === 0) {
    throw new AppError(
      400,
      "No se encontraron ejercicios con los criterios especificados",
    );
  }

  const catalog = availableExercises.map((exercise) => ({
    id: exercise.id,
    equipment: exercise.equipment,
    difficulty: exercise.difficulty,
    trainingEnvironments: exercise.trainingEnvironments,
  }));

  // Try AI generation; its output is untrusted and must pass semantic validation
  // before anything is persisted (AI-04).
  let fallbackReason: string = "ai_unavailable";

  if (env.groqApiKey) {
    try {
      const { generateJSON, SYSTEM_PROMPT_ES } = await import("./llm");

      const prompt = `Genera un entrenamiento de fitness con las siguientes características:
- Tipo: ${params.workoutType}
- Duración: ${effectiveDuration} minutos
- Dificultad: ${effectiveDifficulty}
- Entorno: ${effectiveEnvironment}
- Músculos objetivo: ${effectiveTargetMuscles?.join(", ") || "todos"}
- Equipo disponible: ${params.equipment?.join(", ") || "cualquiera"}
- Edad del usuario: ${effectiveAge ?? "no indicada"}
- Sexo del usuario: ${effectiveSex === "female" ? "mujer" : effectiveSex === "male" ? "hombre" : "no indicado"}
- Objetivo principal: ${snapshot.profile.trainingGoal ?? "no indicado"}
- Nivel declarado: ${snapshot.profile.experienceLevel ?? "no indicado"}
- Adherencia últimas 4 semanas: ${snapshot.adherenceRate !== null ? `${Math.round(snapshot.adherenceRate * 100)}%` : "sin datos"}
- Entrenamientos últimos 7 días: ${snapshot.workoutsLast7Days}
- Duración media reciente: ${snapshot.averageSessionDuration ? `${Math.round(snapshot.averageSessionDuration / 60)} min` : "sin datos"}
- Grupos musculares más trabajados: ${snapshot.preferredMuscleGroups.join(", ") || "sin datos"}
- Riesgo de estancamiento: ${snapshot.stagnationRisk}
- Limitaciones o molestias reportadas: ${snapshot.profile.limitations.join(", ") || "ninguna"}

${ageAwareGuidance ? `Reglas de personalizacion para este perfil:\n${ageAwareGuidance}\n` : ""}

Ejercicios disponibles:
${availableExercises.map((e, i) => `${i + 1}. ${e.name} (ID: ${e.id}, ${e.muscleGroup}, ${e.equipment})`).join("\n")}

Devuelve un JSON con este formato exacto:
{
  "name": "Nombre del entrenamiento en español",
  "exercises": [
    {
      "exerciseId": "id del ejercicio de la lista",
      "sets": número de series,
      "reps": número de repeticiones,
      "rest": segundos de descanso,
      "order": orden (0, 1, 2...)
    }
  ]
}

IMPORTANTE: Usa SOLO los IDs de ejercicios de la lista proporcionada.`;

      let timer: NodeJS.Timeout | undefined;
      const candidate = await Promise.race([
        generateJSON<unknown>({
          messages: [
            { role: "system", content: SYSTEM_PROMPT_ES },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          maxTokens: 4000,
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error("ai_timeout")), env.llmWorkoutTimeoutMs);
        }),
      ]).finally(() => timer && clearTimeout(timer));

      const validation = validateWorkoutPlan(candidate, {
        catalog,
        difficulty: effectiveDifficulty,
        trainingEnvironment: effectiveEnvironment,
        equipment: params.equipment,
        age: effectiveAge,
      });

      if (validation.ok) {
        return await createGeneratedWorkout(
          userId,
          validation.plan,
          { mode: "ai", version: validation.validatorVersion },
          snapshot,
          finalize,
        );
      }

      fallbackReason = "ai_output_rejected";
      logger.warn("AI workout plan rejected by validator", {
        userId,
        violationCodes: validation.violations.map((violation) => violation.code),
      });
    } catch (error) {
      fallbackReason = error instanceof Error && error.message === "ai_timeout" ? "ai_timeout" : "ai_error";
      logger.warn("AI workout generation failed; using deterministic fallback", {
        userId,
        error: error instanceof Error ? error.message : "unknown",
      });
    }
  }

  // Deterministic fallback: same input and version always yield the same plan (AI-05).
  const fallbackPlan = buildDeterministicFallbackPlan({
    userId,
    candidates: availableExercises.map((exercise) => ({ id: exercise.id, muscleGroup: exercise.muscleGroup })),
    workoutType: params.workoutType,
    difficulty: effectiveDifficulty,
    age: effectiveAge,
    reduceLoad: snapshot.workoutAdjustment === "reduce",
  });

  return await createGeneratedWorkout(
    userId,
    fallbackPlan,
    { mode: "fallback", version: FALLBACK_VERSION, reason: fallbackReason },
    snapshot,
    finalize,
  );
}

export const WORKOUT_GENERATE_OPERATION = "workouts.generate";

/** Normalized content the idempotency key is bound to (order-insensitive lists). */
export function normalizeGenerateParams(params: GenerateWorkoutInput) {
  return {
    workoutType: params.workoutType,
    duration: params.duration,
    difficulty: params.difficulty,
    trainingEnvironment: params.trainingEnvironment,
    targetMuscles: [...(params.targetMuscles ?? [])].sort(),
    equipment: [...(params.equipment ?? [])].sort(),
    age: params.age ?? null,
    sex: params.sex ?? null,
  };
}

/**
 * Idempotent POST /workouts/generate: one logical operation creates at most one routine, regardless of
 * double taps, network retries, lost responses or process restarts. Creation commits atomically with the
 * idempotency completion and is owner-checked, so a superseded execution leaves no routine behind.
 */
export async function generateWorkoutIdempotent(
  userId: string,
  params: GenerateWorkoutInput,
  idempotencyKey: string,
) {
  assertValidIdempotencyKey(idempotencyKey);
  const gate = await beginIdempotent({
    userId,
    operation: WORKOUT_GENERATE_OPERATION,
    key: idempotencyKey,
    requestHash: hashRequest(normalizeGenerateParams(params)),
    lockSeconds: Math.ceil(env.llmWorkoutTimeoutMs / 1000) + 15,
    retentionSeconds: env.idempotencyRetentionHours * 3600,
    maxAttempts: env.idempotencyMaxAttempts,
    maxConcurrent: env.llmCoachMaxConcurrent,
  });

  if (gate.kind === "replay") {
    return { workout: gate.response, replayed: true };
  }
  if (gate.kind === "conflict") {
    throw new AppError(422, "Idempotency-Key was already used with a different request");
  }
  if (gate.kind === "in_progress") {
    throw new AppError(409, `A request with this Idempotency-Key is still in progress; retry in ${gate.retryAfterSeconds}s`, true, {
      retryAfterSeconds: gate.retryAfterSeconds,
    });
  }
  if (gate.kind === "exhausted") {
    throw new AppError(429, "Too many attempts for this Idempotency-Key; start a new request later", true, {
      reason: "idempotency_attempts_exhausted",
      attempts: gate.attempts,
    });
  }

  if (gate.kind === "concurrency_limited") {
    throw new AppError(429, "Too many generation requests in flight; retry shortly", true, {
      reason: "concurrency_limit",
      retryAfterSeconds: gate.retryAfterSeconds,
    });
  }

  try {
    const workout = await generateWorkout(userId, params, (tx, response) =>
      completeIdempotent(tx, gate.recordId, gate.ownerToken, 201, response, env.idempotencyRetentionHours * 3600),
    );
    return { workout, replayed: false };
  } catch (error) {
    await failIdempotent(
      gate.recordId,
      gate.ownerToken,
      error instanceof IdempotencyOwnershipLostError ? "ownership_lost" : error instanceof AppError ? `http_${error.statusCode}` : "error",
    );
    if (error instanceof IdempotencyOwnershipLostError) {
      throw new AppError(409, "This operation was taken over by another attempt; retry with the same Idempotency-Key", true, {
        retryAfterSeconds: 1,
      });
    }
    throw error;
  }
}
