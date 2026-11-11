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

export type AgeBandCode = 'A1' | 'A2' | 'A3' | 'A4' | 'A5';

export interface AgeBand {
  code: AgeBandCode;
  ageMin: number;
  ageMax: number | null;
  labelEs: string;
  labelEn: string;
}

export const AGE_BANDS: readonly AgeBand[] = [
  { code: 'A1', ageMin: 18, ageMax: 29, labelEs: '18–29 años', labelEn: 'Ages 18–29' },
  { code: 'A2', ageMin: 30, ageMax: 39, labelEs: '30–39 años', labelEn: 'Ages 30–39' },
  { code: 'A3', ageMin: 40, ageMax: 49, labelEs: '40–49 años', labelEn: 'Ages 40–49' },
  { code: 'A4', ageMin: 50, ageMax: 59, labelEs: '50–59 años', labelEn: 'Ages 50–59' },
  { code: 'A5', ageMin: 60, ageMax: null, labelEs: '60+ años', labelEn: 'Ages 60+' },
] as const;

export function resolveAgeBand(age: number | null | undefined): AgeBand | null {
  if (typeof age !== 'number' || !Number.isInteger(age) || age < 18) return null;
  return AGE_BANDS.find((band) => isInCohort(age, band.ageMin, band.ageMax)) ?? null;
}

export function validateAgeBands(
  bands: readonly AgeBand[] = AGE_BANDS,
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
      const aMax = a.ageMax ?? Number.POSITIVE_INFINITY;
      const bMax = b.ageMax ?? Number.POSITIVE_INFINITY;
      if (a.ageMin <= bMax && b.ageMin <= aMax) {
        errors.push(`Overlap detected between ${a.code} and ${b.code}`);
      }
    }
  }
  return { valid: errors.length === 0, errors };
}

export type ModalityCode = 'P01' | 'P02' | 'P03' | 'P04' | 'P05' | 'P06' | 'P07' | 'P08' | 'P09' | 'P10';
export type ModalityVariant = 'M' | 'F';
export type VariantPreference = ModalityVariant | 'NEUTRAL' | 'prefer_not_say' | 'male' | 'female' | null | undefined;

export interface HealthPlanModalityBand {
  code: ModalityCode;
  bandCode?: AgeBandCode;
  slug?: string;
  variant: ModalityVariant;
  ageMin: number;
  ageMax: number | null;
  nameEs: string;
  nameEn: string;
}

export const HEALTH_PLAN_MODALITY_BANDS: readonly HealthPlanModalityBand[] = [
  { code: 'P01', bandCode: 'A1', slug: 'p01-arranque-fuerza-m', variant: 'M', ageMin: 18, ageMax: 29, nameEs: 'Arranque Fuerza · Hombres (18–29)', nameEn: 'Strength Start · Men (18–29)' },
  { code: 'P02', bandCode: 'A1', slug: 'p02-arranque-fuerza-f', variant: 'F', ageMin: 18, ageMax: 29, nameEs: 'Arranque Fuerza · Mujeres (18–29)', nameEn: 'Strength Start · Women (18–29)' },
  { code: 'P03', bandCode: 'A2', slug: 'p03-motor-30-m', variant: 'M', ageMin: 30, ageMax: 39, nameEs: 'Motor 30 · Hombres (30–39)', nameEn: 'Engine 30 · Men (30–39)' },
  { code: 'P04', bandCode: 'A2', slug: 'p04-motor-30-f', variant: 'F', ageMin: 30, ageMax: 39, nameEs: 'Motor 30 · Mujeres (30–39)', nameEn: 'Engine 30 · Women (30–39)' },
  { code: 'P05', bandCode: 'A3', slug: 'p05-equilibrio-40-m', variant: 'M', ageMin: 40, ageMax: 49, nameEs: 'Equilibrio 40 · Hombres (40–49)', nameEn: 'Balance 40 · Men (40–49)' },
  { code: 'P06', bandCode: 'A3', slug: 'p06-equilibrio-40-f', variant: 'F', ageMin: 40, ageMax: 49, nameEs: 'Equilibrio 40 · Mujeres (40–49)', nameEn: 'Balance 40 · Women (40–49)' },
  { code: 'P07', bandCode: 'A4', slug: 'p07-vital-50-m', variant: 'M', ageMin: 50, ageMax: 59, nameEs: 'Vital 50 · Hombres (50–59)', nameEn: 'Vital 50 · Men (50–59)' },
  { code: 'P08', bandCode: 'A4', slug: 'p08-vital-50-f', variant: 'F', ageMin: 50, ageMax: 59, nameEs: 'Vital 50 · Mujeres (50–59)', nameEn: 'Vital 50 · Women (50–59)' },
  { code: 'P09', bandCode: 'A5', slug: 'p09-longevidad-60-plus-m', variant: 'M', ageMin: 60, ageMax: null, nameEs: 'Longevidad 60+ · Hombres', nameEn: 'Longevity 60+ · Men' },
  { code: 'P10', bandCode: 'A5', slug: 'p10-longevidad-60-plus-f', variant: 'F', ageMin: 60, ageMax: null, nameEs: 'Longevidad 60+ · Mujeres', nameEn: 'Longevity 60+ · Women' },
] as const;

export function normalizeVariantPreference(preference: VariantPreference): ModalityVariant | null {
  if (preference === 'M' || preference === 'male') return 'M';
  if (preference === 'F' || preference === 'female') return 'F';
  return null;
}

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

export interface ModalitySuggestionResult {
  eligible: boolean;
  reason: 'ELIGIBLE' | 'UNDER_18' | 'AGE_REQUIRED' | 'INVALID_AGE';
  ageBand: AgeBand | null;
  suggestionMode: 'NEUTRAL_OPTIONS' | 'EXPLICIT_VARIANT' | 'NONE';
  autoEnroll: false;
  suggestedModalities: HealthPlanModalityBand[];
}

export function suggestModalitiesForProfile(input: {
  age: number | null | undefined;
  variantPreference?: VariantPreference;
}): ModalitySuggestionResult {
  if (input.age === null || input.age === undefined) {
    return {
      eligible: false,
      reason: 'AGE_REQUIRED',
      ageBand: null,
      suggestionMode: 'NONE',
      autoEnroll: false,
      suggestedModalities: [],
    };
  }
  if (typeof input.age !== 'number' || !Number.isInteger(input.age) || input.age < 0) {
    return {
      eligible: false,
      reason: 'INVALID_AGE',
      ageBand: null,
      suggestionMode: 'NONE',
      autoEnroll: false,
      suggestedModalities: [],
    };
  }
  if (input.age < 18) {
    return {
      eligible: false,
      reason: 'UNDER_18',
      ageBand: null,
      suggestionMode: 'NONE',
      autoEnroll: false,
      suggestedModalities: [],
    };
  }

  const ageBand = resolveAgeBand(input.age);
  if (!ageBand) {
    return {
      eligible: false,
      reason: 'INVALID_AGE',
      ageBand: null,
      suggestionMode: 'NONE',
      autoEnroll: false,
      suggestedModalities: [],
    };
  }

  const normalizedVariant = normalizeVariantPreference(input.variantPreference);
  const suggestedModalities = getEligibleModalitiesForAge(input.age, normalizedVariant ?? undefined);

  return {
    eligible: true,
    reason: 'ELIGIBLE',
    ageBand,
    suggestionMode: normalizedVariant ? 'EXPLICIT_VARIANT' : 'NEUTRAL_OPTIONS',
    autoEnroll: false,
    suggestedModalities,
  };
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
