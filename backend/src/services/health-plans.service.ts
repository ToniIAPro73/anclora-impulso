import { randomUUID } from 'crypto';
import { prisma } from '../config/database';
import {
  getAdaptation,
  getPhaseForWeek,
  HEALTH_PLAN_PHASES,
  HEALTH_PLAN_PILLARS,
  isInCohort,
  RUTA_VITAL_KEY,
  type SafetyCategory,
  classifySafety,
} from './health-plans.domain';
import type { HealthPlanOnboardingInput } from '../utils/health-plans.validators';
import { AppError } from '../middleware/errorHandler';

const actionDefinitions = [
  { key: 'strength_session', pillar: 'FORCE', type: 'workout', route: '/workouts/generate', titleEs: 'Haz una sesión breve de fuerza', titleEn: 'Do a short strength session', descriptionEs: 'Usa el entrenamiento existente y adapta la intensidad a tu día.', descriptionEn: 'Use the existing workout flow and adapt intensity to your day.', minimumEligible: true },
  { key: 'movement_break', pillar: 'MOVEMENT', type: 'movement', route: '/progress', titleEs: 'Acumula movimiento suave', titleEn: 'Accumulate gentle movement', descriptionEs: 'Elige una caminata o una pausa activa que puedas sostener.', descriptionEn: 'Choose a walk or active break you can sustain.', minimumEligible: true },
  { key: 'nutrition_anchor', pillar: 'NUTRITION', type: 'nutrition', route: '/nutrition', titleEs: 'Completa un ancla de nutrición', titleEn: 'Complete one nutrition anchor', descriptionEs: 'Revisa tu módulo de nutrición y elige una acción sencilla.', descriptionEn: 'Review nutrition and choose one simple action.', minimumEligible: true },
  { key: 'recovery_anchor', pillar: 'RECOVERY', type: 'recovery', route: '/progress', titleEs: 'Protege tu recuperación', titleEn: 'Protect your recovery', descriptionEs: 'Mantén una hora de despertar estable y observa cómo te sientes.', descriptionEn: 'Keep a consistent wake time and notice how you feel.', minimumEligible: true },
];

