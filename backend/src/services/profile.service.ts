import { prisma } from '../config/database';
import { noteReminderTime } from './notification-schedule.service';

export interface UserProfile {
  avatarDataUrl: string | null;
  sex: 'male' | 'female' | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  timeframeWeeks: number | null;
  trainingDaysPerWeek: number | null;
  trainingGoal: 'lose_weight' | 'build_muscle' | 'recomposition' | 'maintain' | null;
  preferredTrainingEnvironment: 'gym' | 'home' | 'outdoor' | null;
  experienceLevel: 'beginner' | 'intermediate' | 'advanced' | null;
  limitations: string[];
  onboardingCompletedAt: string | null;
  remindersEnabled: boolean;
  reminderTime: string | null;
  reminderWorkout: boolean;
  reminderNutrition: boolean;
  reminderWeeklyReview: boolean;
  reminderReactivation: boolean;
}

export interface UpdateUserProfileInput {
  avatarDataUrl?: string | null;
  sex?: 'male' | 'female' | null;
  age?: number | null;
  heightCm?: number | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  timeframeWeeks?: number | null;
  trainingDaysPerWeek?: number | null;
  trainingGoal?: 'lose_weight' | 'build_muscle' | 'recomposition' | 'maintain' | null;
  preferredTrainingEnvironment?: 'gym' | 'home' | 'outdoor' | null;
  experienceLevel?: 'beginner' | 'intermediate' | 'advanced' | null;
  limitations?: string[];
  onboardingCompletedAt?: string | null;
  remindersEnabled?: boolean;
  reminderTime?: string | null;
  reminderWorkout?: boolean;
  reminderNutrition?: boolean;
  reminderWeeklyReview?: boolean;
  reminderReactivation?: boolean;
}

function mapUserToProfile(user: {
  avatarDataUrl: string | null;
  sex: string | null;
  age: number | null;
  heightCm: number | null;
  weightKg: number | null;
  targetWeightKg: number | null;
  timeframeWeeks: number | null;
  trainingDaysPerWeek: number | null;
  trainingGoal: string | null;
  preferredTrainingEnvironment: string | null;
  experienceLevel: string | null;
  limitations: string[];
  onboardingCompletedAt: Date | null;
  remindersEnabled: boolean;
  reminderTime: string | null;
  reminderWorkout: boolean;
  reminderNutrition: boolean;
  reminderWeeklyReview: boolean;
  reminderReactivation: boolean;
}): UserProfile {
  return {
    avatarDataUrl: user.avatarDataUrl,
    sex: (user.sex as UserProfile['sex']) ?? null,
    age: user.age,
    heightCm: user.heightCm,
    weightKg: user.weightKg,
    targetWeightKg: user.targetWeightKg,
    timeframeWeeks: user.timeframeWeeks,
    trainingDaysPerWeek: user.trainingDaysPerWeek,
    trainingGoal: (user.trainingGoal as UserProfile['trainingGoal']) ?? null,
    preferredTrainingEnvironment: (user.preferredTrainingEnvironment as UserProfile['preferredTrainingEnvironment']) ?? null,
    experienceLevel: (user.experienceLevel as UserProfile['experienceLevel']) ?? null,
    limitations: user.limitations ?? [],
    onboardingCompletedAt: user.onboardingCompletedAt?.toISOString() ?? null,
    remindersEnabled: user.remindersEnabled,
    reminderTime: user.reminderTime,
    reminderWorkout: user.reminderWorkout,
    reminderNutrition: user.reminderNutrition,
    reminderWeeklyReview: user.reminderWeeklyReview,
    reminderReactivation: user.reminderReactivation,
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: {
      avatarDataUrl: true,
      sex: true,
      age: true,
      heightCm: true,
      weightKg: true,
      targetWeightKg: true,
      timeframeWeeks: true,
      trainingDaysPerWeek: true,
      trainingGoal: true,
      preferredTrainingEnvironment: true,
      experienceLevel: true,
      limitations: true,
      onboardingCompletedAt: true,
      remindersEnabled: true,
      reminderTime: true,
      reminderWorkout: true,
      reminderNutrition: true,
      reminderWeeklyReview: true,
      reminderReactivation: true,
    },
  });

  return mapUserToProfile(user);
}

export async function updateUserProfile(
  userId: string,
  input: UpdateUserProfileInput
): Promise<UserProfile> {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      avatarDataUrl: input.avatarDataUrl,
      sex: input.sex,
      age: input.age,
      heightCm: input.heightCm,
      weightKg: input.weightKg,
      targetWeightKg: input.targetWeightKg,
      timeframeWeeks: input.timeframeWeeks,
      trainingDaysPerWeek: input.trainingDaysPerWeek,
      trainingGoal: input.trainingGoal,
      preferredTrainingEnvironment: input.preferredTrainingEnvironment,
      experienceLevel: input.experienceLevel,
      limitations: input.limitations,
      onboardingCompletedAt: input.onboardingCompletedAt ? new Date(input.onboardingCompletedAt) : input.onboardingCompletedAt,
      remindersEnabled: input.remindersEnabled,
      reminderTime: input.reminderTime,
      reminderWorkout: input.reminderWorkout,
      reminderNutrition: input.reminderNutrition,
      reminderWeeklyReview: input.reminderWeeklyReview,
      reminderReactivation: input.reminderReactivation,
    },
    select: {
      avatarDataUrl: true,
      sex: true,
      age: true,
      heightCm: true,
      weightKg: true,
      targetWeightKg: true,
      timeframeWeeks: true,
      trainingDaysPerWeek: true,
      trainingGoal: true,
      preferredTrainingEnvironment: true,
      experienceLevel: true,
      limitations: true,
      onboardingCompletedAt: true,
      remindersEnabled: true,
      reminderTime: true,
      reminderWorkout: true,
      reminderNutrition: true,
      reminderWeeklyReview: true,
      reminderReactivation: true,
    },
  });

  noteReminderTime(user.remindersEnabled, user.reminderTime);
  return mapUserToProfile(user);
}
