import request from 'supertest';
import { generateAccessToken } from '../../src/utils/jwt';
import {
  AGE_BANDS,
  HEALTH_PLAN_MODALITY_BANDS,
  RUTA_VITAL_KEY,
  isInCohort,
  resolveAgeBand,
  validateAgeBands,
} from '../../src/services/health-plans.domain';
import {
  SENSITIVE_PROFILE_COLLECTION_ENABLED,
  normalizeSensitiveAttributesInput,
  sanitizeLegacyProfileWithoutInference,
  sensitiveAttributesSchema,
} from '../../src/utils/sensitive-attributes';

const definitionsFixture = [
  {
    id: 'def-rv-1',
    key: RUTA_VITAL_KEY,
    cohortKey: 'RV-50-60',
    variantKey: 'NEUTRAL',
    nameEs: 'Ruta Vital 50–60',
    nameEn: 'Vital Path 50–60',
    subtitleEs: 'Fuerza y capacidad funcional',
    subtitleEn: 'Strength and functional capacity',
    descriptionEs: 'Una ruta progresiva para fuerza, movimiento, nutrición, recuperación y continuidad.',
    descriptionEn: 'A progressive path for strength, movement, nutrition, recovery and continuity.',
    minAge: 50,
    maxAge: 60,
    status: 'published',
    version: 1,
    isActive: true,
    pillars: [{ key: 'FORCE', nameEs: 'Fuerza', nameEn: 'Strength' }],
    phases: [
      {
        key: 'FOUNDATION',
        weeks: [
          {
            weekNumber: 1,
            objectiveEs: 'Semana 1',
            objectiveEn: 'Week 1',
            fullVersion: 'Full',
            minimumVersion: 'Minimum',
            actions: [
              {
                id: 'act-1',
                pillar: 'FORCE',
                titleEs: 'Fuerza base',
                titleEn: 'Base strength',
                descriptionEs: 'Desc',
                descriptionEn: 'Desc',
                route: '/workouts',
              },
            ],
          },
        ],
      },
    ],
    createdAt: new Date('2026-11-12T00:00:00Z'),
    updatedAt: new Date('2026-11-12T00:00:00Z'),
  },
  {
    id: 'def-p10-60plus',
    key: 'p10-longevidad-60-plus',
    cohortKey: 'A5',
    variantKey: 'F',
    nameEs: 'Longevidad Activa · Mujeres (60+)',
    nameEn: 'Active Longevity · Women (60+)',
    subtitleEs: 'Plan modular cohorte 60+',
    subtitleEn: 'Modular plan 60+ cohort',
    descriptionEs: 'Plan modular cohorte 60+.',
    descriptionEn: 'Modular plan 60+ cohort.',
    minAge: 60,
    maxAge: null,
    status: 'published',
    version: 1,
    isActive: true,
    pillars: [],
    phases: [],
    createdAt: new Date('2026-11-12T00:00:00Z'),
    updatedAt: new Date('2026-11-12T00:00:00Z'),
  },
];

type EnrollmentRow = {
  id: string;
  userId: string;
  planDefinitionId: string;
  status: string;
  currentPhase: string;
  safetyCategory: string;
  safetyReasonCodes: string[];
  cohortMatched: boolean;
  startedAt: Date;
  pausedAt: Date | null;
  leftAt: Date | null;
  updatedAt: Date;
  onboarding: Record<string, unknown> | null;
};

const enrollmentsByUser = new Map<string, EnrollmentRow>();
const actionsByEnrollment = new Map<string, Set<string>>();

const usersById: Record<string, { id: string; age: number; sex: 'male' | 'female'; name: string }> = {
  'user-a': { id: 'user-a', age: 54, sex: 'female', name: 'Synthetic User A' },
  'user-b': { id: 'user-b', age: 56, sex: 'male', name: 'Synthetic User B' },
};

jest.mock('../../src/services/session.service', () => ({
  isSessionActive: jest.fn(async (payload: { sid?: string }) =>
    payload.sid === 'sess-a' || payload.sid === 'sess-b'
  ),
}));

