import { z } from 'zod';

// Validadores de autenticación
export const registerSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
  fullName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
});

export const loginSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(1, 'La contraseña es requerida'),
});

export const updateProfileSchema = z.object({
  avatarDataUrl: z.string().max(2_000_000).nullable().optional(),
  sex: z.enum(['male', 'female']).nullable().optional(),
  age: z.number().int().min(14).max(100).nullable().optional(),
  heightCm: z.number().positive().max(300).nullable().optional(),
  weightKg: z.number().positive().max(400).nullable().optional(),
  targetWeightKg: z.number().positive().max(400).nullable().optional(),
  timeframeWeeks: z.number().int().min(1).max(260).nullable().optional(),
  trainingDaysPerWeek: z.number().int().min(1).max(7).nullable().optional(),
  trainingGoal: z.enum(['lose_weight', 'build_muscle', 'recomposition', 'maintain']).nullable().optional(),
  preferredTrainingEnvironment: z.enum(['gym', 'home', 'outdoor']).nullable().optional(),
  experienceLevel: z.enum(['beginner', 'intermediate', 'advanced']).nullable().optional(),
  limitations: z.array(z.string().min(1).max(80)).max(8).optional(),
  onboardingCompletedAt: z.string().datetime().nullable().optional(),
  remindersEnabled: z.boolean().optional(),
  reminderTime: z.string().regex(/^\d{2}:\d{2}$/).nullable().optional(),
  reminderWorkout: z.boolean().optional(),
  reminderNutrition: z.boolean().optional(),
  reminderWeeklyReview: z.boolean().optional(),
  reminderReactivation: z.boolean().optional(),
});

// Validadores de entrenamientos
export const createWorkoutSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  exercises: z.array(
    z.object({
      exerciseId: z.string().uuid('ID de ejercicio inválido'),
      sets: z.number().int().min(1, 'Debe tener al menos 1 serie'),
      reps: z.number().int().min(1, 'Debe tener al menos 1 repetición'),
      rest: z.number().int().min(0, 'El descanso no puede ser negativo'),
      order: z.number().int().min(0, 'El orden no puede ser negativo'),
    })
  ),
});

export const updateWorkoutSchema = createWorkoutSchema.partial();

// Validadores de sesiones
export const createSessionSchema = z.object({
  workoutId: z.string().uuid('ID de entrenamiento inválido'),
  duration: z.number().int().min(1, 'La duración debe ser al menos 1 segundo'),
  notes: z.string().optional(),
  exercises: z.array(
    z.object({
      exerciseId: z.string().uuid('ID de ejercicio inválido'),
      sets: z.array(
        z.object({
          reps: z.number().int().min(1, 'Debe tener al menos 1 repetición'),
          weight: z.number().min(0, 'El peso no puede ser negativo'),
          rir: z.number().int().min(0).max(5).optional(),
          rpe: z.number().min(0).max(10).optional(),
          restSeconds: z.number().int().min(0).max(3600).optional(),
          order: z.number().int().min(0, 'El orden no puede ser negativo'),
        })
      ),
    })
  ),
});

// Validadores de medidas corporales
export const createMeasurementSchema = z.object({
  date: z.string().datetime().optional(),
  weight: z.number().positive().optional(),
  bodyFat: z.number().min(0).max(100).optional(),
  chest: z.number().positive().optional(),
  waist: z.number().positive().optional(),
  hips: z.number().positive().optional(),
  arms: z.number().positive().optional(),
  thighs: z.number().positive().optional(),
});

/**
 * F-3: the ONLY editable fields of a measurement. `.strict()` rejects any other key (id, userId, relations such as
 * `user: { connect }`, unknown flags) instead of silently forwarding it to the ORM. At least one field is required.
 */
export const updateMeasurementSchema = z
  .object({
    date: z.string().datetime(),
    weight: z.number().positive().nullable(),
    bodyFat: z.number().min(0).max(100).nullable(),
    chest: z.number().positive().nullable(),
    waist: z.number().positive().nullable(),
    hips: z.number().positive().nullable(),
    arms: z.number().positive().nullable(),
    thighs: z.number().positive().nullable(),
  })
  .partial()
  .strict()
  .refine((value) => Object.keys(value).length > 0, { message: 'Debe indicar al menos un campo editable' });

// Validadores de ejercicios
export const createExerciseSchema = z.object({
  name: z.string().min(1, 'El nombre es requerido'),
  category: z.string().min(1, 'La categoría es requerida'),
  muscleGroup: z.string().min(1, 'El grupo muscular es requerido'),
  equipment: z.string().min(1, 'El equipo es requerido'),
  trainingEnvironments: z.array(z.enum(['gym', 'home', 'outdoor'])).default([]),
  difficulty: z.string().min(1, 'La dificultad es requerida'),
  description: z.string().min(1, 'La descripción es requerida'),
  instructions: z.array(z.string()).min(1, 'Debe tener al menos una instrucción'),
});

