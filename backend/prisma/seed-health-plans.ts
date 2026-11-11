import { randomUUID } from 'crypto';
import { PrismaClient } from '@prisma/client';
import {
  HEALTH_PLAN_MODALITY_BANDS,
  HEALTH_PLAN_PILLARS,
  ModalityCode,
  ModalityVariant,
} from '../src/services/health-plans.domain';

export interface SeedHealthPlanDefinitionItem {
  key: string;
  cohortKey: ModalityCode;
  variantKey: ModalityVariant;
  nameEs: string;
  nameEn: string;
  descriptionEs: string;
  descriptionEn: string;
  minAge: number;
  maxAge: number | null;
  status: 'draft';
  version: 1;
}

const MODALITY_DESCRIPTIONS: Record<ModalityCode, { es: string; en: string }> = {
  P01: {
    es: 'Borrador de orientación general de fuerza progresiva, hábitos y continuidad para adultos de 18 a 29 años (pendiente de revisión profesional).',
    en: 'General orientation draft for progressive strength, habits and consistency for adults aged 18–29 (pending professional review).',
  },
  P02: {
    es: 'Borrador de orientación general de fuerza, movilidad y hábitos sostenibles para mujeres de 18 a 29 años (pendiente de revisión profesional).',
    en: 'General orientation draft for strength, mobility and sustainable habits for women aged 18–29 (pending professional review).',
  },
  P03: {
    es: 'Borrador de orientación general para energía diaria, fuerza funcional y continuidad en adultos de 30 a 39 años (pendiente de revisión profesional).',
    en: 'General orientation draft for daily energy, functional strength and consistency for adults aged 30–39 (pending professional review).',
  },
  P04: {
    es: 'Borrador de orientación general de fuerza equilibrada, descanso y hábitos para mujeres de 30 a 39 años (pendiente de revisión profesional).',
    en: 'General orientation draft for balanced strength, rest and habits for women aged 30–39 (pending professional review).',
  },
  P05: {
    es: 'Borrador de orientación general de fuerza sostenible, movilidad y recuperación para hombres de 40 a 49 años (pendiente de revisión profesional).',
    en: 'General orientation draft for sustainable strength, mobility and recovery for men aged 40–49 (pending professional review).',
  },
  P06: {
    es: 'Borrador de orientación general de fuerza equilibrada, descanso y bienestar diario para mujeres de 40 a 49 años (pendiente de revisión profesional).',
    en: 'General orientation draft for balanced strength, rest and daily wellbeing for women aged 40–49 (pending professional review).',
  },
  P07: {
    es: 'Borrador de orientación general de capacidad funcional, fuerza y constancia para hombres de 50 a 59 años (pendiente de revisión profesional).',
    en: 'General orientation draft for functional capacity, strength and consistency for men aged 50–59 (pending professional review).',
  },
  P08: {
    es: 'Borrador de orientación general de fuerza funcional, movilidad y descanso para mujeres de 50 a 59 años (pendiente de revisión profesional).',
    en: 'General orientation draft for functional strength, mobility and rest for women aged 50–59 (pending professional review).',
  },
  P09: {
    es: 'Borrador de orientación general de autonomía funcional, fuerza segura y continuidad para hombres de 60 años o más (pendiente de revisión profesional).',
    en: 'General orientation draft for functional autonomy, safe strength and consistency for men aged 60+ (pending professional review).',
  },
  P10: {
    es: 'Borrador de orientación general de autonomía funcional, estabilidad y hábitos saludables para mujeres de 60 años o más (pendiente de revisión profesional).',
    en: 'General orientation draft for functional autonomy, stability and healthy habits for women aged 60+ (pending professional review).',
  },
};