jest.mock('../../src/config/database', () => ({
  prisma: {
    user: {
      findUnique: jest.fn(async ({ where }: { where: { id: string } }) => usersById[where.id] ?? null),
      findUniqueOrThrow: jest.fn(async ({ where }: { where: { id: string } }) => {
        const u = usersById[where.id];
        if (!u) throw new Error('User not found');
        return {
          avatarDataUrl: null,
          sex: u.sex,
          age: u.age,
          heightCm: 168,
          weightKg: 65,
          targetWeightKg: null,
          timeframeWeeks: null,
          trainingDaysPerWeek: 3,
          trainingGoal: 'maintain',
          preferredTrainingEnvironment: 'home',
          experienceLevel: 'beginner',
          limitations: [],
          onboardingCompletedAt: null,
          remindersEnabled: false,
          reminderTime: null,
          reminderWorkout: true,
          reminderNutrition: false,
          reminderWeeklyReview: false,
          reminderReactivation: false,
        };
      }),
    },
    healthPlanDefinition: {
      upsert: jest.fn(async () => definitionsFixture[0]),
      findMany: jest.fn(async ({ where }: { where?: { isActive?: boolean } } = {}) =>
        definitionsFixture.filter((d) => (where?.isActive === undefined ? true : d.isActive === where.isActive))
      ),
      findUnique: jest.fn(async ({ where }: { where: { key: string } }) =>
        definitionsFixture.find((d) => d.key === where.key) ?? null
      ),
    },
    healthPlanEnrollment: {
      findFirst: jest.fn(async ({ where }: { where: { userId: string } }) => {
        const row = enrollmentsByUser.get(where.userId);
        if (!row) return null;
        return {
          ...row,
          currentWeek: 1,
          status: row.status ?? 'active',
          actionStatus: [],
          profile: row.onboarding,
          plan: definitionsFixture[0],
        };
      }),
      findUnique: jest.fn(async ({ where }: { where: { userId_planId?: { userId: string } } }) => {
        const uid = where.userId_planId?.userId;
        if (!uid) return null;
        const row = enrollmentsByUser.get(uid);
        return row
          ? {
              ...row,
              currentWeek: 1,
              status: row.status ?? 'active',
              actionStatus: [],
              profile: row.onboarding,
              plan: definitionsFixture[0],
            }
          : null;
      }),
      upsert: jest.fn(async ({ create, update }: { create: Omit<EnrollmentRow, 'id' | 'startedAt' | 'pausedAt' | 'leftAt' | 'updatedAt' | 'onboarding'>; update: Partial<EnrollmentRow> }) => {
        const existing = enrollmentsByUser.get(create.userId);
        if (existing) {
          const updated: EnrollmentRow = { ...existing, ...update, updatedAt: new Date() };
          enrollmentsByUser.set(create.userId, updated);
          return { ...updated, currentWeek: 1, status: updated.status ?? 'active', plan: definitionsFixture[0] };
        }
        const created: EnrollmentRow = {
          id: `enr-${create.userId}`,
          ...create,
          status: 'active',
          startedAt: new Date('2026-11-12T20:00:00Z'),
          pausedAt: null,
          leftAt: null,
          updatedAt: new Date('2026-11-12T20:00:00Z'),
          onboarding: null,
        };
        enrollmentsByUser.set(create.userId, created);
        return { ...created, currentWeek: 1, plan: definitionsFixture[0] };
      }),
      create: jest.fn(async ({ data }: { data: Omit<EnrollmentRow, 'id' | 'startedAt' | 'pausedAt' | 'leftAt' | 'updatedAt' | 'onboarding'> }) => {
        const created: EnrollmentRow = {
          id: `enr-${data.userId}`,
          ...data,
          startedAt: new Date('2026-11-12T20:00:00Z'),
          pausedAt: null,
          leftAt: null,
          updatedAt: new Date('2026-11-12T20:00:00Z'),
          onboarding: null,
        };
        enrollmentsByUser.set(data.userId, created);
        return { ...created, planDefinition: definitionsFixture[0] };
      }),
      update: jest.fn(async ({ where, data }: { where: { id: string }; data: Partial<EnrollmentRow> }) => {
        for (const [uid, row] of enrollmentsByUser.entries()) {
          if (row.id === where.id) {
            const updated: EnrollmentRow = { ...row, ...data, updatedAt: new Date() };
            enrollmentsByUser.set(uid, updated);
            return { ...updated, planDefinition: definitionsFixture[0] };
          }
        }
        throw new Error('Enrollment not found');
      }),
    },
    healthPlanProfile: {
      upsert: jest.fn(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        for (const [uid, row] of enrollmentsByUser.entries()) {
          if (row.id === create.enrollmentId) {
            const next = { ...(row.onboarding ?? create), ...update };
            row.onboarding = next;
            enrollmentsByUser.set(uid, row);
            return next;
          }
        }
        return create;
      }),
    },
    healthPlanOnboarding: {
      upsert: jest.fn(async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        for (const [uid, row] of enrollmentsByUser.entries()) {
          if (row.id === create.enrollmentId) {
            const next = { ...(row.onboarding ?? create), ...update };
            row.onboarding = next;
            enrollmentsByUser.set(uid, row);
            return next;
          }
        }
        return create;
      }),
    },
    healthPlanMilestone: {
      findMany: jest.fn(async () => []),
    },
    healthPlanActionProgress: {
      findMany: jest.fn(async ({ where }: { where: { enrollmentId: string } }) => {
        const set = actionsByEnrollment.get(where.enrollmentId) ?? new Set<string>();
        return [...set].map((actionKey) => ({
          id: `act-${actionKey}`,
          enrollmentId: where.enrollmentId,
          actionKey,
          weekKey: '2026-W46',
          completedAt: new Date('2026-11-12T20:05:00Z'),
        }));
      }),
      upsert: jest.fn(async ({ create }: { create: { enrollmentId: string; actionKey: string; weekKey: string } }) => {
        const set = actionsByEnrollment.get(create.enrollmentId) ?? new Set<string>();
        set.add(create.actionKey);
        actionsByEnrollment.set(create.enrollmentId, set);
        return {
          id: `act-${create.actionKey}`,
          ...create,
          completedAt: new Date('2026-11-12T20:05:00Z'),
        };
      }),
    },
  },
}));

