export type ProfileSex = 'male' | 'female';

export type GuidanceEvidenceLevel = 'WHO_GLOBAL_GUIDELINE' | 'GENERIC_FITNESS_GUIDANCE';

export type GuidanceAudience = '40_plus_general' | '40_plus_female' | '40_plus_male' | '40_plus_unspecified';

export interface GuidanceEntry {
  readonly id: string;
  readonly scope: 'workout' | 'nutrition';
  readonly audience: GuidanceAudience;
  readonly text: string;
  readonly evidenceLevel: GuidanceEvidenceLevel;
  readonly sourceTitle: string;
  readonly sourceUrl: string | null;
  readonly reviewedAt: string;
}

const WHO_PA_TITLE = 'WHO Guidelines on Physical Activity and Sedentary Behaviour (2020)';
const WHO_PA_URL = 'https://www.who.int/publications/i/item/9789240015128';
const WHO_DIET_TITLE = 'WHO Healthy Diet Fact Sheet';
const WHO_DIET_URL = 'https://www.who.int/news-room/fact-sheets/detail/healthy-diet';
const GENERIC_COACHING_TITLE =
  'Anclora Impulso non-clinical habit & training coaching guide (pending external specialist review)';
const REVIEWED_AT = '2026-11-11';

function isFortyPlus(age?: number | null) {
  return typeof age === 'number' && age >= 40;
}

export const WORKOUT_GUIDANCE_REGISTRY: readonly GuidanceEntry[] = Object.freeze([
  {
    id: 'wk-40-strength-who',
    scope: 'workout',
    audience: '40_plus_general',
    text: 'AJUSTE 40+: incluye actividades de fortalecimiento muscular para los grandes grupos musculares al menos 2 dias por semana.',
    evidenceLevel: 'WHO_GLOBAL_GUIDELINE',
    sourceTitle: WHO_PA_TITLE,
    sourceUrl: WHO_PA_URL,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'wk-40-recovery-generic',
    scope: 'workout',
    audience: '40_plus_general',
    text: 'Incluye movilidad, calentamiento y recuperacion entre bloques, evitando volumen innecesario o fatiga excesiva.',
    evidenceLevel: 'GENERIC_FITNESS_GUIDANCE',
    sourceTitle: GENERIC_COACHING_TITLE,
    sourceUrl: null,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'wk-40-aerobic-who',
    scope: 'workout',
    audience: '40_plus_general',
    text: 'Si anades trabajo aerobico, distribuye la carga semanal hacia 150-300 minutos de intensidad moderada (o equivalente) priorizando continuidad y bajo impacto cuando proceda.',
    evidenceLevel: 'WHO_GLOBAL_GUIDELINE',
    sourceTitle: WHO_PA_TITLE,
    sourceUrl: WHO_PA_URL,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'wk-40-adherence-generic',
    scope: 'workout',
    audience: '40_plus_general',
    text: 'Para objetivos de composicion corporal, prioriza progresion gradual, tecnica y adherencia sostenible.',
    evidenceLevel: 'GENERIC_FITNESS_GUIDANCE',
    sourceTitle: GENERIC_COACHING_TITLE,
    sourceUrl: null,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'wk-40-female-generic',
    scope: 'workout',
    audience: '40_plus_female',
    text: 'Perfil mujer 40+: refuerza fuerza global, estabilidad central, tren inferior y espalda con ejercicios tecnicos, progresivos y sostenibles (orientacion general no clinica).',
    evidenceLevel: 'GENERIC_FITNESS_GUIDANCE',
    sourceTitle: GENERIC_COACHING_TITLE,
    sourceUrl: null,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'wk-40-male-generic',
    scope: 'workout',
    audience: '40_plus_male',
    text: 'Perfil hombre 40+: prioriza fuerza funcional en piernas, espalda, empujes, tracciones y core sobre ejercicios aislados de bajo retorno (orientacion general no clinica).',
    evidenceLevel: 'GENERIC_FITNESS_GUIDANCE',
    sourceTitle: GENERIC_COACHING_TITLE,
    sourceUrl: null,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'wk-40-unspecified-generic',
    scope: 'workout',
    audience: '40_plus_unspecified',
    text: 'Aplica criterios generales 40+: fuerza equilibrada, recuperacion adecuada y movimiento diario sostenible (orientacion general no clinica).',
    evidenceLevel: 'GENERIC_FITNESS_GUIDANCE',
    sourceTitle: GENERIC_COACHING_TITLE,
    sourceUrl: null,
    reviewedAt: REVIEWED_AT,
  },
]);