async function ensureRutaVitalDefinition() {
  const existingDefinition = await prisma.healthPlanDefinition.findUnique({ where: { key: RUTA_VITAL_KEY } });
  if (existingDefinition?.status === 'published') return existingDefinition;

  const definition = await prisma.healthPlanDefinition.upsert({
    where: { key: RUTA_VITAL_KEY },
    update: { status: 'published', version: 1 },
    create: {
      id: randomUUID(), key: RUTA_VITAL_KEY, nameEs: 'Ruta Vital 50–60', nameEn: 'Vital Path 50–60',
      descriptionEs: 'Una ruta progresiva para fuerza, movimiento, nutrición, recuperación y continuidad.',
      descriptionEn: 'A progressive path for strength, movement, nutrition, recovery and continuity.',
      minAge: 50, maxAge: 60, status: 'published', version: 1,
    },
  });

  for (const [index, pillar] of HEALTH_PLAN_PILLARS.entries()) {
    await prisma.healthPlanPillar.upsert({
      where: { planId_key: { planId: definition.id, key: pillar.key } },
      update: {},
      create: { id: randomUUID(), planId: definition.id, key: pillar.key, nameEs: pillar.nameEs, nameEn: pillar.nameEn, order: index },
    });
  }

  for (const [phaseIndex, phase] of HEALTH_PLAN_PHASES.entries()) {
    const phaseRecord = await prisma.healthPlanPhase.upsert({
      where: { planId_key: { planId: definition.id, key: phase.key } },
      update: { nameEs: phase.nameEs, nameEn: phase.nameEn, durationLabel: phase.durationLabel },
      create: { id: randomUUID(), planId: definition.id, key: phase.key, nameEs: phase.nameEs, nameEn: phase.nameEn, descriptionEs: 'Progresión flexible y sostenible.', descriptionEn: 'Flexible and sustainable progression.', order: phaseIndex, durationLabel: phase.durationLabel },
    });
    const weekNumber = phaseIndex === 0 ? 1 : phaseIndex === 1 ? 5 : phaseIndex === 2 ? 13 : 25;
    const week = await prisma.healthPlanWeek.upsert({
      where: { phaseId_weekNumber: { phaseId: phaseRecord.id, weekNumber } },
      update: {},
      create: {
        id: randomUUID(), phaseId: phaseRecord.id, weekNumber,
        objectiveEs: phaseIndex === 0 ? 'Construir fuerza y regularidad.' : 'Avanzar manteniendo continuidad.',
        objectiveEn: phaseIndex === 0 ? 'Build strength and consistency.' : 'Progress while maintaining continuity.',
        fullVersion: { strengthSessions: 2, movementSessions: 3, nutritionAnchors: 3, recoveryAnchors: 3 },
        minimumVersion: { strengthSessions: 1, movementMinutesPerDay: 10, nutritionAnchors: 1, stableWakeTime: true },
        safetyConstraints: ['No medical clearance claims', 'Reduce intensity when safety review is recommended'],
        progressSignals: ['completed actions', 'workout continuity', 'self-reported recovery'],
      },
    });
    for (const [order, action] of actionDefinitions.entries()) {
      await prisma.healthPlanAction.upsert({
        where: { weekId_key: { weekId: week.id, key: action.key } },
        update: { titleEs: action.titleEs, titleEn: action.titleEn, route: action.route },
        create: { id: randomUUID(), weekId: week.id, key: action.key, pillar: action.pillar, titleEs: action.titleEs, titleEn: action.titleEn, descriptionEs: action.descriptionEs, descriptionEn: action.descriptionEn, actionType: action.type, route: action.route, minimumEligible: action.minimumEligible, order },
      });
    }
  }

  for (const locale of ['es', 'en']) {
    await prisma.healthPlanContentReference.upsert({
      where: { planId_key_locale: { planId: definition.id, key: 'route-principles', locale } },
      update: {},
      create: {
        id: randomUUID(), planId: definition.id, key: 'route-principles', locale,
        title: locale === 'es' ? 'Cómo funciona la ruta' : 'How the path works',
        body: locale === 'es' ? 'La ruta propone acciones educativas y de hábitos. Puedes ajustar, pausar o dejarla.' : 'The path proposes educational and habit actions. You can adjust, pause or leave it.',
        source: 'Ruta Vital content contract; source validation required before new health claims', evidenceLevel: 'GENERAL_GUIDANCE', claimType: 'BEHAVIORAL_GUIDANCE', safetyLevel: 'LOW', contentOwner: 'Anclora Product', lastReviewedAt: new Date(),
      },
    });
  }
  return definition;
}

function localized<T extends { nameEs: string; nameEn: string }>(item: T, locale: string) {
  return { ...item, name: locale === 'en' ? item.nameEn : item.nameEs };
}

export async function listDefinitions(locale = 'es') {
  await ensureRutaVitalDefinition();
  const definitions = await prisma.healthPlanDefinition.findMany({ where: { status: 'published' }, include: { pillars: { orderBy: { order: 'asc' } } }, orderBy: { createdAt: 'asc' } });
  return definitions.map((definition) => ({ ...definition, ...localized(definition, locale), pillars: definition.pillars.map((pillar) => localized(pillar, locale)) }));
}

export async function getEnrollment(userId: string) {
  await ensureRutaVitalDefinition();
  return prisma.healthPlanEnrollment.findFirst({
    where: { userId, plan: { key: RUTA_VITAL_KEY } },
    include: {
      plan: {
        include: {
          phases: {
            include: {
              weeks: {
                include: { actions: { orderBy: { order: 'asc' } } },
                orderBy: { weekNumber: 'asc' },
              },
            },
            orderBy: { order: 'asc' },
          },
          pillars: { orderBy: { order: 'asc' } },
        },
      },
      profile: true,
      actionStatus: true,
      weekStatus: true,
    },
  });
}

export async function enroll(userId: string) {
  const definition = await ensureRutaVitalDefinition();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { age: true } });
  if (!user || !isInCohort(user.age, definition.minAge, definition.maxAge)) {
    throw new AppError(422, 'Esta ruta está diseñada para personas de 50 a 60 años.');
  }
  return prisma.healthPlanEnrollment.upsert({ where: { userId_planId: { userId, planId: definition.id } }, update: { status: 'active', leftAt: null }, create: { id: randomUUID(), userId, planId: definition.id } });
}

