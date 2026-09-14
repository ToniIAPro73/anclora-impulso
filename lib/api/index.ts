import type { UserProfile } from '@/lib/user-profile';
import { apiClient } from './client';

// ========== TYPES ==========

export interface Exercise {
  id: string;
  name: string;
  category: string;
  muscleGroup: string;
  equipment: string;
  trainingEnvironments: Array<'gym' | 'home' | 'outdoor'>;
  difficulty: string;
  description: string;
  instructions: string[];
  imageUrl?: string | null;
  videoUrl?: string | null;
  editorial?: {
    qualityScore: number;
    editorialStatus: 'ready' | 'review' | 'needs_work';
    autoEditorialStatus?: 'ready' | 'review' | 'needs_work';
    editorialNotes?: string | null;
    checks: {
      hasDescription: boolean;
      hasEnoughInstructions: boolean;
      hasEnvironment: boolean;
      hasImage: boolean;
      hasDifficulty: boolean;
    };
  };
  createdAt: string;
  updatedAt: string;
}

export interface ExercisesResponse {
  data: Exercise[];
  pagination?: {
    page: number;
    limit: number;
    total: number;
    pages: number;
    hasMore: boolean;
  };
}

export interface HealthPlanDefinition {
  id: string;
  key: string;
  name: string;
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  minAge: number;
  maxAge: number;
  status: string;
  pillars: Array<{ key: string; name: string; nameEs: string; nameEn: string }>;
}

export interface HealthPlanHome {
  enrollment: { id: string; status: string; currentWeek: number; safetyCategory: string; adaptation: string; onboardingComplete: boolean };
  phase: { key: string; name: string; durationLabel: string };
  week: { number: number; objective: string; fullVersion: Record<string, number | boolean>; minimumVersion: Record<string, number | boolean>; progress: number };
  actions: Array<{ id: string; key: string; pillar: string; title: string; description: string; route: string | null; status: string; completedAt: string | null }>;
  nextBestAction: { id: string; label: string; href: string | null } | null;
  pillars: Array<{ key: string; name: string; state: string }>;
}

export interface HealthPlanOnboardingInput {
  goal: 'strength' | 'energy' | 'body_composition' | 'mobility' | 'endurance' | 'general_health';
  baselineActivity: 'low' | 'some' | 'irregular' | 'active';
  availableTime: '15' | '30' | '45_60';
  preferences: string[];
  equipment: string[];
  knownLimitations: string[];
  safetySignals: string[];
}

export interface EditorialSummary {
  total: number;
  averageQualityScore: number;
  byStatus: {
    ready: number;
    review: number;
    needs_work: number;
  };
  exercises: Exercise[];
}

export interface RecipeEditorialSummary {
  total: number;
  averageQualityScore: number;
  byStatus: {
    ready: number;
    review: number;
    needs_work: number;
  };
  recipes: Recipe[];
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  sets: number;
  reps: number;
  rest: number;
  order: number;
  exercise: Exercise;
}

export interface RecommendationExplanation {
  headline: string;
  summary: string;
  reasons: string[];
  signals?: Array<{
    label: string;
    value: string;
  }>;
  nextBestAction?: {
    label: string;
    href: string;
  };
  adjustment?: string;
  focusMuscles?: string[];
  averageRest?: number | null;
}

export interface EngagementNudge {
  id: string;
  kind: 'onboarding' | 'workout' | 'nutrition' | 'weekly_review' | 'reactivation';
  priority: 'high' | 'medium' | 'low';
  href: string;
  context?: Record<string, string | number | boolean | null>;
}

export interface NotificationDelivery {
  id: string;
  kind: string;
  channel: string;
  status: 'pending' | 'sent' | 'failed';
  subject: string;
  body: string;
  href?: string | null;
  failureReason?: string | null;
  createdAt: string;
  sentAt?: string | null;
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  exercises: WorkoutExercise[];
  explanation?: RecommendationExplanation;
}

export interface SessionSet {
  reps: number;
  weight: number;
  rir?: number | null;
  rpe?: number | null;
  restSeconds?: number | null;
  order: number;
}

export interface SessionExercise {
  exerciseId: string;
  sets: SessionSet[];
}

export interface WorkoutSession {
  id: string;
  userId: string;
  workoutId: string;
  completedAt: string;
  duration: number;
  notes?: string;
  workout: {
    id: string;
    name: string;
  };
  exercises: {
    exercise: {
      id: string;
      name: string;
      muscleGroup: string;
    };
    sets: SessionSet[];
  }[];
}

