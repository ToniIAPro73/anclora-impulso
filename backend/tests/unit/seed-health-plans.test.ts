import {
  HealthPlanSeedPrismaClient,
  MODULAR_HEALTH_PLAN_CATALOG,
  seedHealthPlanCatalog,
} from '../../prisma/seed-health-plans';

interface MockUpsertCallArgs<TWhere = Record<string, unknown>> {
  where: TWhere;
  update: Record<string, unknown>;
  create: Record<string, unknown>;
}

describe('modular health plans seed (TASK-019)', () => {
  it('defines 10 draft modalities P01-P10 matching approved age bands without clinical claims', () => {
    expect(MODULAR_HEALTH_PLAN_CATALOG).toHaveLength(10);
    expect(MODULAR_HEALTH_PLAN_CATALOG.map((item) => item.cohortKey)).toEqual([
      'P01',
      'P02',
      'P03',
      'P04',
      'P05',
      'P06',
      'P07',
      'P08',
      'P09',
      'P10',
    ]);
    for (const item of MODULAR_HEALTH_PLAN_CATALOG) {
      expect(item.status).toBe('draft');
      expect(item.version).toBe(1);
      expect(item.descriptionEs).not.toMatch(/diagn[oó]stic|cl[ií]nic|prescripci|terap[eé]utic/i);
      expect(item.descriptionEn).not.toMatch(/diagnos|prescrib|therapeut|medical clearance/i);
    }
    expect(MODULAR_HEALTH_PLAN_CATALOG[8].maxAge).toBeNull();
    expect(MODULAR_HEALTH_PLAN_CATALOG[9].maxAge).toBeNull();
  });

  it('upserts idempotently across repeated executions without altering existing Ruta Vital rows', async () => {
    const definitions = new Map<string, Record<string, unknown>>([
      [
        'ruta-vital-50-60',
        {
          id: 'rv-existing-id',
          key: 'ruta-vital-50-60',
          cohortKey: 'RV-50-60',
          variantKey: 'NEUTRAL',
          minAge: 50,
          maxAge: 60,
          status: 'published',
          version: 1,
        },
      ],
    ]);
    const enrollments = [{ id: 'enr-1', userId: 'user-1', planId: 'rv-existing-id', status: 'active' }];
    const pillars = new Map<string, Record<string, unknown>>();
    const contentRefs = new Map<string, Record<string, unknown>>();

    const mockPrisma = {
      healthPlanDefinition: {
        upsert: jest.fn(async ({ where, update, create }: MockUpsertCallArgs<{ key: string }>) => {
          const existing = definitions.get(where.key);
          const next = existing ? { ...existing, ...update } : { ...create };
          definitions.set(where.key, next);
          return next as { id: string; key: string; cohortKey: string | null; status: string };
        }),
      },
      healthPlanPillar: {
        upsert: jest.fn(async ({
          where,
          update,
          create,
        }: MockUpsertCallArgs<{ planId_key: { planId: string; key: string } }>) => {
          const composite = `${where.planId_key.planId}:${where.planId_key.key}`;
          const existing = pillars.get(composite);
          const next = existing ? { ...existing, ...update } : { ...create };
          pillars.set(composite, next);
          return next;
        }),
      },
      healthPlanContentReference: {
        upsert: jest.fn(async ({
          where,
          update,
          create,
        }: MockUpsertCallArgs<{ planId_key_locale: { planId: string; key: string; locale: string } }>) => {
          const composite = `${where.planId_key_locale.planId}:${where.planId_key_locale.key}:${where.planId_key_locale.locale}`;
          const existing = contentRefs.get(composite);
          const next = existing ? { ...existing, ...update } : { ...create };
          contentRefs.set(composite, next);
          return next;
        }),
      },
    };

    const firstRun = await seedHealthPlanCatalog(mockPrisma as unknown as HealthPlanSeedPrismaClient);
    expect(firstRun).toHaveLength(10);
    expect(definitions.size).toBe(11);
    expect(pillars.size).toBe(60);
    expect(contentRefs.size).toBe(20);

    const idsAfterFirstRun = firstRun.map((d) => d.id);

    const secondRun = await seedHealthPlanCatalog(mockPrisma as unknown as HealthPlanSeedPrismaClient);
    expect(secondRun).toHaveLength(10);
    expect(definitions.size).toBe(11);
    expect(pillars.size).toBe(60);
    expect(contentRefs.size).toBe(20);
    expect(secondRun.map((d) => d.id)).toEqual(idsAfterFirstRun);

    for (const def of secondRun) {
      expect(def.status).toBe('draft');
    }

    for (const ref of contentRefs.values()) {
      expect(ref.evidenceLevel).toBe('PENDING_PROFESSIONAL_REVIEW');
    }

    expect(definitions.get('ruta-vital-50-60')).toMatchObject({
      id: 'rv-existing-id',
      cohortKey: 'RV-50-60',
      minAge: 50,
      maxAge: 60,
      status: 'published',
    });
    expect(enrollments).toEqual([
      { id: 'enr-1', userId: 'user-1', planId: 'rv-existing-id', status: 'active' },
    ]);
  });
});