export const NUTRITION_GUIDANCE_REGISTRY: readonly GuidanceEntry[] = Object.freeze([
  {
    id: 'nu-40-general-generic',
    scope: 'nutrition',
    audience: '40_plus_general',
    text: 'AJUSTE 40+: construye un plan orientado a saciedad, energia estable, conservacion muscular y adherencia realista.',
    evidenceLevel: 'GENERIC_FITNESS_GUIDANCE',
    sourceTitle: GENERIC_COACHING_TITLE,
    sourceUrl: null,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'nu-40-who-foods',
    scope: 'nutrition',
    audience: '40_plus_general',
    text: 'Prioriza alimentos minimamente procesados, verduras y frutas (objetivo general >=400 g o 5 raciones al dia), legumbres, cereales integrales y grasas insaturadas frente a grasas saturadas y azucares libres.',
    evidenceLevel: 'WHO_GLOBAL_GUIDELINE',
    sourceTitle: WHO_DIET_TITLE,
    sourceUrl: WHO_DIET_URL,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'nu-40-protein-generic',
    scope: 'nutrition',
    audience: '40_plus_general',
    text: 'Incluye una fuente clara de proteina repartida en las comidas principales para apoyar la saciedad y el entrenamiento (sin prescripcion clinica individualizada).',
    evidenceLevel: 'GENERIC_FITNESS_GUIDANCE',
    sourceTitle: GENERIC_COACHING_TITLE,
    sourceUrl: null,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'nu-40-deficit-generic',
    scope: 'nutrition',
    audience: '40_plus_general',
    text: 'Evita planteamientos extremos o restricciones agresivas; prioriza sueno, hidratacion y facilidad de preparacion.',
    evidenceLevel: 'GENERIC_FITNESS_GUIDANCE',
    sourceTitle: GENERIC_COACHING_TITLE,
    sourceUrl: null,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'nu-40-fatloss-generic',
    scope: 'nutrition',
    audience: '40_plus_general',
    text: 'Si el objetivo declarado es reducir peso, prioriza cambios sostenibles que respeten la energia diaria y la recuperacion.',
    evidenceLevel: 'GENERIC_FITNESS_GUIDANCE',
    sourceTitle: GENERIC_COACHING_TITLE,
    sourceUrl: null,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'nu-40-trainingdays-generic',
    scope: 'nutrition',
    audience: '40_plus_general',
    text: 'Acompana los dias de mayor carga de entrenamiento con comidas completas y buena recuperacion.',
    evidenceLevel: 'GENERIC_FITNESS_GUIDANCE',
    sourceTitle: GENERIC_COACHING_TITLE,
    sourceUrl: null,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'nu-40-female-generic',
    scope: 'nutrition',
    audience: '40_plus_female',
    text: 'Perfil mujer 40+: prioriza densidad nutricional, saciedad, aporte regular de proteina y comidas sostenibles evitando restricciones severas (orientacion general no clinica).',
    evidenceLevel: 'GENERIC_FITNESS_GUIDANCE',
    sourceTitle: GENERIC_COACHING_TITLE,
    sourceUrl: null,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'nu-40-male-who',
    scope: 'nutrition',
    audience: '40_plus_male',
    text: 'Perfil hombre 40+: prioriza saciedad, comidas completas y moderacion de ultraprocesados, azucares libres y alcohol (orientacion general no clinica).',
    evidenceLevel: 'WHO_GLOBAL_GUIDELINE',
    sourceTitle: WHO_DIET_TITLE,
    sourceUrl: WHO_DIET_URL,
    reviewedAt: REVIEWED_AT,
  },
  {
    id: 'nu-40-unspecified-generic',
    scope: 'nutrition',
    audience: '40_plus_unspecified',
    text: 'Aplica criterios generales 40+: comidas completas, saciedad, hidratacion y recuperacion sostenible (orientacion general no clinica).',
    evidenceLevel: 'GENERIC_FITNESS_GUIDANCE',
    sourceTitle: GENERIC_COACHING_TITLE,
    sourceUrl: null,
    reviewedAt: REVIEWED_AT,
  },
]);

function audienceForSex(sex?: ProfileSex | null): GuidanceAudience {
  if (sex === 'female') return '40_plus_female';
  if (sex === 'male') return '40_plus_male';
  return '40_plus_unspecified';
}

export function getWorkoutGuidanceEntries(age?: number | null, sex?: ProfileSex | null): GuidanceEntry[] {
  if (!isFortyPlus(age)) {
    return [];
  }
  const audience = audienceForSex(sex);
  return WORKOUT_GUIDANCE_REGISTRY.filter(
    (entry) => entry.audience === '40_plus_general' || entry.audience === audience,
  );
}

export function buildWorkoutPersonalizationGuidance(age?: number | null, sex?: ProfileSex | null) {
  return getWorkoutGuidanceEntries(age, sex)
    .map((entry) => `- ${entry.text}`)
    .join('\n');
}

export function getNutritionGuidanceEntries(input: {
  age?: number | null;
  sex?: ProfileSex | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  trainingDaysPerWeek?: number | null;
}): GuidanceEntry[] {
  if (!isFortyPlus(input.age)) {
    return [];
  }

  const isFatLossGoal =
    typeof input.weightKg === 'number' &&
    typeof input.targetWeightKg === 'number' &&
    input.targetWeightKg < input.weightKg;
  const highTrainingFrequency = (input.trainingDaysPerWeek ?? 0) >= 4;
  const audience = audienceForSex(input.sex);

  return NUTRITION_GUIDANCE_REGISTRY.filter((entry) => {
    if (entry.id === 'nu-40-fatloss-generic' && !isFatLossGoal) return false;
    if (entry.id === 'nu-40-trainingdays-generic' && !highTrainingFrequency) return false;
    return entry.audience === '40_plus_general' || entry.audience === audience;
  });
}

export function buildNutritionPersonalizationGuidance(input: {
  age?: number | null;
  sex?: ProfileSex | null;
  weightKg?: number | null;
  targetWeightKg?: number | null;
  trainingDaysPerWeek?: number | null;
}) {
  return getNutritionGuidanceEntries(input)
    .map((entry) => `- ${entry.text}`)
    .join('\n');
}
