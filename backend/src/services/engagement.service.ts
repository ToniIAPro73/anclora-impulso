import { prisma } from '../config/database';
import { getPersonalizationSnapshot } from './personalization.service';

export interface EngagementNudge {
  id: string;
  kind: 'onboarding' | 'workout' | 'nutrition' | 'weekly_review' | 'reactivation';
  priority: 'high' | 'medium' | 'low';
  href: string;
  context?: Record<string, string | number | boolean | null>;
}

function comparePriority(priority: EngagementNudge['priority']) {
  switch (priority) {
    case 'high':
      return 0;
    case 'medium':
      return 1;
    default:
      return 2;
  }
}

export async function getUserNudges(userId: string): Promise<{
  reminderTime: string | null;
  remindersEnabled: boolean;
  nudges: EngagementNudge[];
}> {
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);
  const dayIndex = now.getDay();

  const [user, snapshot, latestWorkout, todaysLogCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        reminderTime: true,
        remindersEnabled: true,
        reminderWorkout: true,
        reminderNutrition: true,
        reminderWeeklyReview: true,
        reminderReactivation: true,
        onboardingCompletedAt: true,
      },
    }),
    getPersonalizationSnapshot(userId),
    prisma.workout.findFirst({
      where: { userId, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true },
    }),
    prisma.nutritionLog.count({
      where: {
        userId,
        date: {
          gte: dayStart,
          lt: dayEnd,
        },
      },
    }),
  ]);

  if (!user.remindersEnabled) {
    return {
      reminderTime: user.reminderTime,
      remindersEnabled: false,
      nudges: [],
    };
  }

  const nudges: EngagementNudge[] = [];

  if (!user.onboardingCompletedAt || snapshot.profileCompletion < 100) {
    nudges.push({
      id: 'onboarding_complete',
      kind: 'onboarding',
      priority: 'high',
      href: '/dashboard',
      context: {
        missingFieldsCount: snapshot.missingProfileFields.length,
      },
    });
  }

  if (user.reminderWorkout && latestWorkout && (snapshot.weeklyTarget ?? 0) > snapshot.workoutsLast7Days) {
    nudges.push({
      id: 'workout_pending',
      kind: 'workout',
      priority: snapshot.workoutsLast7Days === 0 ? 'high' : 'medium',
      href: `/workouts/${latestWorkout.id}/start`,
      context: {
        workoutsLast7Days: snapshot.workoutsLast7Days,
        weeklyTarget: snapshot.weeklyTarget,
      },
    });
  }

  if (user.reminderNutrition && todaysLogCount === 0) {
    nudges.push({
      id: 'nutrition_log_missing',
      kind: 'nutrition',
      priority: 'medium',
      href: '/nutrition',
      context: {
        todaysLogCount,
      },
    });
  }

  if (user.reminderWeeklyReview && (dayIndex === 0 || dayIndex >= 4) && ((snapshot.weeklyTarget ?? 0) > snapshot.workoutsLast7Days || snapshot.stagnationRisk === 'high')) {
    nudges.push({
      id: 'weekly_review',
      kind: 'weekly_review',
      priority: snapshot.stagnationRisk === 'high' ? 'high' : 'medium',
      href: '/progress',
      context: {
        stagnationRisk: snapshot.stagnationRisk,
        workoutsLast7Days: snapshot.workoutsLast7Days,
        weeklyTarget: snapshot.weeklyTarget,
      },
    });
  }

  if (user.reminderReactivation && snapshot.workoutsLast7Days === 0 && snapshot.nutritionLogDaysLast7 <= 2 && Boolean(user.onboardingCompletedAt)) {
    nudges.push({
      id: 'reactivation',
      kind: 'reactivation',
      priority: 'high',
      href: latestWorkout ? `/workouts/${latestWorkout.id}` : '/dashboard',
      context: {
        hasWorkout: Boolean(latestWorkout),
        workoutsLast7Days: snapshot.workoutsLast7Days,
        nutritionLogDaysLast7: snapshot.nutritionLogDaysLast7,
      },
    });
  }

  return {
    reminderTime: user.reminderTime,
    remindersEnabled: true,
    nudges: nudges.sort((left, right) => comparePriority(left.priority) - comparePriority(right.priority)),
  };
}