export async function saveOnboarding(userId: string, input: HealthPlanOnboardingInput) {
  const enrollment = await getEnrollment(userId);
  if (!enrollment) throw new AppError(404, 'Primero debes unirte a Ruta Vital.');
  const safety = classifySafety(input.safetySignals);
  const adaptation = safety.category === 'PROFESSIONAL_REVIEW_RECOMMENDED' ? 'REDUCE' : getAdaptation({});
  const updated = await prisma.healthPlanEnrollment.update({ where: { id: enrollment.id }, data: { safetyCategory: safety.category, safetyReasonCodes: safety.reasonCodes }, include: { plan: true } });
  await prisma.healthPlanProfile.upsert({ where: { enrollmentId: enrollment.id }, update: { goal: input.goal, baselineActivity: input.baselineActivity, availableTime: input.availableTime, preferences: input.preferences, equipment: input.equipment, knownLimitations: input.knownLimitations, adaptation }, create: { id: randomUUID(), userId, enrollmentId: enrollment.id, goal: input.goal, baselineActivity: input.baselineActivity, availableTime: input.availableTime, preferences: input.preferences, equipment: input.equipment, knownLimitations: input.knownLimitations, adaptation } });
  return { ...updated, safetyCategory: safety.category as SafetyCategory, safetyReasonCodes: safety.reasonCodes, safetyMessage: safety.category === 'SELF_MANAGED' ? 'Puedes comenzar con una progresión gradual.' : 'Considera consultar a un profesional antes de aumentar la intensidad.' };
}

export async function getHome(userId: string, locale = 'es') {
  const enrollment = await getEnrollment(userId);
  if (!enrollment) return null;
  const allWeeks = enrollment.plan.phases.flatMap((phase) => phase.weeks);
  const week = allWeeks.find((candidate) => candidate.weekNumber === enrollment.currentWeek) ?? allWeeks[0];
  const statuses = new Map(enrollment.actionStatus.map((status) => [status.actionId, status]));
  const actions = week.actions.map((action) => ({ ...action, title: locale === 'en' ? action.titleEn : action.titleEs, description: locale === 'en' ? action.descriptionEn : action.descriptionEs, status: statuses.get(action.id)?.status ?? 'pending', completedAt: statuses.get(action.id)?.completedAt ?? null }));
  const completedCount = actions.filter((action) => action.status === 'completed').length;
  const nextAction = actions.find((action) => action.status !== 'completed') ?? actions[0];
  return { enrollment: { id: enrollment.id, status: enrollment.status, currentWeek: enrollment.currentWeek, safetyCategory: enrollment.safetyCategory, adaptation: enrollment.profile?.adaptation ?? 'MAINTAIN', onboardingComplete: Boolean(enrollment.profile) }, phase: localized(getPhaseForWeek(enrollment.currentWeek) as never, locale), week: { number: week.weekNumber, objective: locale === 'en' ? week.objectiveEn : week.objectiveEs, fullVersion: week.fullVersion, minimumVersion: week.minimumVersion, progress: Math.round((completedCount / Math.max(actions.length, 1)) * 100) }, actions, nextBestAction: nextAction ? { id: nextAction.id, label: nextAction.title, href: nextAction.route } : null, pillars: enrollment.plan.pillars.map((pillar) => ({ key: pillar.key, name: locale === 'en' ? pillar.nameEn : pillar.nameEs, state: actions.some((action) => action.pillar === pillar.key && action.status === 'completed') ? 'ON_TRACK' : 'NOT_ENOUGH_DATA' })) };
}

export async function completeAction(userId: string, actionId: string) {
  const enrollment = await getEnrollment(userId);
  if (!enrollment) throw new AppError(404, 'No hay una Ruta Vital activa.');
  const action = enrollment.plan.phases.flatMap((phase) => phase.weeks.flatMap((week) => week.actions)).find((candidate) => candidate.id === actionId);
  if (!action) throw new AppError(404, 'Acción no encontrada.');
  return prisma.healthPlanActionStatus.upsert({ where: { enrollmentId_actionId: { enrollmentId: enrollment.id, actionId } }, update: { status: 'completed', completedAt: new Date() }, create: { id: randomUUID(), enrollmentId: enrollment.id, actionId, status: 'completed', completedAt: new Date() } });
}

export async function updateStatus(userId: string, status: 'active' | 'paused' | 'left') {
  const enrollment = await getEnrollment(userId);
  if (!enrollment) throw new AppError(404, 'No hay una Ruta Vital activa.');
  return prisma.healthPlanEnrollment.update({ where: { id: enrollment.id }, data: { status, pausedAt: status === 'paused' ? new Date() : null, leftAt: status === 'left' ? new Date() : null } });
}