import app from '../../src/app';

describe('Post-M27 Functional QA Suite (isolated synthetic fixtures)', () => {
  const tokenA = generateAccessToken({ userId: 'user-a', email: 'qa-a@synthetic.local', sid: 'sess-a' });
  const tokenB = generateAccessToken({ userId: 'user-b', email: 'qa-b@synthetic.local', sid: 'sess-b' });

  beforeEach(() => {
    enrollmentsByUser.clear();
    actionsByEnrollment.clear();
  });

  describe('1. Modular Health Plan Catalog, Cohorts & Variants', () => {
    it('GET /api/health-plans/definitions returns M27 cohortKey, variantKey, nullable maxAge, and Ruta Vital v1 compat', async () => {
      const resEs = await request(app).get('/api/health-plans/definitions');
      expect(resEs.status).toBe(200);
      expect(Array.isArray(resEs.body)).toBe(true);
      expect(resEs.body).toHaveLength(2);

      const rutaVital = resEs.body.find((d: { key: string }) => d.key === RUTA_VITAL_KEY);
      expect(rutaVital).toMatchObject({
        key: 'ruta-vital-50-60',
        cohortKey: 'RV-50-60',
        variantKey: 'NEUTRAL',
        minAge: 50,
        maxAge: 60,
        name: 'Ruta Vital 50–60',
      });

      const openEnded = resEs.body.find((d: { cohortKey: string }) => d.cohortKey === 'A5');
      expect(openEnded).toMatchObject({
        cohortKey: 'A5',
        variantKey: 'F',
        minAge: 60,
        maxAge: null,
      });

      const resEn = await request(app).get('/api/health-plans/definitions?locale=en');
      expect(resEn.status).toBe(200);
      expect(resEn.body[0].name).toBe('Vital Path 50–60');
    });

    it('validates non-overlapping A1-A5 cohorts, open-ended A5 (60+), and 10 P01-P10 modalities', () => {
      expect(validateAgeBands(AGE_BANDS)).toEqual({ valid: true, errors: [] });
      expect(resolveAgeBand(17)).toBeNull();
      expect(resolveAgeBand(25)?.code).toBe('A1');
      expect(resolveAgeBand(54)?.code).toBe('A4');
      expect(resolveAgeBand(72)?.code).toBe('A5');
      expect(isInCohort(65, 60, null)).toBe(true);
      expect(HEALTH_PLAN_MODALITY_BANDS).toHaveLength(10);
    });
  });

  describe('2. Optional Identity Fields (sexAtBirth & genderIdentity)', () => {
    it('keeps collection disabled until sign-off and validates optional/nullable values without inference', () => {
      expect(SENSITIVE_PROFILE_COLLECTION_ENABLED).toBe(false);
      expect(normalizeSensitiveAttributesInput({ sexAtBirth: null, genderIdentity: '   ' })).toEqual({
        sexAtBirth: null,
        genderIdentity: null,
      });
      expect(normalizeSensitiveAttributesInput({ sexAtBirth: 'prefer_not_say', genderIdentity: 'No binario' })).toEqual({
        sexAtBirth: 'prefer_not_say',
        genderIdentity: 'No binario',
      });
      expect(() => sensitiveAttributesSchema.parse({ sexAtBirth: 'invalid_value' })).toThrow();
      expect(() => sensitiveAttributesSchema.parse({ sexAtBirth: 'female', extraField: true })).toThrow();
      expect(sanitizeLegacyProfileWithoutInference({ sex: 'female', age: 54 })).toEqual({
        sexAtBirth: null,
        genderIdentity: null,
      });
    });

    it('GET /api/profile preserves existing contract without exposing unapproved sensitive identity fields', async () => {
      const res = await request(app)
        .get('/api/profile')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(res.status).toBe(200);
      expect(res.body.sex).toBe('female');
      expect(res.body.age).toBe(54);
      expect(res.body).not.toHaveProperty('sexAtBirth');
      expect(res.body).not.toHaveProperty('genderIdentity');
    });
  });

  describe('3. Auth, Authorization, Enrollment Lifecycle & User Isolation', () => {
    it('rejects unauthenticated requests to protected health-plan and profile endpoints with 401', async () => {
      const checks = await Promise.all([
        request(app).get('/api/health-plans/enrollment'),
        request(app).post('/api/health-plans/enrollment'),
        request(app).get('/api/health-plans/home'),
        request(app).put('/api/health-plans/enrollment/status').send({ status: 'paused' }),
        request(app).get('/api/profile'),
      ]);
      for (const res of checks) {
        expect(res.status).toBe(401);
      }
    });

    it('isolates enrollment, onboarding, and status updates between user-a and user-b', async () => {
      const enrollA = await request(app)
        .post('/api/health-plans/enrollment')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(enrollA.status).toBe(201);
      expect(enrollA.body.userId).toBe('user-a');

      // user-b must NOT see user-a's enrollment
      const getB = await request(app)
        .get('/api/health-plans/enrollment')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(getB.status).toBe(200);
      expect(getB.body).toBeNull();

      // user-a saves onboarding and pauses plan
      const onboardA = await request(app)
        .post('/api/health-plans/onboarding')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          goal: 'strength',
          baselineActivity: 'some',
          availableTime: '30',
          preferences: ['walking'],
          equipment: ['dumbbells'],
          knownLimitations: [],
          safetySignals: [],
        });
      expect(onboardA.status).toBe(200);
      expect(onboardA.body.safetyCategory).toBe('SELF_MANAGED');

      const homeA = await request(app)
        .get('/api/health-plans/home')
        .set('Authorization', `Bearer ${tokenA}`);
      expect(homeA.status).toBe(200);
      expect(homeA.body.enrollment.onboardingComplete).toBe(true);

      const pauseA = await request(app)
        .put('/api/health-plans/enrollment/status')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'paused' });
      expect(pauseA.status).toBe(200);
      expect(pauseA.body.status).toBe('paused');

      // user-b home remains unenrolled
      const homeB = await request(app)
        .get('/api/health-plans/home')
        .set('Authorization', `Bearer ${tokenB}`);
      expect(homeB.status).toBe(200);
      expect(homeB.body).toBeNull();
    });
  });

  describe('4. Input Validation & Error Responses', () => {
    it('returns 400 on invalid onboarding goal or invalid enrollment status', async () => {
      const badOnboarding = await request(app)
        .post('/api/health-plans/onboarding')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          goal: 'invalid_goal',
          baselineActivity: 'some',
          availableTime: '30',
        });
      expect(badOnboarding.status).toBe(400);

      const badStatus = await request(app)
        .put('/api/health-plans/enrollment/status')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({ status: 'deleted' });
      expect(badStatus.status).toBe(400);
    });
  });
});