export interface BodyMeasurement {
  id: string;
  userId: string;
  date: string;
  weight?: number;
  bodyFat?: number;
  chest?: number;
  waist?: number;
  hips?: number;
  arms?: number;
  thighs?: number;
}

export interface ProgressStats {
  totalWorkouts: number;
  workoutsThisWeek: number;
  workoutsThisMonth: number;
  totalDuration: number;
  avgDuration: number;
  personalRecords: Array<{
    exercise_id: string;
    exercise_name: string;
    max_weight: number;
    date: string;
  }>;
}

export interface StrengthProgress {
  totalVolume: number;
  personalRecords: Array<{
    id: string;
    exerciseId: string;
    exerciseName: string;
    muscleGroup: string;
    maxWeight: number;
    bestEstimatedOneRepMax: number;
    reps: number;
    weight: number;
    achievedAt: string;
  }>;
  muscleVolume: Array<{
    muscleGroup: string;
    totalVolume: number;
    setCount: number;
  }>;
  recentSets: Array<{
    sessionId: string;
    completedAt: string;
    exerciseId: string;
    exerciseName: string;
    muscleGroup: string;
    reps: number;
    weight: number;
    rir: number | null;
    rpe: number | null;
    restSeconds: number | null;
    estimatedOneRepMax: number;
    volume: number;
  }>;
}

export interface ProgressionSessionPlan {
  generatedAt: string;
  prescriptions: Array<{
    exerciseId: string;
    weight: number;
    repRange: { minReps: number; maxReps: number };
    sets: number;
    targetRIR: number;
    focus: 'STRENGTH' | 'HYPERTROPHY' | 'ENDURANCE';
    action: 'increase_load' | 'maintain' | 'deload';
    freshnessScore: number;
    recoveryAction: 'normal' | 'prioritize' | 'substitute_or_reduce';
    reasons: string[];
    deload: {
      shouldDeload: boolean;
      reason: 'none' | 'stall' | 'scheduled';
    };
  }>;
}

export interface GenerateNextSessionPayload {
  now?: string;
  weekIndex?: number;
  sessionIndex?: number;
  plannedExercises: Array<{
    exerciseId: string;
    sets: number;
    currentWeight?: number;
    targetRepRange?: { minReps: number; maxReps: number };
    exercisePattern: 'lower_compound' | 'upper_compound' | 'isolation';
    primaryMuscle?: string;
    lastVolume?: number;
    sessionResult?: {
      reps: number[];
      averageRir: number;
    };
  }>;
}

export interface CoachMessagePayload {
  conversationId?: string;
  message: string;
}

export interface CoachMessageResponse {
  conversationId: string;
  answer: string;
  provider: 'groq' | 'deterministic' | 'guardrail';
  model: string;
  cached: boolean;
  safety: {
    withinScope: boolean;
    escalatedToProfessional: boolean;
    flags: string[];
  };
  usage: {
    estimatedInputTokens: number;
    estimatedOutputTokens: number;
    estimatedTotalTokens: number;
    remainingWindowRequests: number;
  };
}

export interface SocialFeedItem {
  id: string;
  userId: string;
  userName: string;
  type: 'workout_completed';
  content: string;
  sourceType: string | null;
  sourceId: string | null;
  visibility: 'public' | 'private';
  metadata: Record<string, unknown> | null;
  createdAt: string;
  kudosCount: number;
  hasKudosFromMe: boolean;
}

export interface SocialFeedResponse {
  items: SocialFeedItem[];
}

export interface Challenge {
  id: string;
  key: string;
  title: string;
  metric: 'workout_completions';
  startsAt: string;
  endsAt: string;
}

export interface ChallengeLeaderboard {
  entries: Array<{
    rank: number;
    userId: string;
    userName: string;
    score: number;
    joinedAt: string;
  }>;
}

export interface FoodItem {
  id: string;
  name: string;
  brand: string | null;
  barcode: string | null;
  servingSizeG: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  source: string;
  verified: boolean;
}

export interface NutritionTarget {
  id: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  goal: 'lose_weight' | 'build_muscle' | 'recomposition' | 'maintain';
}

export interface MealLog {
  id: string;
  foodItemId: string | null;
  mealType: 'desayuno' | 'almuerzo' | 'cena' | 'snack';
  consumedAt: string;
  quantityG: number | null;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  notes: string | null;
}

export interface SmartMealPlan {
  id: string;
  userId: string;
  weekStart: string;
  goal: string;
  targetCalories: number;
  targetProtein: number;
  targetCarbs: number;
  targetFat: number;
  targetFiber: number;
  strategy: 'target_aligned';
}