export const MODULAR_HEALTH_PLAN_CATALOG: readonly SeedHealthPlanDefinitionItem[] =
  HEALTH_PLAN_MODALITY_BANDS.map((band) => ({
    key: band.slug ?? band.code.toLowerCase(),
    cohortKey: band.code,
    variantKey: band.variant,
    nameEs: band.nameEs,
    nameEn: band.nameEn,
    descriptionEs: MODALITY_DESCRIPTIONS[band.code].es,
    descriptionEn: MODALITY_DESCRIPTIONS[band.code].en,
    minAge: band.ageMin,
    maxAge: band.ageMax,
    status: 'draft',
    version: 1,
  }));

export type HealthPlanSeedPrismaClient = Pick<
  PrismaClient,
  'healthPlanDefinition' | 'healthPlanPillar' | 'healthPlanContentReference'
>;

export async function seedHealthPlanCatalog(prisma: HealthPlanSeedPrismaClient) {
  const seeded: Array<{ id: string; key: string; cohortKey: string | null; status: string }> = [];

  for (const item of MODULAR_HEALTH_PLAN_CATALOG) {
    const definition = await prisma.healthPlanDefinition.upsert({
      where: { key: item.key },
      update: {
        cohortKey: item.cohortKey,
        variantKey: item.variantKey,
        nameEs: item.nameEs,
        nameEn: item.nameEn,
        descriptionEs: item.descriptionEs,
        descriptionEn: item.descriptionEn,
        minAge: item.minAge,
        maxAge: item.maxAge,
        status: 'draft',
        version: item.version,
      },
      create: {
        id: randomUUID(),
        key: item.key,
        cohortKey: item.cohortKey,
        variantKey: item.variantKey,
        nameEs: item.nameEs,
        nameEn: item.nameEn,
        descriptionEs: item.descriptionEs,
        descriptionEn: item.descriptionEn,
        minAge: item.minAge,
        maxAge: item.maxAge,
        status: 'draft',
        version: item.version,
      },
    });

    for (const [index, pillar] of HEALTH_PLAN_PILLARS.entries()) {
      await prisma.healthPlanPillar.upsert({
        where: { planId_key: { planId: definition.id, key: pillar.key } },
        update: { nameEs: pillar.nameEs, nameEn: pillar.nameEn, order: index },
        create: {
          id: randomUUID(),
          planId: definition.id,
          key: pillar.key,
          nameEs: pillar.nameEs,
          nameEn: pillar.nameEn,
          order: index,
        },
      });
    }

    for (const locale of ['es', 'en'] as const) {
      await prisma.healthPlanContentReference.upsert({
        where: {
          planId_key_locale: {
            planId: definition.id,
            key: 'catalog-scope-notice',
            locale,
          },
        },
        update: {
          evidenceLevel: 'PENDING_PROFESSIONAL_REVIEW',
          claimType: 'BEHAVIORAL_GUIDANCE',
          safetyLevel: 'LOW',
          contentOwner: 'Anclora Product',
        },
        create: {
          id: randomUUID(),
          planId: definition.id,
          key: 'catalog-scope-notice',
          locale,
          title:
            locale === 'es'
              ? 'Orientación general en borrador'
              : 'General orientation draft',
          body:
            locale === 'es'
              ? 'Esta modalidad es una configuración general de hábitos en estado borrador. No constituye recomendación médica ni clínica.'
              : 'This modality is a general habit configuration in draft state. It does not constitute medical or clinical guidance.',
          source:
            'Anclora Impulso Phase 2 modular catalog; general orientation only, clinical validation pending (TASK-004).',
          evidenceLevel: 'PENDING_PROFESSIONAL_REVIEW',
          claimType: 'BEHAVIORAL_GUIDANCE',
          safetyLevel: 'LOW',
          contentOwner: 'Anclora Product',
          lastReviewedAt: new Date(),
        },
      });
    }

    seeded.push(definition);
  }

  return seeded;
}

async function main() {
  const prisma = new PrismaClient();
  try {
    const definitions = await seedHealthPlanCatalog(prisma);
    console.log(`Seeded ${definitions.length} draft health plan modalities cleanly.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