export const updateExerciseSchema = createExerciseSchema.partial();
const editorialOverrideStatusSchema = z.enum(['ready', 'review', 'needs_work']).nullable().optional();
const editorialNotesSchema = z.string().max(4000).nullable().optional();

export const updateExerciseEditorialSchema = z.object({
  editorialOverrideStatus: editorialOverrideStatusSchema,
  editorialNotes: editorialNotesSchema,
});

export const bulkUpdateExerciseEditorialSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  editorialOverrideStatus: z.enum(['ready', 'review', 'needs_work']),
  editorialNotes: z.string().max(4000).nullable().optional(),
});

export const createProductEventSchema = z.object({
  action: z.string().min(1).max(80),
  category: z.string().min(1).max(40),
  source: z.string().min(1).max(40).optional(),
  metadata: z.record(z.any()).optional(),
});

const progressionRepRangeSchema = z.object({
  minReps: z.number().int().min(1).max(50),
  maxReps: z.number().int().min(1).max(50),
}).refine((range) => range.maxReps >= range.minReps, {
  message: 'maxReps must be greater than or equal to minReps',
});

export const generateNextSessionSchema = z.object({
  now: z.string().datetime().optional(),
  weekIndex: z.number().int().min(0).optional(),
  sessionIndex: z.number().int().min(0).optional(),
  readiness: z.object({
    readinessScore: z.number().int().min(0).max(100),
    provider: z.enum(['healthkit', 'health_connect', 'garmin', 'whoop', 'oura', 'manual']).optional(),
    recordedAt: z.string().datetime().optional(),
  }).optional(),
  plannedExercises: z.array(
    z.object({
      exerciseId: z.string().uuid(),
      sets: z.number().int().min(1).max(12),
      currentWeight: z.number().min(0).max(1000).optional(),
      targetRepRange: progressionRepRangeSchema.optional(),
      exercisePattern: z.enum(['lower_compound', 'upper_compound', 'isolation']),
      primaryMuscle: z.string().min(1).max(80).optional(),
      lastVolume: z.number().min(0).max(100000).optional(),
      sessionResult: z.object({
        reps: z.array(z.number().int().min(0).max(100)).min(1).max(12),
        averageRir: z.number().min(0).max(5),
      }).optional(),
    })
  ).min(1).max(30),
});

const wearableProviderSchema = z.enum(['healthkit', 'health_connect', 'garmin', 'whoop', 'oura', 'manual']);

export const upsertWearableConnectionSchema = z.object({
  status: z.enum(['connected', 'paused', 'revoked']),
  syncDirection: z.enum(['import_only', 'export_only', 'bidirectional']),
  scopes: z.array(z.enum(['heart_rate', 'sleep', 'activity', 'hrv'])).max(8).default([]),
});

export const createRecoverySampleSchema = z.object({
  provider: wearableProviderSchema,
  recordedAt: z.string().datetime(),
  hrvMs: z.number().positive().max(300).optional(),
  restingHeartRateBpm: z.number().int().min(25).max(220).optional(),
  sleepMinutes: z.number().int().min(0).max(1440).optional(),
  activityMinutes: z.number().int().min(0).max(1440).optional(),
  payload: z.record(z.any()).optional(),
}).refine((sample) => (
  sample.hrvMs !== undefined ||
  sample.restingHeartRateBpm !== undefined ||
  sample.sleepMinutes !== undefined ||
  sample.activityMinutes !== undefined
), {
  message: 'At least one recovery metric is required',
});

export type UpsertWearableConnectionInput = z.infer<typeof upsertWearableConnectionSchema>;
export type CreateRecoverySampleInput = z.infer<typeof createRecoverySampleSchema>;

export const createFormAnalysisSchema = z.object({
  exerciseName: z.string().trim().min(1).max(160),
  mediaType: z.enum(['image', 'video']),
  mediaUrl: z.string().url().max(2000),
  clientAnalysis: z.record(z.any()).optional(),
});

export const createVoiceCuesSchema = z.object({
  workoutSessionId: z.string().min(1).max(160).optional(),
  exerciseName: z.string().trim().min(1).max(160),
  phase: z.enum(['warmup', 'working_set', 'rest', 'cooldown']),
  intensity: z.enum(['easy', 'moderate', 'hard']),
  locale: z.string().min(2).max(12).default('en-US'),
});

export type CreateFormAnalysisInput = z.infer<typeof createFormAnalysisSchema>;
export type CreateVoiceCuesInput = z.infer<typeof createVoiceCuesSchema>;