export interface HealthImportStatus {
  enabled: boolean;
  providers: Array<{
    provider: 'google_fit' | 'health_connect';
    available: boolean;
  }>;
}

export type WearableProvider = 'healthkit' | 'health_connect' | 'garmin' | 'whoop' | 'oura';
export type RecoveryProvider = WearableProvider | 'manual';

export interface WearableStatus {
  enabled: boolean;
  readinessEnabled: boolean;
  tractionGate: 'blocked_until_d30_retention_validated';
  mobileStrategy: string;
  providers: Array<{
    provider: WearableProvider;
    available: boolean;
    supportsBidirectionalSync: boolean;
  }>;
  pushNotifications: {
    available: boolean;
    strategy: string;
  };
}

export interface WearableConnection {
  id: string;
  userId: string;
  provider: WearableProvider;
  status: 'connected' | 'paused' | 'revoked';
  syncDirection: 'import_only' | 'export_only' | 'bidirectional';
  scopes: Array<'heart_rate' | 'sleep' | 'activity' | 'hrv'>;
  lastSyncAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RecoverySample {
  id: string;
  userId: string;
  provider: RecoveryProvider;
  recordedAt: string;
  hrvMs: number | null;
  restingHeartRateBpm: number | null;
  sleepMinutes: number | null;
  activityMinutes: number | null;
  readinessScore: number;
  createdAt: string;
}

export interface WearableReadiness {
  enabled: boolean;
  latest: RecoverySample | null;
}

export type SubscriptionTier = 'free' | 'premium' | 'pro';

export interface PremiumStatus {
  subscriptionTier: SubscriptionTier;
  premiumEntitled: boolean;
  features: {
    formAnalysis: {
      enabled: boolean;
      available: boolean;
      mode: 'async_contract';
    };
    voiceCoach: {
      enabled: boolean;
      available: boolean;
      mode: 'script_only';
    };
  };
}

export interface FormAnalysisRequest {
  id: string;
  userId: string;
  exerciseName: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  feedback: string[];
  disclaimer: string;
  clientAnalysis?: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface VoiceCueSession {
  id: string;
  userId: string;
  workoutSessionId: string | null;
  exerciseName: string;
  phase: 'warmup' | 'working_set' | 'rest' | 'cooldown';
  intensity: 'easy' | 'moderate' | 'hard';
  locale: string;
  provider: 'deterministic';
  audioStatus: 'script_only';
  cues: string[];
  disclaimer: string;
  createdAt: string;
}

export interface CompleteProgress {
  stats: ProgressStats;
  strength: StrengthProgress;
  measurements: BodyMeasurement[];
  charts: {
    weight: Array<{ date: string; weight: number }>;
    bodyFat: Array<{ date: string; bodyFat: number }>;
    frequency: Array<{ week: string; count: number }>;
  };
  insights: {
    profileCompletion: number;
    missingProfileFields: string[];
    weeklyTarget: number | null;
    workoutsLast7Days: number;
    workoutsLast28Days: number;
    adherenceRate: number | null;
    nutritionLogDaysLast7: number;
    nutritionConsistencyRate: number | null;
    weightTrend: {
      direction: 'up' | 'down' | 'stable' | 'insufficient_data';
      deltaKg: number | null;
    };
    stagnationRisk: 'low' | 'medium' | 'high';
    workoutAdjustment: 'reduce' | 'maintain' | 'increase';
    nutritionAdjustment: 'reduce' | 'maintain' | 'increase';
    preferredMuscleGroups: string[];
    averageSessionDuration: number | null;
    explanation?: RecommendationExplanation;
  };
}

export type ProfilePayload = Omit<UserProfile, 'recommendedPlan'>;

// ========== EXERCISES API ==========

export const exercisesApi = {
  async getAll(filters?: {
    category?: string;
    muscleGroup?: string;
    equipment?: string;
    environment?: string;
    difficulty?: string;
    search?: string;
    page?: number;
    limit?: number;
  }): Promise<Exercise[] | ExercisesResponse> {
    const params = new URLSearchParams();
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          params.append(key, String(value));
        }
      });
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiClient.get<Exercise[]>(`/exercises${query}`);
  },

  async getById(id: string): Promise<Exercise> {
    return apiClient.get<Exercise>(`/exercises/${id}`);
  },

  async getCategories(): Promise<string[]> {
    return apiClient.get<string[]>('/exercises/meta/categories');
  },

  async getMuscleGroups(): Promise<string[]> {
    return apiClient.get<string[]>('/exercises/meta/muscle-groups');
  },

  async getEquipment(): Promise<string[]> {
    return apiClient.get<string[]>('/exercises/meta/equipment');
  },

  async getEditorialSummary(): Promise<EditorialSummary> {
    return apiClient.get<EditorialSummary>('/exercises/editorial/summary');
  },

  async bulkUpdateEditorial(data: {
    ids: string[];
    editorialOverrideStatus: 'ready' | 'review' | 'needs_work';
    editorialNotes?: string | null;
  }): Promise<Exercise[]> {
    return apiClient.post<Exercise[]>('/exercises/editorial/bulk-update', data);
  },

  async create(data: {
    name: string;
    category: string;
    muscleGroup: string;
    equipment: string;
    trainingEnvironments: Array<'gym' | 'home' | 'outdoor'>;
    difficulty: string;
    description: string;
    instructions: string[];
  }): Promise<Exercise> {
    return apiClient.post<Exercise>('/exercises', data);
  },

  async update(id: string, data: Partial<{
    name: string;
    category: string;
    muscleGroup: string;
    equipment: string;
    trainingEnvironments: Array<'gym' | 'home' | 'outdoor'>;
    difficulty: string;
    description: string;
    instructions: string[];
    editorialOverrideStatus: 'ready' | 'review' | 'needs_work' | null;
    editorialNotes: string | null;
  }>): Promise<Exercise> {
    return apiClient.put<Exercise>(`/exercises/${id}`, data);
  },
};

