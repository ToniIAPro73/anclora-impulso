export const RUTA_VITAL_KEY = 'ruta-vital-50-60';

export const HEALTH_PLAN_PILLARS = [
  { key: 'FORCE', nameEs: 'Fuerza', nameEn: 'Strength' },
  { key: 'MOVEMENT', nameEs: 'Movimiento', nameEn: 'Movement' },
  { key: 'NUTRITION', nameEs: 'Nutrición', nameEn: 'Nutrition' },
  { key: 'RECOVERY', nameEs: 'Sueño y recuperación', nameEn: 'Sleep and recovery' },
  { key: 'CONTINUITY', nameEs: 'Continuidad', nameEn: 'Continuity' },
  { key: 'CAPACITY', nameEs: 'Capacidad funcional', nameEn: 'Functional capacity' },
] as const;

export const HEALTH_PLAN_PHASES = [
  { key: 'FOUNDATION', nameEs: 'Fundamentos', nameEn: 'Foundation', durationLabel: 'Semanas 1–4' },
  { key: 'CAPACITY_BUILDING', nameEs: 'Construcción de capacidad', nameEn: 'Capacity building', durationLabel: 'Semanas 5–12' },
  { key: 'CONSOLIDATION', nameEs: 'Consolidación', nameEn: 'Consolidation', durationLabel: 'Meses 4–6' },
  { key: 'MAINTENANCE', nameEs: 'Mantenimiento', nameEn: 'Maintenance', durationLabel: 'Continuo' },
] as const;

export const SAFETY_CATEGORIES = ['SELF_MANAGED', 'CAUTION', 'PROFESSIONAL_REVIEW_RECOMMENDED'] as const;
export type SafetyCategory = (typeof SAFETY_CATEGORIES)[number];

const PROFESSIONAL_REVIEW_SIGNALS = new Set([
  'chest_pain',
  'syncope',
  'disproportionate_dyspnea',
  'important_palpitations',
  'known_cardiovascular_disease',
  'severe_uncontrolled_hypertension',
  'complex_diabetes',
  'significant_renal_disease',
  'recent_injury',
  'osteoporosis_or_fracture',
  'severe_joint_limitation',
  'neurological_symptoms',
]);

export function classifySafety(signals: string[]): {
  category: SafetyCategory;
  reasonCodes: string[];
} {
  const reasonCodes = [...new Set(signals.filter((signal) => PROFESSIONAL_REVIEW_SIGNALS.has(signal)))];
  return {
    category: reasonCodes.length > 0 ? 'PROFESSIONAL_REVIEW_RECOMMENDED' : 'SELF_MANAGED',
    reasonCodes,
  };
}

export function isInCohort(age: number | null | undefined, minAge = 50, maxAge: number | null = 60): boolean {
  if (typeof age !== 'number' || !Number.isInteger(age)) return false;
  if (age < minAge) return false;
  return maxAge === null ? true : age <= maxAge;
}

export type ModalityVariant = 'M' | 'F';

export interface HealthPlanModalityBand {
  code: 'P01' | 'P02' | 'P03' | 'P04' | 'P05' | 'P06' | 'P07' | 'P08' | 'P09' | 'P10';
  variant: ModalityVariant;
  ageMin: number;
  ageMax: number | null;
  nameEs: string;
  nameEn: string;
}

export const HEALTH_PLAN_MODALITY_BANDS: readonly HealthPlanModalityBand[] = [
  { code: 'P01', variant: 'M', ageMin: 18, ageMax: 29, nameEs: 'Arranque Fuerza · Hombres (18–29)', nameEn: 'Strength Start · Men (18–29)' },
  { code: 'P02', variant: 'F', ageMin: 18, ageMax: 29, nameEs: 'Arranque Fuerza · Mujeres (18–29)', nameEn: 'Strength Start · Women (18–29)' },
  { code: 'P03', variant: 'M', ageMin: 30, ageMax: 39, nameEs: 'Motor 30 · Hombres (30–39)', nameEn: 'Engine 30 · Men (30–39)' },
  { code: 'P04', variant: 'F', ageMin: 30, ageMax: 39, nameEs: 'Motor 30 · Mujeres (30–39)', nameEn: 'Engine 30 · Women (30–39)' },
  { code: 'P05', variant: 'M', ageMin: 40, ageMax: 49, nameEs: 'Equilibrio 40 · Hombres (40–49)', nameEn: 'Balance 40 · Men (40–49)' },
  { code: 'P06', variant: 'F', ageMin: 40, ageMax: 49, nameEs: 'Equilibrio 40 · Mujeres (40–49)', nameEn: 'Balance 40 · Women (40–49)' },
  { code: 'P07', variant: 'M', ageMin: 50, ageMax: 59, nameEs: 'Ruta Vital · Hombres (50–59)', nameEn: 'Vital Path · Men (50–59)' },
  { code: 'P08', variant: 'F', ageMin: 50, ageMax: 59, nameEs: 'Ruta Vital · Mujeres (50–59)', nameEn: 'Vital Path · Women (50–59)' },
  { code: 'P09', variant: 'M', ageMin: 60, ageMax: null, nameEs: 'Longevidad 60+ · Hombres', nameEn: 'Longevity 60+ · Men' },
  { code: 'P10', variant: 'F', ageMin: 60, ageMax: null, nameEs: 'Longevidad 60+ · Mujeres', nameEn: 'Longevity 60+ · Women' },
] as const;

export function getEligibleModalitiesForAge(
  age: number | null | undefined,
  variant?: ModalityVariant,
): HealthPlanModalityBand[] {
  if (typeof age !== 'number' || !Number.isInteger(age) || age < 18) return [];
  return HEALTH_PLAN_MODALITY_BANDS.filter(
    (band) =>
      isInCohort(age, band.ageMin, band.ageMax) &&
      (variant === undefined || band.variant === variant),
  );
}

export function validateNonOverlappingBands(
  bands: readonly HealthPlanModalityBand[] = HEALTH_PLAN_MODALITY_BANDS,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const band of bands) {
    if (!Number.isInteger(band.ageMin) || band.ageMin < 18) {
      errors.push(`${band.code}: ageMin must be an integer >= 18`);
    }
    if (band.ageMax !== null && (!Number.isInteger(band.ageMax) || band.ageMax < band.ageMin)) {
      errors.push(`${band.code}: ageMax must be null or an integer >= ageMin`);
    }
  }
  for (let i = 0; i < bands.length; i += 1) {
    for (let j = i + 1; j < bands.length; j += 1) {
      const a = bands[i];
      const b = bands[j];
      if (a.variant !== b.variant) continue;
      const aMax = a.ageMax ?? Number.POSITIVE_INFINITY;
      const bMax = b.ageMax ?? Number.POSITIVE_INFINITY;
      if (a.ageMin <= bMax && b.ageMin <= aMax) {
        errors.push(`Overlap detected between ${a.code} and ${b.code}`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export function getPhaseForWeek(weekNumber: number) {
  if (weekNumber <= 4) return HEALTH_PLAN_PHASES[0];
  if (weekNumber <= 12) return HEALTH_PLAN_PHASES[1];
  if (weekNumber <= 24) return HEALTH_PLAN_PHASES[2];
  return HEALTH_PLAN_PHASES[3];
}

export function getAdaptation(input: { missedWeek?: boolean; poorRecovery?: boolean; completedEarly?: boolean }): 'REDUCE' | 'MAINTAIN' | 'PROGRESS' {
  if (input.missedWeek || input.poorRecovery) return 'REDUCE';
  if (input.completedEarly) return 'PROGRESS';
  return 'MAINTAIN';
}