export const sendCoachMessageSchema = z.object({
  conversationId: z.string().uuid().optional(),
  message: z.string().trim().min(3).max(2000),
});

export const updateSocialPrivacySchema = z.object({
  visibility: z.enum(['public', 'private']),
});

export const updateRecipeSchema = z.object({
  name: z.string().min(1).optional(),
  nameEn: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
  instructions: z.array(z.string().min(1)).min(1).optional(),
  prepTime: z.number().int().min(0).nullable().optional(),
  cookTime: z.number().int().min(0).nullable().optional(),
  difficulty: z.string().min(1).nullable().optional(),
  calories: z.number().min(0).nullable().optional(),
  protein: z.number().min(0).nullable().optional(),
  carbs: z.number().min(0).nullable().optional(),
  fat: z.number().min(0).nullable().optional(),
  fiber: z.number().min(0).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string().min(1)).max(12).optional(),
  editorialOverrideStatus: editorialOverrideStatusSchema,
  editorialNotes: editorialNotesSchema,
});

export const createRecipeSchema = z.object({
  name: z.string().min(1),
  nameEn: z.string().min(1).nullable().optional(),
  description: z.string().min(1).nullable().optional(),
  instructions: z.array(z.string().min(1)).min(1),
  prepTime: z.number().int().min(0).nullable().optional(),
  cookTime: z.number().int().min(0).nullable().optional(),
  servings: z.number().int().min(1).max(20).optional(),
  difficulty: z.string().min(1).nullable().optional(),
  calories: z.number().min(0).nullable().optional(),
  protein: z.number().min(0).nullable().optional(),
  carbs: z.number().min(0).nullable().optional(),
  fat: z.number().min(0).nullable().optional(),
  fiber: z.number().min(0).nullable().optional(),
  imageUrl: z.string().url().nullable().optional(),
  tags: z.array(z.string().min(1)).max(12).default([]),
  mealTypes: z.array(z.enum(['desayuno', 'almuerzo', 'cena', 'snack'])).default([]),
  dietTypes: z.array(z.enum(['ninguna', 'mediterranea', 'dash', 'ayuno_intermitente', 'alta_proteina'])).default([]),
  goalTypes: z.array(z.string().min(1)).max(12).default([]),
  ingredients: z.array(
    z.object({
      name: z.string().min(1),
      quantity: z.number().positive(),
      unit: z.string().min(1),
    })
  ).min(1),
});

export const bulkUpdateRecipeEditorialSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  editorialOverrideStatus: z.enum(['ready', 'review', 'needs_work']),
  editorialNotes: z.string().max(4000).nullable().optional(),
});

// Validador para generación de entrenamientos
export const generateWorkoutSchema = z.object({
  workoutType: z.enum(['strength', 'cardio', 'hiit', 'flexibility', 'full_body']),
  duration: z.number().int().min(10).max(180), // 10 a 180 minutos
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
  trainingEnvironment: z.enum(['gym', 'home', 'outdoor']),
  targetMuscles: z.array(z.string()).optional(),
  equipment: z.array(z.string()).optional(),
  age: z.number().int().min(14).max(100).optional(),
  sex: z.enum(['male', 'female']).optional(),
});

// Validador para generación de planes de comida
export const generateMealPlanSchema = z.object({
  goal: z.string().optional(),
  difficulty: z.enum(['facil', 'medio', 'dificil']).optional(),
  dietType: z.enum(['ninguna', 'mediterranea', 'dash', 'ayuno_intermitente', 'alta_proteina']).optional(),
  maxIngredients: z.number().int().min(1).max(20).optional(),
  includeIngredients: z.array(z.string()).optional(),
  dietaryRestrictions: z.array(z.string()).optional(),
  age: z.number().int().min(14).max(100).optional(),
  sex: z.enum(['male', 'female']).optional(),
  weightKg: z.number().positive().max(400).optional(),
  targetWeightKg: z.number().positive().max(400).optional(),
  trainingDaysPerWeek: z.number().int().min(1).max(7).optional(),
});

// Validador para logs de nutrición
export const createNutritionLogSchema = z.object({
  date: z.string().optional(),
  consumedAt: z.string().optional(),
  mealType: z.enum(['desayuno', 'almuerzo', 'cena', 'snack']),
  recipeId: z.string().uuid().optional(),
  name: z.string().optional(),
  calories: z.number().min(0),
  protein: z.number().min(0),
  carbs: z.number().min(0),
  fat: z.number().min(0),
  notes: z.string().optional(),
});