// ========== WORKOUTS API ==========

export const workoutsApi = {
  async getAll(): Promise<Workout[]> {
    return apiClient.get<Workout[]>('/workouts');
  },

  async getById(id: string): Promise<Workout> {
    return apiClient.get<Workout>(`/workouts/${id}`);
  },

  async create(data: {
    name: string;
    exercises: Array<{
      exerciseId: string;
      sets: number;
      reps: number;
      rest: number;
      order: number;
    }>;
  }): Promise<Workout> {
    return apiClient.post<Workout>('/workouts', data);
  },

  async update(
    id: string,
    data: Partial<{
      name: string;
      exercises: Array<{
        exerciseId: string;
        sets: number;
        reps: number;
        rest: number;
        order: number;
      }>;
    }>
  ): Promise<Workout> {
    return apiClient.put<Workout>(`/workouts/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(`/workouts/${id}`);
  },

  async generate(params: {
    workoutType: 'strength' | 'cardio' | 'hiit' | 'flexibility' | 'full_body';
    duration: number;
    difficulty: 'beginner' | 'intermediate' | 'advanced';
    trainingEnvironment: 'gym' | 'home' | 'outdoor';
    targetMuscles?: string[];
    equipment?: string[];
    age?: number;
    sex?: 'male' | 'female';
  }): Promise<Workout> {
    return apiClient.post<Workout>('/workouts/generate', params);
  },
};

// ========== SESSIONS API ==========

export const sessionsApi = {
  async getAll(limit?: number): Promise<WorkoutSession[]> {
    const query = limit ? `?limit=${limit}` : '';
    return apiClient.get<WorkoutSession[]>(`/sessions${query}`);
  },

  async getById(id: string): Promise<WorkoutSession> {
    return apiClient.get<WorkoutSession>(`/sessions/${id}`);
  },

  async create(data: {
    workoutId: string;
    duration: number;
    notes?: string;
    exercises: SessionExercise[];
  }): Promise<WorkoutSession> {
    return apiClient.post<WorkoutSession>('/sessions', data);
  },

  async update(
    id: string,
    data: Partial<{
      duration: number;
      notes?: string;
    }>
  ): Promise<WorkoutSession> {
    return apiClient.put<WorkoutSession>(`/sessions/${id}`, data);
  },

  async delete(id: string): Promise<void> {
    return apiClient.delete(`/sessions/${id}`);
  },
};

// ========== PROGRESS API ==========

export const progressApi = {
  async getStats(): Promise<ProgressStats> {
    return apiClient.get<ProgressStats>('/progress/stats');
  },

  async getStrength(): Promise<StrengthProgress> {
    return apiClient.get<StrengthProgress>('/progress/strength');
  },

  async getComplete(): Promise<CompleteProgress> {
    return apiClient.get<CompleteProgress>('/progress/complete');
  },

  async getMeasurements(): Promise<BodyMeasurement[]> {
    return apiClient.get<BodyMeasurement[]>('/progress/measurements');
  },

  async createMeasurement(data: {
    date?: string;
    weight?: number;
    bodyFat?: number;
    chest?: number;
    waist?: number;
    hips?: number;
    arms?: number;
    thighs?: number;
  }): Promise<BodyMeasurement> {
    return apiClient.post<BodyMeasurement>('/progress/measurements', data);
  },

  async updateMeasurement(
    id: string,
    data: Partial<{
      date?: string;
      weight?: number;
      bodyFat?: number;
      chest?: number;
      waist?: number;
      hips?: number;
      arms?: number;
      thighs?: number;
    }>
  ): Promise<BodyMeasurement> {
    return apiClient.put<BodyMeasurement>(`/progress/measurements/${id}`, data);
  },

  async deleteMeasurement(id: string): Promise<void> {
    return apiClient.delete(`/progress/measurements/${id}`);
  },
};

export const progressionApi = {
  async getNextSession(data: GenerateNextSessionPayload): Promise<ProgressionSessionPlan> {
    return apiClient.post<ProgressionSessionPlan>('/v1/progression/next-session', data);
  },
};

export const coachApi = {
  async sendMessage(data: CoachMessagePayload): Promise<CoachMessageResponse> {
    return apiClient.post<CoachMessageResponse>('/v1/coach/messages', data);
  },
};

export const socialApi = {
  async updatePrivacy(visibility: 'public' | 'private'): Promise<{ userId: string; visibility: string }> {
    return apiClient.put<{ userId: string; visibility: string }>('/social/privacy', { visibility });
  },

  async getFeed(): Promise<SocialFeedResponse> {
    return apiClient.get<SocialFeedResponse>('/social/feed');
  },

  async follow(userId: string): Promise<void> {
    return apiClient.post<void>(`/social/follows/${userId}`, {});
  },

  async unfollow(userId: string): Promise<void> {
    return apiClient.delete<void>(`/social/follows/${userId}`);
  },

  async addKudos(feedItemId: string): Promise<void> {
    return apiClient.post<void>(`/social/feed/${feedItemId}/kudos`, {});
  },

  async removeKudos(feedItemId: string): Promise<void> {
    return apiClient.delete<void>(`/social/feed/${feedItemId}/kudos`);
  },

  async getWeeklyChallenge(): Promise<Challenge> {
    return apiClient.get<Challenge>('/social/challenges/weekly');
  },

  async joinChallenge(challengeId: string): Promise<void> {
    return apiClient.post<void>(`/social/challenges/${challengeId}/join`, {});
  },

  async getChallengeLeaderboard(challengeId: string): Promise<ChallengeLeaderboard> {
    return apiClient.get<ChallengeLeaderboard>(`/social/challenges/${challengeId}/leaderboard`);
  },
};

export const smartNutritionApi = {
  async searchFoods(query?: string): Promise<{ items: FoodItem[] }> {
    const suffix = query ? `?query=${encodeURIComponent(query)}` : '';
    return apiClient.get<{ items: FoodItem[] }>(`/nutrition/foods${suffix}`);
  },

  async createFood(data: Omit<FoodItem, 'id' | 'source' | 'verified'>): Promise<FoodItem> {
    return apiClient.post<FoodItem>('/nutrition/foods', data);
  },

  async getTarget(): Promise<NutritionTarget | null> {
    return apiClient.get<NutritionTarget | null>('/nutrition/targets');
  },

  async upsertTarget(data: Omit<NutritionTarget, 'id'>): Promise<NutritionTarget> {
    return apiClient.put<NutritionTarget>('/nutrition/targets', data);
  },

  async createMealLog(data: Partial<MealLog> & { mealType: MealLog['mealType'] }): Promise<MealLog> {
    return apiClient.post<MealLog>('/nutrition/meal-logs', data);
  },

  async getMealLogs(date?: string): Promise<{ items: MealLog[] }> {
    const suffix = date ? `?date=${encodeURIComponent(date)}` : '';
    return apiClient.get<{ items: MealLog[] }>(`/nutrition/meal-logs${suffix}`);
  },

  async createSmartMealPlan(data: { weekStart?: string } = {}): Promise<SmartMealPlan> {
    return apiClient.post<SmartMealPlan>('/nutrition/meal-plans/smart', data);
  },

  async getHealthImportStatus(): Promise<HealthImportStatus> {
    return apiClient.get<HealthImportStatus>('/nutrition/health-import/status');
  },
};

export const wearablesApi = {
  async getStatus(): Promise<WearableStatus> {
    return apiClient.get<WearableStatus>('/wearables/status');
  },

  async upsertConnection(
    provider: WearableProvider,
    data: {
      status: WearableConnection['status'];
      syncDirection: WearableConnection['syncDirection'];
      scopes?: WearableConnection['scopes'];
    }
  ): Promise<WearableConnection> {
    return apiClient.put<WearableConnection>(`/wearables/connections/${provider}`, data);
  },

  async createRecoverySample(data: {
    provider: RecoveryProvider;
    recordedAt: string;
    hrvMs?: number;
    restingHeartRateBpm?: number;
    sleepMinutes?: number;
    activityMinutes?: number;
    payload?: Record<string, unknown>;
  }): Promise<RecoverySample> {
    return apiClient.post<RecoverySample>('/wearables/recovery-samples', data);
  },

  async getReadiness(): Promise<WearableReadiness> {
    return apiClient.get<WearableReadiness>('/wearables/readiness');
  },
};

export const premiumApi = {
  async getStatus(): Promise<PremiumStatus> {
    return apiClient.get<PremiumStatus>('/premium/status');
  },

  async createFormAnalysis(data: {
    exerciseName: string;
    mediaType: 'image' | 'video';
    mediaUrl: string;
    clientAnalysis?: Record<string, unknown>;
  }): Promise<FormAnalysisRequest> {
    return apiClient.post<FormAnalysisRequest>('/premium/form-analysis', data);
  },

  async createVoiceCues(data: {
    workoutSessionId?: string;
    exerciseName: string;
    phase: VoiceCueSession['phase'];
    intensity: VoiceCueSession['intensity'];
    locale?: string;
  }): Promise<VoiceCueSession> {
    return apiClient.post<VoiceCueSession>('/premium/voice-cues', data);
  },
};

export const profileApi = {
  async get(): Promise<ProfilePayload> {
    return apiClient.get<ProfilePayload>('/profile');
  },

  async update(data: Partial<ProfilePayload>): Promise<ProfilePayload> {
    return apiClient.put<ProfilePayload>('/profile', data);
  },
};

export const eventsApi = {
  async track(data: {
    action: string;
    category: string;
    source?: string;
    metadata?: Record<string, unknown>;
  }) {
    return apiClient.post('/events', data);
  },

  async getSummary(): Promise<{
    totalLast28Days: number;
    last7Days: Array<{ action: string; count: number }>;
    topActions: Array<{ action: string; category: string; count: number }>;
    topSources: Array<{ source: string | null; count: number }>;
  }> {
    return apiClient.get('/events/summary');
  },
};

export const engagementApi = {
  async getNudges(): Promise<{
    reminderTime: string | null;
    remindersEnabled: boolean;
    nudges: EngagementNudge[];
  }> {
    return apiClient.get('/engagement/nudges');
  },
  async getDeliveries(): Promise<NotificationDelivery[]> {
    return apiClient.get('/engagement/deliveries');
  },
  async dispatchNow(): Promise<{ created: number; sent: number; failed: number }> {
    return apiClient.post('/engagement/admin/dispatch-now', {});
  },
  async getRecentDeliveries(): Promise<Array<NotificationDelivery & { user: { email: string; fullName: string } }>> {
    return apiClient.get('/engagement/admin/deliveries');
  },
};

// ========== NUTRITION TYPES ==========

export interface RecipeIngredient {
  id: string;
  quantity: number;
  ingredient: {
    id: string;
    name: string;
    unit: string;
  };
}

export interface Recipe {
  id: string;
  userId?: string | null;
  name: string;
  nameEn?: string;
  description?: string;
  instructions: string[];
  prepTime?: number;
  cookTime?: number;
  servings: number;
  difficulty?: string;
  calories?: number;
  protein?: number;
  carbs?: number;
  fat?: number;
  fiber?: number;
  imageUrl?: string;
  tags: string[];
  source?: 'system' | 'ai' | 'user';
  isPublic?: boolean;
  isEditable?: boolean;
  mealTypes?: string[];
  dietTypes?: string[];
  goalTypes?: string[];
  ingredients: RecipeIngredient[];
  updatedAt: string;
  editorial?: {
    qualityScore: number;
    editorialStatus: 'ready' | 'review' | 'needs_work';
    autoEditorialStatus?: 'ready' | 'review' | 'needs_work';
    editorialNotes?: string | null;
    checks: {
      hasDescription: boolean;
      hasEnoughInstructions: boolean;
      hasImage: boolean;
      hasDifficulty: boolean;
      hasMacros: boolean;
      hasTags: boolean;
      hasIngredients: boolean;
    };
  };
}

export interface RecipeLibraryResponse {
  recipes: Recipe[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

export interface MealRecipe {
  id: string;
  recipe: Recipe;
}

export interface Meal {
  id: string;
  dayOfWeek: number;
  mealType: string;
  servingMultiplier: number;
  adjustmentReason?: string | null;
  selectedRecipeId?: string | null;
  selectedRecipe?: Recipe | null;
  recipes: MealRecipe[];
}

export interface MealPlan {
  id: string;
  userId: string;
  weekStart: string;
  goal?: string;
  dietType?: string | null;
  carryoverCaloriesApplied: number;
  createdAt: string;
  meals: Meal[];
  explanation?: RecommendationExplanation;
}

export interface NutritionLog {
  id: string;
  userId: string;
  date: string;
  consumedAt?: string | null;
  mealType: string;
  recipeId?: string;
  name?: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  notes?: string;
}

export interface NutritionSummary {
  period: 'day' | 'week';
  totals: { calories: number; protein: number; carbs: number; fat: number; count: number };
  averages: { calories: number; protein: number; carbs: number; fat: number };
  logCount: number;
  intermittentFasting: {
    enabled: boolean;
    targetFastingHours: number;
    eatingWindowHours: number | null;
    fastingHours: number | null;
    firstIntakeAt: string | null;
    lastIntakeAt: string | null;
    snackCount: number;
    exceededWindow: boolean;
    carryoverCalories: number;
  };
}

// ========== NUTRITION API ==========

export const nutritionApi = {
  async generateMealPlan(params: {
    goal?: string;
    difficulty?: 'facil' | 'medio' | 'dificil';
    dietType?: 'ninguna' | 'mediterranea' | 'dash' | 'ayuno_intermitente' | 'alta_proteina';
    maxIngredients?: number;
    includeIngredients?: string[];
    dietaryRestrictions?: string[];
    age?: number;
    sex?: 'male' | 'female';
    weightKg?: number;
    targetWeightKg?: number;
    trainingDaysPerWeek?: number;
  }): Promise<MealPlan> {
    return apiClient.post<MealPlan>('/nutrition/meal-plans/generate', params);
  },

  async getMealPlans(): Promise<MealPlan[]> {
    return apiClient.get<MealPlan[]>('/nutrition/meal-plans');
  },

  async getMealPlanById(id: string): Promise<MealPlan> {
    return apiClient.get<MealPlan>(`/nutrition/meal-plans/${id}`);
  },

  async deleteMealPlan(id: string): Promise<void> {
    return apiClient.delete(`/nutrition/meal-plans/${id}`);
  },

  async getRecipeById(id: string): Promise<Recipe> {
    return apiClient.get<Recipe>(`/nutrition/recipes/${id}`);
  },

  async listRecipes(params?: {
    query?: string;
    mealType?: 'desayuno' | 'almuerzo' | 'cena' | 'snack';
    dietType?: 'ninguna' | 'mediterranea' | 'dash' | 'ayuno_intermitente' | 'alta_proteina';
    goalType?: string;
    source?: 'system' | 'ai' | 'user';
    scope?: 'all' | 'mine' | 'public';
    limit?: number;
    offset?: number;
  }): Promise<RecipeLibraryResponse> {
    const searchParams = new URLSearchParams();

    Object.entries(params ?? {}).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        searchParams.set(key, String(value));
      }
    });

    const suffix = searchParams.toString() ? `?${searchParams.toString()}` : '';
    return apiClient.get<RecipeLibraryResponse>(`/nutrition/recipes${suffix}`);
  },

  async createRecipe(
    data: {
      name: string;
      nameEn?: string | null;
      description?: string | null;
      instructions: string[];
      prepTime?: number | null;
      cookTime?: number | null;
      servings?: number;
      difficulty?: string | null;
      calories?: number | null;
      protein?: number | null;
      carbs?: number | null;
      fat?: number | null;
      fiber?: number | null;
      imageUrl?: string | null;
      tags?: string[];
      mealTypes?: Array<'desayuno' | 'almuerzo' | 'cena' | 'snack'>;
      dietTypes?: Array<'ninguna' | 'mediterranea' | 'dash' | 'ayuno_intermitente' | 'alta_proteina'>;
      goalTypes?: string[];
      ingredients: Array<{
        name: string;
        quantity: number;
        unit: string;
      }>;
    }
  ): Promise<Recipe> {
    return apiClient.post<Recipe>('/nutrition/recipes', data);
  },

  async replaceMealRecipe(
    mealId: string,
    data: {
      recipeId: string;
      reason?: string | null;
    }
  ): Promise<MealPlan> {
    return apiClient.post<MealPlan>(`/nutrition/meals/${mealId}/replace`, data);
  },

  async getRecipeEditorialSummary(): Promise<RecipeEditorialSummary> {
    return apiClient.get<RecipeEditorialSummary>('/nutrition/editorial/summary');
  },

  async updateRecipe(
    id: string,
    data: Partial<{
      name: string;
      nameEn: string | null;
      description: string | null;
      instructions: string[];
      prepTime: number | null;
      cookTime: number | null;
      difficulty: string | null;
      calories: number | null;
      protein: number | null;
      carbs: number | null;
      fat: number | null;
      fiber: number | null;
      imageUrl: string | null;
      tags: string[];
      editorialOverrideStatus: 'ready' | 'review' | 'needs_work' | null;
      editorialNotes: string | null;
    }>
  ): Promise<Recipe> {
    return apiClient.put<Recipe>(`/nutrition/recipes/${id}`, data);
  },

  async bulkUpdateRecipeEditorial(data: {
    ids: string[];
    editorialOverrideStatus: 'ready' | 'review' | 'needs_work';
    editorialNotes?: string | null;
  }): Promise<Recipe[]> {
    return apiClient.post<Recipe[]>('/nutrition/recipes/editorial/bulk-update', data);
  },

  async logNutrition(data: {
    mealType: 'desayuno' | 'almuerzo' | 'cena' | 'snack';
    recipeId?: string;
    name?: string;
    consumedAt?: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    notes?: string;
    date?: string;
  }): Promise<NutritionLog> {
    return apiClient.post<NutritionLog>('/nutrition/log', data);
  },

  async getLogs(period: 'day' | 'week' = 'day'): Promise<NutritionLog[]> {
    return apiClient.get<NutritionLog[]>(`/nutrition/logs?period=${period}`);
  },

  async getSummary(period: 'day' | 'week' = 'day'): Promise<NutritionSummary> {
    return apiClient.get<NutritionSummary>(`/nutrition/summary?period=${period}`);
  },
};

// ========== GAMIFICATION TYPES ==========

export interface GamificationStatus {
  id: string;
  userId: string;
  xp: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastActivityAt?: string;
  xpProgress: number;
  xpToNextLevel: number;
  progressPercent: number;
}

export interface Achievement {
  id: string;
  key: string;
  nameEs: string;
  nameEn: string;
  descEs: string;
  descEn: string;
  icon: string;
  xpReward: number;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface XPEvent {
  id: string;
  userId: string;
  action: string;
  xp: number;
  createdAt: string;
}

// ========== GAMIFICATION API ==========

export const gamificationApi = {
  async getStatus(): Promise<GamificationStatus> {
    return apiClient.get<GamificationStatus>('/gamification/status');
  },

  async getAchievements(): Promise<Achievement[]> {
    return apiClient.get<Achievement[]>('/gamification/achievements');
  },

  async getXPHistory(limit = 20): Promise<XPEvent[]> {
    return apiClient.get<XPEvent[]>(`/gamification/xp-history?limit=${limit}`);
  },
};

// ========== HEALTH PLANS API ==========

export const healthPlansApi = {
  async listDefinitions(locale: 'es' | 'en' = 'es'): Promise<HealthPlanDefinition[]> {
    return apiClient.get<HealthPlanDefinition[]>(`/health-plans/definitions?locale=${locale}`);
  },

  async getEnrollment(): Promise<unknown | null> {
    return apiClient.get<unknown | null>('/health-plans/enrollment');
  },

  async enroll(): Promise<{ id: string; status: string }> {
    return apiClient.post<{ id: string; status: string }>('/health-plans/enrollment');
  },

  async saveOnboarding(input: HealthPlanOnboardingInput): Promise<{ safetyCategory: string; safetyReasonCodes: string[]; safetyMessage: string }> {
    return apiClient.post('/health-plans/onboarding', input);
  },

  async getHome(locale: 'es' | 'en' = 'es'): Promise<HealthPlanHome | null> {
    return apiClient.get<HealthPlanHome | null>(`/health-plans/home?locale=${locale}`);
  },

  async completeAction(actionId: string): Promise<{ status: string }> {
    return apiClient.post(`/health-plans/actions/${actionId}/complete`);
  },

  async updateStatus(status: 'active' | 'paused' | 'left'): Promise<{ status: string }> {
    return apiClient.put('/health-plans/enrollment/status', { status });
  },
};

// Export all
export * from './auth';
export { apiClient } from './client';
