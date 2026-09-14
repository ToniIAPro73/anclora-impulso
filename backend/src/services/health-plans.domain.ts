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

export function isInCohort(age: number | null | undefined, minAge = 50, maxAge = 60): boolean {
  return age == null || (Number.isInteger(age) && age >= minAge && age <= maxAge);
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