export const createFoodItemSchema = z.object({
  name: z.string().trim().min(1).max(160),
  brand: z.string().trim().min(1).max(120).nullable().optional(),
  barcode: z.string().trim().min(3).max(80).nullable().optional(),
  servingSizeG: z.number().positive().max(5000),
  calories: z.number().min(0).max(5000),
  protein: z.number().min(0).max(1000),
  carbs: z.number().min(0).max(1000),
  fat: z.number().min(0).max(1000),
  fiber: z.number().min(0).max(200).optional(),
});

export const listFoodItemsQuerySchema = z.object({
  query: z.string().trim().min(1).max(120).optional(),
  limit: z.coerce.number().int().min(1).max(50).optional(),
});

export const upsertNutritionTargetSchema = z.object({
  calories: z.number().positive().max(10000),
  protein: z.number().min(0).max(1000),
  carbs: z.number().min(0).max(1500),
  fat: z.number().min(0).max(1000),
  fiber: z.number().min(0).max(200),
  goal: z.enum(['lose_weight', 'build_muscle', 'recomposition', 'maintain']),
});

export const createMealLogSchema = z.object({
  mealType: z.enum(['desayuno', 'almuerzo', 'cena', 'snack']),
  consumedAt: z.string().datetime().optional(),
  foodItemId: z.string().uuid().optional(),
  quantityG: z.number().positive().max(10000).optional(),
  name: z.string().trim().min(1).max(160).optional(),
  calories: z.number().min(0).max(10000).optional(),
  protein: z.number().min(0).max(1000).optional(),
  carbs: z.number().min(0).max(1500).optional(),
  fat: z.number().min(0).max(1000).optional(),
  fiber: z.number().min(0).max(200).optional(),
  notes: z.string().max(1000).optional(),
}).refine((value) => value.foodItemId || value.name, {
  message: 'Either foodItemId or name is required',
});

export const listMealLogsQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export const createSmartMealPlanSchema = z.object({
  weekStart: z.string().datetime().optional(),
});

export const listRecipesQuerySchema = z.object({
  query: z.string().min(1).optional(),
  mealType: z.enum(['desayuno', 'almuerzo', 'cena', 'snack']).optional(),
  dietType: z.enum(['ninguna', 'mediterranea', 'dash', 'ayuno_intermitente', 'alta_proteina']).optional(),
  goalType: z.string().min(1).optional(),
  source: z.enum(['system', 'ai', 'user']).optional(),
  scope: z.enum(['all', 'mine', 'public']).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
  offset: z.coerce.number().int().min(0).optional(),
});

export const replaceMealRecipeSchema = z.object({
  recipeId: z.string().uuid(),
  reason: z.string().max(500).nullable().optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>;
export type SendCoachMessageInput = z.infer<typeof sendCoachMessageSchema>;
export type UpdateSocialPrivacyInput = z.infer<typeof updateSocialPrivacySchema>;
export type CreateFoodItemInput = z.infer<typeof createFoodItemSchema>;
export type ListFoodItemsQueryInput = z.infer<typeof listFoodItemsQuerySchema>;
export type UpsertNutritionTargetInput = z.infer<typeof upsertNutritionTargetSchema>;
export type CreateMealLogInput = z.infer<typeof createMealLogSchema>;
export type ListMealLogsQueryInput = z.infer<typeof listMealLogsQuerySchema>;
export type CreateSmartMealPlanInput = z.infer<typeof createSmartMealPlanSchema>;
export type CreateSessionInput = z.infer<typeof createSessionSchema>;
export type CreateMeasurementInput = z.infer<typeof createMeasurementSchema>;
export type UpdateMeasurementInput = z.infer<typeof updateMeasurementSchema>;
export type CreateExerciseInput = z.infer<typeof createExerciseSchema>;
export type UpdateExerciseInput = z.infer<typeof updateExerciseSchema>;
export type UpdateExerciseEditorialInput = z.infer<typeof updateExerciseEditorialSchema>;
export type BulkUpdateExerciseEditorialInput = z.infer<typeof bulkUpdateExerciseEditorialSchema>;
export type GenerateWorkoutInput = z.infer<typeof generateWorkoutSchema>;
export type GenerateMealPlanInput = z.infer<typeof generateMealPlanSchema>;
export type CreateNutritionLogInput = z.infer<typeof createNutritionLogSchema>;
export type CreateProductEventInput = z.infer<typeof createProductEventSchema>;
export type UpdateRecipeInput = z.infer<typeof updateRecipeSchema>;
export type CreateRecipeInput = z.infer<typeof createRecipeSchema>;
export type BulkUpdateRecipeEditorialInput = z.infer<typeof bulkUpdateRecipeEditorialSchema>;
export type ListRecipesQueryInput = z.infer<typeof listRecipesQuerySchema>;
export type ReplaceMealRecipeInput = z.infer<typeof replaceMealRecipeSchema>;
